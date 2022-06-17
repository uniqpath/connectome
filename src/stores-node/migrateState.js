function applyMigration({ state, migration }) {
  // todo: catch errors -- what to do? drop state for now... !
  const { toVersion, migrator } = migration;

  state.schemaVersion = toVersion;
  migrator(state); // mutates in place

  return state;
}

export default function migrateState({ state, schemaVersion, schemaMigrations = [] }) {
  let currentState = state;

  while (state.schemaVersion != schemaVersion) {
    const migration = schemaMigrations.find(({ fromVersion }) => fromVersion == state.schemaVersion);

    if (!migration) {
      return; // drop state, no path to migrate further
    }

    try {
      currentState = applyMigration({ state, migration });
    } catch (e) {
      return; // Any problem? Just drop state, YOLO
    }
  }

  return currentState;
}
