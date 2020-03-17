import nacl from 'tweetnacl';
import naclutil from 'tweetnacl-util';
nacl.util = naclutil;

import EventEmitter from '../emitter';

import util from '../util';
import RpcClient from '../rpc/client';

const nullNonce = new Uint8Array(new ArrayBuffer(24), 0);

const { hexToBuffer, bufferToHex } = util;

class Connector extends EventEmitter {
  constructor({ debug = false } = {}) {
    super();
    this.debug = debug;
    this.rpcClient = new RpcClient(this);
  }

  isConnected() {
    return this.connected;
  }

  connectStatus(connected) {
    this.connected = connected;
    if (connected) {
      this.sentCounter = 0;
    }
    this.emit('status', { connected });
  }

  wireReceive({ jsonData, encryptedData, rawMessage }) {
    if (jsonData) {
      if (jsonData.jsonrpc) {
        this.rpcClient.jsonrpcMsgReceive(rawMessage);
      } else {
        this.emit('wire_receive', { jsonData, rawMessage });
      }
    } else if (encryptedData) {
      const decryptedMessage = nacl.secretbox.open(encryptedData, nullNonce, this.sharedSecret);
      const decodedMessage = nacl.util.encodeUTF8(decryptedMessage);

      let jsonData;

      try {
        jsonData = JSON.parse(decodedMessage);
      } catch (e) {}

      if (jsonData) {
        if (jsonData.jsonrpc) {
          this.wireReceive({ jsonData, rawMessage: decodedMessage }); // recursive: will cann rpcClient as before
        } else {
          if (this.debug) {
            console.log('Received bytes:');
            console.log(encryptedData);
            console.log(`Decrypting with shared secret ${this.sharedSecret}...`);
          }

          this.emit('wire_receive', { jsonData, rawMessage: decodedMessage });
        }
      } else {
        this.wireReceive({ binaryData: decodedMessage });
      }
    }
  }

  send(data) {
    if (this.isConnected()) {
      if (this.sentCounter > 1) {
        const encodedMessage = nacl.util.decodeUTF8(data);
        const encryptedMessage = nacl.secretbox(encodedMessage, nullNonce, this.sharedSecret);

        this.connection.websocket.send(encryptedMessage);
      } else {
        this.connection.websocket.send(data);
      }
      this.sentCounter += 1;
    } else {
      console.log(`Warning: "${data}" was not sent because the store is not yet connected to the backend`);
    }
  }

  remoteObject(handle) {
    return {
      call: (methodName, params = []) => {
        return this.rpcClient.remoteObject(handle).call(methodName, util.listify(params)); // rpcClient always expects a list of arguments, never a single argument
      }
    };
  }

  diffieHellman({ clientPrivateKey, clientPublicKey }) {
    return new Promise((success, reject) => {
      this.remoteObject('Auth')
        .call('exchangePubkeys', { pubkey: bufferToHex(clientPublicKey) })
        .then(remotePubkey => {
          const sharedSecret = nacl.box.before(hexToBuffer(remotePubkey), clientPrivateKey);
          const sharedSecretHex = bufferToHex(sharedSecret);
          this.sharedSecret = sharedSecret;

          success({ sharedSecret, sharedSecretHex });

          this.remoteObject('Auth')
            .call('exchangePubkeys', { ackResult: true })
            .then(() => {})
            .catch(reject);
        })
        .catch(reject);
    });
  }

  close() {
    this.connection.closedManually = true;
    this.connection.websocket.onclose = () => {}; // disable onclose handler first

    this.connectStatus(false);
    this.connection.websocket.close();
  }
}

export default Connector;
