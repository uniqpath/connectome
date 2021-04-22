import { EventEmitter } from '../../utils/index.js';

import clone from './lib/clone.js';

import KeyValueStore from './twoLevelMergeKVStore.js';

import getDiff from './lib/getDiff.js';

class ProgramStateStore extends EventEmitter {
  constructor(
    initialState = {},
    { loadState = null, saveState = null, omitStateFn = x => x, removeStateChangeFalseTriggers = x => x } = {}
  ) {
    super();

    this.omitStateFn = omitStateFn;
    this.saveState = saveState;
    this.removeStateChangeFalseTriggers = removeStateChangeFalseTriggers;

    this.kvStore = new KeyValueStore();

    this.lastAnnouncedState = initialState;

    if (loadState) {
      const persistedState = loadState();

      if (persistedState) {
        this.kvStore.update(persistedState, { announce: false });
      }
    }

    this.kvStore.update(initialState, { announce: false });

    this.stateChangesCount = 0;

    this.subscriptions = [];
  }

  mirror(channelList) {
    this.channelList = channelList;

    channelList.on('new_channel', channel => {
      channel.send({ state: this.lastAnnouncedState });
    });
  }

  sendRemote({ state, diff }) {
    if (this.channelList) {
      this.channelList.sendAll({ state, diff }); // one or the other
    }
  }

  state() {
    return this.kvStore.state;
  }

  omitAndCloneState() {
    return this.omitStateFn(clone(this.state()));
  }

  /* State update functions */

  update(patch, { announce = true, skipDiffing = false } = {}) {
    this.kvStore.update(patch);
    this.announceStateChange(announce, skipDiffing);
  }

  replaceSlot(slotName, value, { announce = true } = {}) {
    this.kvStore.replaceBaseKey(slotName, value);
    this.announceStateChange(announce);
  }

  clearSlot(slotName, { announce = true } = {}) {
    this.kvStore.clearBaseKey(slotName);
    this.announceStateChange(announce);
  }

  replaceSlotElement({ slotName, key, value }, { announce = true } = {}) {
    this.kvStore.replaceSubKey({ baseKey: slotName, key, value });
    this.announceStateChange(announce);
  }

  removeSlotElement({ slotName, key }, { announce = true } = {}) {
    this.kvStore.removeSubKey({ baseKey: slotName, key });
    this.announceStateChange(announce);
  }

  pushToSlotArrayElement(slotName, entry, { announce = true } = {}) {
    this.kvStore.pushToArray(slotName, entry);
    this.announceStateChange(announce);
  }

  removeFromSlotArrayElement(slotName, removePredicate, { announce = true } = {}) {
    this.kvStore.removeFromArray(slotName, removePredicate);
    this.announceStateChange(announce);
  }

  replaceSlotArrayElement(slotName, selectorPredicate, value, { announce = true } = {}) {
    const foundMatch = this.kvStore.replaceArrayElement(slotName, selectorPredicate, value);
    this.announceStateChange(announce);
    return foundMatch;
  }

  updateSlotArrayElement(slotName, selectorPredicate, value, { announce = true } = {}) {
    const foundMatch = this.kvStore.updateArrayElement(slotName, selectorPredicate, value);
    this.announceStateChange(announce);
    return foundMatch;
  }

  /* end State update functions */

  save() {
    if (this.saveState) {
      this.lastSavedState =
        this.saveState({ state: clone(this.state()), lastSavedState: this.lastSavedState }) ||
        this.lastSavedState;
    }
  }

  announceStateChange(announce = true, skipDiffing = false) {
    if (!announce) {
      return;
    }

    const remoteState = this.omitAndCloneState();

    if (skipDiffing) {
      this.sendRemote({ state: remoteState });
      this.tagState({ state: remoteState });
      return;
    }

    const diff = getDiff(this.lastAnnouncedState, this.removeStateChangeFalseTriggers(remoteState));

    if (diff) {
      this.sendRemote({ diff });
      this.stateChangesCount += 1;
      this.tagState({ state: remoteState });
    }
  }

  tagState({ state }) {
    this.save();
    this.lastAnnouncedState = state;
    this.pushStateToLocalSubscribers();
  }

  subscribe(handler) {
    this.subscriptions.push(handler);

    handler(this.state());

    return () => {
      this.subscriptions = this.subscriptions.filter(sub => sub !== handler);
    };
  }

  pushStateToLocalSubscribers() {
    this.subscriptions.forEach(handler => handler(this.state()));
  }
}

export default ProgramStateStore;
