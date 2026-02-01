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

function canGenerateDraft(themeId, requestedCount = 1) {
  if (countGeneratedForTheme(themeId) + requestedCount > GENERATED_LIMIT) {
    return { ok: false, reason: 'max-generated' };
  }
  if (countDraftsLast24h(themeId) + requestedCount > DAILY_LIMIT) {
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

function buildAnalysisPrompt(theme, article) {
  const system = [
    'Du bist Redakteur für X-Posts.',
    'Bewerte Artikel streng nach Relevanz für das Thema.',
    'Antwort-Format: JSON ohne zusätzlichen Text.',
  ].join(' ');

  const user = [
    `Thema: ${theme.label}`,
    `Titel: ${article.title}`,
    `Inhalt: ${article.content}`,
    'Bewerte mit Scores 0 bis 3 (0 = schwach, 3 = sehr stark).',
    'Felder: recency, theme_fit, conflict, novelty, discussion, total_score, key_takeaway.',
    'total_score ist die Summe der fünf Scores.',
    'key_takeaway ist eine knappe Kernaussage in einem Satz.',
  ].join('\n');

  return { system, user };
}

function buildIdeaPrompt(theme, analysis) {
  const propertyHints = theme.allowed_properties.map((item) => item.prompt).join(' ');
  const system = [
    'Du bist Redakteur und formulierst Post-Ideen für X.',
    'Antwort-Format: JSON mit Feld "idea". Kein zusätzlicher Text.',
  ].join(' ');

  const user = [
    `Thema: ${theme.label}`,
    `Kernaussage: ${analysis.key_takeaway}`,
    `Eigenschaften: ${propertyHints}`,
    'Formuliere eine klare These mit Blickwinkel.',
    'Keine Zusammenfassung des Artikels.',
    'Meinungsstark, roh, kurz.',
  ].join('\n');

  return { system, user };
}

function buildRewritePrompt(theme, article, idea, includeLink) {
  const system = [
    'Du bist Social Editor für X.',
    'Antwort-Format: JSON mit Feldern "text" und "link". Kein zusätzlicher Text.',
  ].join(' ');

  const linkLine = includeLink && article.link ? `Link: ${article.link}` : '';
  const sourceLine = article.source ? `Quelle: ${article.source}` : '';
  const user = [
    `Thema: ${theme.label}`,
    `These: ${idea}`,
    `Titel: ${article.title}`,
    `Inhalt: ${article.content}`,
    sourceLine,
    linkLine,
    'SCHRITT 1 – INTERNE ANALYSE (NICHT AUSGEBEN)',
    '- Kernaussage des Inhalts',
    '- Welches Narrativ dominiert',
    '- Wer profitiert davon',
    '- Wo liegt Selbsttäuschung oder Macht',
    '- Position immer GRUNDSÄTZLICH pro Krypto',
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
    '- Nur EIN Modul',
    '- Keine Kombination',
    '- Modul nicht benennen',
    '',
    'SCHRITT 3 – FINALER X-POST (AUSGABE)',
    'HARTE STILREGELN:',
    '- kurze Sätze',
    '- einfache Wörter',
    '- keine Metaphern',
    '- keine Fachbegriffe',
    '- keine technische oder akademische Sprache',
    '- keine Erklärungen',
    '- keine Definitionen',
    '- keine Zusammenfassungen',
    '- keine neutralen oder ausgewogenen Formulierungen',
    '- keine Influencer-Sprache',
    '- keine Call-to-Action-Phrasen wie "let’s discuss", "what do you think", "here’s why"',
    '- keine Floskeln',
    '- keine Meta-Sprache',
    '- keine Mehrfachfragen',
    '- Ich-Sätze nur bei Modul 3 (max. 1)',
    '',
    'TON:',
    '- pro Krypto',
    '- kritisch gegenüber Macht, Akteuren, Narrativen',
    '- ruhig, direkt, leicht genervt',
    '- meinungsstark, nicht hype-getrieben',
    '',
    'LÄNGE & STRUKTUR (NICHT VERLETZEN):',
    '- Ziel: 120–200 Zeichen',
    '- Absolutes Maximum: 4 Sätze',
    '- Bevorzugt: 2–3 Sätze',
    '- Satz 1: Beobachtung',
    '- Satz 2: klare Haltung',
    '- Optional Satz 3: Provokation oder Frage',
    '- Keine Conclusions',
    '- Keine Zusammenfassungen',
    '- Jeder Satz muss für sich stehen',
    '- Wenn der Post etwas erklärt, ist er falsch',
    '',
    'STRUKTUR:',
    '- Text zuerst',
    '- Danach Link oder Quelle in eigener Zeile',
    '',
    'QUELLEN:',
    '- RSS: genau EIN echter Link in eigener Zeile',
    '- Trend: KEIN externer Link, stattdessen: "Quelle: <kurze Beschreibung>"',
    '',
    'ZIEL:',
    'Der Text soll klingen wie die Meinung einer realen Person mit Haltung.',
    'Nicht wie ein News-Feed.',
    '',
    'Gib das Ergebnis als JSON zurück: {"text": "...", "link": "..."}',
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

async function runAnalysis(theme, article) {
  const prompt = buildAnalysisPrompt(theme, article);
  const data = await runOpenAiJson(prompt);
  if (!data) {
    throw new Error('Analysis response was invalid');
  }
  const total = Number(data.total_score);
  return {
    ...data,
    total_score: Number.isFinite(total) ? total : 0,
  };
}

async function runIdea(theme, analysis) {
  const prompt = buildIdeaPrompt(theme, analysis);
  const data = await runOpenAiJson(prompt);
  const idea = String(data?.idea || '').trim();
  if (!idea) {
    throw new Error('Idea response was invalid');
  }
  return idea;
}

async function runRewrite(theme, article, idea, includeLink) {
  const prompt = buildRewritePrompt(theme, article, idea, includeLink);
  const data = await runOpenAiJson(prompt);
  const text = String(data?.text || '').trim();
  const link = String(data?.link || '').trim();
  if (!text || !/[.!?][\"'”’)]?$/.test(text)) {
    throw new Error('Post text was incomplete');
  }
  if (text.length < 120 || text.length > 200) {
    throw new Error('Post text was incomplete');
  }
  const sentences = text.match(/[^.!?]+[.!?]/g)?.length || 0;
  if (sentences > 4) {
    throw new Error('Post text was incomplete');
  }
  if (/https?:\/\//i.test(text)) {
    throw new Error('Post text was incomplete');
  }
  if (!link.startsWith('http') || /\s/.test(link)) {
    throw new Error('Post text was incomplete');
  }
  if (includeLink && !link) {
    throw new Error('Post text was incomplete');
  }
  return `${text}\n\n${link}`;
}

function enforceNoDashes(text) {
  return text.replace(/\s[–—]\s/g, '. ').replace(/\s-\s/g, '. ');
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

  const analysis = await runAnalysis(theme, normalized);
  if (analysis.total_score < 9) {
    return { skipped: true, analysis };
  }

  const idea = await runIdea(theme, analysis);
  const includeLink = sourceType === 'rss' || sourceType === 'manual';
  let text = await runRewrite(theme, normalized, idea, includeLink);
  text = enforceNoDashes(text);
  if (includeLink && normalized.link && !text.includes(normalized.link)) {
    throw new Error('Post text was incomplete');
  }

  return {
    skipped: false,
    content: text,
    analysis,
    source_ref: normalized.link || null,
  };
}

async function generateDraftsFromArticle(themeId, sourceType, article, count) {
  const theme = getDraftTheme(themeId);
  if (!theme) {
    throw new Error('Theme is invalid');
  }
  ensureClient();
  const normalized = normalizeArticle(article);
  if (!normalized.title || !normalized.content) {
    throw new Error('Article title and content are required');
  }

  const analysis = await runAnalysis(theme, normalized);
  if (analysis.total_score < 9) {
    return { skipped: true, analysis, drafts: [] };
  }

  const idea = await runIdea(theme, analysis);
  const includeLink = sourceType === 'rss' || sourceType === 'manual';
  const drafts = [];
  for (let i = 0; i < count; i += 1) {
    let text = await runRewrite(theme, normalized, idea, includeLink);
    text = enforceNoDashes(text);
    if (includeLink && normalized.link && !text.includes(normalized.link)) {
      throw new Error('Post text was incomplete');
    }
    drafts.push({
      content: text,
      source_ref: normalized.link || null,
    });
  }

  return {
    skipped: false,
    drafts,
    analysis,
  };
}

function pickEligibleArticles(articles) {
  return articles
    .map(normalizeArticle)
    .filter((article) => article.title && article.content && article.link);
}

async function generateDraftForTheme(themeId, payload, count) {
  const limits = canGenerateDraft(themeId, count);
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
    const generated = await generateDraftsFromArticle(themeId, 'trend', {
      title: `Trend: ${trend}`,
      content: trend,
      link: '',
      source: 'Trend-Quelle',
    }, count);
    if (generated.skipped) {
      throw new Error('Trend-Idee war nicht stark genug');
    }
    return generated.drafts.map((draft) =>
      addPostDraft({
        theme: themeId,
        content: draft.content,
        status: 'generated',
        source_type: 'trend',
        source_ref: null,
      })
    );
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

  const generated = await generateDraftsFromArticle(themeId, sourceType, normalized, count);
  if (generated.skipped) {
    throw new Error('Artikel ist für einen Draft nicht stark genug.');
  }
  return generated.drafts.map((draft) =>
    addPostDraft({
      theme: themeId,
      content: draft.content,
      status: 'generated',
      source_type: sourceType,
      source_ref: normalized.link,
    })
  );
}

async function generateDraftFromCandidates(themeId, candidates, count) {
  const articles = pickEligibleArticles(candidates || []);
  for (const article of articles) {
    if (hasDraftForSource(article.link)) {
      continue;
    }
    try {
      const generated = await generateDraftsFromArticle(themeId, 'rss', article, count);
      if (generated.skipped) {
        continue;
      }
      return generated.drafts.map((draft) =>
        addPostDraft({
          theme: themeId,
          content: draft.content,
          status: 'generated',
          source_type: 'rss',
          source_ref: article.link,
        })
      );
    } catch (error) {
      continue;
    }
  }
  return null;
}

async function generateDraft(themeId, payload) {
  const count = payload.count || 3;
  const limits = canGenerateDraft(themeId, count);
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
    }, count);
  }

  const drafts = await generateDraftFromCandidates(themeId, payload.candidates || [], count);
  if (drafts) {
    return drafts;
  }

  return generateDraftForTheme(themeId, {
    source_type: 'trend',
  }, count);
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
