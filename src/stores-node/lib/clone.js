export default clone;

// LATER when browsers support check:
// https://developer.mozilla.org/en-US/docs/Web/API/structuredClone
// also in Connectome library
// tried in node.js, had issues:
// DOMException [DataCloneError]: accessor => {
// let current = obj;

// for (const nextKey of accessor.split('.')) {
//   // support square ...<omitted>... } could not be cloned.
// at new DOMException (node:internal/per_context/domexception:53:5)
// at structuredClone (node:internal/structured_clone:23:17)
//
// structuredClone is only supported in v17.9.1 and upwards
function clone(obj) {
  if (typeof obj == 'function') {
    return obj;
  }
  var result = Array.isArray(obj) ? [] : {};
  for (var key in obj) {
    var value = obj[key];
    var type = {}.toString.call(value).slice(8, -1);
    if (type == 'Array' || type == 'Object') {
      result[key] = clone(value);
    } else if (type == 'Date') {
      result[key] = new Date(value.getTime());
    } else if (type == 'RegExp') {
      result[key] = RegExp(value.source, getRegExpFlags(value));
    } else {
      result[key] = value;
    }
  }
  return result;
}

function getRegExpFlags(regExp) {
  if (typeof regExp.source.flags == 'string') {
    return regExp.source.flags;
  } else {
    var flags = [];
    regExp.global && flags.push('g');
    regExp.ignoreCase && flags.push('i');
    regExp.multiline && flags.push('m');
    regExp.sticky && flags.push('y');
    regExp.unicode && flags.push('u');
    return flags.join('');
  }
}
