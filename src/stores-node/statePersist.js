import fs from 'fs';
import path from 'path';

// needed to pre-compile writeFileAtomic because usual transpilation with rollup failed because of __filename global variable
// didn't succeed with rollup-inject and polyfills to fix that problem so simply added __filename global into pre-compile
import writeFileAtomic from './lib/writeFileAtomic.js';
import migrateState from './migrateState.js';

import compare from './lib/compare.js';

function dropState({ strState, stateFilePath, noRecovery }) {
  if (!noRecovery && strState?.trim() != '') {
    const extname = path.extname(stateFilePath);

    const backupFilePath = stateFilePath.replace(
      new RegExp(`${extname}$`),
      `-recovery-${Date.now()}${extname}`
    );

    fs.writeFileSync(backupFilePath, strState);
  }
}

// import rfc6902 from 'rfc6902';
// const generateJsonPatch = rfc6902.createPatch;

// BUMP THIS UP WHEN BREAKING CHANGES TO PROGRAM STATE FORMAT WERE MADE
// EVERYONE WILL GET THEIR STATE RESET WHEN THEY UPDATE AND RESTART THE PROCESS
// JUST THE WAY IT IS, HAPPENS FROM TIME TO TIME but better not!
//

// 💻 → 💾
// we receive clone of the state here, we can mutate it before saving.. no need to clone
function saveState({ stateFilePath, schemaVersion, state, lastSavedState }) {
  // 💡 we record schemaVersion in data if utilizing it in the first place
  if (schemaVersion) {
    state.schemaVersion = schemaVersion;
  }

  if (!lastSavedState || !compare(lastSavedState, state)) {
    // const diff = generateJsonPatch(lastSavedState, state);
    // console.log(JSON.stringify(diff, null, 2));

    writeFileAtomic(stateFilePath, JSON.stringify(state, null, 2), err => {
      // does it really throw so that program stops ?
      if (err) throw err;
    });

    // hopefully it has been written
    return state; // forgot to return this state before and we were exhausting sd cards!! Abu, Iztok and Borovnjakova had problems!!
  }
}

// 💻 ← 💾
function loadState({ stateFilePath, schemaVersion, schemaMigrations = [], noRecovery = false }) {
  if (fs.existsSync(stateFilePath)) {
    const strState = fs.readFileSync(stateFilePath).toString();

    try {
      const loadedState = JSON.parse(strState);

      if (schemaVersion) {
        if (!loadedState.schemaVersion) {
          return dropState({ strState, stateFilePath, noRecovery }); // drop state
        }

        if (loadedState.schemaVersion != schemaVersion) {
          // either migrates or also drops state if cannot migrate (will return undefined instead of state)
          const migratedState = migrateState({ state: loadedState, schemaVersion, schemaMigrations });

          return migratedState || dropState({ strState, stateFilePath, noRecovery });
        }
      } else if (loadedState.schemaVersion) {
        return dropState({ strState, stateFilePath, noRecovery }); // drop state
      }

      // we land here if:
      // loadedState.schemaVersion and schemaVersion match (same number or they are both undefined)
      return loadedState;
    } catch (e) {
      //log.red('⚠️  Discarding invalid persisted state.');
      return dropState({ strState, stateFilePath, noRecovery }); // drop state
    }
  }
  // state file not present, starting with a clean state ...
}

export { saveState, loadState };
