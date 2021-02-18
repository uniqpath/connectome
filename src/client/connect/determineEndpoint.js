const browser = typeof window !== 'undefined';

export default function determineEndpoint({ endpoint, address, port }) {
  // if endpoint is specified with "/something", it is rewritten as ws[s]://origin/something
  if (browser && endpoint && endpoint.startsWith('/')) {
    const wsProtocol = window.location.protocol.includes('s') ? 'wss' : 'ws';
    endpoint = `${wsProtocol}://${window.location.host}${endpoint}`;
  }

  // if no endpoint is specified then use address and port if provided, otherwise use origin (in browser)
  // in nodejs address and port have to be provided
  if (!endpoint) {
    if (browser) {
      address = address || window.location.hostname;
      const wsProtocol = window.location.protocol.includes('s') ? 'wss' : 'ws';

      endpoint = `${wsProtocol}://${address}`;

      if (port) {
        endpoint = `${endpoint}:${port}`;
      } else if (window.location.port) {
        endpoint = `${endpoint}:${window.location.port}`;
      }
    } else {
      endpoint = `ws://${address}:${port}`;
    }
  }

  // if endpoint is provided directly and it didn't start with '/', then use this directly
  return endpoint;
}
