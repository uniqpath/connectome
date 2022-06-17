//import ConnectedStore from '../../connectedStore/connectedStore.js';
import connect from '../../../../client/connect/connectBrowser.js';

export default class ConnectDevice {
  constructor({ mcs, foreground, connectToDeviceKey }) {
    this.mcs = mcs;
    this.foreground = foreground;
    this.connectToDeviceKey = connectToDeviceKey;
  }

  createConnector({ host }) {
    const { port, protocol, logStore, rpcRequestTimeout, verbose, keypair } = this.mcs;
    return connect({ host, port, protocol, keypair, rpcRequestTimeout, verbose });
  }

  getDeviceKey(state) {
    return state?.device?.deviceKey;
  }

  // todo: what happens if this device key changes?
  // and also other deviceKeys
  // this is rare and deviceKeys are unique identifiers for devices but still
  // at least for this device we have to handle deviceKey changes!
  // for other devices maybe it will work naturally as well
  // only that we'll keep more connected stores than neccessary who will retry connections
  // for devices that are no longer coming back under that deviceKey.. this resolves (clears) after GUI reloads
  connectThisDevice({ host }) {
    const thisConnector = this.createConnector({ host });

    thisConnector.state.subscribe(state => {
      if (!state.nearbyDevices) {
        state.nearbyDevices = [];
      }

      const deviceKey = this.getDeviceKey(state);

      if (deviceKey) {
        if (!this.thisDeviceAlreadySetup) {
          this.mcs.set({ activeDeviceKey: deviceKey });
          this.initNewConnector({ deviceKey, connector: thisConnector });
        }

        const needToConnectAnotherDevice = this.connectToDeviceKey && this.connectToDeviceKey != deviceKey;

        if (!needToConnectAnotherDevice && this.mcs.activeDeviceKey() == deviceKey) {
          // state.device?.deviceName ==> ?. is not strictly neccessary because we always assume device.deviceName in every state
          const optimisticDeviceName = state.device?.deviceName;
          this.foreground.set(state, { optimisticDeviceName });
        }

        this.foreground.setSpecial(state);

        if (!this.thisDeviceAlreadySetup) {
          if (needToConnectAnotherDevice) {
            this.mcs.switch({ deviceKey: this.connectToDeviceKey });
            delete this.connectToDeviceKey;
          }

          this.thisDeviceAlreadySetup = true;
        }
      }
    });

    return thisConnector;
  }

  connectOtherDevice({ host, deviceKey }) {
    const connector = this.createConnector({ host });

    this.initNewConnector({ deviceKey, connector });

    connector.state.subscribe(state => {
      if (this.mcs.activeDeviceKey() == deviceKey) {
        const optimisticDeviceName = state.device ? state.device.deviceName : null;
        this.foreground.set(state, { optimisticDeviceName });
      }
    });
  }

  initNewConnector({ deviceKey, connector }) {
    this.mcs.connectors[deviceKey] = connector; // add this store to our list of multi-connected stores

    this.setConnectedStore({ deviceKey, connector });
  }

  // transfer connected state from currently active connected store into the "connected" store on MultiConnectedStore
  setConnectedStore({ deviceKey, connector }) {
    connector.connected.subscribe(connected => {
      if (this.mcs.activeDeviceKey() == deviceKey) {
        this.mcs.connected.set(connected);
      }
    });
  }
}
