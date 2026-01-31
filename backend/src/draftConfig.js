const { getThemes, getTheme } = require('./store');

const THEME_PROPERTIES = {
  crypto: {
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

function buildDraftTheme(theme) {
  if (!theme) return null;
  const config = THEME_PROPERTIES[theme.key] || { allowed_properties: [] };
  return {
    id: theme.id,
    key: theme.key,
    label: theme.name,
    active: theme.active,
    allowed_properties: config.allowed_properties || [],
  };
}

function getDraftThemes() {
  return getThemes()
    .filter((theme) => theme.active)
    .map((theme) => buildDraftTheme(theme));
}

function getDraftTheme(themeId) {
  const theme = getTheme(themeId);
  if (!theme || !theme.active) {
    return null;
  }
  return buildDraftTheme(theme);
}

module.exports = {
  getDraftThemes,
  getDraftTheme,
};
