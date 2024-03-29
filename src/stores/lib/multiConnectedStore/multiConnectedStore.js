import WritableStore from '../helperStores/writableStore.js';
import MergeStore from '../helperStores/mergeStore.js';

import { newKeypair, acceptKeypair } from '../../../utils/crypto/index.js';

import ConnectDevice from './helpers/connectDevice.js';
import Foreground from './helpers/foreground.js';
import SwitchDevice from './helpers/switchDevice.js';

import notificationsExpireAndCalculateRelativeTime from './helpers/notificationsExpireAndCalculateRelativeTime.js';

//import logger from '../../../utils/logger/logger.js';

const NOTIFICATIONS_CHECK_INTERVAL = 500;

class MultiConnectedStore extends MergeStore {
  constructor({
    //endpoint,
    host,
    port,
    protocol,
    keypair = newKeypair(),
    connectToDeviceKey,
    rpcRequestTimeout = 3000,
    log,
    verbose
  }) {
    super();

    const thisDeviceStateKeys = ['time', 'environment', 'nearbyDevices', 'nearbySensors', 'notifications'];

    const { publicKey, privateKey } = acceptKeypair(keypair);

    this.publicKey = publicKey;
    this.privateKey = privateKey;

    // used when connecting each device ... passed into connect function
    this.keypair = keypair;

    this.port = port;
    this.protocol = protocol;

    this.log = log;
    this.rpcRequestTimeout = rpcRequestTimeout;
    this.verbose = verbose;

    this.connectors = {};

    this.connected = new WritableStore(); // is currently active store connected ?

    const foreground = new Foreground({ mcs: this, thisDeviceStateKeys });
    const connectDevice = new ConnectDevice({ mcs: this, foreground, connectToDeviceKey });

    this.connectDevice = connectDevice; // used only for preconnect method

    this.switchDevice = new SwitchDevice({ mcs: this, connectDevice, foreground });
    this.switchDevice.on('connect_to_device_key_failed', () => {
      this.emit('connect_to_device_key_failed');
    });

    // use from the outside as part of api as well, see dmt-mobile app
    this.localConnector = connectDevice.connectThisDevice({ host });

    this._notificationsExpireAndCalculateRelativeTime();
  }

  // we don't do the same for environment (sensors) and nearbuDevices
  // we don't expire these at frontend because it's less critical
  // and for nearbyDevices it's even better to keep...
  // notifications are more critical and we need to expire at frontend when dmt-proc is down
  _notificationsExpireAndCalculateRelativeTime() {
    const { notifications } = this.get();

    this.setMerge({ notifications: notificationsExpireAndCalculateRelativeTime(notifications) });

    setTimeout(() => {
      this._notificationsExpireAndCalculateRelativeTime();
    }, NOTIFICATIONS_CHECK_INTERVAL);
  }

  signal(signal, data) {
    if (this.activeConnector()) {
      this.activeConnector().signal(signal, data);
    } else {
      console.log(
        `MCS: Error emitting remote signal ${signal} / ${data}. Debug info: activeDeviceKey=${this.activeDeviceKey()}`
      );
    }
  }

  signalLocalDevice(signal, data) {
    this.localConnector.signal(signal, data);
  }

  remoteObject(objectName) {
    if (this.activeConnector()) {
      return this.activeConnector().remoteObject(objectName);
    }

    console.log(
      `Error obtaining remote object ${objectName}. Debug info: activeDeviceKey=${this.activeDeviceKey()}`
    );
  }

  // returns corresponding connector
  preconnect({ host, deviceKey, thisDevice }) {
    if (thisDevice) {
      return this.localConnector;
    }

    return this.connectDevice.connectOtherDevice({ host, deviceKey });
  }

  switch({ host, deviceKey, deviceName }) {
    this.switchDevice.switch({ host, deviceKey, deviceName });
  }

  activeConnector() {
    if (this.activeDeviceKey()) {
      return this.connectors[this.activeDeviceKey()];
    }
  }

  activeDeviceKey() {
    return this.get().activeDeviceKey;
  }
}

export default MultiConnectedStore;
