//import colors from 'kleur';

import nacl from 'tweetnacl';
import naclutil from 'tweetnacl-util';
nacl.util = naclutil;

import send from './send.js';
import receive from './receive.js';

import WritableStore from '../../stores/lib/helperStores/writableStore.js';

import { EventEmitter, listify, hexToBuffer, bufferToHex } from '../../utils/index.js';

import RpcClient from '../rpc/client.js';
import RPCTarget from '../rpc/RPCTarget.js';

import { newKeypair, acceptKeypair } from '../../utils/crypto/index.js';

import ProtocolState from './protocolState';
import ConnectionState from './connectionState';

class Connector extends EventEmitter {
  constructor({
    endpoint,
    protocol,
    keypair = newKeypair(),
    rpcRequestTimeout,
    verbose = false,
    tag,
    log = console.log,
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

    // 💡 connected == undefined ==> while trying to connect
    // 💡 connected == false => while disconnected
    // 💡 connected == true => while connected
    // for better GUI
    setTimeout(() => {
      if (this.connected.get() == undefined) {
        this.connected.set(false);
      }
    }, 700); // formerly 300ms
  }

  send(data) {
    send({ data, connector: this });
    this.sentCount += 1;
  }

  signal(signal, data) {
    if (this.connected.get()) {
      //log(`Sending signal '${signal}' over connector ${this.endpoint}`);
      this.send({ signal, data });
    } else {
      this.log('Warning: trying to send signal over disconnected connector, this should be prevented by GUI');
    }
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

  decommission() {
    this.decommissioned = true;
  }

  connectStatus(connected) {
    if (connected) {
      this.sentCount = 0;
      this.receivedCount = 0;

      this.transportConnected = true;

      this.successfulConnectsCount += 1;

      const num = this.successfulConnectsCount;

      this.diffieHellman({
        clientPrivateKey: this.clientPrivateKey,
        clientPublicKey: this.clientPublicKey,
        protocol: this.protocol
      })
        //.then(({ sharedSecret, sharedSecretHex }) => {
        .then(() => {
          this.connectedAt = Date.now();
          this.connected.set(true);

          // new trick so that any state has time to get populated
          // this.connectedTimeout = setTimeout(() => {
          //   this.connected.set(true);
          // }, 100);
          // WHAT ABOUT this from dmt-connect ?
          // {#if !$connected || Object.keys($state).length <= 0}
          //   <Loading />

          this.ready = true;

          this.emit('ready');
        })
        .catch(e => {
          if (num == this.successfulConnectsCount) {
            this.log(e);
            this.log('dropping connection and retrying');
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
        this.log(
          `Connector ${this.endpoint}${tag} was not able to connect at first try, setting READY to false`
        );
      }

      this.transportConnected = false;
      this.ready = false;
      this.sharedSecret = undefined; // could also stay but less confusion if we clear it

      delete this.connectedAt;

      if (isDisconnect) {
        this.emit('disconnect');
        //clearTimeout(this.connectedTimeout);
        this.connected.set(false);
      }
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

          //const sharedSecretHex = bufferToHex(sharedSecret);
          this.sharedSecret = sharedSecret;

          this._remotePubkeyHex = remotePubkeyHex;

          if (this.verbose) {
            this.log(
              `Connector ${this.endpoint}: Established shared secret through diffie-hellman exchange:`
            );
            //this.log(sharedSecretHex);
          }

          this.remoteObject('Auth')
            .call('finalizeHandshake', { protocol })
            .then(res => {
              if (res && res.error) {
                this.log(`x Protocol ${this.protocol} error:`);
                this.log(res.error);
              } else {
                //success({ sharedSecret, sharedSecretHex });
                success();

                //this.log(`✓ Lane ${this.lane} negotiated `);
                const tag = this.tag ? ` (${this.tag})` : '';
                this.log(
                  `✓ Protocol [ ${this.protocol || '"no-name"'} ] connection [ ${this.endpoint}${tag} ] ready`
                );
              }
            })
            .catch(e => {
              this.log(`x Protocol ${this.protocol} finalizeHandshake error:`);
              reject(e);
            });
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
