//import colors from 'kleur';

import nacl from 'tweetnacl';
import naclutil from 'tweetnacl-util';
nacl.util = naclutil;

import send from './send.js';
import receive from './receive.js';

import WritableStore from '../../stores/lib/helperStores/writableStore.js';
import logger from '../../utils/logger/logger.js';

import { EventEmitter, listify, hexToBuffer, bufferToHex } from '../../utils/index.js';

import RpcClient from '../rpc/client.js';
import RPCTarget from '../rpc/RPCTarget.js';

import { newKeypair, acceptKeypair } from '../../utils/crypto/index.js';

import ProtocolState from './protocolState';
import ConnectionState from './connectionState';

const ADJUST_UNDEFINED_CONNECTION_STATUS_DELAY = 700; // was 700 for a long time, was ok, maybe a bit long, before that 300

const DECOMMISSION_INACTIVITY = 120000; // 2min
//const DECOMMISSION_INACTIVITY = 10000; // 2min

class Connector extends EventEmitter {
  constructor({
    endpoint,
    protocol,
    keypair = newKeypair(),
    rpcRequestTimeout,
    verbose = false,
    tag,
    log = console.log,
    decommissionable = false,
    dummy
  } = {}) {
    super();

    this.protocol = protocol;
    this.log = log;

    const { privateKey: clientPrivateKey, publicKey: clientPublicKey } = acceptKeypair(keypair);

    this.clientPrivateKey = clientPrivateKey;
    this.clientPublicKey = clientPublicKey;
    this.clientPublicKeyHex = bufferToHex(clientPublicKey);

    this.rpcClient = new RpcClient(this, rpcRequestTimeout);

    this.endpoint = endpoint;
    this.verbose = verbose;
    this.tag = tag;

    this.decommissionable = decommissionable;

    this.sentCount = 0;
    this.receivedCount = 0;

    this.successfulConnectsCount = 0;

    if (!dummy) {
      // remove this check once legacyLib with old MCS is removed
      // we call connect from legacyLib with dummy == true and this doesn't get invoked
      // it messes with MCS state in some weird ways, no idea why even
      // new MCS doesn't have these problems
      this.state = new ProtocolState(this);
      this.connectionState = new ConnectionState(this);
    }

    this.connected = new WritableStore();

    this.delayedAdjustConnectionStatus();

    if (verbose) {
      logger.green(this.log, `Connector ${this.endpoint} created`);
    }

    this.decommissionCheckCounter = 0;

    // not actually true but for what we need it's great ...
    // this will make sure that we correctly decommission connectors that never even connected for the first time
    this.lastPongReceivedAt = Date.now();

    this.on('pong', () => {
      this.lastPongReceivedAt = Date.now();
    });
  }

  delayedAdjustConnectionStatus() {
    // 💡 connected == undefined ==> while trying to connect
    // 💡 connected == false => while disconnected
    // 💡 connected == true => while connected
    // for better GUI
    setTimeout(() => {
      if (this.connected.get() == undefined) {
        this.connected.set(false);
      }
    }, ADJUST_UNDEFINED_CONNECTION_STATUS_DELAY);
  }

  send(data) {
    send({ data, connector: this });
    this.sentCount += 1;
  }

  signal(signal, data) {
    if (this.connected.get()) {
      this.send({ signal, data });
    } else {
      logger.write(
        this.log,
        'Warning: trying to send signal over disconnected connector, this should be prevented by GUI'
      );
    }
  }

  // pre-check for edge cases
  on(eventName, handler) {
    if (eventName == 'ready') {
      // latecomer !! for example via connectorPool.getConnector
      // connector might be ready or not ..
      // with earlier approach we might have missed on ready event because we are attaching handler like this:
      //
      // connectorPool.getConnector({ endpoint, host: address, port, deviceTag }).then(connector => {
      //   connector.on('ready', () => {
      //     onReconnect({ connector, slotName, program, selectorPredicate });
      //   });
      // ...

      if (this.isReady()) {
        // connector already ready at time of attaching on ready event,
        // we have missed the event, now simulate the event so that
        // calling code handler is executed and client is aware of correct status
        handler(); // we call on('ready', () => { ... }) handler manually for attached code that missed the event
      }
    }

    // attach real handler
    super.on(eventName, handler);
  }

  // just used in connectome examples for now, no real use in api
  getSharedSecret() {
    return this.sharedSecret ? bufferToHex(this.sharedSecret) : undefined;
  }

  wireReceive({ jsonData, encryptedData, rawMessage }) {
    receive({ jsonData, encryptedData, rawMessage, connector: this });
    this.receivedCount += 1;
  }

  field(name) {
    return this.connectionState.get(name);
  }

  isReady() {
    return this.ready;
  }

  closed() {
    return !this.transportConnected;
  }

