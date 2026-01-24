const OpenAI = require('openai');

const apiKey = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const client = apiKey ? new OpenAI({ apiKey }) : null;

const MODE_MAP = {
  current: 'Aktuelle Trends',
  controversy: 'Kontroverse Themen',
  questions: 'Offene Fragen',
};

async function generateTrendsForTopic(topicName, mode, count = 7) {
  if (!topicName) {
    throw new Error('topicName is required');
  }
  const modeLabel = MODE_MAP[mode];
  if (!modeLabel) {
    throw new Error('mode is invalid');
  }
  const clamped = clampCount(count);

  if (!client) {
    return buildFallback(topicName, modeLabel, clamped);
  }

  const { system, user } = buildTrendPrompt(topicName, modeLabel, clamped);

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
    return buildFallback(topicName, modeLabel, clamped);
  }
  return parsed.slice(0, clamped);
}

function buildTrendPrompt(topicName, modeLabel, count) {
  const system = [
    'Du bist Trend-Analyst für X (Twitter).',
    'Antworte immer auf Deutsch.',
    'Basis: weltweite Diskussionen der letzten 24–72 Stunden.',
    'Bewerte Trends nach Diskussionsdichte (Replies wichtiger als Likes) und wiederkehrenden Narrativen.',
    'Keine generischen Dauerbrenner, keine historischen oder zeitlosen Themen.',
    'Output-Format: JSON mit dem Feld "trends" als Array von Strings.',
    'Jeder Eintrag max. 1–2 kurze Stichsätze, ohne Emojis.',
    `Gib ${count} Einträge aus.`,
  ].join(' ');

  const user = [
    `Thema: ${topicName}`,
    `Modus: ${modeLabel}`,
    'Liefere Trend-Ideen als Grundlage für spätere X-Posts.',
  ].join('\n');
  return { system, user };
}

function clampCount(value) {
  const number = Number(value) || 7;
  return Math.min(10, Math.max(5, number));
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

function buildFallback(topicName, modeLabel, count) {
  const base = fallbackSeeds[modeLabel] || fallbackSeeds['Aktuelle Trends'];
  const results = [];
  for (let i = 0; i < count; i += 1) {
    const seed = base[i % base.length];
    results.push(`${seed} rund um ${topicName}.`);
  }
  return results;
}

const fallbackSeeds = {
  'Aktuelle Trends': [
    'Spontaner Hype um neue Produkt-Launches',
    'Live-Diskussionen nach einem internationalen Event',
    'Community-Reaktionen auf überraschende Ankündigungen',
    'Vergleiche zwischen zwei konkurrierenden Angeboten',
    'Kurzfristige Preisbewegungen mit starkem Echo',
  ],
  'Kontroverse Themen': [
    'Streit um Transparenz, Gebühren oder Fairness',
    'Polarisierende Meinungen zu Regulierung oder Regeln',
    'Heftige Debatte nach einem öffentlichen Fehltritt',
    'Kontroverse um Datennutzung und Privatsphäre',
    'Spaltung zwischen Early Adopters und Skeptikern',
  ],
  'Offene Fragen': [
    'Viele fragen nach der besten nächsten Handlung',
    'Unsicherheit über die langfristigen Auswirkungen',
    'Fragen nach Empfehlungen und Alternativen',
    'Diskussion über Risiken vs. Chancen',
    'Offene Frage nach dem richtigen Timing',
  ],
};

module.exports = {
  generateTrendsForTopic,
  MODE_MAP,
  clampCount,
  buildTrendPrompt,
};
