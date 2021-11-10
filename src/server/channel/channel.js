import send from './send.js';
import receive from './receive.js';

import { EventEmitter, listify } from '../../utils/index.js';

import RpcClient from '../../client/rpc/client.js';

import RPCTarget from '../../client/rpc/RPCTarget.js';

import WritableStore from '../../stores/front/helperStores/writableStore.js';

class Channel extends EventEmitter {
  constructor(ws, { rpcRequestTimeout, verbose = false }) {
    super();
    this.ws = ws;
    this.verbose = verbose;

    //this.protocol = ws.protocol;

    this.reverseRpcClient = new RpcClient(this, rpcRequestTimeout);

    this.sentCount = 0;
    this.receivedCount = 0;

    this.stateFields = {};
    this.stateFieldsSubscriptions = [];

    ws.on('close', () => {
      Object.values(this.stateFieldsSubscriptions).forEach(unsubscribe => unsubscribe());
      this.emit('disconnect');
    });
  }

  // Usage:
  //
  // per-channel (connection) state
  //
  // state('name', state) OR
  // state('name').set(state)
  //
  // we don't do diffing on clientside here, no need and it would be extemely hard to maintain in sync
  // this is for syncing per-state smaller state
  //
  // however when setting state state on backend we do check if there was any diff and only then send the entire state over
  //
  // always change state state in response to some frontend action through that channel..
  // not through timer or something like this.. channel may be long dead
  state(name, _state) {
    if (!this.stateFields[name]) {
      this.stateFields[name] = new WritableStore();

      let first = true;
      const unsubscribe = this.stateFields[name].subscribe(state => {
        // after first subscribing we will get empty state
        // and we don't need to send this over the channel
        if (!first) {
          this.send({ stateField: { name, state } });
        }
        first = false;
      });

      this.stateFieldsSubscriptions.push(unsubscribe);
    }

    if (_state) {
      this.stateFields[name].set(_state);
    }

    return this.stateFields[name];
  }

  clearState(...names) {
    names.forEach(name => this.state(name).set(undefined));
  }

  setProtocol(protocol) {
    this.protocol = protocol;
  }

  setSharedSecret(sharedSecret) {
    this.sharedSecret = sharedSecret;
  }

  isReady({ warn = true } = {}) {
    if (warn) {
      console.log(
        "LIB USAGE WARNING ⚠️  we normally don't have to check if channel is ready because we already get it prepared"
      );
      console.log('If you really need to do this, call isReady like this: isReady({ warn: false })');
    }
    return !!this.sharedSecret;
  }

  remoteAddress() {
    return this._remoteAddress;
  }

  remoteIp() {
    return this._remoteIp;
  }

  setRemotePubkeyHex(remotePubkeyHex) {
    this._remotePubkeyHex = remotePubkeyHex;
  }

  remotePubkeyHex() {
    return this._remotePubkeyHex;
  }

  // 💡 message is string, binary or json (automatically stringified before sending)
  send(message) {
    send({ message, channel: this });
    this.sentCount += 1;
  }

  signal(signal, data) {
    this.send({ signal, data });
  }

  // 💡 we have to send a "special message" { state: {…} } to sync state to frontend ('other side')
  // 💡 { state: {…} } agreement is part of lower level simple connectome protocol along with { diff: { … }}, { action: { … }} (in other direction) and some others
  // 💡 we document this SOON
  // sendState(state) {
  //   this.send({ state });
  // }

  messageReceived(message) {
    receive({ message, channel: this });
    this.receivedCount += 1;
  }

  attachObject(handle, obj) {
    new RPCTarget({ serversideChannel: this, serverMethods: obj, methodPrefix: handle });
  }

  remoteObject(handle) {
    return {
      call: (methodName, params = []) => {
        return this.reverseRpcClient.remoteObject(handle).call(methodName, listify(params));
      }
    };
  }

  terminate() {
    this.ws.terminated = true;

    this.ws.close();

    process.nextTick(() => {
      if ([this.ws.OPEN, this.ws.CLOSING].includes(this.ws.readyState)) {
        this.ws.terminate();
      }
    });
  }

  terminated() {
    return this.ws.terminated;
  }

  closed() {
    return [this.ws.CLOSED, this.ws.CLOSING].includes(this.ws.readyState);
  }
}

export default Channel;
