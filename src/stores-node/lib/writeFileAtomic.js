import fs from 'fs';
import require$$0 from 'assert';
import require$$2 from 'events';
import path from 'path';
import require$$0$1 from 'util';
import require$$1 from 'worker_threads';

// transpiled write-file-atomic npm package into ES6 module with rollup.js
// entrypoint:
//
// import writeFileAtomic from 'write-file-atomic';
// export default writeFileAtomic;
// ....
// then added these two lines:
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url); // this is used in the code and just transpiling is not enough, we need to add _filename global

var commonjsGlobal =
  typeof globalThis !== 'undefined'
    ? globalThis
    : typeof window !== 'undefined'
    ? window
    : typeof global !== 'undefined'
    ? global
    : typeof self !== 'undefined'
    ? self
    : {};

function createCommonjsModule(fn, basedir, module) {
  return (
    (module = {
      path: basedir,
      exports: {},
      require: function (path, base) {
        return commonjsRequire(path, base === undefined || base === null ? module.path : base);
      }
    }),
    fn(module, module.exports),
    module.exports
  );
}

function commonjsRequire() {
  throw new Error('Dynamic requires are not currently supported by @rollup/plugin-commonjs');
}

var imurmurhash = createCommonjsModule(function (module) {
  /**
   * @preserve
   * JS Implementation of incremental MurmurHash3 (r150) (as of May 10, 2013)
   *
   * @author <a href="mailto:jensyt@gmail.com">Jens Taylor</a>
   * @see http://github.com/homebrewing/brauhaus-diff
   * @author <a href="mailto:gary.court@gmail.com">Gary Court</a>
   * @see http://github.com/garycourt/murmurhash-js
   * @author <a href="mailto:aappleby@gmail.com">Austin Appleby</a>
   * @see http://sites.google.com/site/murmurhash/
   */
  (function () {
    var cache;

    // Call this function without `new` to use the cached object (good for
    // single-threaded environments), or with `new` to create a new object.
    //
    // @param {string} key A UTF-16 or ASCII string
    // @param {number} seed An optional positive integer
    // @return {object} A MurmurHash3 object for incremental hashing
    function MurmurHash3(key, seed) {
      var m = this instanceof MurmurHash3 ? this : cache;
      m.reset(seed);
      if (typeof key === 'string' && key.length > 0) {
        m.hash(key);
      }

      if (m !== this) {
        return m;
      }
    }
    // Incrementally add a string to this hash
    //
    // @param {string} key A UTF-16 or ASCII string
    // @return {object} this
    MurmurHash3.prototype.hash = function (key) {
      var h1, k1, i, top, len;

      len = key.length;
      this.len += len;

      k1 = this.k1;
      i = 0;
      switch (this.rem) {
        case 0:
          k1 ^= len > i ? key.charCodeAt(i++) & 0xffff : 0;
        case 1:
          k1 ^= len > i ? (key.charCodeAt(i++) & 0xffff) << 8 : 0;
        case 2:
          k1 ^= len > i ? (key.charCodeAt(i++) & 0xffff) << 16 : 0;
        case 3:
          k1 ^= len > i ? (key.charCodeAt(i) & 0xff) << 24 : 0;
          k1 ^= len > i ? (key.charCodeAt(i++) & 0xff00) >> 8 : 0;
      }

      this.rem = (len + this.rem) & 3; // & 3 is same as % 4
      len -= this.rem;
      if (len > 0) {
        h1 = this.h1;
        while (1) {
          k1 = (k1 * 0x2d51 + (k1 & 0xffff) * 0xcc9e0000) & 0xffffffff;
          k1 = (k1 << 15) | (k1 >>> 17);
          k1 = (k1 * 0x3593 + (k1 & 0xffff) * 0x1b870000) & 0xffffffff;

          h1 ^= k1;
          h1 = (h1 << 13) | (h1 >>> 19);
          h1 = (h1 * 5 + 0xe6546b64) & 0xffffffff;

          if (i >= len) {
            break;
          }

          k1 =
            (key.charCodeAt(i++) & 0xffff) ^
            ((key.charCodeAt(i++) & 0xffff) << 8) ^
            ((key.charCodeAt(i++) & 0xffff) << 16);
          top = key.charCodeAt(i++);
          k1 ^= ((top & 0xff) << 24) ^ ((top & 0xff00) >> 8);
        }

        k1 = 0;
        switch (this.rem) {
          case 3:
            k1 ^= (key.charCodeAt(i + 2) & 0xffff) << 16;
          case 2:
            k1 ^= (key.charCodeAt(i + 1) & 0xffff) << 8;
          case 1:
            k1 ^= key.charCodeAt(i) & 0xffff;
        }

        this.h1 = h1;
      }

      this.k1 = k1;
      return this;
    };

    // Get the result of this hash
    //
    // @return {number} The 32-bit hash
    MurmurHash3.prototype.result = function () {
      var k1, h1;

      k1 = this.k1;
      h1 = this.h1;

      if (k1 > 0) {
        k1 = (k1 * 0x2d51 + (k1 & 0xffff) * 0xcc9e0000) & 0xffffffff;
        k1 = (k1 << 15) | (k1 >>> 17);
        k1 = (k1 * 0x3593 + (k1 & 0xffff) * 0x1b870000) & 0xffffffff;
        h1 ^= k1;
      }

      h1 ^= this.len;

      h1 ^= h1 >>> 16;
      h1 = (h1 * 0xca6b + (h1 & 0xffff) * 0x85eb0000) & 0xffffffff;
      h1 ^= h1 >>> 13;
      h1 = (h1 * 0xae35 + (h1 & 0xffff) * 0xc2b20000) & 0xffffffff;
      h1 ^= h1 >>> 16;

      return h1 >>> 0;
    };

    // Reset the hash object for reuse
    //
    // @param {number} seed An optional positive integer
    MurmurHash3.prototype.reset = function (seed) {
      this.h1 = typeof seed === 'number' ? seed : 0;
      this.rem = this.k1 = this.len = 0;
      return this;
    };

    // A cached object to use. This can be safely used if you're in a single-
    // threaded environment, otherwise you need to create new hashes to use.
    cache = new MurmurHash3();

    {
      module.exports = MurmurHash3;
    }
  })();
});

