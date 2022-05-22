import { EventEmitter } from '../../utils/index.js';

import clone from './lib/clone.js';

import KeyValueStore from './twoLevelMergeKVStore.js';

import Slot from './slot';

import getDiff from './lib/getDiff.js';

import removeVolatileElements from './removeVolatileElements';
import muteAnnounce from './muteAnnounce';

// WARNING: initialState can mess with loaded state!
// example:
//
// new SyncStore({ messages: [] })
//
// this won't have the intented consequences because this state will override
// any messages loaded from the file... use carefuly!
//
// initial state is merged into loaded state (2-level merge) and in this case when slot is attay instead of object
// it will set that slot to empty array

// Do this instead:
//
// store.slot('notifications').makeArray().pushToArray(data);

export default class SyncStore extends EventEmitter {
  constructor(initialState = {}, { loadState = null, saveState = null, omitStateFn = x => x } = {}) {
    super();

    this.omitStateFn = omitStateFn;
    this.saveState = saveState;

    //this.lastAnnouncedState = clone(initialState); // alternative to below...

    this.slots = {};
    this.kvStore = new KeyValueStore();

    if (loadState) {
      const persistedState = loadState();

      if (persistedState) {
        this.kvStore.update(removeVolatileElements(this.slots, persistedState)); // we do remove volatile elements just in case although they shouldn't have been saved in the first place... but sometimes when schema is changing they can be
      }
    }

    this.kvStore.update(initialState);

    this.lastAnnouncedState = this.omitAndCloneState(); // think more about this!

    this.stateChangesCount = 0;

    this.subscriptions = [];
  }

  sync(channelList) {
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

  // dangerous :)
  // we replace the entire state across all slots
  // set(state) {
  //   this.kvStore.set(state);
  // }

  get(key) {
    return key ? this.state()[key] : this.state();
  }

  omitAndCloneState() {
    return this.omitStateFn(clone(this.state()));
  }

  /* State update functions */

  slot(name) {
    if (!this.slots[name]) {
      this.slots[name] = new Slot({ name, parent: this });
    }

    return this.slots[name];
  }

  update(patch, { announce = true, skipDiffing = false } = {}) {
    this.kvStore.update(patch);
    this.announceStateChange(announce, skipDiffing);
  }

  /* end State update functions */

  save() {
    if (this.saveState) {
      const state = removeVolatileElements(this.slots, clone(this.state()));
      const savedState = this.saveState({ state, lastSavedState: this.lastSavedState });

      if (savedState) {
        this.lastSavedState = savedState;
      }
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

    const diff = getDiff(this.lastAnnouncedState, muteAnnounce(this.slots, remoteState));

    if (diff) {
      // console.log(diff);
      //this.emit('diff', diff)
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
