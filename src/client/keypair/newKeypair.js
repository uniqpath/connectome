import nacl from 'tweetnacl';
import naclutil from 'tweetnacl-util';

import { bufferToHex } from '../../utils/index.js';

nacl.util = naclutil;

function newKeypair(_crypto_) {
  //if _crypto_ specified it will overite the default nacl.setPRNG
  //this only for server
  if(_crypto_&&typeof Window==='undefined')
  nacl.setPRNG(function(x, n){
      let values = _crypto_.randomBytes(n)
      if(values){
        for (let i = 0; i < n; i++) x[i] = values[i];
        //cleanup
        for (let i = 0; i < values.length; i++) values[i] = 0;
      }
  });
  
  const keys = nacl.box.keyPair();
  const publicKeyHex = bufferToHex(keys.publicKey);
  const privateKeyHex = bufferToHex(keys.secretKey);

  return { privateKey: keys.secretKey, publicKey: keys.publicKey, privateKeyHex, publicKeyHex };
}

export default newKeypair;
