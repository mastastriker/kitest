const OpenAI = require('openai');

const apiKey = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const client = apiKey ? new OpenAI({ apiKey }) : null;

const STYLE_MODULES = [
  'offene Frage am Ende',
  'provokante These',
  'Call-to-Comment',
  'Link am Anfang',
  'Link am Ende',
];

const TREND_FALLBACKS = [
  'Diskussion um neue KI-Modelle im Alltag',
  'Spannungen zwischen Regulierung und Innovation',
  'Kritik an intransparenten Geschäftsmodellen',
  'Debatte über Vertrauensverlust bei Plattformen',
  'Aufruhr um überraschende Marktbewegungen',
];

function pickStyleModule() {
  const index = Math.floor(Math.random() * STYLE_MODULES.length);
  return STYLE_MODULES[index];
}

async function generateDraftFromArticle(topicName, article, styleModule) {
  if (!client) {
    throw new Error('OpenAI client is not configured');
  }
  const themeDescription = article?.themeDescription || 'Keine.';
  const articleText = buildArticleText(article);
  const analysis = await runAnalysisStep(topicName, themeDescription, articleText);
  const postIdea = await runPostIdeaStep(analysis);
  return runFinalStep({
    postIdea,
    theme: topicName,
    sourceRef: article.link,
    sourceType: 'rss',
    styleModule,
  });
}

async function generateDraftFromTrend(topicName, trend, styleModule) {
  if (!client) {
    throw new Error('OpenAI client is not configured');
  }
  const themeDescription = 'Keine.';
  const analysis = await runAnalysisStep(topicName, themeDescription, trend);
  const postIdea = await runPostIdeaStep(analysis);
  return runFinalStep({
    postIdea,
    theme: topicName,
    sourceRef: trend,
    sourceType: 'trend',
    styleModule,
  });
}

async function generateTrendSignal(topicName, count = 7) {
  if (!topicName) {
    throw new Error('Topic is required');
  }
  const desired = clampTrendCount(count);
  if (!client) {
    return TREND_FALLBACKS.slice(0, desired);
  }
  const { system, user } = buildTrendSignalPrompt(topicName, desired);
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.6,
    response_format: { type: 'json_object' },
  });
  const content = response.choices[0]?.message?.content;
  const parsed = safeParseTrends(content);
  if (!parsed.length) {
    throw new Error('OpenAI response did not include valid trends');
  }
  return parsed.slice(0, desired);
}

async function requestCompletion(system, user) {
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.7,
  });
  const content = response.choices[0]?.message?.content;
  const trimmed = typeof content === 'string' ? content.trim() : '';
  if (!trimmed) {
    throw new Error('OpenAI response did not include a draft');
  }
  return trimmed;
}

async function runAnalysisStep(theme, themeDescription, content) {
  const system = [
    'Du analysierst Inhalte für die spätere Erstellung eines meinungsstarken X-Posts.',
    'Du schreibst keinen Social-Post.',
  ].join(' ');

  const user = [
    `Thema: ${theme}`,
    `Beschreibung: ${themeDescription}`,
    '',
    'Inhalt:',
    content,
    '',
    'Aufgabe:',
    '- identifiziere die zentrale Aussage',
    '- identifiziere den Konflikt oder Reibungspunkt',
    '- beschreibe, warum Menschen darüber diskutieren könnten',
    '',
    'Wichtig:',
    '- KEINE Zusammenfassung',
    '- KEIN Social-Text',
    '- KEINE Meinung formulieren',
    '',
    'Gib das Ergebnis strukturiert aus.',
    '',
    'Erwarteter Output:',
    'Kernaussage:',
    '...',
    '',
    'Konflikt / Reibung:',
    '...',
    '',
    'Diskussionspotenzial:',
    '...',
  ].join('\n');

  return requestCompletion(system, user);
}

async function runPostIdeaStep(analysisOutput) {
  const system = [
    'Du entwickelst eine klare Post-Idee für einen X-Post.',
    'Du schreibst noch keinen finalen Text.',
  ].join(' ');

  const user = [
    'Analyse:',
    analysisOutput,
    '',
    'Aufgabe:',
    '- formuliere eine klare These oder einen Blickwinkel',
    '- nicht neutral',
    '- keine Erklärung',
    '- keine Zusammenfassung',
    '- Ziel ist Meinung + Reibung',
    '',
    'Gib NUR die Post-Idee aus.',
  ].join('\n');

  return requestCompletion(system, user);
}

