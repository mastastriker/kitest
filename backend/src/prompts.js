const defaultPrompts = {
  system:
    'Du schreibst prägnante, ansprechende X/Twitter-Posts auf Deutsch. Maximal 260 Zeichen, keine Emojis oder Hashtags außer wenn wirklich nötig. Liefere nur JSON: {"posts":[{"text":"..."}]} ohne zusätzlichen Text.',
  user: [
    'Thema: {{topic}}',
    'Erzeuge {{count}} unterschiedliche Posts.',
    'Jeder Post soll selbsterklärend und direkt postbar sein.',
  ].join('\n'),
};

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
  renderUserPrompt,
};
