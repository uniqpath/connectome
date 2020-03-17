import Channel from './moleChannel';

import * as mole from './mole';

const { MoleClient, ClientTransport } = mole;

class RpcClient {
  constructor(connector) {
    this.connector = connector;
    this.remoteObjects = {};
  }

  remoteObject(methodPrefix) {
    const remoteObject = this.remoteObjects[methodPrefix];
    if (!remoteObject) {
      this.remoteObjects[methodPrefix] = new SpecificRpcClient(this.connector, methodPrefix);
    }
    return this.remoteObjects[methodPrefix];
  }

  jsonrpcMsgReceive(stringMessage) {
    for (const remoteObject of Object.values(this.remoteObjects)) {
      remoteObject.jsonrpcMsgReceive(stringMessage);
    }
  }
}

class SpecificRpcClient {
  constructor(connector, methodPrefix) {
    this.moleChannel = new Channel(connector);
    this.methodPrefix = methodPrefix;

    this.client = new MoleClient({
      requestTimeout: 1000,
      transport: new ClientTransport(this.moleChannel)
    });
  }

  jsonrpcMsgReceive(stringMessage) {
    this.moleChannel.emit('json_rpc', stringMessage);
  }

  call(methodName, params) {
    return this.client.callMethod(`${this.methodPrefix}::${methodName}`, params);
  }
}

export default RpcClient;
