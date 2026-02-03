const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const MASTER_PROMPT_PATH = path.join(
  __dirname,
  'x_master_prompt_v2_1_1.txt'
);

let cachedPrompt = null;
let cachedMtimeMs = 0;

function loadPrompt() {
  const stats = fs.statSync(MASTER_PROMPT_PATH);
  const shouldReload =
    process.env.NODE_ENV !== 'production' &&
    (!cachedPrompt || stats.mtimeMs !== cachedMtimeMs);

  if (!cachedPrompt || shouldReload) {
    cachedPrompt = fs.readFileSync(MASTER_PROMPT_PATH, 'utf8');
    cachedMtimeMs = stats.mtimeMs;
  }

  if (!cachedPrompt) {
    throw new Error('X master prompt is empty');
  }

  return cachedPrompt;
}

// Single source of truth for the X master prompt across all generation paths.
function getXMasterPrompt() {
  return loadPrompt();
}

function getXMasterPromptInfo() {
  const prompt = loadPrompt();
  const sha256 = crypto.createHash('sha256').update(prompt).digest('hex');
  return {
    prompt,
    sha256,
    sourcePath: MASTER_PROMPT_PATH,
  };
}

module.exports = {
  getXMasterPrompt,
  getXMasterPromptInfo,
};
