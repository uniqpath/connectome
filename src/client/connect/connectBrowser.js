function timed_console_log(msg) {
  console.log(`${new Date().toLocaleString()} → ${msg}`);
}

import _establishAndMaintainConnection from './establishAndMaintainConnection.js';

function establishAndMaintainConnection(opts) {
  return _establishAndMaintainConnection(opts, { WebSocket, log: opts.log || timed_console_log });
}

export default establishAndMaintainConnection;
