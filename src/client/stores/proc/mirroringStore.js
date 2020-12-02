import { EventEmitter } from '../../utils/index.js';

import { clone } from './util/index.js';

import getDiff from './lib/getDiff.js';

class MirroringStore extends EventEmitter {
  constructor(initialState = {}) {
    super();

    this.state = initialState;
    this.prevAnnouncedState = {};
  }

  mirror(channelList) {
    channelList.on('new_channel', channel => {
      const { state } = this;
      channel.send({ state });
    });

    this.on('diff', diff => {
      channelList.sendToAll({ diff });
    });
  }

  set(patch, { announce = true } = {}) {
    Object.assign(this.state, patch);
    this.announceStateChange(announce);
  }

  announceStateChange(announce = true) {
    if (!announce) {
      return;
    }

    const { state } = this;

    const diff = getDiff(this.prevAnnouncedState, state);

    if (diff) {
      this.emit('diff', diff);

      this.prevAnnouncedState = clone(state);
    }
  }
}

export default MirroringStore;
