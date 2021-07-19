import ConnectedStore from '../../connectedStore/connectedStore.js';

class ConnectDevice {
  constructor({ mcs, foreground, connectToDeviceKey }) {
    this.mcs = mcs;
    this.foreground = foreground;
    this.connectToDeviceKey = connectToDeviceKey;
  }

  createStore({ address }) {
    const {
      port,
      protocol,
      lane,
      logStore,
      rpcRequestTimeout,
      verbose,
      privateKey: clientPrivateKey,
      publicKey: clientPublicKey
    } = this.mcs;

    return new ConnectedStore({
      address,
      port,
      protocol,
      lane,
      clientPrivateKey,
      clientPublicKey,
      logStore,
      rpcRequestTimeout,
      verbose
    });
  }

  getDeviceKey(state) {
    return state?.device?.deviceKey;
  }

  connectThisDevice({ address }) {
    const thisStore = this.createStore({ address });

    thisStore.subscribe(state => {
      if (!state.nearbyDevices) {
        state.nearbyDevices = [];
      }

      const deviceKey = this.getDeviceKey(state);

      if (deviceKey) {
        if (!this.thisDeviceAlreadySetup) {
          this.mcs.set({ activeDeviceKey: deviceKey });
          this.initNewStore({ deviceKey, store: thisStore });
        }

        const needToConnectAnotherDevice = this.connectToDeviceKey && this.connectToDeviceKey != deviceKey;

        if (!needToConnectAnotherDevice && this.mcs.activeDeviceKey() == deviceKey) {
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

    return thisStore;
  }

  connectOtherDevice({ address, deviceKey }) {
    const newStore = this.createStore({ address });

    this.initNewStore({ deviceKey, store: newStore });

    newStore.subscribe(state => {
      if (this.mcs.activeDeviceKey() == deviceKey) {
        const optimisticDeviceName = state.device ? state.device.deviceName : null;
        this.foreground.set(state, { optimisticDeviceName });
      }
    });
  }

  initNewStore({ deviceKey, store }) {
    this.mcs.stores[deviceKey] = store; // add this store to our list of multi-connected stores

    this.setConnectedStore({ deviceKey, store });
  }

  // transfer connected state from currently active connected store into the "connected" store on MultiConnectedStore
  setConnectedStore({ deviceKey, store }) {
    store.connected.subscribe(connected => {
      if (this.mcs.activeDeviceKey() == deviceKey) {
        this.mcs.connected.set(connected);
      }
    });
  }
}

export default ConnectDevice;
