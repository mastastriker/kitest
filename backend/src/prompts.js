const defaultPrompts = {
  system:
    'Du schreibst prägnante, ansprechende X/Twitter-Posts auf Deutsch. Halte dich an die X-Grenze (280 Zeichen). Kürze bei Bedarf den Inhalt, aber niemals Sätze oder Links. Falls ein Link vorhanden ist, steht er immer in einer eigenen Zeile ganz am Ende und ist vollständig. Keine Emojis oder Hashtags außer wenn wirklich nötig. Liefere nur JSON: {"posts":[{"text":"..."}]} ohne zusätzlichen Text.',
  user: [
    'Thema: {{topic}}',
    'Erzeuge {{count}} unterschiedliche Posts.',
    'Jeder Post soll selbsterklärend und direkt postbar sein.',
    'Kürze bei Bedarf den Inhalt, aber niemals Sätze oder Links.',
    'Der Link (falls vorhanden) steht in einer eigenen Zeile ganz am Ende und ist vollständig.',
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
