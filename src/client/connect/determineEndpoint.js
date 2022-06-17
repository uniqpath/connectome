const browser = typeof window !== 'undefined';

export default function determineEndpoint({ endpoint, host, port }) {
  // if endpoint is specified with "/something", it is rewritten as ws[s]://origin/something
  if (browser && endpoint && endpoint.startsWith('/')) {
    const wsProtocol = window.location.protocol.includes('s') ? 'wss' : 'ws';
    endpoint = `${wsProtocol}://${window.location.host}${endpoint}`;
  }

  // if no endpoint is specified then use host and port if provided, otherwise use origin (in browser)
  // in nodejs host and port have to be provided
  if (!endpoint) {
    if (browser) {
      host = host || window.location.hostname;
      const wsProtocol = window.location.protocol.includes('s') ? 'wss' : 'ws';

      endpoint = `${wsProtocol}://${host}`;

      // new addition
      if (wsProtocol == 'wss') {
        // if wss from browser we forget all about the port and use /ws which has to be upgraded to websocket connection by our reverse-proxy
        // read this as well, very informative :: https://medium.com/intrinsic-blog/why-should-i-use-a-reverse-proxy-if-node-js-is-production-ready-5a079408b2ca
        endpoint = `${wsProtocol}://${host}/ws`;
      } else if (port) {
        endpoint = `${endpoint}:${port}`;
      } else if (window.location.port) {
        endpoint = `${endpoint}:${window.location.port}`;
      }
    } else {
      if (!port) {
        throw new Error(`Connectome determineEndpoint: No websocket port provided for ${host}`);
      }
      // node.js ... if wss is needed, then full endpoint has to be passed in instead of host and port
      // endpoint is then used "as is with no modifications" and this entire block of code is not needed
      endpoint = `ws://${host || 'localhost'}:${port}`;
    }
  }

  // if endpoint is provided directly and it didn't start with '/', then use this verbatim
  return endpoint;
}
