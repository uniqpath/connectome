// used to generate ./lib/writeFileAtomic -> index.mjs through npm run build
// import writeFileAtomic from 'write-file-atomic';
// export default writeFileAtomic;
// afterwards these two lines need to be added:
// import { fileURLToPath } from 'url';
// const __filename = fileURLToPath(import.meta.url); // this is used in the code and just transpiling is not enough, we need to add _filename global

import SyncStore from './syncStore.js';
export { SyncStore };