var signals = createCommonjsModule(function (module) {
  // This is not the set of all possible signals.
  //
  // It IS, however, the set of all signals that trigger
  // an exit on either Linux or BSD systems.  Linux is a
  // superset of the signal names supported on BSD, and
  // the unknown signals just fail to register, so we can
  // catch that easily enough.
  //
  // Don't bother with SIGKILL.  It's uncatchable, which
  // means that we can't fire any callbacks anyway.
  //
  // If a user does happen to register a handler on a non-
  // fatal signal like SIGWINCH or something, and then
  // exit, it'll end up firing `process.emit('exit')`, so
  // the handler will be fired anyway.
  //
  // SIGBUS, SIGFPE, SIGSEGV and SIGILL, when not raised
  // artificially, inherently leave the process in a
  // state from which it is not safe to try and enter JS
  // listeners.
  module.exports = ['SIGABRT', 'SIGALRM', 'SIGHUP', 'SIGINT', 'SIGTERM'];

  if (process.platform !== 'win32') {
    module.exports.push(
      'SIGVTALRM',
      'SIGXCPU',
      'SIGXFSZ',
      'SIGUSR2',
      'SIGTRAP',
      'SIGSYS',
      'SIGQUIT',
      'SIGIOT'
      // should detect profiler and enable/disable accordingly.
      // see #21
      // 'SIGPROF'
    );
  }

  if (process.platform === 'linux') {
    module.exports.push('SIGIO', 'SIGPOLL', 'SIGPWR', 'SIGSTKFLT', 'SIGUNUSED');
  }
});

