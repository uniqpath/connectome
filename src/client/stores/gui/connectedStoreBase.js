import Emitter from '../../../utils/emitter/index.js';

// 💡 we use Emitter inside ConnectedStore to emit 'ready' event
class ConnectedStoreBase extends Emitter {
  constructor(initialState = {}) {
    super();

    this.state = initialState;

    this.subscriptions = [];
  }

  set(state) {
    const { connected } = this.state;
    this.state = { ...state, connected };

    this.pushStateToSubscribers();
  }

  setConnected(connected) {
    Object.assign(this.state, { connected });
    this.pushStateToSubscribers();
  }

  clearState({ except = [] } = {}) {
    //except.push('connected');

    for (const key of Object.keys(this.state)) {
      if (!except.includes(key)) {
        delete this[key];
        delete this.state[key];
      }
    }
  }

  subscribe(handler) {
    this.subscriptions.push(handler);
    handler(this.state);
    return () => {
      this.subscriptions = this.subscriptions.filter(sub => sub !== handler);
    };
  }

  pushStateToSubscribers() {
    this.subscriptions.forEach(handler => handler(this.state));
  }
}

export default ConnectedStoreBase;
