import nacl from 'tweetnacl';
import naclutil from 'tweetnacl-util';
nacl.util = naclutil;

import { hexToBuffer } from '../../utils/index.js';

import logger from '../../utils/logger/logger.js';

export default function diffieHellman({ connector, afterFirstStep = () => {} }) {
  const {
    clientPrivateKey,
    clientPublicKey,
    clientPublicKeyHex,
    protocol,
    tag,
    endpoint,
    verbose
  } = connector;

  return new Promise((success, reject) => {
    connector.remoteObject('Auth')
      .call('exchangePubkeys', { pubkey: clientPublicKeyHex })
      .then(remotePubkeyHex => {
        const sharedSecret = nacl.box.before(hexToBuffer(remotePubkeyHex), clientPrivateKey);

        afterFirstStep({ sharedSecret, remotePubkeyHex });

        if (verbose) {
          logger.write(
            connector.log,
            `Connector ${endpoint} established shared secret through diffie-hellman exchange.`
          );
        }

        connector.remoteObject('Auth')
          .call('finalizeHandshake', { protocol })
          .then(res => {
            // finalizeHandshake rpc endpoint on server can cleanly retorn {error} as a result
            // in case the protocol we are trying to connect to is not registered (does not exist at the endpoint)
            if (res && res.error) {
              console.log(res.error);
              // this connection will keep hangling and no reconnect tries will be made
              // since we keep websocket open just that nothing is happening

              // when we enable the protocol on the endpoint we have to restart the process
              // frontend connector will get disconnected at this point, websocket will close
              // and from then on it tries reconnecting again so when ws first connects
              // and protocol is present , it will be a success

              // DONT'T REJECT here! reject(res.error); -- we need to keep this websocket hanging
            } else {
              success();

              const _tag = tag ? ` (${tag})` : '';
              logger.cyan(
                connector.log,
                `✓ [ ${protocol || '"no-name"'} ] connection [ ${endpoint}${_tag} ] ready`
              );
            }
          })
          .catch(reject); // for example Timeout ... delayed! we have to be careful with closing any connections because new websocket might have already be created, we should not close that one
      })
      .catch(reject);
  });
}
