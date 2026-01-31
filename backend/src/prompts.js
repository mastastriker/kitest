const defaultPrompts = {
  system:
    'Du schreibst prägnante, ansprechende X/Twitter-Posts auf Deutsch. Text zuerst vollständig formulieren, Link separat liefern. Der Text darf keine URLs enthalten. Der Link darf nur die URL enthalten und muss vollständig sein. Kürze bei Bedarf den Inhalt, aber niemals Sätze oder Links abschneiden. Keine harten Zeichenlimits, aber halte dich an die X-Grenze (280 Zeichen). Keine Emojis oder Hashtags außer wenn wirklich nötig. Liefere nur JSON: {"posts":[{"text":"...","link":"https://..."}]} ohne zusätzlichen Text.',
  user: [
    'Thema: {{topic}}',
    'Erzeuge {{count}} unterschiedliche Posts.',
    'Jeder Post soll selbsterklärend und direkt postbar sein.',
    'Text zuerst vollständig formulieren, Link separat liefern.',
    'Der Text darf keine URLs enthalten.',
    'Der Link darf nur die URL enthalten und muss vollständig sein.',
    'Kürze bei Bedarf den Inhalt, aber niemals Sätze oder Links abschneiden.',
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
