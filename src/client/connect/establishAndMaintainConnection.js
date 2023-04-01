const browser = typeof window !== 'undefined';

const wsCONNECTING = 0;
const wsOPEN = 1;
//const wsCLOSING = 2;
//const wsCLOSED = 3;

// connection tick
const CONN_CHECK_INTERVAL = 1000; // was 1500 for a long time, then 1000 seemed to work ok, 800 was prehaps a bit too low

// it was 5 for long time (and with higher CONN_CHECK_INTERVAL), 3 seems to be working great now (CONN_CHECK_INTERVAL=800), sweet balance!
// 1,2 is too low... some raspberries when busy (switching songs / just starting dmt-proc) can easily miss out on sending pongs at the right moment
const CONN_IDLE_TICKS = 3;

// how long to wait for a new websocket to connect... after this we cancel it
const WAIT_FOR_NEW_CONN_TICKS = 5; // 5000 ms ( = (5) * CONN_CHECK_INTERVAL )

//from zero to this much ms delay after ws has been terminated for reconnect to be tries
//const MAX_RECONNECT_DELAY_AFTER_WS_CLOSE = 50;
//const MAX_RECONNECT_DELAY_AFTER_WS_CLOSE = 0; // todo: remove this .. and two timeout handlers

//⚠️ TODO: pass CONN_CHECK_INTERVAL and/or CONN_IDLE_TICKS as params to connect function
// and supply 500 / 1 from multiconnected store .. because it works locally
// then mayme make defaults 1000 / 2 for WAN connections ... decide later after some more testing

import Connector from '../connector/connector.js';
import determineEndpoint from './determineEndpoint.js';

import logger from '../../utils/logger/logger.js';

//todo: remove 'dummy' argument once legacyLib with old MCS is history
function establishAndMaintainConnection(
  {
    endpoint,
    host,
    port,
    protocol,
    keypair,
    remotePubkey,
    rpcRequestTimeout,
    autoDecommission,
    log,
    verbose,
    tag,
    dummy
  },
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
    autoDecommission,
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
      reconnect();
      //for multiconnected store ↴ so that not everything tries to reconnect at once.. oh well didn't have much influence it seems, we can do everything at once! :)
      //setTimeout(reconnect, MAX_RECONNECT_DELAY_AFTER_WS_CLOSE * Math.random());
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
    if (connector.decommissioned) {
      // decommissioned
      logger.yellow(
        log,
        `${connector.endpoint} Connection decommisioned, closing websocket ${conn.websocket.__id}, will not retry again `
      );

      decommission(connector);
    } else {
      // idle connection
      connector.emit('inactive_connection');
      logger.yellow(log, `${connector.endpoint} ✖ Terminated inactive connection`);
    }

    conn.terminate();
    return;
  }

  const connected = socketConnected(conn);

  if (connected) {
    conn.websocket.send('ping');
  } else {
    if (connector.connected == undefined) {
      logger.write(
        log,
        `${connector.endpoint} Setting connector status to FALSE because connector.connected is undefined`
      );
      connector.connectStatus(false);
    }

    reconnect();
  }

  conn.checkTicker += 1;
}