var signalExit = createCommonjsModule(function (module) {
  // Note: since nyc uses this module to output coverage, any lines
  // that are in the direct sync flow of nyc's outputCoverage are
  // ignored, since we can never get coverage for them.
  // grab a reference to node's real process object right away
  var process = commonjsGlobal.process;

  const processOk = function (process) {
    return (
      process &&
      typeof process === 'object' &&
      typeof process.removeListener === 'function' &&
      typeof process.emit === 'function' &&
      typeof process.reallyExit === 'function' &&
      typeof process.listeners === 'function' &&
      typeof process.kill === 'function' &&
      typeof process.pid === 'number' &&
      typeof process.on === 'function'
    );
  };

  // some kind of non-node environment, just no-op
  /* istanbul ignore if */
  if (!processOk(process)) {
    module.exports = function () {
      return function () {};
    };
  } else {
    var assert = require$$0;
    var signals$1 = signals;
    var isWin = /^win/i.test(process.platform);

    var EE = require$$2;
    /* istanbul ignore if */
    if (typeof EE !== 'function') {
      EE = EE.EventEmitter;
    }

    var emitter;
    if (process.__signal_exit_emitter__) {
      emitter = process.__signal_exit_emitter__;
    } else {
      emitter = process.__signal_exit_emitter__ = new EE();
      emitter.count = 0;
      emitter.emitted = {};
    }

    // Because this emitter is a global, we have to check to see if a
    // previous version of this library failed to enable infinite listeners.
    // I know what you're about to say.  But literally everything about
    // signal-exit is a compromise with evil.  Get used to it.
    if (!emitter.infinite) {
      emitter.setMaxListeners(Infinity);
      emitter.infinite = true;
    }

    module.exports = function (cb, opts) {
      /* istanbul ignore if */
      if (!processOk(commonjsGlobal.process)) {
        return function () {};
      }
      assert.equal(typeof cb, 'function', 'a callback must be provided for exit handler');

      if (loaded === false) {
        load();
      }

      var ev = 'exit';
      if (opts && opts.alwaysLast) {
        ev = 'afterexit';
      }

      var remove = function () {
        emitter.removeListener(ev, cb);
        if (emitter.listeners('exit').length === 0 && emitter.listeners('afterexit').length === 0) {
          unload();
        }
      };
      emitter.on(ev, cb);

      return remove;
    };

    var unload = function unload() {
      if (!loaded || !processOk(commonjsGlobal.process)) {
        return;
      }
      loaded = false;

      signals$1.forEach(function (sig) {
        try {
          process.removeListener(sig, sigListeners[sig]);
        } catch (er) {}
      });
      process.emit = originalProcessEmit;
      process.reallyExit = originalProcessReallyExit;
      emitter.count -= 1;
    };
    module.exports.unload = unload;

    var emit = function emit(event, code, signal) {
      /* istanbul ignore if */
      if (emitter.emitted[event]) {
        return;
      }
      emitter.emitted[event] = true;
      emitter.emit(event, code, signal);
    };

    // { <signal>: <listener fn>, ... }
    var sigListeners = {};
    signals$1.forEach(function (sig) {
      sigListeners[sig] = function listener() {
        /* istanbul ignore if */
        if (!processOk(commonjsGlobal.process)) {
          return;
        }
        // If there are no other listeners, an exit is coming!
        // Simplest way: remove us and then re-send the signal.
        // We know that this will kill the process, so we can
        // safely emit now.
        var listeners = process.listeners(sig);
        if (listeners.length === emitter.count) {
          unload();
          emit('exit', null, sig);
          /* istanbul ignore next */
          emit('afterexit', null, sig);
          /* istanbul ignore next */
          if (isWin && sig === 'SIGHUP') {
            // "SIGHUP" throws an `ENOSYS` error on Windows,
            // so use a supported signal instead
            sig = 'SIGINT';
          }
          /* istanbul ignore next */
          process.kill(process.pid, sig);
        }
      };
    });

    module.exports.signals = function () {
      return signals$1;
    };

    var loaded = false;

    var load = function load() {
      if (loaded || !processOk(commonjsGlobal.process)) {
        return;
      }
      loaded = true;

      // This is the number of onSignalExit's that are in play.
      // It's important so that we can count the correct number of
      // listeners on signals, and don't wait for the other one to
      // handle it instead of us.
      emitter.count += 1;

      signals$1 = signals$1.filter(function (sig) {
        try {
          process.on(sig, sigListeners[sig]);
          return true;
        } catch (er) {
          return false;
        }
      });

      process.emit = processEmit;
      process.reallyExit = processReallyExit;
    };
    module.exports.load = load;

    var originalProcessReallyExit = process.reallyExit;
    var processReallyExit = function processReallyExit(code) {
      /* istanbul ignore if */
      if (!processOk(commonjsGlobal.process)) {
        return;
      }
      process.exitCode = code || /* istanbul ignore next */ 0;
      emit('exit', process.exitCode, null);
      /* istanbul ignore next */
      emit('afterexit', process.exitCode, null);
      /* istanbul ignore next */
      originalProcessReallyExit.call(process, process.exitCode);
    };

    var originalProcessEmit = process.emit;
    var processEmit = function processEmit(ev, arg) {
      if (ev === 'exit' && processOk(commonjsGlobal.process)) {
        /* istanbul ignore else */
        if (arg !== undefined) {
          process.exitCode = arg;
        }
        var ret = originalProcessEmit.apply(this, arguments);
        /* istanbul ignore next */
        emit('exit', process.exitCode, null);
        /* istanbul ignore next */
        emit('afterexit', process.exitCode, null);
        /* istanbul ignore next */
        return ret;
      } else {
        return originalProcessEmit.apply(this, arguments);
      }
    };
  }
});

