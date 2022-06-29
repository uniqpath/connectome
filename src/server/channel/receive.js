import nacl from 'tweetnacl';
import naclutil from 'tweetnacl-util';
nacl.util = naclutil;

import { integerToByteArray } from '../../utils/index.js';

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
    log('Error: Message should be json !');
    log(message);
    log(message.toString());
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

  channel.lastMessageAt = Date.now();

  const nonce = new Uint8Array(integerToByteArray(2 * channel.receivedCount, 24));

  if (channel.verbose) {
    log(`Channel → Received message #${channel.receivedCount} @ ${channel.remoteAddress()}:`);
  }

  //if (channel.sharedSecret) {
  // if (channel.sharedSecret && channel.verbose == 'extra') {
  //   log('Received bytes:');
  //   log(message);
  //   log(`Decrypting with shared secret ${channel.sharedSecret}...`);
  // }

  try {
    // handshake phase
    if (!channel.sharedSecret) {
      //const jsonData = JSON.parse(message);
      handleMessage(channel, message);
      return;
    }

    // subsequent encrypted communication
    const _decryptedMessage = nacl.secretbox.open(message, nonce, channel.sharedSecret);

    const flag = _decryptedMessage[0];
    const decryptedMessage = _decryptedMessage.subarray(1);

    if (channel.verbose) {
      log(`decryptedMessage: ${decryptedMessage}`);
    }

    // text (json)
    if (flag == 1) {
      const decodedMessage = nacl.util.encodeUTF8(decryptedMessage);
      //const jsonData = JSON.parse(decodedMessage);

      // todo: channel.sharedSecret will never be true here... move/ dduplicate
      // if (channel.verbose) {
      //   if (channel.sharedSecret) {
      //     log('Decrypted message:');
      //   }

      //   log(message);
      //   log();
      // }

      if (channel.verbose) {
        log(`Message: ${decodedMessage}`);
      }

      handleMessage(channel, decodedMessage);
    } else {
      // binary
      channel.emit('receive_binary', decryptedMessage);
    }
  } catch (e) {
    throw new Error(`${message} -- ${channel.protocol} -- ${e.toString()}`);
  }
}

export default messageReceived;
