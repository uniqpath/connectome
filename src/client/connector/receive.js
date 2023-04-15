//import colors from 'kleur';

import nacl from 'tweetnacl';
import naclutil from 'tweetnacl-util';
nacl.util = naclutil;

import { integerToByteArray } from '../../utils/index.js';

import logger from '../../utils/logger/logger.js';

function isRpcCallResult(jsonData) {
  return Object.keys(jsonData).includes('result') || Object.keys(jsonData).includes('error');
}

function wireReceive({ jsonData, encryptedData, rawMessage, wasEncrypted, connector }) {
  const { log } = connector;

  // const log = (...opts) => {
  //   if (opts.length == 0) {
  //     connector.logger.write(log, );
  //   } else {
  //     connector.logger.write(log,
  //       colors.yellow('📥'),
  //       colors.gray(connector.tag || connector.endpoint),
  //       colors.yellow(...opts)
  //     );
  //   }
  // };

  connector.lastMessageAt = Date.now();

  const nonce = new Uint8Array(integerToByteArray(2 * connector.receivedCount + 1, 24));

  if (connector.verbose && !wasEncrypted) {
    //logger.write(log);
    logger.magenta(log, `Connector ${connector.endpoint} → Received message #${connector.receivedCount} ↴`);
  }

  // 💡 unencrypted jsonData !
  if (jsonData) {
    if (jsonData.jsonrpc) {
      if (isRpcCallResult(jsonData)) {
        if (connector.verbose && !wasEncrypted) {
          logger.magenta(log, `Connector ${connector.endpoint} received plain-text rpc result ↴`);
          logger.gray(log, jsonData);
        }

        connector.rpcClient.jsonrpcMsgReceive(rawMessage);
      } else {
        connector.emit('json_rpc', rawMessage);
      }
    } else {
      connector.emit('receive', { jsonData, rawMessage });
    }

    // logger.magenta(
    //   log,
    //   `Connector ${connector.endpoint} → ${rawMessage}`
    // );
  } else if (encryptedData) {
    // 💡 encryptedJson data!!
    if (connector.verbose == 'extra') {
      logger.magenta(log, `Connector ${connector.endpoint} received bytes ↴`);
      logger.cyan(log, encryptedData);
      logger.green(log, JSON.stringify(encryptedData));
      logger.gray(
        log,
        `Connector ${connector.endpoint} decrypting with shared secret ${connector.sharedSecret}...`
      );
      logger.cyan(log, JSON.stringify(connector.sharedSecret));
    }

    if (!connector.sharedSecret) {
      // we had this problem before -- zurich wifi -- when terminating inactive websocket
      // it didn't actually close in time .. we set connector to disconnected and deleted sharedSecret
      // but then a stray message json rpc return from hadshake arrived after that and couldn't be decrypted
      // because it shouldn't have arrived in the first place after websocket was supposedly closed
      // solution: __closed flag on all websockets.. it is set to true at the same time as calling close()
      // and then any messages still coming over the wire on such closed websockets are dropped
      // we hope websocket is eventually closed though (?)
      // see messageCallback in establishAndMaintainConnection, this was fixed there
      logger.red(log, `Connector ${connector.endpoint} missing sharedSecret - should not happen...`);
    }

    const _decryptedMessage = nacl.secretbox.open(encryptedData, nonce, connector.sharedSecret);

    const flag = _decryptedMessage[0];
    const decryptedMessage = _decryptedMessage.subarray(1);

    if (flag == 1) {
      const decodedMessage = nacl.util.encodeUTF8(decryptedMessage);

      if (connector.verbose) {
        logger.yellow(log, `Connector ${connector.endpoint} received message: ${decodedMessage}`);
      }

      try {
        const jsonData = JSON.parse(decodedMessage);

        // 💡 rpc
        if (jsonData.jsonrpc) {
          // if (connector.verbose) {
          //   logger.magenta(log, `Connector ${connector.endpoint} decrypted rpc result ↴`);
          //   logger.gray(log, jsonData);
          // }

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
        logger.red(log, "Couldn't parse json message although the flag was for string ...");
        logger.red(log, decodedMessage);
        throw e;
      }
    } else {
      if (connector.verbose) {
        logger.yellow(log, `Connector ${connector.endpoint} received binary data`);
      }

      //const binaryData = decryptedMessage;
      // const sessionId = Buffer.from(binaryData.buffer, binaryData.byteOffset, 64).toString();
      // const binaryPayload = Buffer.from(binaryData.buffer, binaryData.byteOffset + 64);
      // connector.emit('binary_data', { sessionId, data: binaryPayload });
      connector.emit('receive_binary', decryptedMessage);
    }
  }
}

export default wireReceive;