  connectStatus(connected) {
    if (connected) {
      this.sentCount = 0;
      this.receivedCount = 0;

      this.transportConnected = true;

      this.successfulConnectsCount += 1;

      if (this.verbose) {
        logger.green(this.log, `✓ Connector ${this.endpoint} connected #${this.successfulConnectsCount}`);
      }

      const websocketId = this.connection.websocket.__id;

      this.diffieHellman({
        clientPrivateKey: this.clientPrivateKey,
        clientPublicKey: this.clientPublicKey,
        protocol: this.protocol
      })
        .then(() => {
          this.connectedAt = Date.now();
          this.connected.set(true);

          this.ready = true;
          this.emit('ready');
        })
        .catch(e => {
          logger.write(
            this.log,
            `x Connector ${this.endpoint} [${this.protocol}] handshake error: ${e.message}`
          );

          // if there was a timeout error our websocket might have already closed
          // we only drop the current websocket if it is still open and there was a rpc error,
          // most likely it was not a timeout but some error on the other end which was passed to us
          // websocket would stay open but to try and reconnect we have to drop it, otherwise it will be left hanging
          const wsOPEN = 1;
          if (
            this.connection.websocket.__id == websocketId &&
            this.connection.websocket.readyState == wsOPEN
          ) {
            logger.write(
              this.log,
              `Connector ${this.endpoint} dropping stale websocket after handshake error`
            );

            // ⚠️ todo: test with some rpc error (not timeout) .. (not sure how to achieve it)..
            // and maybe implement a short delay here so that there is no immediate fast infinite reconnect loop
            // with error thrown, socket terminated, error thrown again etc.
            this.connection.terminate();
          }
        });
    } else {
      let isDisconnect;

      if (this.transportConnected) {
        isDisconnect = true;
      }

      if (this.transportConnected == undefined) {
        const tag = this.tag ? ` (${this.tag})` : '';
        logger.write(
          this.log,
          `Connector ${this.endpoint}${tag} was not able to connect at first try`
        );
      }

      this.transportConnected = false;
      this.ready = false;
      this.sharedSecret = undefined; // could also stay but less confusion if we clear it

      delete this.connectedAt;

      if (isDisconnect) {
        this.emit('disconnect');

        // connected will be false or undefined
        // establishAndMaintainConnection sets this to undefined after close connection
        // so that again red cross doesn't appear immediately -- experimental!

        // used unly when ws is closed
        // useful on dmt-mobile when we switch back to app
        // and websockets need to be quickly reconnected
        // we want to avoid the red x
        // on the other hand with legit disconnects we will have to tolerate a small delay
        if (connected == undefined) {
          this.delayedAdjustConnectionStatus();
        }

        this.connected.set(connected); // false or undefined
      }
    }
  }

  checkForDecommission() {
    if (!this.decommissionable) {
      return;
    }

    // we want fresh 12 consecutive checks and only then we check for late pings and decommission connector
    // this assures that in dmt-mobile when switching back to app connector has chance to reconnect to any endpoint
    // that was either down or dmt-mobile was in background ... so checks for late pings are only relevant if app is in foreground
    // for a few seconds

    if (this.decommissionCheckRequestedAt && Date.now() - this.decommissionCheckRequestedAt > 3000) {
      this.decommissionCheckCounter = 0;
    }

    this.decommissionCheckRequestedAt = Date.now();

    this.decommissionCheckCounter += 1;

    if (this.decommissionCheckCounter > 12) {
      // 12 x tick = around 10s
      if (Date.now() - this.lastPongReceivedAt > DECOMMISSION_INACTIVITY) {
        logger.write(this.log, `Decommissioning connector ${this.endpoint} (long inactive)`);

        this.decommission();
        this.emit('decommission');
      }
    }
  }

  decommission() {
    if (this.decommissionable) {
      this.decommissioned = true;
    }
  }

  remoteObject(handle) {
    return {
      call: (methodName, params = []) => {
        return this.rpcClient.remoteObject(handle).call(methodName, listify(params));
      }
    };
  }

  attachObject(handle, obj) {
    new RPCTarget({ serversideChannel: this, serverMethods: obj, methodPrefix: handle });
  }

  diffieHellman({ clientPrivateKey, clientPublicKey, protocol }) {
    return new Promise((success, reject) => {
      this.remoteObject('Auth')
        .call('exchangePubkeys', { pubkey: this.clientPublicKeyHex })
        .then(remotePubkeyHex => {
          const sharedSecret = nacl.box.before(hexToBuffer(remotePubkeyHex), clientPrivateKey);

          this.sharedSecret = sharedSecret;

          this._remotePubkeyHex = remotePubkeyHex;

          if (this.verbose) {
            logger.write(
              this.log,
              `Connector ${this.endpoint} established shared secret through diffie-hellman exchange.`
            );
          }

          this.remoteObject('Auth')
            .call('finalizeHandshake', { protocol })
            .then(res => {
              if (res && res.error) {
                reject(res.error);
              } else {
                success();

                const tag = this.tag ? ` (${this.tag})` : '';
                logger.cyan(
                  this.log,
                  `✓ [ ${this.protocol || '"no-name"'} ] connection [ ${this.endpoint}${tag} ] ready`
                );
              }
            })
            .catch(reject); // for example Timeout ... delayed! we have to be careful with closing any connections because new websocket might have already be created, we should not close that one
        })
        .catch(reject);
    });
  }

  clientPubkey() {
    return this.clientPublicKeyHex;
  }

  remotePubkeyHex() {
    return this._remotePubkeyHex;
  }

  remoteAddress() {
    return this.endpoint;
  }
}

export default Connector;
