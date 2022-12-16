import fastJsonPatch from 'fast-json-patch';

// return true if objects are the same
// previously used just collection-compare, but this is faster !
export default function compare(a, b) {
  return fastJsonPatch.compare(a, b).length == 0;
}