var lib = writeFile;
var sync = writeFileSync;
var _getTmpname = getTmpname; // for testing
var _cleanupOnExit = cleanupOnExit;

const { promisify } = require$$0$1;
const activeFiles = {};

// if we run inside of a worker_thread, `process.pid` is not unique
/* istanbul ignore next */
const threadId = (function getId() {
  try {
    const workerThreads = require$$1;

    /// if we are in main thread, this is set to `0`
    return workerThreads.threadId;
  } catch (e) {
    // worker_threads are not available, fallback to 0
    return 0;
  }
})();

let invocations = 0;
function getTmpname(filename) {
  return (
    filename +
    '.' +
    imurmurhash(__filename)
      .hash(String(process.pid))
      .hash(String(threadId))
      .hash(String(++invocations))
      .result()
  );
}

function cleanupOnExit(tmpfile) {
  return () => {
    try {
      fs.unlinkSync(typeof tmpfile === 'function' ? tmpfile() : tmpfile);
    } catch (_) {}
  };
}

function serializeActiveFile(absoluteName) {
  return new Promise(resolve => {
    // make a queue if it doesn't already exist
    if (!activeFiles[absoluteName]) {
      activeFiles[absoluteName] = [];
    }

    activeFiles[absoluteName].push(resolve); // add this job to the queue
    if (activeFiles[absoluteName].length === 1) {
      resolve();
    } // kick off the first one
  });
}

// https://github.com/isaacs/node-graceful-fs/blob/master/polyfills.js#L315-L342
function isChownErrOk(err) {
  if (err.code === 'ENOSYS') {
    return true;
  }

  const nonroot = !process.getuid || process.getuid() !== 0;
  if (nonroot) {
    if (err.code === 'EINVAL' || err.code === 'EPERM') {
      return true;
    }
  }

  return false;
}

