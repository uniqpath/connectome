import SyncStore from './syncStore.js';

// we export MultiConnectedStore here because of svelte(kit) apps (and possibly other unidentified reasons)
// when doing prerender then build tools (rollup) use node to generate code and if we don't export MCS here
// then it will fail if our FRONTEND code uses for example: import { MultiConnectedStore } from 'connectome/stores';
// so this only helps although MCS is not usually used from node
import MultiConnectedStore from '../stores/lib/multiConnectedStore/multiConnectedStore.js';

function isEmptyObject(obj) {
  return typeof obj === 'object' && Object.keys(obj).length === 0;
}

export { SyncStore, MultiConnectedStore, isEmptyObject };
