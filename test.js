const colors = require('colors');
const { newKeypair, stores } = require('./dist/client.js');
const { ConnectionsAcceptor } = require('./dist/server.js');

const store = new stores.CanonicStore({});

function onConnect({ channel, store }) {
  console.log('New example/gui connection');

  channel.send({ state: store.state() });

  channel.on('action', ({ action, namespace, payload }) => {
    if (namespace == 'svelte' && action == 'set_component') {
      const { compiledComponent } = payload;
      store.replaceSlot('compiledComponent', compiledComponent);
    }
  });
}

function start({ port }) {
  // define connections acceptor
  const keypair = newKeypair();
  const acceptor = new ConnectionsAcceptor({ port, keypair });

  acceptor.on('protocol_added', ({ protocol, protocolLane }) => {
    console.log(`💡 Connectome protocol ${colors.cyan(protocol)}/${colors.cyan(protocolLane)} ready.`);
  });

  // add our example protocol
  const protocol = 'example';
  const protocolLane = 'gui';
  const channelList = acceptor.registerProtocol({
    protocol,
    protocolLane,
    onConnect: ({ channel }) => onConnect({ channel, store })
  });

  // wire state syncing mechanism
  store.on('diff', (diff) => {
    channelList.sendToAll({ diff }); // { diff: {…} } -> this json message is part of connectome protocol and ConnectedStore on frontend uses it to apply diffs
  });

  // start websocket server
  acceptor.start();
  console.log(colors.green(`Connectome → Running websocket connections acceptor on port ${port} ...`));
}

start({ port: 9000 });
