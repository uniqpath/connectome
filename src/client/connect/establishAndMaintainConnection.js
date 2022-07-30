const browser = typeof window !== 'undefined';

const wsCONNECTING = 0;
const wsOPEN = 1;
//const wsCLOSING = 2;
//const wsCLOSED = 3;

// it was 5 for long time, 2 seems to be working great!
// now testing one
const CONN_IDLE_TICKS = 2;

// connection tick
const CONN_CHECK_INTERVAL = 1000; // was 1500 for a long time, then 1000 seemed to work ok, now testing 500

//⚠️ TODO: pass CONN_CHECK_INTERVAL and/or CONN_IDLE_TICKS as params to connect function
// and supply 500 / 1 from multiconnected store .. because it works locally
// then mayme make defaults 1000 / 2 for WAN connections ... decide later after some more testing

import Connector from '../connector/connector.js';
import determineEndpoint from './determineEndpoint.js';

import logger from '../../utils/logger/logger.js';

//todo: remove 'dummy' argument once legacyLib with old MCS is history
function establishAndMaintainConnection(
  { endpoint, host, port, protocol, keypair, remotePubkey, rpcRequestTimeout, log, verbose, tag, dummy },
  { WebSocket }
) {
  endpoint = determineEndpoint({ endpoint, host, port });

  const connector = new Connector({
    endpoint,
    protocol,
    rpcRequestTimeout,
    keypair,
    verbose,
    tag,
    log,
    dummy
  });

  const reconnect = () => {
    tryReconnect({ connector, endpoint }, { WebSocket, reconnect, log, verbose });
  };

  connector.connection = {
    terminate() {
      this.websocket._removeAllCallbacks();
      this.websocket.close();
      //connector.connectStatus(undefined);
      connector.connectStatus(false);
      //reconnect();
      // especially important in multiconnected store
      setTimeout(reconnect, MAX_RECONNECT_DELAY_AFTER_WS_CLOSE * Math.random());
    },
    endpoint,
    checkTicker: 0
  };

  const callback = () => {
    if (!connector.decommissioned) {
      checkConnection({ connector, reconnect, log });
      setTimeout(callback, CONN_CHECK_INTERVAL);
    }
  };

  // setTimeout(() => tryReconnect({ connector, endpoint }, { WebSocket, log, verbose }), 10);
  // setTimeout(callback, CONN_CHECK_INTERVAL);
  setTimeout(callback, 10);

  return connector;
}

export default establishAndMaintainConnection;

function checkConnection({ connector, reconnect, log }) {
  const conn = connector.connection;

  //if (verbose && (connectionIdle(conn) || connector.decommissioned)) {
  if (connectionIdle(conn) || connector.decommissioned) {
    if (connectionIdle(conn)) {
      connector.emit('inactive_connection');
      logger.yellow(log, `✖ Terminating inactive connection ${connector.connection.endpoint}`);
    } else {
      logger.yellow(
        log,
        `Connection ${connector.connection.endpoint} decommisioned, closing websocket ${conn.websocket.__id}, will not retry again `
      );
    }

    conn.terminate();
    return;
  }

  const connected = socketConnected(conn);

  if (connected) {
    conn.websocket.send('ping');
  } else {
    if (connector.connected == undefined) {
      logger.write(log, 'Setting connector status to FALSE because connector.connected is undefined');
      connector.connectStatus(false);
    }

    //tryReconnect({ connector, endpoint }, { WebSocket, log, verbose });
    reconnect();
  }

  conn.checkTicker += 1;
}

