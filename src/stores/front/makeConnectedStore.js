import ConnectedStore from './connectedStore/connectedStore.js';

export default function makeConnectedStore(opts) {
  const store = new ConnectedStore(opts);

  const { connected, action: sendJSON, remoteObject, connector } = store;

  const shape = store.shape.bind(store);

  // function sendText(str) {
  //   connector.send(str);
  // }

  const api = remoteObject.bind(store);

  // sendJSON, sendText
  return { state: store, shape, connected, api, connector };
}
