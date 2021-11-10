import WritableStore from '../../stores/front/helperStores/writableStore.js';

export default class connectionState extends WritableStore {
  constructor(connector) {
    super({});

    this.fields = {};

    this.connector = connector;

    // fields (we don't do diffing here, always the entire state)
    this.connector.on('receive_state_field', ({ name, state }) => {
      this.get(name).set(state); // set and announce per channel state
    });
  }

  // default is null, not {} !
  get(name) {
    if (!this.fields[name]) {
      this.fields[name] = new WritableStore();
    }

    return this.fields[name];
  }
}
