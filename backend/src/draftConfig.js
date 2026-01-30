const THEMES = {
  crypto: {
    id: 'crypto',
    label: 'Crypto',
    allowed_properties: [
      {
        id: 'kritisch',
        label: 'Kritisch',
        prompt: 'Betone Risiken, Widersprüche oder blinde Flecken im Markt.',
      },
      {
        id: 'provokant',
        label: 'Provokant',
        prompt: 'Formuliere eine klare, kantige These mit Reibung.',
      },
      {
        id: 'erklärend',
        label: 'Erklärend',
        prompt: 'Führe kurz in die Relevanz ein, ohne belehrend zu wirken.',
      },
      {
        id: 'fragend',
        label: 'Fragend',
        prompt: 'Schließe mit einer klaren Frage, die Reaktionen triggert.',
      },
    ],
  },
  camping: {
    id: 'camping',
    label: 'Camping',
    allowed_properties: [
      {
        id: 'kritisch',
        label: 'Kritisch',
        prompt: 'Greife ein Problem oder eine schwache Empfehlung klar auf.',
      },
      {
        id: 'provokant',
        label: 'Provokant',
        prompt: 'Setze einen klaren Kontrast oder eine unbequeme Wahrheit.',
      },
      {
        id: 'erklärend',
        label: 'Erklärend',
        prompt: 'Erkläre kurz den konkreten Nutzen oder Schaden.',
      },
      {
        id: 'fragend',
        label: 'Fragend',
        prompt: 'Stelle eine direkte Frage an die Community.',
      },
    ],
  },
};

const THEME_LIST = Object.values(THEMES);

function getDraftThemes() {
  return THEME_LIST.map((theme) => ({
    id: theme.id,
    label: theme.label,
    allowed_properties: theme.allowed_properties,
  }));
}

function getDraftTheme(themeId) {
  return THEMES[themeId] || null;
}

module.exports = {
  getDraftThemes,
  getDraftTheme,
};
