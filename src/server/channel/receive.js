import nacl from 'tweetnacl';
import naclutil from 'tweetnacl-util';
nacl.util = naclutil;

import { integerToByteArray } from '../../utils/index.js';

function handleMessage(channel, message) {
  let jsonData;

  try {
    jsonData = JSON.parse(message);
  } catch (e) {
    console.log('Error: Message should be json !');
    console.log(message);
    console.log('---');
    return;
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
  channel.lastMessageAt = Date.now();

  const nonce = new Uint8Array(integerToByteArray(2 * channel.receivedCount, 24));

  if (channel.verbose) {
    console.log(`Channel → Received message #${channel.receivedCount} @ ${channel.remoteAddress()}:`);
  }

  //if (channel.sharedSecret) {
  // if (channel.sharedSecret && channel.verbose == 'extra') {
  //   console.log('Received bytes:');
  //   console.log(message);
  //   console.log(`Decrypting with shared secret ${channel.sharedSecret}...`);
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

    // text (json)
    if (flag == 1) {
      const decodedMessage = nacl.util.encodeUTF8(decryptedMessage);
      //const jsonData = JSON.parse(decodedMessage);

      // todo: channel.sharedSecret will never be true here... move/ dduplicate
      // if (channel.verbose) {
      //   if (channel.sharedSecret) {
      //     console.log('Decrypted message:');
      //   }

      //   console.log(message);
      //   console.log();
      // }

      if (channel.verbose) {
        console.log(`Message: ${decodedMessage}`);
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
