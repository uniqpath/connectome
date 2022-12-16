import prettyMicroDuration from './prettyMicroDuration/index.js';

function start() {
  return process.hrtime.bigint();
}

function stop(start) {
  const duration = Number(process.hrtime.bigint() - start);

  // prettyMicroDuration is inacurate for values over 1s... we get 2m for example instead of 1 min 50 s etc.
  const prettyTime = duration < 1e9 ? prettyMicroDuration(duration) : `${duration / 1e6}ms`;

  return { duration, prettyTime };
}

export default { start, stop };
