//import { WebSocketServer } from 'ws';
import WebSocket from 'ws';

import { EventEmitter } from '../../utils/index.js';

import getRemoteHost from '../channel/getRemoteHost.js';
import getRemoteIp from '../channel/getRemoteIp.js';
import Channel from '../channel/channel.js';

function noop() {}

function heartbeat() {
  this.isAlive = true;
}

// example of ssl server that can be passed in as `server`
// const { certPath, keyPath } = ssl;

// const server = https.createServer({
//   cert: fs.readFileSync(certPath),
//   key: fs.readFileSync(keyPath)
// });

class WsServer extends EventEmitter {
  constructor({ port, server, log = console.log, verbose }) {
    super();

    process.nextTick(() => {
      // const handleProtocols = (protocols, request) => {
      //   return protocols[0];
      // };

      if (server) {
        this.webSocketServer = new WebSocket.Server({ server });
        //this.webSocketServer = new WebSocketServer({ server, handleProtocols });
      } else {
        this.webSocketServer = new WebSocket.Server({ port });
        //this.webSocketServer = new WebSocketServer({ port, handleProtocols });
      }

      this.continueSetup({ log, verbose });
    });
  }

  continueSetup({ log, verbose }) {
    this.webSocketServer.on('connection', (ws, req) => {
      // https://github.com/websockets/ws/issues/1354
      // Websocket RangeError: Invalid WebSocket frame: RSV2 and RSV3 must be clear
      // https://stackoverflow.com/questions/45303733/error-rsv2-and-rsv3-must-be-clear-in-ws
      // this should possibly help, not yet confirmed!
      ws.on('error', e => {
        const log2 = log.yellow || log;
        log2('Handled Websocket issue (probably a malformed websocket connection):');
        log2(e);
        // log.red => assume dmt logger
        // log => assume console.log
      });

      const channel = new Channel(ws, { log, verbose });

      const wsId = Math.round(10 ** 5 * Math.random()).toString();
      ws.__id = wsId;
      const log3 = log.red || log;
      log3(`Created new channel ${channel.ident}, ws id: ${wsId}`);

      channel._remoteIp = getRemoteIp(req);
      channel._remoteAddress = getRemoteHost(req);

      channel.connectedAt = Date.now();

      ws._connectomeChannel = channel;

      channel.on('disconnect', () => {
        this.emit('connection_closed', channel);
      });

      this.emit('connection', channel);

      ws.isAlive = true;
      ws.on('pong', heartbeat);

      ws.on('message', message => {
        if (ws.terminated) {
          return;
        }

        ws.isAlive = true;

        if (message == 'ping') {
          if (ws.readyState == ws.OPEN) {
            try {
              ws.send('pong');
            } catch (e) {}
          }
          return;
        }

        channel.messageReceived(message);
      });
    });

    this.periodicCleanupAndPing();
  }

  // 💡 this method here is incoming connections list
  // 💡⚠️ and it has to have THE SAME properties as connectorPool::connectionList
  // 💡 (which is used to get outgoing connections list)
  enumerateConnections() {
    const list = [];

    this.webSocketServer.clients.forEach(ws => {
      list.push({
        address: ws._connectomeChannel.remoteAddress() || ws._connectomeChannel.remoteIp(),
        //protocol: ws.protocol,
        protocol: ws._connectomeChannel.protocol,
        remotePubkeyHex: ws._connectomeChannel.remotePubkeyHex(),
        ready: ws._connectomeChannel.isReady({ warn: false }), // 💡 connected and agreed on shared key .. so far only used in informative cli `dmt connections` list, otherwise we never have to check for this in our distributed systems logic
        //💡 informative-nature only, not used for distributed system logic
        readyState: ws.readyState, // 💡 underlying ws-connection original 'readyState' -- useful only for debugging purposes, otherwise it's just informative
        connectedAt: ws._connectomeChannel.connectedAt,
        lastMessageAt: ws._connectomeChannel.lastMessageAt
      });
    });

    return list;
  }

  periodicCleanupAndPing() {
    this.webSocketServer.clients.forEach(ws => {
      if (ws.terminated) {
        return;
      }

      if (ws.isAlive === false) {
        return ws.terminate();
      }

      ws.isAlive = false;
      ws.ping(noop); // probably does nothing, we don't handle this on frontend, no actual need
    });

    setTimeout(() => {
      this.periodicCleanupAndPing();
    }, 10000);
  }
}

export default WsServer;
