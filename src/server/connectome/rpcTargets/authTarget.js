import nacl from 'tweetnacl';
import naclutil from 'tweetnacl-util';

import initializeProtocol from '../initializeProtocol.js';

import { EventEmitter, hexToBuffer } from '../../../utils/index.js';

import logger from '../../../utils/logger/logger.js';

nacl.util = naclutil;

const DAY = 24 * 60 * 60 * 1000;

// common among all instances of AuthTarget
const _errorReportTimestamps = {};
const _errorReportCounters = {};

//cleanup --⚠️ it should be and it is just one global setInterval
// if we have a lot connections from different IPs and our processes are really long running, then this
// data structure may grow unbounded.. probably not a really pressing problem but we still play it nice
// and free up the memory because it is the right thing to do
setInterval(() => {
  const now = Date.now();

  for (const [remoteIp, timestamp] of Object.entries(_errorReportTimestamps)) {
    if (now - timestamp > 2 * DAY) {
      // remove processes that are no longer reconnecting in last 2 days
      delete _errorReportTimestamps[remoteIp];
      delete _errorReportCounters[remoteIp];
    }
  }
}, DAY); // cleanup data structure every day

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

    const { log } = this.channel;

    // in the future if remote process doesn't have the correct allowance (public key), we also let it hang
    // as we do now with missing or incorrect dmt protocol

    if (initializeProtocol({ server, channel })) {
      server.emit('connection', channel);
    } else {
      const error = `Error: request from ${channel.remoteIp()} (${channel.remotePubkeyHex()}) - unknown protocol ${protocol}, disconnecting in 60s`;

      _errorReportCounters[channel.remoteIp()] = (_errorReportCounters[channel.remoteIp()] || 0) + 1;

      // report at most once per 24h -- for example if some old dmt-proc keeps reconnecting
      if (
        !_errorReportTimestamps[channel.remoteIp()] ||
        Date.now() - _errorReportTimestamps[channel.remoteIp()] > DAY
      ) {
        logger.yellow(log, error);

        logger.yellow(
          log,
          'Maybe it is a stray or unwelcome dmt-proc which will keep reconnecting until terminated... we report at most once per 24h per remote ip'
        );

        logger.yellow(
          log,
          `Reconnect tries since this dmt-proc started: ${_errorReportCounters[channel.remoteIp()]}`
        );

        _errorReportTimestamps[channel.remoteIp()] = Date.now();
      }

      setTimeout(() => {
        channel.terminate();
      }, 60 * 60 * 1000); // we keep it hanging for one hour, why not .. reconsider this approach and how to block such leech connections... but maybe this is good enough

      return { error };
      //channel.terminate(); // don't do this so we don't get reconnect looping!
      // client will need to refresh the page and this is better than to keep trying
    }
  }
}
