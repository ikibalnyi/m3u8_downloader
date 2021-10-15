const path = require('path');
const utils = require('./utils');
const fs = require('fs');
const fetch = require('node-fetch');
const ProgressBar = require('progress');
const throttle = require('./promiseThrottle');
const downloadFile = require('./downloadFileAndSave');
const rimraf = require('rimraf');

const urls = [
  // INTRO ========================
  // {
  //   url: 'https://vh-04.vhgetcourse.ru/player/160c413dd0b61abe55751669c5688d58/e408569d0e0c815ec57cc3a8a7a4f7b5/master.m3u8?sid=sid&host=vh-31&user-cdn=integros&akamai-cdn-pr=0&v=3:2:1:0',
  //   fileName: 'Block1/01.Intro'
  // },
];
const filePath = './out';

(async function dwn() {
  for (const { url, fileName } of urls) {
    const dir = path.join(filePath, fileName);
    const outputFile = `${dir}.mp4`;

    if (fs.existsSync(outputFile)) {
      fs.unlinkSync(outputFile);
    }

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, {
        recursive: true,
      });
    }

    try {
      await fetch(url)
        .then((res) => res.text())
        .then((data) => data.split('\n').filter(Boolean).pop())
        .then((url) => fetch(url).then((res) => res.text()))
        .then((data) => parseM3U8(fileName, dir, data));
    } catch (error) {
      console.log(error.message);
    }
  }
})();

async function parseM3U8(fileName, dir, content) {
  utils.log(`Start downloading ${fileName}...`);

  const tsList = content.match(/((http|https):\/\/.*)|(.+\.ts(\?.*)?)/g);

  if (!tsList?.length) {
    utils.logError('m3u8 file error, no ts files');
    utils.log(content);
    return;
  }

  const throttler = throttle(100);
  const bar = new ProgressBar(
    'Downloading::percent [:bar]  Current::current Total::total Current time::elapseds rest::etas',
    { total: tsList.length, width: 100 }
  );
  const tsOutPuts = [];

  await Promise.all(
    tsList.map((url, i) => throttler.push(async () => {
      const file = await downloadFile(url, `${dir}/${i}.ts`);
      bar.tick();
      tsOutPuts[i] = file;
    }))
  );

  const chunks = await Promise.all(
    utils.arrayChunk(tsOutPuts, 100).map(async (chunk, index) => {
      const outputMP4 = `${dir}/output${index}.mp4`;
      await concatChunk(chunk, outputMP4, index);

      return outputMP4;
    })
  );

  const outputMp4 = `${dir}.mp4`;

  await concatMP4(chunks, outputMp4, dir);
}


async function concatChunk(chunk, output, index) {
  const strConcat = chunk.join('|');

  if (fs.existsSync(output)) {
    fs.unlinkSync(output);
  }

  return utils.ffmpeg(`concat:${strConcat}`)
    .audioCodec('copy')
    .videoCodec('copy')
    .addOutputOption('-bsf:a aac_adtstoasc')
    .output(output)
    .run()
    .then(() => {
      utils.log(`${index + 1}. FFMPEG mp4 ${output} Processing complete.`);
    })
    .catch(error => {
      utils.logError(`ffmpeg mp4 ${output} error: ${error.message}`);
      concatChunk(chunk, output, index);
    });
}


function concatMP4(chunks, output, dir) {
  if (fs.existsSync(output)) {
    utils.log('The final file already exists, skip the generation, so far all FFMPEG processing is complete.');
    cleanup(dir);
    return;
  }

  if (chunks.length > 1) {
    const fileListPath = path.join(dir, 'filelist.txt');

    const filelist = chunks.reduce((result, chunkFile) => {
      return result + `file ${path.relative(path.dirname(fileListPath), chunkFile)} \n`;
    }, '');

    fs.writeFileSync(fileListPath, filelist);

    return utils
      .ffmpeg(fileListPath)
      .addOutputOption('-c copy')
      .addInputOption('-f concat')
      .output(output)
      .run()
      .then(() => {
        utils.log('All FFMPEG processing completed.');
        cleanup(dir);
      }).catch((error) => {
        utils.logError(`ffmpeg mp4 ALL error: ${error.message}`);
        utils.exit();
      });
  } else if (chunks.length === 1) {
    const [chunk] = chunks;
    return fs.promises.rename(chunk, output)
      .then(() => cleanup(dir))
      .catch((err) => {
        utils.logError(`rename last mp4 error: ${err.message}`);
        utils.exit();
      });
  }
}

function cleanup(dir) {
  rimraf(dir, {}, (err) => {
    if (err) console.log(err);
  });
}
