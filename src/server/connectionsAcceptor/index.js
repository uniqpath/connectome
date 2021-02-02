//import { EventEmitter } from '../../utils/index.js';
import WsServer from './wsServer.js';
import initializeConnection from './initializeConnection.js';

import ReadableStore from '../../stores/front/helperStores/readableStore.js';

import { compareValues } from '../../utils/sorting/sorting.js';

import ChannelList from '../channel/channelList.js';

class ConnectionsAcceptor extends ReadableStore {
  constructor({ ssl = false, port, keypair, verbose, server }) {
    super({ connectionList: [] });
    this.server = server;
    this.ssl = ssl;
    this.port = port;
    this.keypair = keypair;
    this.verbose = verbose;

    this.protocols = {};
  }

  registerProtocol({ protocol, lane, onConnect }) {
    if (this.wsServer) {
      throw new Error('registerProtocol: Please add all protocols before starting the ws server.');
    }

    this.emit('protocol_added', { protocol, lane });

    if (!this.protocols[protocol]) {
      this.protocols[protocol] = {};
    }

    if (!this.protocols[protocol][lane]) {
      const channelList = new ChannelList({ protocol, lane });
      this.protocols[protocol][lane] = { onConnect, channelList };
      return channelList;
    }

    throw new Error(`Protocol lane ${protocol}/${lane} already exists`);
  }

  start() {
    this.wsServer = new WsServer({
      ssl: this.ssl,
      port: this.port,
      verbose: this.verbose,
      server: this.server
    });

    this.wsServer.on('connection', channel => {
      initializeConnection({ server: this, channel });
    });

    // initializeConnection above will emit 'connection' on this object after Diffie-Hellman handshake!
    this.on('connection', () => {
      this.publishState();
    });

    this.wsServer.on('connection_closed', channel => {
      this.emit('connection_closed', channel);
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

  registeredProtocols() {
    return Object.entries(this.protocols).map(([protocol, lanes]) => {
      return { protocol, lanes: Object.keys(lanes) };
    });
  }

  connectionList() {
    const list = this.wsServer.enumerateConnections().reverse();
    const order = compareValues('protocol', 'lane');
    return list.sort(order);
  }
}

export default ConnectionsAcceptor;
