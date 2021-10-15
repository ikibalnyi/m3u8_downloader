const { promisify } = require('util');
const fluentFfmpeg = require('fluent-ffmpeg');

const streamPipeline = promisify(require('stream').pipeline);

const log = (str) => {
  console.log(str);
};

const logError = (str) => {
  console.error(str);
};

const exit = () => {
  throw new Error("exit");
};

const arrayChunk = (arr, num) => {
  let c = arr.length / num;
  if (arr.length % num > 0) {
    c++;
  }
  const result = [];
  for (let i = 0; i < c; i++) {
    const a = arr.splice(0, num);
    if (a.length > 0) {
      result.push(a);
    }
  }
  return result;
};

function ffmpeg(input) {
  const ffmpeg = fluentFfmpeg(input);

  const originalRun = ffmpeg.run.bind(ffmpeg);

  ffmpeg.run = () => new Promise((resolve, reject) => {
    ffmpeg
      .on('error', reject)
      .on('end', resolve)

    originalRun()
  });

  return ffmpeg
}

module.exports = {
  log,
  logError,
  exit,
  arrayChunk,
  ffmpeg,
  streamPipeline,
};
