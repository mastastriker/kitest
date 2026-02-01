const fs = require('fs');
const path = require('path');

const ENV_PATH = path.join(__dirname, '..', '..', '.env');

const PROVIDER_ENV_KEYS = {
  openai: 'OPENAI_API_KEY',
  grok: 'GROK_API_KEY',
};

function getApiKeyStatus() {
  return {
    openai: Boolean(process.env.OPENAI_API_KEY),
    grok: Boolean(process.env.GROK_API_KEY),
  };
}

function setApiKey(providerId, value) {
  const envKey = PROVIDER_ENV_KEYS[providerId];
  if (!envKey) {
    throw new Error('provider is invalid');
  }
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    throw new Error('api key is required');
  }
  const nextLine = `${envKey}=${trimmed}`;
  let lines = [];
  if (fs.existsSync(ENV_PATH)) {
    lines = fs.readFileSync(ENV_PATH, 'utf-8').split(/\r?\n/);
  }
  let found = false;
  lines = lines.map((line) => {
    if (line.startsWith(`${envKey}=`)) {
      found = true;
      return nextLine;
    }
    return line;
  });
  if (!found) {
    lines.push(nextLine);
  }
  const cleaned = lines.filter((line, index, list) => index < list.length - 1 || line.trim() !== '');
  fs.writeFileSync(ENV_PATH, cleaned.join('\n'), 'utf-8');
  process.env[envKey] = trimmed;
  return true;
}

module.exports = {
  getApiKeyStatus,
  setApiKey,
};
