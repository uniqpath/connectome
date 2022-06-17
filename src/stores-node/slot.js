export default class Slot {
  constructor({ name, parent }) {
    this.name = name;
    this.parent = parent;
  }

  makeArray() {
    if (!Array.isArray(this.get())) {
      this.set([], { announce: false });
    }
    return this;
  }

  // // doesn't get saved
  // makeVolatile(callback) {
  //   this.volatile = true;
  //   this.volatileCallback = callback;

  //   // "tv nearvy devices problem -- loading old state"
  //   //this.remove({ announce: false }); // should we announce ?
  // }

  // isVolatile() {
  //   return this.volatile;
  // }

  muteAnnounce(callback) {
    this._muteAnnounce = true;
    this.muteAnnounceCallback = callback;
  }

  mutesAnnounce() {
    return this._muteAnnounce;
  }

  get(key) {
    const slotState = this.parent.get(this.name) || {};
    return key ? slotState[key] : slotState;
  }

  set(state, { announce = true } = {}) {
    this.parent.kvStore.replaceBaseKey(this.name, state);
    this.parent.announceStateChange(announce);
  }

  update(patch, { announce = true } = {}) {
    const _patch = {};
    _patch[this.name] = patch;
    this.parent.update(_patch, { announce });
  }

  remove({ announce = true } = {}) {
    this.parent.kvStore.clearBaseKey(this.name);
    this.parent.announceStateChange(announce);
  }

  removeKey(key, { announce = true } = {}) {
    this.parent.kvStore.removeSubKey({ baseKey: this.name, key });
    this.parent.announceStateChange(announce);
  }

  push(element, { announce = true } = {}) {
    this.parent.kvStore.push(this.name, element);
    this.parent.announceStateChange(announce);
  }

  updateArray(selectorPredicate, value, { announce = true } = {}) {
    const foundMatches = this.parent.kvStore.updateArray(this.name, selectorPredicate, value);
    if (foundMatches) {
      this.parent.announceStateChange(announce);
    }
  }

  removeArrayElements(selectorPredicate, { announce = true } = {}) {
    this.parent.kvStore.removeArrayElements(this.name, selectorPredicate);
    this.parent.announceStateChange(announce);
  }

  replaceArrayElement(selectorPredicate, value, { announce = true } = {}) {
    const foundMatch = this.parent.kvStore.replaceArrayElement(this.name, selectorPredicate, value);
    if (foundMatch) {
      this.parent.announceStateChange(announce);
      return true;
    }
  }
}