async function writeFileAsync(filename, data, options = {}) {
  if (typeof options === 'string') {
    options = { encoding: options };
  }

  let fd;
  let tmpfile;
  /* istanbul ignore next -- The closure only gets called when onExit triggers */
  const removeOnExitHandler = signalExit(cleanupOnExit(() => tmpfile));
  const absoluteName = path.resolve(filename);

  try {
    await serializeActiveFile(absoluteName);
    const truename = await promisify(fs.realpath)(filename).catch(() => filename);
    tmpfile = getTmpname(truename);

    if (!options.mode || !options.chown) {
      // Either mode or chown is not explicitly set
      // Default behavior is to copy it from original file
      const stats = await promisify(fs.stat)(truename).catch(() => {});
      if (stats) {
        if (options.mode == null) {
          options.mode = stats.mode;
        }

        if (options.chown == null && process.getuid) {
          options.chown = { uid: stats.uid, gid: stats.gid };
        }
      }
    }

    fd = await promisify(fs.open)(tmpfile, 'w', options.mode);
    if (options.tmpfileCreated) {
      await options.tmpfileCreated(tmpfile);
    }
    if (ArrayBuffer.isView(data)) {
      await promisify(fs.write)(fd, data, 0, data.length, 0);
    } else if (data != null) {
      await promisify(fs.write)(fd, String(data), 0, String(options.encoding || 'utf8'));
    }

    if (options.fsync !== false) {
      await promisify(fs.fsync)(fd);
    }

    await promisify(fs.close)(fd);
    fd = null;

    if (options.chown) {
      await promisify(fs.chown)(tmpfile, options.chown.uid, options.chown.gid).catch(err => {
        if (!isChownErrOk(err)) {
          throw err;
        }
      });
    }

    if (options.mode) {
      await promisify(fs.chmod)(tmpfile, options.mode).catch(err => {
        if (!isChownErrOk(err)) {
          throw err;
        }
      });
    }

    await promisify(fs.rename)(tmpfile, truename);
  } finally {
    if (fd) {
      await promisify(fs.close)(fd).catch(
        /* istanbul ignore next */
        () => {}
      );
    }
    removeOnExitHandler();
    await promisify(fs.unlink)(tmpfile).catch(() => {});
    activeFiles[absoluteName].shift(); // remove the element added by serializeSameFile
    if (activeFiles[absoluteName].length > 0) {
      activeFiles[absoluteName][0](); // start next job if one is pending
    } else {
      delete activeFiles[absoluteName];
    }
  }
}

function writeFile(filename, data, options, callback) {
  if (options instanceof Function) {
    callback = options;
    options = {};
  }

  const promise = writeFileAsync(filename, data, options);
  if (callback) {
    promise.then(callback, callback);
  }

  return promise;
}

function writeFileSync(filename, data, options) {
  if (typeof options === 'string') {
    options = { encoding: options };
  } else if (!options) {
    options = {};
  }
  try {
    filename = fs.realpathSync(filename);
  } catch (ex) {
    // it's ok, it'll happen on a not yet existing file
  }
  const tmpfile = getTmpname(filename);

  if (!options.mode || !options.chown) {
    // Either mode or chown is not explicitly set
    // Default behavior is to copy it from original file
    try {
      const stats = fs.statSync(filename);
      options = Object.assign({}, options);
      if (!options.mode) {
        options.mode = stats.mode;
      }
      if (!options.chown && process.getuid) {
        options.chown = { uid: stats.uid, gid: stats.gid };
      }
    } catch (ex) {
      // ignore stat errors
    }
  }

  let fd;
  const cleanup = cleanupOnExit(tmpfile);
  const removeOnExitHandler = signalExit(cleanup);

  let threw = true;
  try {
    fd = fs.openSync(tmpfile, 'w', options.mode || 0o666);
    if (options.tmpfileCreated) {
      options.tmpfileCreated(tmpfile);
    }
    if (ArrayBuffer.isView(data)) {
      fs.writeSync(fd, data, 0, data.length, 0);
    } else if (data != null) {
      fs.writeSync(fd, String(data), 0, String(options.encoding || 'utf8'));
    }
    if (options.fsync !== false) {
      fs.fsyncSync(fd);
    }

    fs.closeSync(fd);
    fd = null;

    if (options.chown) {
      try {
        fs.chownSync(tmpfile, options.chown.uid, options.chown.gid);
      } catch (err) {
        if (!isChownErrOk(err)) {
          throw err;
        }
      }
    }

    if (options.mode) {
      try {
        fs.chmodSync(tmpfile, options.mode);
      } catch (err) {
        if (!isChownErrOk(err)) {
          throw err;
        }
      }
    }

    fs.renameSync(tmpfile, filename);
    threw = false;
  } finally {
    if (fd) {
      try {
        fs.closeSync(fd);
      } catch (ex) {
        // ignore close errors at this stage, error may have closed fd already.
      }
    }
    removeOnExitHandler();
    if (threw) {
      cleanup();
    }
  }
}
lib.sync = sync;
lib._getTmpname = _getTmpname;
lib._cleanupOnExit = _cleanupOnExit;

export default lib;
