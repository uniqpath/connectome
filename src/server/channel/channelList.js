import { EventEmitter } from '../../utils/index.js';

//import ProtocolStore from '../../stores/back/protocolStore.js';

//⚠️ when not going directly to ws port but instead for example through ligthttpd websocket-upgrade
// this channelList will behave strangely... probably just a lag between connections actually disappearing
// so to count active connections through proxy it is not accurate, hopefully just a time lag but test...

class ChannelList extends EventEmitter {
  constructor({ protocol }) {
    super();

    this.protocol = protocol;

    this.channels = [];

    // // latent means that it won't send anything over the channels until we first use it (set the state)
    // // this allows for outside stores to mirror into channel list which default ProtocolStore (channels.state) remains unused
    // this.state = new ProtocolStore({}, { latent: true });
    // this.state.sync(this);

    process.nextTick(() => {
      this.reportStatus();
    });
  }

  add(channel) {
    this.channels.push(channel);

    channel.on('disconnect', () => {
      this.channels.splice(this.channels.indexOf(channel), 1);
      this.reportStatus();
    });

    this.emit('new_channel', channel);

    this.reportStatus();
  }

  signalAll(signal, data) {
    for (const channel of this.channels) {
      channel.signal(signal, data);
    }
  }

  sendAll(msg) {
    for (const channel of this.channels) {
      channel.send(msg);
    }
  }

  remoteCallAll(remoteObjectHandle, method, args) {
    for (const channel of this.channels) {
      channel
        .remoteObject(remoteObjectHandle)
        .call(method, args)
        .catch(e => {
          console.log(e);
        });
    }
  }

  multiCall(remoteObjectHandle, method, args) {
    const promises = this.channels.map(channel =>
      channel.remoteObject(remoteObjectHandle).call(method, args)
    );
    return Promise.all(promises);
  }

  reportStatus() {
    const connList = this.channels.map(channel => {
      return {
        ip: channel.remoteIp(),
        address: channel.remoteAddress(),
        remotePubkeyHex: channel.remotePubkeyHex()
      };
    });

    this.emit('status', { connList });
  }

  [Symbol.iterator]() {
    let counter = 0;
    return {
      next: () => {
        if (counter < this.channels.length) {
          const result = { value: this.channels[counter], done: false };
          counter++;
          return result;
        }
        return { done: true };
      }
    };
  }
}

export default ChannelList;
