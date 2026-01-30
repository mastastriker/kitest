const OpenAI = require('openai');
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

async function generateDraftFromSource({
  theme,
  source,
  styleModule,
  requireLink,
  sourceLine,
}) {
  if (!client) {
    throw new Error('OpenAI client is not configured');
  }
  const analysis = await runAnalysis(theme, source);
  if (!analysis || analysis.total_score < 9) {
    return {
      eligible: false,
      analysis,
    };
  }
  const idea = await runIdeaStage(theme, source, analysis, styleModule);
  const finalText = await runRewriteStage(theme, source, idea, requireLink, sourceLine);
  return {
    eligible: true,
    analysis,
    idea,
    content: finalText,
  };
}

async function runAnalysis(theme, source) {
  const { system, user } = buildAnalysisPrompt(theme, source);
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

async function runIdeaStage(theme, source, analysis, styleModule) {
  const { system, user } = buildIdeaPrompt(theme, source, analysis, styleModule);
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

async function runRewriteStage(theme, source, idea, requireLink, sourceLine) {
  const { system, user } = buildRewritePrompt(theme, source, idea, requireLink, sourceLine);
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
  if (requireLink) {
    validatePostLength(parsed, source.link);
  } else if (sourceLine) {
    validateSourceLine(parsed, sourceLine);
  }
  return parsed;
}

function buildAnalysisPrompt(theme, source) {
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
    'Antworte als JSON mit Feldern:',
    'timeliness_score (0-3), theme_fit_score (0-3), friction_score (0-3), novelty_score (0-3), discussion_score (0-3), total_score (0-15), core_claim (ein Satz).',
    'Nur JSON.',
  ]
    .filter(Boolean)
    .join('\n');
  return { system, user };
}

function buildIdeaPrompt(theme, source, analysis, styleModule) {
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
    buildStyleModuleHint(styleModule),
    'Erzeuge eine klare These, einen Blickwinkel und eine meinungsstarke Rohfassung.',
    'Format: {"thesis":"...","angle":"...","rough":"..."}',
  ]
    .filter(Boolean)
    .join('\n');
  return { system, user };
}

function buildRewritePrompt(theme, source, idea, requireLink, sourceLine) {
  const system = [
    'Du schreibst den finalen X-Post.',
    'Klingt menschlich, direkt und glaubwürdig.',
    'Maximal 280 Zeichen.',
    'Kurze, klare Sätze.',
    'Keine Gedankenstriche, keine Emojis, keine Aufzählungen.',
    'Keine Meta-Sprache und keine Floskeln.',
    'Keine abstrakten Verben wie "ignorieren" oder "thematisieren".',
    'Der Text vor dem Link darf maximal 256 Zeichen lang sein.',
    'Kürze inhaltlich und beende Sätze sauber, niemals technisch abschneiden.',
    'Antworte nur mit JSON: {"post":"..."}',
  ].join(' ');
  const user = [
    `Thema: ${theme}`,
    `Quelle: ${source.title}`,
    source.link ? `Link: ${source.link}` : '',
    `These: ${idea.thesis}`,
    `Blickwinkel: ${idea.angle}`,
    `Rohfassung: ${idea.rough}`,
    requireLink
      ? 'Der Post muss den Link enthalten und sich konkret auf Quelle, Akteur oder Ereignisse beziehen.'
      : 'Beziehe dich konkret auf Akteure oder Ereignisse.',
    requireLink
      ? 'Plane den Textteil vor dem Link auf maximal 256 Zeichen. Der Link steht in einer eigenen Zeile am Ende.'
      : 'Halte den gesamten Post unter 280 Zeichen.',
    requireLink
      ? 'Der Link darf nicht gekürzt werden und muss exakt so stehen wie angegeben.'
      : '',
    sourceLine ? 'Am Ende steht eine eigene Quellenzeile, exakt wie vorgegeben.' : '',
    sourceLine ? `Quellenzeile: ${sourceLine}` : '',
    'Kein Gedankenstrich, keine Emojis, keine Aufzählungen.',
    'Nur JSON.',
  ]
    .filter(Boolean)
    .join('\n');
  return { system, user };
}

function buildStyleModuleHint(styleModule) {
  if (!styleModule?.rule) {
    return '';
  }
  return `Stil-Modul:\n- ${styleModule.rule}`;
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

function validatePostLength(post, link) {
  const text = String(post || '').trim();
  if (!link) {
    throw new Error('Post link is required');
  }
  const parts = text.split('\n');
  if (parts.length < 2) {
    throw new Error('Post must place the link on a new line');
  }
  const linkLine = parts[parts.length - 1].trim();
  if (linkLine !== link) {
    throw new Error('Post link must match the source link');
  }
  const textPart = parts.slice(0, -1).join('\n').trim();
  if (textPart.length > 256) {
    // eslint-disable-next-line no-console
    console.warn('[drafts] Post text exceeds 256 characters before link', {
      length: textPart.length,
      link,
    });
  }
}

function validateSourceLine(post, sourceLine) {
  const text = String(post || '').trim();
  if (!sourceLine) {
    return;
  }
  const parts = text.split('\n');
  if (parts.length < 2) {
    throw new Error('Post must place the source line on a new line');
  }
  const lastLine = parts[parts.length - 1].trim();
  if (lastLine !== sourceLine) {
    throw new Error('Post source line must match the expected source');
  }
}

module.exports = {
  generateDraftFromSource,
};
