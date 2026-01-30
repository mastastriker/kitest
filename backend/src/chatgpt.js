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
  const { system, user } = buildArticlePrompt(topicName, article, styleModule);
  const content = await requestCompletion(system, user);
  return content;
}

async function generateDraftFromTrend(topicName, trend, styleModule) {
  if (!client) {
    throw new Error('OpenAI client is not configured');
  }
  const { system, user } = buildTrendPostPrompt(topicName, trend, styleModule);
  const content = await requestCompletion(system, user);
  return content;
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

function buildArticlePrompt(topicName, article, styleModule) {
  const system = [
    'Du bist ein Redaktionsassistent für X-Posts.',
    'Antworte nur mit dem finalen X-Post, ohne Erklärungen.',
    'Arbeite strikt in drei Schritten (intern): Analyse, Post-Idee, Anti-KI-Rewrite.',
    'Schritt 1 Analyse: Kernaussage, Konflikt, Diskussionspotenzial, keine Zusammenfassung.',
    'Schritt 2 Post-Idee: klare These/Blickwinkel, nicht neutral, keine Erklärung.',
    'Schritt 3 Anti-KI-Rewrite: finale Fassung.',
    'Finale Regeln: kurze Sätze, kein Gedankenstrich, keine Floskeln, kein Meta-Kommentar.',
    'Verständlich beim ersten Lesen.',
    'Maximal 280 Zeichen Gesamt; jeder Link zählt pauschal als 23 Zeichen.',
    'Wenn zu lang: neu formulieren, nicht kürzen.',
    'Gib nur den finalen Post aus, ohne Anführungszeichen.',
  ].join(' ');

  const styleInstruction = buildStyleInstruction(styleModule, 'rss');

  const user = [
    `Thema: ${topicName}`,
    `Artikel-Titel: ${article.title || 'Ohne Titel'}`,
    article.summary ? `Artikel-Auszug: ${article.summary}` : null,
    `Artikel-Link: ${article.link}`,
    'Link-Regel (RSS): Posttext, dann leere Zeile, dann der Link.',
    styleInstruction,
  ]
    .filter(Boolean)
    .join('\n');
  return { system, user };
}

function buildTrendPostPrompt(topicName, trend, styleModule) {
  const system = [
    'Du bist ein Redaktionsassistent für X-Posts.',
    'Antworte nur mit dem finalen X-Post, ohne Erklärungen.',
    'Arbeite strikt in drei Schritten (intern): Analyse, Post-Idee, Anti-KI-Rewrite.',
    'Schritt 1 Analyse: Kernaussage, Konflikt, Diskussionspotenzial, keine Zusammenfassung.',
    'Schritt 2 Post-Idee: klare These/Blickwinkel, nicht neutral, keine Erklärung.',
    'Schritt 3 Anti-KI-Rewrite: finale Fassung.',
    'Finale Regeln: kurze Sätze, kein Gedankenstrich, keine Floskeln, kein Meta-Kommentar.',
    'Verständlich beim ersten Lesen.',
    'Maximal 280 Zeichen Gesamt; jeder Link zählt pauschal als 23 Zeichen.',
    'Wenn zu lang: neu formulieren, nicht kürzen.',
    'Gib nur den finalen Post aus, ohne Anführungszeichen.',
  ].join(' ');

  const styleInstruction = buildStyleInstruction(styleModule, 'trend');

  const user = [
    `Thema: ${topicName}`,
    `Trend-Beschreibung: ${trend}`,
    'Trend-Regel: Posttext, dann leere Zeile, dann "Quelle: <Trendbeschreibung>".',
    styleInstruction,
  ]
    .filter(Boolean)
    .join('\n');
  return { system, user };
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
