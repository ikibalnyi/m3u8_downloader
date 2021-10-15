const fs = require('fs');
const fetch = require('node-fetch');
const utils = require('./utils');

module.exports = async function downloadFile(url, file, repeatOnErrorTimes = 5) {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
    return file;
  } catch {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0)',
        },
      });
      if (!response.ok) throw new Error(`Unexpected response: ${response.statusText}`);
      await utils.streamPipeline(response.body, fs.createWriteStream(file));
      return file;
    } catch (error) {
      utils.logError(error.message);

      if (repeatOnErrorTimes) {
        return downloadFile(url, file, repeatOnErrorTimes - 1);
      }

      throw new error;
    }
  }
};
