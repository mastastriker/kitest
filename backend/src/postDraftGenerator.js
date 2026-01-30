const OpenAI = require('openai');
const { getPostPropertyMap } = require('./postProperties');

const apiKey = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const client = apiKey ? new OpenAI({ apiKey }) : null;

const SCORE_FIELDS = [
  'timeliness_score',
  'theme_fit_score',
  'friction_score',
  'novelty_score',
  'discussion_score',
  'total_score',
];

async function generateDraftFromSource({ theme, source, allowedProperties, requireLink }) {
  if (!client) {
    throw new Error('OpenAI client is not configured');
  }
  const propertyHints = buildPropertyHints(allowedProperties);
  const analysis = await runAnalysis(theme, source, propertyHints);
  if (!analysis || analysis.total_score < 9) {
    return {
      eligible: false,
      analysis,
    };
  }
  const idea = await runIdeaStage(theme, source, analysis, propertyHints);
  const finalText = await runRewriteStage(theme, source, idea, propertyHints, requireLink);
  return {
    eligible: true,
    analysis,
    idea,
    content: finalText,
  };
}

async function runAnalysis(theme, source, propertyHints) {
  const { system, user } = buildAnalysisPrompt(theme, source, propertyHints);
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.2,
    response_format: { type: 'json_object' },
  });
  const content = response.choices[0]?.message?.content;
  return parseAnalysis(content);
}

async function runIdeaStage(theme, source, analysis, propertyHints) {
  const { system, user } = buildIdeaPrompt(theme, source, analysis, propertyHints);
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
  return parseIdea(content);
}

async function runRewriteStage(theme, source, idea, propertyHints, requireLink) {
  const { system, user } = buildRewritePrompt(theme, source, idea, propertyHints, requireLink);
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.7,
    response_format: { type: 'json_object' },
  });
  const content = response.choices[0]?.message?.content;
  const parsed = parseFinal(content);
  if (!parsed) {
    throw new Error('OpenAI response did not include a valid post');
  }
  return enforceLimits(parsed, source.link, requireLink);
}

function buildAnalysisPrompt(theme, source, propertyHints) {
  const system = [
    'Du bist Redakteur für pointierte X-Posts.',
    'Lies Titel und Inhalt komplett.',
    'Bewerte Aktualität, Themen-Fit, Konflikt/Reibung, Neuheitsgrad, Diskussionspotenzial.',
    'Antworte nur mit JSON.',
  ].join(' ');
  const user = [
    `Thema: ${theme}`,
    `Titel: ${source.title}`,
    `Inhalt: ${source.content}`,
    source.publishedAt ? `Veröffentlicht: ${source.publishedAt}` : '',
    source.link ? `Quelle: ${source.link}` : '',
    propertyHints,
    'Antworte als JSON mit Feldern:',
    'timeliness_score (0-3), theme_fit_score (0-3), friction_score (0-3), novelty_score (0-3), discussion_score (0-3), total_score (0-15), core_claim (ein Satz).',
    'Nur JSON.',
  ]
    .filter(Boolean)
    .join('\n');
  return { system, user };
}

function buildIdeaPrompt(theme, source, analysis, propertyHints) {
  const system = [
    'Du entwickelst eine klare Post-Idee.',
    'Keine Zusammenfassung des Artikels.',
    'Klares Urteil, klare Perspektive.',
    'Antworte nur mit JSON.',
  ].join(' ');
  const user = [
    `Thema: ${theme}`,
    `Kernaussage: ${analysis.core_claim}`,
    `Quelle: ${source.title}`,
    propertyHints,
    'Erzeuge eine klare These, einen Blickwinkel und eine meinungsstarke Rohfassung.',
    'Format: {"thesis":"...","angle":"...","rough":"..."}',
  ]
    .filter(Boolean)
    .join('\n');
  return { system, user };
}

function buildRewritePrompt(theme, source, idea, propertyHints, requireLink) {
  const system = [
    'Du schreibst den finalen X-Post.',
    'Klingt menschlich, direkt und glaubwürdig.',
    'Maximal 280 Zeichen.',
    'Kurze, klare Sätze.',
    'Keine Gedankenstriche, keine Emojis, keine Aufzählungen.',
    'Keine Meta-Sprache und keine Floskeln.',
    'Keine abstrakten Verben wie "ignorieren" oder "thematisieren".',
    'Antworte nur mit JSON: {"post":"..."}',
  ].join(' ');
  const user = [
    `Thema: ${theme}`,
    `Quelle: ${source.title}`,
    source.link ? `Link: ${source.link}` : '',
    `These: ${idea.thesis}`,
    `Blickwinkel: ${idea.angle}`,
    `Rohfassung: ${idea.rough}`,
    propertyHints,
    requireLink
      ? 'Der Post muss den Link enthalten und sich konkret auf Quelle, Akteur oder Ereignis beziehen.'
      : 'Beziehe dich konkret auf Akteure oder Ereignisse.',
    'Kein Gedankenstrich, keine Emojis, keine Aufzählungen.',
    'Nur JSON.',
  ]
    .filter(Boolean)
    .join('\n');
  return { system, user };
}

function buildPropertyHints(allowedProperties = []) {
  if (!allowedProperties.length) {
    return '';
  }
  const propertyMap = getPostPropertyMap();
  const hints = allowedProperties
    .map((id) => propertyMap[id]?.prompt)
    .filter(Boolean)
    .map((prompt) => `- ${prompt}`);
  if (!hints.length) {
    return '';
  }
  return `Erlaubte Eigenschaften:\n${hints.join('\n')}`;
}

function parseAnalysis(payload) {
  try {
    const json = JSON.parse(payload);
    const result = {};
    SCORE_FIELDS.forEach((field) => {
      result[field] = Number(json[field]) || 0;
    });
    result.core_claim = String(json.core_claim || '').trim();
    return result;
  } catch (err) {
    return null;
  }
}

function parseIdea(payload) {
  try {
    const json = JSON.parse(payload);
    return {
      thesis: String(json.thesis || '').trim(),
      angle: String(json.angle || '').trim(),
      rough: String(json.rough || '').trim(),
    };
  } catch (err) {
    return null;
  }
}

function parseFinal(payload) {
  try {
    const json = JSON.parse(payload);
    const post = String(json.post || '').trim();
    return post || null;
  } catch (err) {
    return null;
  }
}

function enforceLimits(post, link, requireLink) {
  let text = String(post || '').trim();
  if (requireLink && link) {
    if (!text.includes(link)) {
      text = `${text} ${link}`.trim();
    }
    text = trimToLimitWithLink(text, link, 280);
  }
  if (text.length > 280) {
    text = text.slice(0, 280).trim();
  }
  return text;
}

function trimToLimitWithLink(text, link, limit) {
  const normalized = text.trim();
  if (normalized.length <= limit) {
    return normalized;
  }
  const linkIndex = normalized.indexOf(link);
  if (linkIndex === -1) {
    return normalized.slice(0, limit).trim();
  }
  const linkPart = normalized.slice(linkIndex).trim();
  const available = limit - linkPart.length - 1;
  if (available <= 0) {
    return linkPart.slice(0, limit);
  }
  const prefix = normalized.slice(0, linkIndex).trim().slice(0, available).trim();
  return `${prefix} ${linkPart}`.trim();
}

module.exports = {
  generateDraftFromSource,
};
