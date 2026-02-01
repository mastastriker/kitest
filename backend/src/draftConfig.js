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
        prompt: 'Starte mit einer nüchternen Beobachtung ohne Erklärung oder Einordnung.',
      },
      {
        id: 'fragend',
        label: 'Fragend',
        prompt: 'Schließe mit einer klaren Frage ohne Community-CTA.',
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
        prompt: 'Setze eine klare Beobachtung ohne Erklärung des Nutzens.',
      },
      {
        id: 'fragend',
        label: 'Fragend',
        prompt: 'Stelle eine direkte Frage ohne Community-CTA.',
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
