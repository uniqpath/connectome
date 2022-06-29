//import colors from 'kleur';

import nacl from 'tweetnacl';
import naclutil from 'tweetnacl-util';
nacl.util = naclutil;

import { isObject, addHeader } from '../../server/channel/sendHelpers.js';
import { integerToByteArray } from '../../utils/index.js';

function send({ data, connector }) {
  const { log } = connector;

  // const log = (...opts) => {
  //   if (opts.length == 0) {
  //     connector.log();
  //   } else {
  //     connector.log(
  //       colors.magenta('📡'),
  //       colors.gray(connector.tag || connector.endpoint),
  //       colors.magenta(...opts)
  //     );
  //   }
  // };

  if (isObject(data)) {
    data = JSON.stringify(data);
  }

  const nonce = new Uint8Array(integerToByteArray(2 * connector.sentCount, 24));

  if (!connector.closed()) {
    if (connector.sentCount > 1) {
      let flag = 0;

      if (typeof data == 'string') {
        flag = 1;
      }

      const _encodedMessage = flag == 1 ? nacl.util.decodeUTF8(data) : data;
      const encodedMessage = addHeader(_encodedMessage, flag);

      const encryptedMessage = nacl.secretbox(encodedMessage, nonce, connector.sharedSecret);

      if (connector.verbose) {
        log();
        log(`Connector → Sending encrypted message #${connector.sentCount} @ ${connector.address}:`);
        log(data);
      }

      connector.connection.websocket.send(encryptedMessage);
    } else {
      if (connector.verbose) {
        log();
        log(`Connector → Sending message #${connector.sentCount} @ ${connector.address}:`);
        log(data);
      }

      connector.connection.websocket.send(data);
    }
  } else {
    log(`⚠️ Warning: "${data}" was not sent because connector is not ready`);
  }
}

export default send;
