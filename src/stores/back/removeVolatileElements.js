export default function removeVolatileElements(slots, state) {
  // find volatile slots in state
  // if entire slot is volatile, remove it
  // otherwise invoke callback that cleans up the slot (removes some elements from it)
  for (const slotName of Object.keys(state)) {
    if (slots[slotName]?.isVolatile()) {
      const { volatileCallback } = slots[slotName];

      if (volatileCallback) {
        volatileCallback(state[slotName]);
      } else {
        delete state[slotName];
      }
    }
  }

  return state;
}
