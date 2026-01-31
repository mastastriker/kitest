const OpenAI = require('openai');
const { getDraftTheme } = require('./draftConfig');
const {
  addPostDraft,
  getPostDrafts,
  updatePostDraft,
  updatePostDraftStatus,
  deletePostDraft,
  deletePostDraftsByStatus,
} = require('./store');
const { generateTrendsForTopic } = require('./trends');

const apiKey = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const client = apiKey ? new OpenAI({ apiKey }) : null;

const GENERATED_LIMIT = 10;
const DAILY_LIMIT = 100;

function ensureClient() {
  if (!client) {
    throw new Error('OpenAI client is not configured');
  }
}

function getDraftsForTheme(themeId) {
  return getPostDrafts({ theme: themeId });
}

function countGeneratedForTheme(themeId) {
  return getPostDrafts({ theme: themeId, status: 'generated' }).length;
}

function countDraftsLast24h(themeId) {
  const since = Date.now() - 24 * 60 * 60 * 1000;
  return getDraftsForTheme(themeId).filter((draft) => {
    const created = Date.parse(draft.created_at || '');
    return Number.isFinite(created) && created >= since;
  }).length;
}

function hasDraftForSource(sourceRef) {
  if (!sourceRef) return false;
  const allDrafts = getPostDrafts();
  return allDrafts.some((draft) => draft.source_ref === sourceRef);
}

function canGenerateDraft(themeId) {
  if (countGeneratedForTheme(themeId) >= GENERATED_LIMIT) {
    return { ok: false, reason: 'max-generated' };
  }
  if (countDraftsLast24h(themeId) >= DAILY_LIMIT) {
    return { ok: false, reason: 'daily-limit' };
  }
  return { ok: true };
}

function normalizeArticle(article) {
  const title = String(article?.title || '').trim();
  const content = String(article?.content || article?.summary || '').trim();
  const link = String(article?.link || '').trim();
  const source = String(article?.source || '').trim();
  return {
    title,
    content,
    link,
    source,
    published_at: String(article?.published_at || article?.publishedAt || '').trim(),
  };
}

function buildDraftPrompt(theme, article, sourceType) {
  const system = [
    'Du schreibst X-Posts für ENGAGER v2.',
    'Befolge die Pipeline strikt und gib nur JSON zurück.',
  ].join(' ');

  const sourceLine =
    sourceType === 'trend'
      ? `Trend: ${article.content}`
      : `Quelle: ${article.source || 'RSS'}`;
  const linkLine = sourceType === 'trend' ? '' : `Link: ${article.link}`;

  const user = [
    `Thema: ${theme.label}`,
    `Titel: ${article.title}`,
    `Inhalt: ${article.content}`,
    sourceLine,
    linkLine,
    '',
    'SCHRITT 1 – INTERNE ANALYSE (NICHT AUSGEBEN)',
    '- Kernaussage des Inhalts',
    '- Wer profitiert vom Narrativ',
    '- Wo liegt Macht, Kontrolle oder Selbsttäuschung',
    '- Wie kann eine pro-Krypto-Haltung formuliert werden',
    '- KEINE Neutralität',
    '- KEINE Zusammenfassung',
    '',
    'SCHRITT 2 – STIL-MODUL (NICHT AUSGEBEN)',
    'Wähle intern GENAU EIN Modul zufällig:',
    '1) Überzeugt-pro-Krypto',
    '2) Skeptisch gegenüber Macht',
    '3) Persönliche Einschätzung (max. 1 Ich-Satz)',
    '4) Entlarvend',
    '5) Leser-Spiegel',
    'Keine Kombination.',
    'Modul niemals nennen oder erklären.',
    '',
    'SCHRITT 3 – FINALER X-POST (AUSGABE)',
    '- Maximal 280 Zeichen',
    '- Kurze Sätze',
    '- Keine Floskeln',
    '- Keine Meta-Sprache',
    '- Keine Erklärungen',
    '- Keine Fremdwörter oder Metaphern',
    '- Keine Mehrfachfragen',
    '- Ich-Sätze NUR bei Modul 3 (max. 1)',
    '',
    'STRUKTUR:',
    '- Text zuerst',
    '- Danach Quelle oder Link in eigener Zeile',
    '',
    'QUELLENREGELN:',
    '- RSS: genau EIN echter Link, vollständige URL',
    '- Trend: kein externer Link, stattdessen: "Quelle: <Trendbeschreibung>"',
    '',
    'Antwort-Format: {"text": "POST TEXT\\n\\nQUELLE ODER LINK"}',
  ]
    .filter(Boolean)
    .join('\n');

  return { system, user };
}

function parseJsonResponse(payload) {
  try {
    return JSON.parse(payload);
  } catch (error) {
    return null;
  }
}

async function runOpenAiJson(prompt) {
  ensureClient();
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: prompt.system },
      { role: 'user', content: prompt.user },
    ],
    temperature: 0.6,
    response_format: { type: 'json_object' },
  });
  const content = response.choices[0]?.message?.content;
  return parseJsonResponse(content);
}

