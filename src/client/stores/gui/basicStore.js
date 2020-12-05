class BasicStore {
  constructor(initialState = {}) {
    this.state = initialState;

    this.subscriptions = [];
  }

  set(state) {
    //this.clearState();

    this.state = state;
    //Object.assign(this, state); // PROBLEMS HERE !!! this.clearState();

    this.pushStateToSubscribers();
  }

  get() {
    return this.state;
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

export default BasicStore;
