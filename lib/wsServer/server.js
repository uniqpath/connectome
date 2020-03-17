import EventEmitter from '../emitter';
import ServerInstance from './serverInstance';

import AuthTarget from './authTarget';

class Server extends EventEmitter {
  constructor({ port, keypair, protocols = {} }) {
    super();

    process.nextTick(() => {
      this.server = new ServerInstance({ port });
      this.protocols = protocols;
      this.keypair = keypair;

      this.server.on('connection_closed', channel => this.emit('connection_closed', channel));

      this.server.on('connection', channel => this.initializeConnection({ channel }));
    });
  }

  initializeConnection({ channel }) {
    const auth = new AuthTarget({ keypair: this.keypair });

    channel.registerRemoteObject('Auth', auth);

    auth.on('shared_secret', sharedSecret => {
      channel.setSharedSecret(sharedSecret);
      this.initializeProtocol({ channel });

      this.emit('connection', channel);
    });
  }

  initializeProtocol({ channel }) {
    const protocolEndpoint = this.protocols[channel.protocol];
    if (protocolEndpoint) {
      protocolEndpoint({ channel });
    } else {
      console.log(`Error: unknown protocol ${channel.protocol}, disconnecting`);
      channel.terminate();
    }
  }
}

export default Server;
