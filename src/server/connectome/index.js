//import { EventEmitter } from '../../utils/index.js';
import WsServer from './wsServer.js';
import initializeConnection from './initializeConnection.js';

import ReadableStore from '../../stores/lib/helperStores/readableStore.js';

import { orderBy } from '../../utils/sorting/sorting.js';

import ChannelList from '../channel/channelList.js';

import { newKeypair } from '../../utils/crypto/index.js';

export default class Connectome extends ReadableStore {
  constructor({ port, keypair = newKeypair(), server, verbose }) {
    super({ connectionList: [] });

    this.port = port
    this.keypair = keypair;

    this.server = server;

    this.verbose = verbose;

    this.protocols = {};
  }

  registerProtocol({ protocol, onConnect = () => {} }) {
    if (this.wsServer) {
      throw new Error('registerProtocol: Please add all protocols before starting the ws server.');
    }

    this.emit('protocol_added', { protocol });

    if (!this.protocols[protocol]) {
      const channelList = new ChannelList({ protocol });
      this.protocols[protocol] = { onConnect, channelList };
      return channelList;
    }

    throw new Error(`Protocol ${protocol} already exists`);
  }

  start() {
    this.wsServer = new WsServer({
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
    return Object.keys(this.protocols);
  }

  connectionList() {
    const list = this.wsServer.enumerateConnections().reverse();
    const order = orderBy('protocol');
    return list.sort(order);
  }
}
