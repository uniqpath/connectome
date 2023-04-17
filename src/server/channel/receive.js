import nacl from 'tweetnacl';
import naclutil from 'tweetnacl-util';
nacl.util = naclutil;

import { integerToByteArray } from '../../utils/index.js';

import logger from '../../utils/logger/logger.js';

function handleMessage(channel, message) {
  const { log } = channel;

  let jsonData;

  // we implemented this because all messages should be json
  // but there was a bug when we sent some message before connection ready
  // and message snuck in just before the last step (finalizeHandshake
  // process expected unencrypted data but message was received
  // just as finalize handshake was executing and it was already encrypted since this.sharedSecret was set in
  // connector diffieHellman immediately after return from exchangePubkeys
  try {
    jsonData = JSON.parse(message);
  } catch (e) {
    logger.red(log, 'Error: Message should be json !');
    logger.red(log, message);
    logger.red(log, message.toString());
    throw e; // let program crash
  }

  if (jsonData.jsonrpc) {
    if (Object.keys(jsonData).includes('result') || Object.keys(jsonData).includes('error')) {
      channel.reverseRpcClient.jsonrpcMsgReceive(message);
    } else {
      channel.emit('json_rpc', message);
    }
    //} else if (jsonData.tag == 'request_file') {
    //  channel.streamFile(jsonData); // currently disabled
  } else if (jsonData.signal) {
    channel.emit(jsonData.signal, jsonData.data);
  } else {
    channel.emit('receive', message); // renamed this from 'message' recently...
    // we have signal named 'message' somewhere.. this handler is not even utilized anywhere at the moment..
    // and connector also has 'receive' instead of 'message' ... todo: think over
  }
}

function messageReceived({ message, channel }) {
  const { log } = channel;

  const prefix = `Channel #${channel.ident} ${channel.remoteAddress() || ''} ${
    channel.remotePubkeyHex() ? `to ${channel.remotePubkeyHex()}` : ''
  }`;

  channel.lastMessageAt = Date.now();

  const nonce = new Uint8Array(integerToByteArray(2 * channel.receivedCount, 24));

  if (channel.verbose) {
    logger.yellow(log, `${prefix} → Received message #${channel.receivedCount} ↴`);
  }

  //if (channel.sharedSecret) {
  // if (channel.sharedSecret && channel.verbose == 'extra') {
  //   logger.write(log, 'Received bytes:');
  //   logger.write(log, message);
  //   logger.write(log, `Decrypting with shared secret ${channel.sharedSecret}...`);
  // }

  let decodedMessage;

  try {
    // handshake phase
    if (!channel.sharedSecret) {
      if (channel.verbose) {
        logger.write(log, `${prefix} handshake message: ${message}`);
      }

      //const jsonData = JSON.parse(message);
      handleMessage(channel, message);
      return;
    }

    // subsequent encrypted communication
    const _decryptedMessage = nacl.secretbox.open(message, nonce, channel.sharedSecret);

    const flag = _decryptedMessage[0];
    const decryptedMessage = _decryptedMessage.subarray(1);

    if (channel.verbose) {
      logger.write(log, `decryptedMessage: ${decryptedMessage}`);
      //logger.write(log, `decryptedMessage length: ${decryptedMessage.length}`);
    }

    // text (json)
    if (flag == 1) {
      decodedMessage = nacl.util.encodeUTF8(decryptedMessage);

      //const jsonData = JSON.parse(decodedMessage);

      // todo: channel.sharedSecret will never be true here... move/ dduplicate
      // if (channel.verbose) {
      //   if (channel.sharedSecret) {
      //     logger.write(log, 'Decrypted message:');
      //   }

      //   logger.write(log, message);
      //   logger.write(log, );
      // }

      if (channel.verbose) {
        logger.write(log, `Message: ${decodedMessage}`);
        //logger.write(log, `Message length: ${decodedMessage.length}`);
      }

      handleMessage(channel, decodedMessage);
    } else {
      // binary
      channel.emit('receive_binary', decryptedMessage);
    }
  } catch (e) {
    // we repackage the error so we can include the channel message that triggered the problem
    throw new Error(
      `${e.toString()} \n-- Protocol ${
        channel.protocol
      } received channel message: ${decodedMessage} \n-- Stacktrace: ${
        e.stack
      }\n------ ↑ original stacktrace ------ `
    );
  }
}

export default messageReceived;
