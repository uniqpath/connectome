import mergeState from './lib/merge.js';

export default class KeyValueStore {
  constructor() {
    this.state = {};
  }

  // dangerous :)
  // set(state) {
  //   this.state = state;
  // }

  update(patch) {
    this.state = mergeState(this.state, patch);
  }

  replaceBaseKey(baseKey, value) {
    this.state[baseKey] = value;
  }

  clearBaseKey(baseKey) {
    delete this.state[baseKey];
  }

  replaceSubKey({ baseKey, key, value }) {
    this.state[baseKey] = this.state[baseKey] || {};
    this.state[baseKey][key] = value;
  }

  removeSubKey({ baseKey, key }) {
    this.state[baseKey] = this.state[baseKey] || {};
    delete this.state[baseKey][key];
  }

  push(baseKey, value) {
    this.state[baseKey].push(value);
  }

  updateArray(baseKey, selectorPredicate, value) {
    let hasUpdated;

    for (const entry of this.state[baseKey].filter(entry => selectorPredicate(entry))) {
      // in-place replace entry completely (array reference stays the same)
      //Object.keys(entry).forEach(key => delete entry[key]);
      Object.assign(entry, value);
      hasUpdated = true;
    }

    return hasUpdated;
  }

  removeArrayElements(baseKey, removePredicate) {
    this.state[baseKey] = this.state[baseKey].filter(entry => !removePredicate(entry));
  }

  replaceArrayElement(baseKey, selectorPredicate, value) {
    const entry = this.state[baseKey].find(entry => selectorPredicate(entry));

    if (entry) {
      // in-place replace entry completely (array reference stays the same)
      Object.keys(entry).forEach(key => delete entry[key]);
      Object.assign(entry, value);
      return true;
    }
  }
}
