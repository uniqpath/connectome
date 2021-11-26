interface Keypair {
  privateKey: Buffer;
  publicKey: Buffer;
  privateKeyHex: string;
  publicKeyHex: string;
}
interface Options {
  host?: string;
  port?: string;
  endpoint?: string;
  protocol?: string;
  remotePubkey?: string;
  keypair?: Keypair;
  rpcRequestTimeout?: any;
  verbose?: boolean;
  connectToDeviceKey;
  logStore;
}
export class LogStore extends WritableStore {
  constructor();
  addToLog(
    {
      origConsoleLog,
      limit
    }: {
      origConsoleLog: any;
      limit: any;
    },
    ...args: any[]
  ): void;
}
export class MultiConnectedStore extends MergeStore {
  constructor({
    endpoint,
    host,
    port,
    protocol,
    keypair,
    connectToDeviceKey,
    logStore,
    rpcRequestTimeout,
    verbose
  }: Options);
  publicKey: any;
  privateKey: any;
  keypair: Keypair;
  port: any;
  protocol: any;
  logStore: any;
  rpcRequestTimeout: any;
  verbose?: boolean;
  connectors: Record<string, any>;
  connected: WritableStore;
  connectDevice: ConnectDevice;
  switchDevice: SwitchDevice;
  localConnector: Connector;
  signal(signal: any, data: any): void;
  signalLocalDevice(signal: any, data: any): void;
  remoteObject(objectName: any): any;
  preconnect({ host, deviceKey }: { host: any; deviceKey: any }): void;
  switch({ host, deviceKey, deviceName }: { host: any; deviceKey: any; deviceName: any }): void;
  activeConnector(): any;
  activeDeviceKey(): any;
}
export class ProtocolStore extends Eev {
  constructor(
    initialState?: {},
    {
      latent
    }?: {
      latent?: boolean;
    }
  );
  latent: boolean;
  state: any;
  lastAnnouncedState: any;
  syncOver(channelList: any): void;
  set(
    state: any,
    {
      announce
    }?: {
      announce?: boolean;
    }
  ): void;
  update(
    patch: any,
    {
      announce
    }?: {
      announce?: boolean;
    }
  ): void;
  get(): typeof this.state;
  announceStateChange(announce?: boolean): void;
}
export class SlottedStore extends Eev {
  constructor(
    initialState?: {},
    {
      loadState,
      saveState,
      omitStateFn,
      removeStateChangeFalseTriggers
    }?: {
      loadState?: any;
      saveState?: any;
      omitStateFn?: (x: any) => any;
      removeStateChangeFalseTriggers?: (x: any) => any;
    }
  );
  omitStateFn: (x: any) => any;
  saveState: any;
  removeStateChangeFalseTriggers: (x: any) => any;
  slots: Record<string, any>;
  kvStore: KeyValueStore;
  lastAnnouncedState: any;
  stateChangesCount: number;
  subscriptions: any[];
  syncOver(channelList: any): void;
  channelList: any;
  sendRemote({ state, diff }: { state: any; diff: any }): void;
  state(): Record<string, any>;
  get(key: any): any;
  omitAndCloneState(): any;
  slot(name: any): any;
  update(
    patch: any,
    {
      announce,
      skipDiffing
    }?: {
      announce?: boolean;
      skipDiffing?: boolean;
    }
  ): void;
  save(): void;
  lastSavedState: any;
  announceStateChange(announce?: boolean, skipDiffing?: boolean): void;
  tagState({ state }: { state: any }): void;
  subscribe(handler: any): () => void;
  pushStateToLocalSubscribers(): void;
}
class WritableStore extends ReadableStore {
  set(state: any): void;
}
class MergeStore extends WritableStore {
  constructor(initialState?: {});
  setMerge(patch: any): void;
  clearState({ except }?: { except?: any[] }): void;
}
class ConnectDevice {
  constructor({
    mcs,
    foreground,
    connectToDeviceKey
  }: {
    mcs: any;
    foreground: any;
    connectToDeviceKey: any;
  });
  mcs: any;
  foreground: any;
  connectToDeviceKey: any;
  createConnector({ host }: { host: any }): Connector;
  getDeviceKey(state: any): any;
  connectThisDevice({ host }: { host: any }): Connector;
  thisDeviceAlreadySetup: boolean;
  connectOtherDevice({ host, deviceKey }: { host: any; deviceKey: any }): void;
  initNewConnector({ deviceKey, connector }: { deviceKey: any; connector: any }): void;
  setConnectedStore({ deviceKey, connector }: { deviceKey: any; connector: any }): void;
}
class SwitchDevice extends Eev {
  constructor({ mcs, connectDevice, foreground }: { mcs: any; connectDevice: any; foreground: any });
  mcs: any;
  connectDevice: any;
  foreground: any;
  switchState({ deviceKey, deviceName }: { deviceKey: any; deviceName: any }): void;
  switch({ host, deviceKey, deviceName }: { host: any; deviceKey: any; deviceName: any }): void;
}
class Connector extends Eev {
  constructor({
    endpoint,
    protocol,
    keypair,
    rpcRequestTimeout,
    verbose,
    tag,
    dummy
  }?: {
    endpoint?: any;
    protocol?: any;
    keypair?: Keypair;
    rpcRequestTimeout?: any;
    verbose?: boolean;
    tag?: any;
    dummy?: any;
  });
  protocol: any;
  clientPrivateKey: any;
  clientPublicKey: any;
  clientPublicKeyHex: string;
  rpcClient: RpcClient;
  endpoint: any;
  verbose: boolean;
  tag: any;
  sentCount: number;
  receivedCount: number;
  successfulConnectsCount: number;
  state: protocolState;
  connectionState: connectionState;
  connected: WritableStore;
  send(data: any): void;
  signal(signal: any, data: any): void;
  wireReceive({
    jsonData,
    encryptedData,
    rawMessage
  }: {
    jsonData: any;
    encryptedData: any;
    rawMessage: any;
  }): void;
  field(name: any): any;
  isReady(): boolean;
  closed(): boolean;
  decommission(): void;
  decommissioned: boolean;
  connectStatus(connected: any): void;
  transportConnected: boolean;
  ready: boolean;
  connectedAt: number;
  remoteObject(handle: any): {
    call: (methodName: any, params?: any[]) => any;
  };
  attachObject(handle: any, obj: any): void;
  diffieHellman({
    clientPrivateKey,
    clientPublicKey,
    protocol
  }: {
    clientPrivateKey: any;
    clientPublicKey: any;
    protocol: any;
  }): Promise<any>;
  sharedSecret: any;
  _remotePubkeyHex: any;
  clientPubkey(): string;
  remotePubkeyHex(): any;
  remoteAddress(): any;
}
class Eev {
  __events_list: Record<string, any>;
  on(name: any, fn: any): void;
  off(name: any, fn: any): void;
  removeListener(...args: any[]): void;
  emit(name: any, data: any): void;
}
class KeyValueStore {
  state: Record<string, any>;
  update(patch: any): void;
  replaceBaseKey(baseKey: any, value: any): void;
  clearBaseKey(baseKey: any): void;
  replaceSubKey({ baseKey, key, value }: { baseKey: any; key: any; value: any }): void;
  removeSubKey({ baseKey, key }: { baseKey: any; key: any }): void;
  pushToArray(baseKey: any, value: any): void;
  removeFromArray(baseKey: any, removePredicate: any): void;
  replaceArrayElement(baseKey: any, selectorPredicate: any, value: any): boolean;
  updateArrayElement(baseKey: any, selectorPredicate: any, value: any): boolean;
}
class ReadableStore extends Eev {
  constructor(initialState: any);
  state: any;
  subscriptions: any[];
  get(): any;
  subscribe(handler: any): () => void;
  announceStateChange(): void;
}
class RpcClient {
  constructor(connectorOrServersideChannel: any, requestTimeout: any);
  connectorOrServersideChannel: any;
  remoteObjects: Record<string, any>;
  requestTimeout: any;
  remoteObject(methodPrefix: any): any;
  jsonrpcMsgReceive(stringMessage: any): void;
}
class protocolState extends WritableStore {
  connector: any;
  wireStateReceived: boolean;
  field(name: any): any;
}
class connectionState extends WritableStore {
  fields: Record<string, any>;
  connector: any;
}