async function runFinalStep({ postIdea, theme, sourceRef, sourceType, styleModule }) {
  const system = [
    'Du schreibst einen finalen X-Post.',
    'Der Text muss natürlich klingen und darf nicht nach KI wirken.',
  ].join(' ');

  const styleInstruction = buildStyleInstruction(styleModule, sourceType);
  const linkRules =
    sourceType === 'rss'
      ? ['- RSS:', '  Posttext', '', '  https://original-artikel-url'].join('\n')
      : ['- Trend:', '  Posttext', '', '  Quelle: <Trendbeschreibung>'].join('\n');

  const user = [
    'Post-Idee:',
    postIdea,
    '',
    'Kontext:',
    `Thema: ${theme}`,
    `Quelle: ${sourceRef}`,
    '',
    'REGELN (HART):',
    '- MAXIMAL 280 Zeichen gesamt',
    '- JEDER Link zählt pauschal als 23 Zeichen',
    '- kurze Sätze',
    '- kein Gedankenstrich',
    '- keine Erklärsprache',
    '- keine Floskeln',
    '- kein Meta-Kommentar',
    '- verständlich beim ersten Lesen',
    '- wenn zu lang: NEU FORMULIEREN, NICHT kürzen',
    '',
    'LINK-REGELN:',
    linkRules,
    '',
    'STIL-VARIANZ (INTERN):',
    '- Wähle zufällig GENAU EIN Stil-Modul:',
    '  - offene Frage am Ende',
    '  - provokante These',
    '  - Call-to-Comment',
    '  - Link am Anfang',
    '  - Link am Ende',
    '',
    styleInstruction,
    '',
    'WICHTIG:',
    '- Der Output ist der FINALE X-POST',
    '- KEIN zusätzlicher Text',
    '- KEIN Kürzen im Code',
    '- KEIN Anhängen von Links im Code',
  ].join('\n');

  return requestCompletion(system, user);
}

function buildArticleText(article) {
  const lines = [];
  if (article?.title) {
    lines.push(`Titel: ${article.title}`);
  }
  if (article?.summary) {
    lines.push(`Auszug: ${article.summary}`);
  }
  if (!lines.length) {
    lines.push('Keine Inhalte verfügbar.');
  }
  return lines.join('\n');
}

function buildTrendSignalPrompt(topicName, count) {
  const system = [
    'Du bist Trend-Analyst für X (Twitter).',
    'Antworte immer auf Deutsch.',
    'Basis: Diskussionen der letzten 24–72 Stunden.',
    'Keine Links, keine vollständigen Posts, nur Begriffe/Narrative.',
    'Output-Format: JSON mit Feld "trends" als Array von Strings.',
    'Kein Text außerhalb des JSON.',
    `Gib ${count} Einträge aus.`,
  ].join(' ');
  const user = [
    `Thema: ${topicName}`,
    'Liefere Trend-Signale (Begriffe/Narrative) als Grundlage.',
  ].join('\n');
  return { system, user };
}

function clampTrendCount(count) {
  const value = Number(count) || 7;
  return Math.min(10, Math.max(5, value));
}

function safeParseTrends(payload) {
  try {
    const json = JSON.parse(payload);
    const trends = Array.isArray(json.trends) ? json.trends : [];
    return trends.map((item) => String(item).trim()).filter(Boolean);
  } catch (err) {
    return [];
  }
}

function buildStyleInstruction(styleModule, sourceType) {
  if (styleModule === 'offene Frage am Ende') {
    return 'Stilmodul: Beende den Post mit einer offenen Frage.';
  }
  if (styleModule === 'provokante These') {
    return 'Stilmodul: Formuliere eine provokante These als Kern.';
  }
  if (styleModule === 'Call-to-Comment') {
    return 'Stilmodul: Baue einen klaren Call-to-Comment ein.';
  }
  if (styleModule === 'Link am Anfang') {
    return sourceType === 'rss'
      ? 'Stilmodul: Starte den Posttext mit einem knappen Verweis auf die Quelle unten.'
      : 'Stilmodul: Starte den Posttext mit einem Hinweis auf die Quelle unten.';
  }
  if (styleModule === 'Link am Ende') {
    return sourceType === 'rss'
      ? 'Stilmodul: Schließe den Posttext mit einer Pointe direkt vor dem Link.'
      : 'Stilmodul: Schließe den Posttext mit einer Pointe direkt vor der Quellenzeile.';
  }
  return '';
}

module.exports = {
  pickStyleModule,
  generateDraftFromArticle,
  generateDraftFromTrend,
  generateTrendSignal,
};
