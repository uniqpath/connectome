import nacl from 'tweetnacl';
import naclutil from 'tweetnacl-util';

import initializeProtocol from '../initializeProtocol.js';

import { EventEmitter, hexToBuffer } from '../../../utils/index.js';

nacl.util = naclutil;

export default class AuthTarget extends EventEmitter {
  constructor({ keypair, channel, server }) {
    super();

    this.keypair = keypair;
    this.channel = channel;
    this.server = server;
  }

  exchangePubkeys({ pubkey }) {
    const remoteClientPubkey = hexToBuffer(pubkey);

    this.channel.setRemotePubkeyHex(pubkey);

    this.sharedSecret = nacl.box.before(remoteClientPubkey, this.keypair.privateKey);

    return this.keypair.publicKeyHex;
  }

  finalizeHandshake({ protocol }) {
    const { server, channel } = this;

    channel.setSharedSecret(this.sharedSecret);
    channel.setProtocol(protocol);

    if (initializeProtocol({ server, channel })) {
      server.emit('connection', channel);
    } else {
      const error = `Error: request from ${channel.remoteIp()} (${channel.remotePubkeyHex()}) - unknown protocol ${protocol}, disconnecting in 60s`;
      this.channel.log(error);

      setTimeout(() => {
        channel.terminate();
      }, 60000);

      return { error };
      //channel.terminate(); // don't do this so we don't get reconnect looping!
      // client will need to refresh the page and this is better than to keep trying
      // we will get multiple connections though.. maybe disconnect after 5min...
    }
  }
}
