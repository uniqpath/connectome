import fastJsonPatch from 'fast-json-patch';

import connect from '../connect/connectBrowser';
import SimpleStore from './simpleStore';

const { applyPatch: applyJSONPatch } = fastJsonPatch;

class ConnectedStore extends SimpleStore {
  constructor({ ip, ssl = false, port, protocol, protocolLane, clientPrivateKey, clientPublicKey, logStore, rpcRequestTimeout, verbose } = {}) {
    super();

    if (!ip) {
      throw new Error('ConnectedStore: missing ip');
    }

    this.ssl = ssl;
    this.protocol = protocol;
    this.protocolLane = protocolLane;

    this.logStore = logStore;
    this.verbose = verbose;

    this.rpcRequestTimeout = rpcRequestTimeout;

    this.connect(ip, port, clientPrivateKey, clientPublicKey);
  }

  action({ action, namespace, payload }) {
    if (this.connector.connected) {
      console.log(`Sending action ${action} over connector ${this.connector.address}`);
      this.connector.send({ action, namespace, payload });
    } else {
      console.log(
        'Warning: trying to send action over disconnected connector, this should be prevented by GUI (to disable any state-changing element when not connected)'
      );
    }
  }

  remoteObject(handle) {
    return this.connector.remoteObject(handle);
  }

  connect(address, port, clientPrivateKey, clientPublicKey) {
    connect({
      address,
      ssl: this.ssl,
      port,
      protocol: this.protocol,
      protocolLane: this.protocolLane,
      clientPrivateKey,
      clientPublicKey,
      rpcRequestTimeout: this.rpcRequestTimeout,
      verbose: this.verbose
    }).then(connector => {
      this.connector = connector;

      connector.on('ready', ({ sharedSecret, sharedSecretHex }) => {
        this.set({ connected: true });

        this.emit('ready');
      });

      // 💡 connected == undefined ==> while trying to connect
      // 💡 connected == false => while disconnected
      // 💡 connected == true => while connected
      setTimeout(() => {
        if (this.connected == undefined) {
          this.set({ connected: false });
        }
      }, 300);

      connector.on('disconnected', () => {
        this.set({ connected: false });
      });

      // 💡 Special incoming JSON message: { state: ... } ... parsed as part of 'Connectome State Syncing Protocol'
      connector.on('receive_state', state => {
        this.wireStateReceived = true;

        if (this.verbose) {
          console.log(`New store ${address} / ${this.protocol} / ${this.protocolLane} state:`);
          console.log(state);
        }

        this.set(state);
      });

      // 💡 Special incoming JSON message: { diff: ... } ... parsed as part of 'Connectome State Syncing Protocol'
      connector.on('receive_diff', diff => {
        if (this.wireStateReceived) {
          applyJSONPatch(this.state, diff);
          this.pushStateToSubscribers();
        }
      });
    });
  }
}

export default ConnectedStore;