async function runDraftPrompt(theme, article, sourceType) {
  const prompt = buildDraftPrompt(theme, article, sourceType);
  const data = await runOpenAiJson(prompt);
  const text = String(data?.text || '').trim();
  if (!text) {
    throw new Error('Post text was invalid');
  }
  if (text.length > 280) {
    throw new Error('Post text was invalid');
  }
  if (sourceType === 'trend') {
    if (/https?:\/\//i.test(text)) {
      throw new Error('Post text was invalid');
    }
    if (!text.includes('Quelle:')) {
      throw new Error('Post text was invalid');
    }
  } else if (!/https?:\/\/\S+/i.test(text)) {
    throw new Error('Post text was invalid');
  }
  return text;
}

async function generateDraftFromArticle(themeId, sourceType, article) {
  const theme = getDraftTheme(themeId);
  if (!theme) {
    throw new Error('Theme is invalid');
  }
  ensureClient();
  const normalized = normalizeArticle(article);
  if (!normalized.title || !normalized.content) {
    throw new Error('Article title and content are required');
  }

  const text = await runDraftPrompt(theme, normalized, sourceType);
  if (sourceType !== 'trend' && normalized.link && !text.includes(normalized.link)) {
    throw new Error('Post text was invalid');
  }

  return {
    skipped: false,
    content: text,
    source_ref: normalized.link || null,
  };
}

function pickEligibleArticles(articles) {
  return articles
    .map(normalizeArticle)
    .filter((article) => article.title && article.content && article.link);
}

async function generateDraftForTheme(themeId, payload) {
  const limits = canGenerateDraft(themeId);
  if (!limits.ok) {
    const message =
      limits.reason === 'max-generated'
        ? 'Maximal 3 Entwürfe mit Status generated pro Thema erreicht.'
        : 'Maximal 5 Entwürfe pro Thema in 24 Stunden erreicht.';
    throw new Error(message);
  }

  const sourceType = payload.source_type || 'rss';

  if (sourceType === 'trend') {
    const trends = await generateTrendsForTopic(themeId, 'current', 5);
    const trend = trends.find(Boolean);
    if (!trend) {
      throw new Error('Keine Trenddaten verfügbar');
    }
    const draft = await generateDraftFromArticle(themeId, 'trend', {
      title: `Trend: ${trend}`,
      content: trend,
      link: '',
      source: 'Trend-Quelle',
    });
    if (draft.skipped) {
      throw new Error('Trend-Idee war nicht stark genug');
    }
    return addPostDraft({
      theme_id: themeId,
      content: draft.content,
      status: 'generated',
      source_type: 'trend',
      source_ref: null,
    });
  }

  const article = payload.article;
  if (!article) {
    throw new Error('Article data is required');
  }
  const normalized = normalizeArticle(article);
  if (!normalized.link) {
    throw new Error('Article link is required');
  }
  if (hasDraftForSource(normalized.link)) {
    throw new Error('Für diesen Artikel existiert bereits ein Draft.');
  }

  const generated = await generateDraftFromArticle(themeId, sourceType, normalized);
  if (generated.skipped) {
    throw new Error('Artikel ist für einen Draft nicht stark genug.');
  }
  return addPostDraft({
    theme_id: themeId,
    content: generated.content,
    status: 'generated',
    source_type: sourceType,
    source_ref: normalized.link,
  });
}

async function generateDraftFromCandidates(themeId, candidates) {
  const articles = pickEligibleArticles(candidates || []);
  for (const article of articles) {
    if (hasDraftForSource(article.link)) {
      continue;
    }
    try {
      const draft = await generateDraftFromArticle(themeId, 'rss', article);
      if (draft.skipped) {
        continue;
      }
      return addPostDraft({
        theme_id: themeId,
        content: draft.content,
        status: 'generated',
        source_type: 'rss',
        source_ref: article.link,
      });
    } catch (error) {
      continue;
    }
  }
  return null;
}

async function generateDraft(themeId, payload) {
  const limits = canGenerateDraft(themeId);
  if (!limits.ok) {
    const message =
      limits.reason === 'max-generated'
        ? 'Maximal 3 Entwürfe mit Status generated pro Thema erreicht.'
        : 'Maximal 5 Entwürfe pro Thema in 24 Stunden erreicht.';
    throw new Error(message);
  }

  if (payload.mode === 'manual') {
    return generateDraftForTheme(themeId, {
      source_type: 'manual',
      article: payload.article,
    });
  }

  const draft = await generateDraftFromCandidates(themeId, payload.candidates || []);
  if (draft) {
    return draft;
  }

  return generateDraftForTheme(themeId, {
    source_type: 'trend',
  });
}

function approveDraft(draftId) {
  return updatePostDraftStatus(draftId, 'approved');
}

function discardDraft(draftId) {
  return updatePostDraftStatus(draftId, 'discarded');
}

function editDraft(draftId, content) {
  return updatePostDraft(draftId, { content });
}

function deleteDraft(draftId) {
  return deletePostDraft(draftId);
}

function clearArchivedDrafts() {
  return deletePostDraftsByStatus('discarded');
}

module.exports = {
  getDraftsForTheme,
  generateDraft,
  approveDraft,
  discardDraft,
  editDraft,
  deleteDraft,
  clearArchivedDrafts,
};
