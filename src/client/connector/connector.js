import nacl from 'tweetnacl';
import naclutil from 'tweetnacl-util';
nacl.util = naclutil;

import send from './send.js';
import receive from './receive.js';
import handshake from './handshake.js';

import WritableStore from '../../stores/lib/helperStores/writableStore.js';
import logger from '../../utils/logger/logger.js';

import { EventEmitter, listify, bufferToHex } from '../../utils/index.js';

import RpcClient from '../rpc/client.js';
import RPCTarget from '../rpc/RPCTarget.js';
import errorCodes from '../rpc/mole/errorCodes.js';

import { newKeypair, acceptKeypair } from '../../utils/crypto/index.js';

import ProtocolState from './protocolState.js';
import ConnectionState from './connectionState.js';

const ADJUST_UNDEFINED_CONNECTION_STATUS_DELAY = 700; // was 700 for a long time, was ok, maybe a bit long, before that 300

const DECOMMISSION_INACTIVITY = 60000; // 1min
//const DECOMMISSION_INACTIVITY = 120000; // 2min
//const DECOMMISSION_INACTIVITY = 10000; // 2min

const wsOPEN = 1;

class Connector extends EventEmitter {
  constructor({
    endpoint,
    protocol,
    keypair = newKeypair(),
    rpcRequestTimeout,
    verbose = false,
    tag,
    log = console.log,
    autoDecommission = false,
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

    this.autoDecommission = autoDecommission;

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

  // convenience method
  userAction({ action, scope, payload }) {
    this.signal('__action', { action, scope, payload });
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

      const afterFirstStep = ({ sharedSecret, remotePubkeyHex }) => {
        this.sharedSecret = sharedSecret;
        this._remotePubkeyHex = remotePubkeyHex;
      };

      // there can {error} object returned from finalizeHandshake in case protocol is not present on server
      // websocket will just keep hanging until first reconnect and prehaps then the desired protocol is present in the endpoint
      // two more possible errors which are indeed handled in our catch block are:
      // - timeout when handshake messages were delayed, we have to try again in this case
      // - some other rpc error (?) mayme implementation.. but this is not relevant since we have no issues that throw inside our handshake
      // procuderes on server - it is tested well enough, perhaps later if something is added we will encounter such errors again?
      handshake({ connector: this, afterFirstStep })
        .then(() => {
          this.connectedAt = Date.now();
          this.connected.set(true);

          this.ready = true;
          this.emit('ready'); //⚠️ Note: when inside any client handler for ready we throw an error it gets caught in the following catch statement (along with Timeouts and other things)
        })
        .catch(e => {
          // if there was a timeout error our websocket MIGHT have already closed
          // we only drop the current websocket if it is still open,
          // most likely it was not a timeout but some error on the other end which was passed to us
          // websocket would stay open but to try and reconnect we have to drop it, otherwise it will be left hanging
          // but sometimes we also get an open websocket after rpc timeout (not sure but this code handles it anyway, should be no problem, only better for all cases)
          if (
            this.connection.websocket.__id == websocketId &&
            this.connection.websocket.readyState == wsOPEN
          ) {
            //⚠️ we only show if it seems still relevant, special case
            // previously we had this first log output above this if statement
            // so on every reject
            // but then timeout messages sometimes came for websockets that already closed because of normal reconnect when dmt-proc was restarting etc.
            // and it was strange because new connector was ready and then this late error came
            // now we don't report handshake rpc errors on already closed websockets, they are probably no interesting at all
            // but still - watch this space for some time, maybe there are some small remaining voids in this logic
            if (e.code == errorCodes.TIMEOUT) {
              logger.write(
                this.log,
                `${this.endpoint} x Connector [ ${this.protocol} ] handshake error: "${e.message}"`
              );

              logger.write(
                this.log,
                `${this.endpoint} Connector dropping stale websocket after handshake error`
              );

              // ⚠️ todo: test with some rpc error (not timeout) .. (not sure how to achieve it)..
              // not so urgent since we don't expect rpc errors except timeouts (we don't have bugs in remote handshake endpoints which would be passes here as rpc errors over the wire)
              // and maybe implement a short delay here so that there is no immediate fast infinite reconnect loop
              // with error thrown, socket terminated, error thrown again etc.
              this.connection.terminate();
            }
          }

          // we show all other errors even if websocket has already closed
          if (e.code != errorCodes.TIMEOUT) {
            logger.write(
              this.log,
              `${this.endpoint} x Connector [ ${this.protocol} ] on:ready error: "${e.stack}" — (will not try to reconnect, fix the error and reload this gui)`
            );

            // TODO: what about errors coming from RPC ? Like remote exceptions
            // see -- rpc/mole/errorCodes.js --
            // not critical or even that important because it could only matter in development but once we don't expect any remote exceptions
            // we don't need to reconnect automatically in such cases.. if error in on:ready we expect frontend to be reloaded anyway
          }
        });
    } else {
      let isDisconnect;

      if (this.transportConnected) {
        isDisconnect = true;
      }

      if (this.transportConnected == undefined) {
        //const tag = this.tag ? ` (${this.tag})` : '';
        logger.write(this.log, `${this.endpoint} Connector was not able to connect at first try`);
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
    if (!this.autoDecommission) {
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

    // 12 x tick = around 10s
    if (this.decommissionCheckCounter > 12) {
      // and now the real check DECOMMISSION_INACTIVITY (1min)
      if (Date.now() - this.lastPongReceivedAt > DECOMMISSION_INACTIVITY) {
        logger.write(this.log, `Decommissioning connector ${this.endpoint} (long inactive)`);

        this.decommission();
        this.emit('decommission');
      }
    }
  }

  decommission() {
    this.decommissioned = true;
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
