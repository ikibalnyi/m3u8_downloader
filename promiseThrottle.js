const promiseThrottle = (maxParallelCalls = 10) => {
  const queued = [];
  let parallelCalls = 0;

  const execute = () => {
    if (!queued.length || parallelCalls >= maxParallelCalls) return;

    const { promiseFn, resolve, reject } = queued.shift();
    parallelCalls++;

    promiseFn()
      .then(resolve)
      .catch(reject)
      .then(() => {
        parallelCalls--;
        execute();
      })
  };

  const push = (promiseFn) => {
    return new Promise((resolve, reject) => {
      queued.push({
        resolve,
        reject,
        promiseFn
      });

      execute();
    })
  };

  return { push };
};

module.exports = promiseThrottle;
