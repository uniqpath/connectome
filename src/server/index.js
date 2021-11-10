import Connectome from './connectome';

import { newKeypair } from '../utils/crypto/index.js';

export { Connectome, newKeypair as newServerKeypair };
// i guess just newKeypair was ok since there is only one.
