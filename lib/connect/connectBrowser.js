import util from '../util';
import _establishAndMaintainConnection from './establishAndMaintainConnection';

const { log } = util;

function establishAndMaintainConnection({ obj, endpoint, protocol, resumeNow, debug }) {
  return new Promise((success, reject) => {
    success(_establishAndMaintainConnection({ obj, endpoint, protocol, resumeNow, debug }, { WebSocket, log }));
  });
}

export default establishAndMaintainConnection;
