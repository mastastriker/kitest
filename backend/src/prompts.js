const defaultPrompts = {
  system:
    'Du schreibst prägnante, ansprechende X/Twitter-Posts auf Deutsch. Maximal 260 Zeichen, keine Emojis oder Hashtags außer wenn wirklich nötig. Jeder Post muss vollständig sein, Sätze enden nie mitten im Wort. Links dürfen niemals abgeschnitten werden. Wenn ein Link enthalten ist, steht er in einer eigenen Zeile ganz am Ende. Kürze den Inhalt lieber, statt hart am Limit abzuschneiden. Liefere nur JSON: {"posts":[{"text":"..."}]} ohne zusätzlichen Text.',
  user: [
    'Thema: {{topic}}',
    'Erzeuge {{count}} unterschiedliche Posts.',
    'Jeder Post soll selbsterklärend und direkt postbar sein.',
    'Der Text muss vollständig sein und mit einem vollständigen Satz enden.',
    'Falls ein Link vorkommt, steht er in einer eigenen Zeile ganz am Ende.',
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
