import http from 'http';
import https from 'https';
interface Keypair {
  privateKey: Buffer;
  publicKey: Buffer;
  privateKeyHex: string;
  publicKeyHex: string;
}
declare class RpcClient {
  constructor(connectorOrServersideChannel: any, requestTimeout: any);
  connectorOrServersideChannel: any;
  remoteObjects: {};
  requestTimeout: any;
  remoteObject(methodPrefix: any): any;
  jsonrpcMsgReceive(stringMessage: any): void;
}
class Channel extends Eev {
  constructor(
    ws: any,
    {
      rpcRequestTimeout,
      verbose
    }: {
      rpcRequestTimeout: any;
      verbose?: boolean;
    }
  );
  ws: any;
  verbose: boolean;
  reverseRpcClient: RpcClient;
  sentCount: number;
  receivedCount: number;
  stateFields: {};
  stateFieldsSubscriptions: any[];
  state(name: any, _state: any): any;
  clearState(...names: any[]): void;
  setProtocol(protocol: string): void;
  protocol: string;
  setSharedSecret(sharedSecret: any): void;
  sharedSecret: any;
  isReady({ warn }?: { warn?: boolean }): boolean;
  remoteAddress(): any;
  remoteIp(): any;
  setRemotePubkeyHex(remotePubkeyHex: any): void;
  _remotePubkeyHex: any;
  remotePubkeyHex(): any;
  send(message: any): void;
  signal(signal: any, data: any): void;
  messageReceived(message: any): void;
  attachObject(handle: any, obj: any): void;
  remoteObject(handle: any): {
    call: (methodName: any, params?: any[]) => any;
  };
  terminate(): void;
  terminated(): any;
  closed(): boolean;
}
export class Connectome extends ReadableStore {
  constructor({
    port,
    keypair,
    server,
    verbose
  }: {
    port?: number | string;
    keypair?: Keypair;
    server?: http.Server | https.Server;
    verbose?: boolean;
  });
  port: number;
  keypair: Keypair;
  server: any;
  verbose?: boolean;
  protocols: Record<string, any>;
  registerProtocol({
    protocol,
    onConnect
  }: {
    protocol: string;
    onConnect?: ({ channel }: { channel: Channel }) => void | Promise<void>;
  }): ChannelList;
  start(): void;
  wsServer: WsServer;
  publishState(): void;
  registeredProtocols(): string[];
  connectionList(): any[];
}
function newServerKeypair(): Keypair;
class ReadableStore extends Eev {
  constructor(initialState: any);
  state: any;
  subscriptions: any[];
  get(): any;
  subscribe(handler: any): () => void;
  announceStateChange(): void;
}
class ChannelList extends Eev {
  constructor({ protocol }: { protocol: string });
  protocol: string;
  channels: Channel[];
  state: ProtocolStore;
  add(channel: Channel): void;
  signalAll(signal: any, data: any): void;
  sendAll(msg: any): void;
  remoteCallAll(remoteObjectHandle: any, method: any, args: any): void;
  multiCall(remoteObjectHandle: any, method: any, args: any): Promise<any[]>;
  reportStatus(): void;
  [Symbol.iterator](): {
    next: () =>
      | {
          value: any;
          done: boolean;
        }
      | {
          done: boolean;
        };
  };
}
class WsServer extends Eev {
  constructor({ port, server, verbose }: { port: number; server: any; verbose?: boolean });
  webSocketServer: any;
  continueSetup({ verbose }: { verbose?: boolean }): void;
  enumerateConnections(): any[];
  periodicCleanupAndPing(): void;
}
class Eev {
  __events_list: Record<string, any>;
  on(name: any, fn: any): void;
  off(name: any, fn: any): void;
  removeListener(...args: any[]): void;
  emit(name: any, data: any): void;
}
class ProtocolStore extends Eev {
  constructor(
    initialState?: {},
    {
      latent
    }?: {
      latent?: boolean;
    }
  );
  latent: boolean;
  state: Record<string, any>;
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