function tryReconnect({ connector, endpoint }, { WebSocket, reconnect, log, verbose }) {
  const conn = connector.connection;

  // console.log(`Try reconnect: ${endpoint}, ${conn?.currentlyTryingWS?.readyState}`);

  if (conn.currentlyTryingWS && conn.currentlyTryingWS.readyState == wsCONNECTING) {
    if (conn.currentlyTryingWS._waitForConnectCounter == WAIT_FOR_NEW_CONN_TICKS) {
      if (verbose) {
        logger.write(log, `${endpoint} took to long to connect, discarding ws`);
      }

      conn.currentlyTryingWS._removeAllCallbacks();
      conn.currentlyTryingWS.close();
    } else {
      conn.currentlyTryingWS._waitForConnectCounter += 1;
      // console.log(
      //   `Increaed new ws connection retry counter to ${conn.currentlyTryingWS._waitForConnectCounter}`
      // );
      return;
    }
  }

  const ws = new WebSocket(endpoint);
  ws.__id = Math.random();

  if (verbose) {
    logger.write(log, `Created new websocket ${conn.endpoint}`);
  }

  conn.currentlyTryingWS = ws;
  conn.currentlyTryingWS._waitForConnectCounter = 0;

  if (browser) {
    ws.binaryType = 'arraybuffer';
  }

  if (!browser) {
    ws.on('error', () => {});
  }

  const openCallback = () => {
    if (verbose) {
      logger.write(log, `websocket ${endpoint} connection opened`);
    }

    conn.currentlyTryingWS = null;
    conn.checkTicker = 0;
    addSocketListeners({ ws, connector, openCallback, reconnect }, { log, verbose });

    conn.websocket = ws;
    connector.connectStatus(true);
  };

  ws._removeAllCallbacks = () => {
    ws.removeEventListener('open', openCallback);
  };

  if (browser) {
    ws.addEventListener('open', openCallback);
  } else {
    ws.on('open', openCallback);
  }
}

function addSocketListeners({ ws, connector, openCallback, reconnect }, { log, verbose }) {
  const conn = connector.connection;

  const errorCallback = event => {
    //const msg = `websocket ${ws.__id} conn ${connector.connection.endpoint} error`;
    const msg = `websocket ${connector.connection.endpoint} error`;
    // whould not output normally since error events happen mostly on iphone.. didn't usually happen on desktop browsers or nodejs
    // this is also not standardized, it outputs nothing useful and we always get close event immediately after this error event
    console.log(msg);
    console.log(event);
    // this also wasn't useful / didn't work everywhere: ws.onerror = error => {}
  };

  const closeCallback = () => {
    logger.write(log, `✖ Connection ${connector.connection.endpoint} closed`);

    connector.connectStatus(undefined);
    //connector.connectStatus(false);
    // especially important in multiconnected store:
    setTimeout(reconnect, MAX_RECONNECT_DELAY_AFTER_WS_CLOSE * Math.random());
  };

  const messageCallback = _msg => {
    conn.checkTicker = 0;

    const msg = browser ? _msg.data : _msg;

    if (msg == 'pong') {
      connector.emit('pong');
      return;
    }

    let jsonData;

    try {
      jsonData = JSON.parse(msg);
    } catch (e) {}

    if (jsonData) {
      connector.wireReceive({ jsonData, rawMessage: msg });
    } else {
      const encryptedData = browser ? new Uint8Array(msg) : msg;
      connector.wireReceive({ encryptedData });
    }
  };

  ws._removeAllCallbacks = () => {
    ws.removeEventListener('error', errorCallback);
    ws.removeEventListener('close', closeCallback);
    ws.removeEventListener('message', messageCallback);

    ws.removeEventListener('open', openCallback);
  };

  if (browser) {
    ws.addEventListener('error', errorCallback);
    ws.addEventListener('close', closeCallback);
    ws.addEventListener('message', messageCallback);
  } else {
    ws.on('error', errorCallback);
    ws.on('close', closeCallback);
    ws.on('message', messageCallback);
  }
}

function socketConnected(conn) {
  return conn.websocket && conn.websocket.readyState == wsOPEN;
}

function connectionIdle(conn) {
  return socketConnected(conn) && conn.checkTicker > CONN_IDLE_TICKS;
}
