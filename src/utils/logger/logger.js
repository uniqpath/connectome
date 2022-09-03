import inspect from 'browser-util-inspect';

function doLogging(color, log, ...args) {
  try {
    if (log == console.log) {
      // by doing inspect in this way we get normal text in quotations: '...'
      // 9/2/2022, 9:42:11 PM → 'Connector ws://192.168.0.16:7780 created'
      // we remove them with 2x replace ...
      log(
        `${new Date().toLocaleString()} → ${inspect(...args)
          .replace(/^'/, '')
          .replace(/'$/, '')}`
      );
    } else if (typeof log == 'function') {
      log(...args); // recently changed from args to ...args -- see if some other places need change
    } else if (log) {
      // dmt logger object
      log.logOutput(color, { source: 'connectome' }, ...args);
    }
  } catch (e) {
    console.log(e);
  }
}

class Logger {
  write(log, ...args) {
    doLogging(undefined, log, ...args);
  }

  red(log, ...args) {
    doLogging('red', log, ...args);
  }

  green(log, ...args) {
    doLogging('green', log, ...args);
  }

  yellow(log, ...args) {
    doLogging('yellow', log, ...args);
  }

  blue(log, ...args) {
    doLogging('blue', log, ...args);
  }

  cyan(log, ...args) {
    doLogging('cyan', log, ...args);
  }

  magenta(log, ...args) {
    doLogging('magenta', log, ...args);
  }

  gray(log, ...args) {
    doLogging('gray', log, ...args);
  }

  white(log, ...args) {
    doLogging('white', log, ...args);
  }
}

export default new Logger();
