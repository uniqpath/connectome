//import colors from 'kleur';

import nacl from 'tweetnacl';
import naclutil from 'tweetnacl-util';
nacl.util = naclutil;

import { integerToByteArray } from '../../utils/index.js';

function isRpcCallResult(jsonData) {
  return Object.keys(jsonData).includes('result') || Object.keys(jsonData).includes('error');
}

function wireReceive({ jsonData, encryptedData, rawMessage, wasEncrypted, connector }) {
  const { log } = connector;

  // const log = (...opts) => {
  //   if (opts.length == 0) {
  //     connector.log();
  //   } else {
  //     connector.log(
  //       colors.yellow('📥'),
  //       colors.gray(connector.tag || connector.endpoint),
  //       colors.yellow(...opts)
  //     );
  //   }
  // };

  connector.lastMessageAt = Date.now();

  const nonce = new Uint8Array(integerToByteArray(2 * connector.receivedCount + 1, 24));

  if (connector.verbose && !wasEncrypted) {
    log();
    log(`Connector → Received message #${connector.receivedCount}:`);
  }

  // 💡 unencrypted jsonData !
  if (jsonData) {
    if (jsonData.jsonrpc) {
      if (isRpcCallResult(jsonData)) {
        if (connector.verbose && !wasEncrypted) {
          log('Received plain-text rpc result');
          log(jsonData);
        }

        connector.rpcClient.jsonrpcMsgReceive(rawMessage);
      } else {
        connector.emit('json_rpc', rawMessage);
      }
    } else {
      connector.emit('receive', { jsonData, rawMessage });
    }
  } else if (encryptedData) {
    // 💡 encryptedJson data!!
    if (connector.verbose == 'extra') {
      log('Received bytes:');
      log(encryptedData);
      log(`Decrypting with shared secret ${connector.sharedSecret}...`);
    }

    const _decryptedMessage = nacl.secretbox.open(encryptedData, nonce, connector.sharedSecret);

    const flag = _decryptedMessage[0];
    const decryptedMessage = _decryptedMessage.subarray(1);

    if (flag == 1) {
      const decodedMessage = nacl.util.encodeUTF8(decryptedMessage);

      // if (connector.verbose) {
      //   log(`Received message: ${decodedMessage}`);
      // }

      try {
        const jsonData = JSON.parse(decodedMessage);

        // 💡 rpc
        if (jsonData.jsonrpc) {
          if (connector.verbose) {
            log('Received and decrypted rpc result:');
            log(jsonData);
          }

          wireReceive({ jsonData, rawMessage: decodedMessage, wasEncrypted: true, connector });
          // } else if (jsonData.tag) {
          //   // 💡 tag
          //   const msg = jsonData;

          //   if (msg.tag == 'file_not_found') {
          //     connector.emit(msg.tag, { ...msg, ...{ tag: undefined } });
          //   } else if (msg.tag == 'binary_start') {
          //     connector.emit(msg.tag, { ...msg, ...{ tag: undefined } });
          //   } else if (msg.tag == 'binary_end') {
          //     connector.emit(msg.tag, { sessionId: msg.sessionId });
          //   } else {
          //     connector.emit('receive', { jsonData, rawMessage: decodedMessage });
          //   }
        } else if (jsonData.state) {
          // 💡 Initial state sending ... part of Connectome protocol
          connector.emit('receive_state', jsonData.state);
        } else if (jsonData.diff) {
          // 💡 Subsequent JSON patch diffs (rfc6902)* ... part of Connectome protocol
          connector.emit('receive_diff', jsonData.diff);
        } else if (jsonData.signal) {
          connector.emit(jsonData.signal, jsonData.data);
        } else if (jsonData.stateField) {
          connector.emit('receive_state_field', jsonData.stateField);
        } else {
          connector.emit('receive', { jsonData, rawMessage: decodedMessage });
        }
      } catch (e) {
        log("Couldn't parse json message although the flag was for string ...");
        log(decodedMessage);
        throw e;
      }
    } else {
      //const binaryData = decryptedMessage;
      // const sessionId = Buffer.from(binaryData.buffer, binaryData.byteOffset, 64).toString();
      // const binaryPayload = Buffer.from(binaryData.buffer, binaryData.byteOffset + 64);
      // connector.emit('binary_data', { sessionId, data: binaryPayload });
      connector.emit('receive_binary', decryptedMessage);
    }
  }
}

export default wireReceive;
