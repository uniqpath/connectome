import quantum from 'quantum-generator';

function setupEndpoint({ channel }) {
  const send = () => {
    channel.send({ msg: quantum({ numSentences: 2 }) });
    setTimeout(() => {
      send();
    }, 7000);
  };

  send();
}

export default setupEndpoint;
