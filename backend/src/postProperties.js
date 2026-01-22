const postProperties = [
  {
    id: 'humorous',
    label: 'Lustig / humorvoll',
    prompt: 'Schreibe den Post mit humorvollem, leichtem Ton.',
    conflicts: ['serious'],
  },
  {
    id: 'serious',
    label: 'Sachlich / ernst',
    prompt: 'Halte den Ton sachlich und ernst.',
    conflicts: ['humorous', 'provocative'],
  },
  {
    id: 'provocative',
    label: 'Provokant / kontrovers',
    prompt: 'Setze eine provokante oder kontroverse Zuspitzung ein.',
    conflicts: ['serious'],
  },
  {
    id: 'educational',
    label: 'Lehrreich',
    prompt: 'Vermittle einen klaren, lehrreichen Erkenntnisgewinn.',
  },
  {
    id: 'optimistic',
    label: 'Optimistisch (bullish)',
    prompt: 'Nutze einen optimistischen, zuversichtlichen Blick.',
    conflicts: ['critical'],
  },
  {
    id: 'critical',
    label: 'Kritisch (bearish)',
    prompt: 'Nutze einen kritischen, skeptischen Blick.',
    conflicts: ['optimistic'],
  },
  {
    id: 'strong-hook',
    label: 'Starke Hook am Anfang',
    prompt: 'Starte mit einer starken Hook im ersten Satz.',
  },
  {
    id: 'question-end',
    label: 'Offene Frage am Ende',
    prompt: 'Beende den Post mit einer offenen Frage.',
  },
  {
    id: 'short-sentences',
    label: 'Kurze, knackige Sätze',
    prompt: 'Nutze kurze, knackige Sätze.',
  },
  {
    id: 'story',
    label: 'Story-ähnlicher Aufbau',
    prompt: 'Strukturiere den Post wie eine kurze Story.',
    conflicts: ['list-style'],
  },
  {
    id: 'list-style',
    label: 'Aufzählungsstil',
    prompt: 'Nutze einen klaren Aufzählungsstil.',
    conflicts: ['story'],
  },
  {
    id: 'call-to-action',
    label: 'Call-to-Action (Diskussion anstoßen)',
    prompt: 'Füge einen Call-to-Action hinzu, der zur Diskussion einlädt.',
  },
  {
    id: 'curiosity-gap',
    label: 'Neugier erzeugen (nicht alles erklären)',
    prompt: 'Lass bewusst etwas offen, um Neugier zu erzeugen.',
  },
  {
    id: 'no-emojis',
    label: 'Keine Emojis',
    prompt: 'Verwende keine Emojis.',
  },
  {
    id: 'no-hashtags',
    label: 'Keine Hashtags',
    prompt: 'Verwende keine Hashtags.',
  },
];

function getPostProperties() {
  return postProperties.map((property) => ({ ...property }));
}

function getPostPropertyMap() {
  return postProperties.reduce((acc, property) => {
    acc[property.id] = property;
    return acc;
  }, {});
}

module.exports = {
  getPostProperties,
  getPostPropertyMap,
};