function tryReconnect({ connector, endpoint }, { WebSocket, reconnect, log, verbose }) {
  const conn = connector.connection;

  // if device on the other side went missing we will usually get websocket connecting timeouts
  // so we retry WAIT_FOR_NEW_CONN_TICKS times (4800ms in total) and then discard the current websocket
  // and we again try the same with a new WebSocket
  // if device (IP) is online but websocket server is not responsing / program not running, then ...
  // [ see explanation a few lines below] ...

  connector.checkForDecommission();

  if (connector.decommissioned) {
    decommission(connector); // our side of things -- tear down any ws callbacks
    return;
  }

  //logger.write(log, `${endpoint} CONN_TICK`);
  //logger.write(log, `${endpoint} wsReadyState ${conn.currentlyTryingWS?.readyState}`);

  if (conn.currentlyTryingWS && conn.currentlyTryingWS.readyState == wsCONNECTING) {
    if (conn.currentlyTryingWS._waitForConnectCounter < WAIT_FOR_NEW_CONN_TICKS) {
      //logger.write(log, `${endpoint} wsCONNECTING`);
      conn.currentlyTryingWS._waitForConnectCounter += 1;
      return;
    }

    if (verbose || browser) {
      logger.write(log, `${endpoint} Reconnect timeout, creating new ws`);
    }

    conn.currentlyTryingWS._removeAllCallbacks();
    conn.currentlyTryingWS.close();
  } else if (verbose || browser) {
    logger.write(log, `${endpoint} Created new websocket`);
  }

  // so in case when device is online but websocket server is not running we usually
  // get immediate close event (websocket readyState becomes CLOSED) and we land here every
  // CONN_CHECK_INTERVAL ms to create a new WebSocket and try again with a new WebSocket
  // which will again fail immediately until it can successfuly connect (process is running)
  // if in addition to process not running the devices goes offline, then we get long delays again
  // (see above)... and we try with a new websocket every 4800ms again instead on every tick (800ms)

  const ws = new WebSocket(endpoint);
  ws.__id = Math.random();

  conn.currentlyTryingWS = ws;
  conn.currentlyTryingWS._waitForConnectCounter = 0;

  if (browser) {
    ws.binaryType = 'arraybuffer';
  }

  if (!browser) {
    ws.on('error', () => {});
  }

  const openCallback = () => {
    // should not come here because we remove open callbacks, but sometimes it might
    if (connector.decommissioned) {
      return;
    }

    if (verbose || browser) {
      logger.write(log, `${endpoint} Websocket open`);
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
    //const msg = `websocket ${ws.__id} conn ${connector.endpoint} error`;
    const msg = `${connector.endpoint} Websocket error`;
    // whould not output normally since error events happen mostly on iphone.. didn't usually happen on desktop browsers or nodejs
    // this is also not standardized, it outputs nothing useful and we always get close event immediately after this error event
    console.log(msg);
    console.log(event);
    // this also wasn't useful / didn't work everywhere: ws.onerror = error => {}
  };

  const closeCallback = () => {
    logger.write(log, `${connector.endpoint} ✖ Connection [ ${connector.protocol} ] closed`);

    if (connector.decommissioned) {
      connector.connectStatus(false);
      return;
    }

    // when switching back to dmt-mobile it will usually quickly close the old connection and reconnect
    // we want some buffer delay (see connector::ADJUST_UNDEFINED_CONNECTION_STATUS_DELAY) as we had on first connection
    // where we don't show red x for some short time so that ws has a chance to connect first ... looks better in the UI
    // flip side is that there is such small delay between when we stop some process and when red x appears... but it's quite ok!
    // we do however disable all commands immediately ... so: show red X when connect status is FALSE excusively and disable all gui actions when it's NOT TRUE (false or undefined)
    connector.connectStatus(undefined);
    reconnect();
    //setTimeout(reconnect, MAX_RECONNECT_DELAY_AFTER_WS_CLOSE * Math.random()); // turns out we don't really need to do these delays, works fine without
  };

  const messageCallback = _msg => {
    if (connector.decommissioned) {
      return;
    }

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

function decommission(connector) {
  const conn = connector.connection;

  if (conn.currentlyTryingWS) {
    conn.currentlyTryingWS._removeAllCallbacks();
    conn.currentlyTryingWS.close();
    conn.currentlyTryingWS = null;
  }

  if (conn.ws) {
    conn.ws._removeAllCallbacks();
    conn.ws.close();
    conn.ws = null;
  }

  connector.connectStatus(false);
}

function socketConnected(conn) {
  return conn.websocket && conn.websocket.readyState == wsOPEN;
}

function connectionIdle(conn) {
  return socketConnected(conn) && conn.checkTicker > CONN_IDLE_TICKS;
}
