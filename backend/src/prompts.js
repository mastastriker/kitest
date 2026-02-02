const fs = require('fs');
const path = require('path');

const MASTER_PROMPT_PATH = path.join(
  __dirname,
  '..',
  'prompts',
  'x_master_prompt_v2_1_1.txt'
);

const defaultPrompts = {
  user: [
    'Topic: {{topic}}',
    'Generate {{count}} distinct posts.',
    'Each post must be self-contained and ready to publish.',
    'Write the full text first, then provide the link separately.',
    'The text must not contain URLs.',
    'The link must be only the URL and must be complete.',
    'Trim if needed, but never cut off sentences or links.',
    'Return JSON only: {"posts":[{"text":"...","link":"https://..."}]}',
  ].join('\n'),
};

function getMasterPrompt() {
  const prompt = fs.readFileSync(MASTER_PROMPT_PATH, 'utf8');
  if (!prompt) {
    throw new Error('X master prompt is empty');
  }
  return prompt;
}

function getDefaultPrompts() {
  return { ...defaultPrompts };
}

function renderUserPrompt(template, topicName, count) {
  const safeTemplate = template || defaultPrompts.user;
  return safeTemplate
    .replaceAll('{{topic}}', topicName)
    .replaceAll('{{count}}', String(count));
}

module.exports = {
  getDefaultPrompts,
  getMasterPrompt,
  renderUserPrompt,
};
