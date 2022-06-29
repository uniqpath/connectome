import WebSocket from 'ws';

import _establishAndMaintainConnection from './establishAndMaintainConnection.js';

function establishAndMaintainConnection(opts) {
  return _establishAndMaintainConnection(opts, { WebSocket, log: opts.log || console.log });
}

export default establishAndMaintainConnection;
