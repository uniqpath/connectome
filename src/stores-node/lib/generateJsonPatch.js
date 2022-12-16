// import rfc6902 from 'rfc6902';
// const generateJsonPatch = rfc6902.createPatch;
// export default generateJsonPatch;

import fastJsonPatch from 'fast-json-patch';
const { compare } = fastJsonPatch;
export default compare;
