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
  tag?: any;
  dummy?: any;
}
export class ConnectorPool extends ReadableStore {
  options: Options;
  connectors: Record<string, any>;
  isPreparingConnector: Record<string, any>;
  getConnector({ host, port, tag }: { endpoint: any; host: any; port: any; tag: any }): Promise<any>;
  setupConnectorReactivity(connector: Connector): void;
  publishState(): void;
  connectionList(): {
    address: string;
    protocol: any;
    remotePubkeyHex: any;
    operational: any;
    readyState: any;
    connectedAt: any;
    lastMessageAt: any;
  }[];
}
export const concurrency: Readonly<{
  __proto__: any;
  promiseTimeout: typeof promiseTimeout;
  requireConditions: typeof requireConditions;
}>;
export function connect(opts: Options): Connector;
export function newClientKeypair(): Keypair;
class ReadableStore extends Eev {
  constructor(initialState: any);
  state: any;
  subscriptions: any[];
  get(): any;
  subscribe(handler: any): () => void;
  announceStateChange(): void;
}
function promiseTimeout(ms: any, promise: any): Promise<any>;
function requireConditions(num: any, callback: any): ConditionsChecker;
class Connector extends Eev {
  constructor({ endpoint, protocol, keypair, rpcRequestTimeout, verbose, tag, dummy }?: Options);
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
class ConditionsChecker {
  constructor(num: any, callback: any);
  num: any;
  callback: any;
  counter: number;
  oneConditionFulfilled(): void;
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
  connector: Connector;
  wireStateReceived: boolean;
  field(name: any): any;
}
class connectionState extends WritableStore {
  fields: Record<string, any>;
  connector: Connector;
}
class WritableStore extends ReadableStore {
  set(state: any): void;
}
