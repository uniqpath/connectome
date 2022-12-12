import colors from 'kleur';

import { printClientInfo } from '../exampleUtils.js';

import { connect, newClientKeypair } from '../../../src/client/index.js';

const address = 'localhost';

const port = 3500;
const protocol = 'test';

const keypair = newClientKeypair();
const { privateKeyHex, publicKeyHex } = keypair;

printClientInfo({ privateKeyHex, publicKeyHex });

const connector = connect({ port, protocol });

connector.connected.subscribe(ready => {
  console.log(ready);
});

// connector.on('ready', ({ sharedSecretHex }) => {
//   console.log(`${colors.gray('Channel connected')} ${colors.green('✓')}`);
//   console.log(colors.magenta(`Shared secret: ${colors.gray(sharedSecretHex)}`));
// });

// connector.on('disconnect', () => {
//   console.log(`${colors.gray('Channel disconnected')} ${colors.red('✖')}`);
// });

// connector.on('receive', ({ jsonData }) => {
//   console.log(jsonData);
//   receivedCount += 1;
//   if (receivedCount == 3) {
//     console.log(`${colors.gray('Received 3/3 messages, disconnecting ...')}`);
//     process.exit();
//   }
// });
