import ConnectionsAcceptor from './connectionsAcceptor';
import { newKeypair } from '../utils/crypto/index.js';

export { ConnectionsAcceptor, newKeypair as newServerKeypair };
// i guess just newKeypair was ok since there is only one.
