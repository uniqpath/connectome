import connect from '../connect/connectNode.js';

import { orderBy } from '../../utils/sorting/sorting.js';

import ReadableStore from '../../stores/lib/helperStores/readableStore.js';

class ConnectorPool extends ReadableStore {
  constructor(options) {
    super({ connectionList: [] });

    this.options = options;

    this.connectors = {};
    this.isPreparingConnector = {};
  }

  getConnector({ endpoint, host, port, tag }) {
    const hostWithPort = endpoint || `${host}:${port}`;

    if (!host || !port) {
      throw new Error(`Must provide both host and port: ${hostWithPort}`);
    }

    return new Promise((success, reject) => {
      if (!this.connectors[hostWithPort]) {
        const connector = connect({ ...this.options, ...{ endpoint, host, port, tag } });
        this.connectors[hostWithPort] = connector;
        this.setupConnectorReactivity(connector);
      }

      success(this.connectors[hostWithPort]);

      // if (this.connectors[hostWithPort]) {
      //   success(this.connectors[hostWithPort]);
      //   return;
      // }

      // if (this.isPreparingConnector[hostWithPort]) {
      //   setTimeout(() => {
      //     this.getConnector({ host, port, tag }).then(success);
      //   }, 10);
      // } else {
      //   this.isPreparingConnector[hostWithPort] = true;

      //   firstConnectWaitAndContinue({ ...this.options, ...{ endpoint, host, port, tag } }).then(connector => {
      //     this.connectors[hostWithPort] = connector;
      //     this.isPreparingConnector[hostWithPort] = false;

      //     // part of reactive outgoingConnections feature :: ConnectorPool as reactive (Readable)Store
      //     this.setupConnectorReactivity(connector);

      //     success(connector);
      //   });
      // }
    });
  }

  // part of reactive outgoingConnections feature :: ConnectorPool as reactive (Readable)Store
  // ⚠️ lastMessageAt IS NOT REACTIVE !!
  setupConnectorReactivity(connector) {
    this.publishState();

    connector.on('ready', () => {
      this.publishState();
    });

    connector.on('disconnect', () => {
      this.publishState();
    });
  }

  // part of reactive outgoingConnections feature :: ConnectorPool as reactive (Readable)Store
  publishState() {
    const connectionList = this.connectionList();

    // we delete attributes that are not reactive
    // we won't publish new state on each new message just for statistics
    // too much state syncing...
    // but this can read on request, for example via CLI:
    // dmt connections
    // there the lastMessageAt attribute will be included
    connectionList.forEach(connection => {
      delete connection.lastMessageAt;
      delete connection.readyState; // maybe we'll make it reactive but we probably don't need that either
    });

    // this is the same as "set()" in writable store
    this.state = { connectionList };
    this.announceStateChange();
  }

  // 💡 this method here is outgoing connections list
  // 💡 ⚠️ and it has to have THE SAME properties as wsServer::enumerateConnections
  // 💡 (which is used to get incoming connections list)
  connectionList() {
    const list = Object.entries(this.connectors).map(([address, conn]) => {
      return {
        address,
        protocol: conn.protocol,
        //lane: conn.lane,
        remotePubkeyHex: conn.remotePubkeyHex(),
        ready: conn.isReady(), // 💡 connected and agreed on shared key ... used to determine if we can already send via connector or "we wait for the next rouund"
        //💡 informative-nature only, not used for distributed system logic
        readyState: conn.connection && conn.connection.websocket ? conn.connection.websocket.readyState : '?', // 💡 underlying ws-connection original 'readyState' -- useful only for debugging purposes, otherwise it's just informative
        connectedAt: conn.connectedAt,
        lastMessageAt: conn.lastMessageAt
      };
    });

    const order = orderBy('protocol');
    return list.sort(order);
  }
}

export default ConnectorPool;
