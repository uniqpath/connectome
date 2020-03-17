import colors from 'colors';
import { newKeypair, Server } from '../index';
import util from '../lib/util';

const { bufferToHex } = util;

import wsEndpointQuantum from './endpoints/quantumEndpoint';

const keypair = newKeypair();

const { privateKeyHex, publicKeyHex } = keypair;

console.log(colors.green('Server'));
console.log(colors.green('------'));
console.log();
console.log(colors.magenta('Generated server keypair:'));
console.log(colors.cyan(`  — Private key: ${colors.gray(privateKeyHex)}`));
console.log(colors.cyan(`  — Public key: ${colors.gray(publicKeyHex)}`));
console.log();

const protocols = {
  quantum: wsEndpointQuantum
};

const server = new Server({ port: 3500, keypair, protocols });
server.on('connection', channel => {
  console.log(colors.magenta(`Shared secret: ${colors.gray(bufferToHex(channel.sharedSecret))}`));
});
