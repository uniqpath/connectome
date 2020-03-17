import colors from 'colors';

import { connect, newKeypair } from '../index';

const endpoint = 'ws://localhost:3500';
const protocol = 'quantum';
//const remotePubkey = '4d41beb083a102f527965d94e2379003d969726b0ebb1c6db86cf24c37686176';

const { privateKey, publicKey, privateKeyHex, publicKeyHex } = newKeypair();

console.log(colors.green('Client'));
console.log(colors.green('------'));
console.log();
console.log(colors.magenta('Generated session keypair:'));
console.log(colors.cyan(`  — Private key: ${colors.gray(privateKeyHex)}`));
console.log(colors.cyan(`  — Public key: ${colors.gray(publicKeyHex)}`));
console.log();

connect({ endpoint, protocol, remotePubkey: undefined, debug: true }).then(connector => {
  connector.on('status', ({ connected }) => {
    // on each reconnection the channel has to be authenticated
    if (connected) {
      console.log(`${colors.gray('Channel connected')} ${colors.green('✓')}`);
      connector
        .diffieHellman({ clientPrivateKey: privateKey, clientPublicKey: publicKey })
        .then(({ sharedSecretHex }) => {
          console.log(colors.magenta(`Shared secret: ${colors.gray(sharedSecretHex)}`));
        })
        .catch(console.log);
    } else {
      console.log(`${colors.gray('Channel disconnected')} ${colors.red('✖')}`);
    }
  });

  connector.on('wire_receive', ({ jsonData }) => {
    console.log(jsonData);
  });
});
