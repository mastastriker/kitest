const OpenAI = require('openai');
const { getDraftTheme } = require('./draftConfig');
const { getXMasterPrompt } = require('../prompts/masterPrompt');
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
    'You are an editor scoring article relevance for X posts.',
    'Return JSON only with no extra text.',
  ].join(' ');

  const user = [
    `Topic: ${theme.label}`,
    `Title: ${article.title}`,
    `Content: ${article.content}`,
    'Score 0 to 3 (0 = weak, 3 = very strong).',
    'Fields: recency, theme_fit, conflict, novelty, discussion, total_score, key_takeaway.',
    'total_score is the sum of the five scores.',
    'key_takeaway is one concise sentence.',
  ].join('\n');

  return { system, user };
}

function buildIdeaPrompt(theme, analysis) {
  const propertyHints = theme.allowed_properties.map((item) => item.prompt).join(' ');
  const system = [
    'You are an editor crafting X post ideas.',
    'Return JSON with field "idea" only, no extra text.',
  ].join(' ');

  const user = [
    `Topic: ${theme.label}`,
    `Key takeaway: ${analysis.key_takeaway}`,
    `Properties: ${propertyHints}`,
    'Write a clear thesis with a strong angle.',
    'Do not summarize the article.',
    'Opinionated, raw, concise.',
  ].join('\n');

  return { system, user };
}

function buildRewritePrompt(theme, article, idea, count) {
  const system = getXMasterPrompt();

  const sourceLine = article.source ? `Source: ${article.source}` : '';
  const user = [
    `Topic: ${theme.label}`,
    `Thesis: ${idea}`,
    `Title: ${article.title}`,
    `Content: ${article.content}`,
    sourceLine,
    `Generate ${count} drafts.`,
    'Do not include URLs in the draft text.',
    'Return JSON only: {"drafts":[{"text":"...","link":"..."}]}',
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

function validateDraftText(text) {
  if (!text || !/[.!?][\"'”’)]?$/.test(text)) {
    return false;
  }
  const lower = text.toLowerCase();
  const germanSignals = [' der ', ' die ', ' das ', ' und ', ' ist '];
  if (/[äöüß]/i.test(text) || germanSignals.some((token) => lower.includes(token))) {
    return false;
  }
  if (/https?:\/\//i.test(text)) {
    return false;
  }
  if (text.length < 120 || text.length > 200) {
    return false;
  }
  const sentences = text.match(/[^.!?]+[.!?]/g)?.length || 0;
  if (sentences > 4) {
    return false;
  }
  return true;
}

async function runRewrite(theme, article, idea, count) {
  const prompt = buildRewritePrompt(theme, article, idea, count);
  const initial = await runOpenAiJson(prompt);
  const validated = validateDraftBatch(initial, count);
  if (validated.ok) {
    return validated.items;
  }
  console.error('Draft validation failed, retrying once with the same prompt.');
  const retry = await runOpenAiJson(prompt);
  const retryValidated = validateDraftBatch(retry, count);
  if (!retryValidated.ok) {
    throw new Error(retryValidated.error || 'Post text was incomplete');
  }
  return retryValidated.items;
}

function enforceNoDashes(text) {
  return text.replace(/\s[–—]\s/g, '. ').replace(/\s-\s/g, '. ');
}

function validateDraftBatch(data, count) {
  const drafts = Array.isArray(data?.drafts) ? data.drafts : [];
  if (!drafts.length || drafts.length !== count) {
    return { ok: false, error: 'Post text was incomplete' };
  }
  const items = drafts.map((draft) => {
    const text = String(draft?.text || '').trim();
    if (!validateDraftText(text)) {
      return null;
    }
    if (/https?:\/\//i.test(text)) {
      return null;
    }
    return { text };
  });
  if (items.some((item) => !item)) {
    return { ok: false, error: 'Post text was incomplete' };
  }
  if (count > 1) {
    const statementCount = items.filter((item) => !endsWithQuestion(item.text)).length;
    if (statementCount < Math.ceil(count / 2)) {
      return { ok: false, error: 'Post text was incomplete' };
    }
  }
  return { ok: true, items };
}

function endsWithQuestion(text) {
  return String(text || '').trim().endsWith('?');
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
  const drafts = await runRewrite(theme, normalized, idea, 1);
  let text = drafts[0].text;
  text = enforceNoDashes(text);

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
  const generatedDrafts = await runRewrite(theme, normalized, idea, count);
  const drafts = generatedDrafts.map((draft) => {
    let text = draft.text;
    text = enforceNoDashes(text);
    return {
      content: text,
      source_ref: normalized.link || null,
    };
  });

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

async function generateDraftFromCandidates(themeId, candidates, count) {
  const articles = pickEligibleArticles(candidates || []);
  const requestedCount = Math.max(1, Number(count) || 1);
  const drafts = [];
  for (const article of articles) {
    if (drafts.length >= requestedCount) break;
    if (hasDraftForSource(article.link)) {
      continue;
    }
    try {
      const generated = await generateDraftFromArticle(themeId, 'rss', article);
      if (generated.skipped) {
        continue;
      }
      drafts.push(
        addPostDraft({
          theme: themeId,
          content: generated.content,
          status: 'generated',
          source_type: 'rss',
          source_ref: article.link,
        })
      );
    } catch (error) {
      continue;
    }
  }
  return drafts.length ? drafts : null;
}

async function generateDraftForTheme(themeId, payload, count) {
  const requestedCount = Math.max(1, Number(count) || 1);
  const limits = canGenerateDraft(themeId, requestedCount);
  if (!limits.ok) {
    const message =
      limits.reason === 'max-generated'
        ? 'Maximal 3 Entwürfe mit Status generated pro Thema erreicht.'
        : 'Maximal 5 Entwürfe pro Thema in 24 Stunden erreicht.';
    throw new Error(message);
  }

  const sourceType = payload.source_type || 'trend';

  if (sourceType === 'trend') {
    const trends = await generateTrendsForTopic(themeId, 'current', Math.max(requestedCount, 5));
    const uniqueTrends = [];
    const seen = new Set();
    trends.forEach((trend) => {
      const title = String(trend?.title || '').trim();
      if (!title || seen.has(title)) {
        return;
      }
      seen.add(title);
      uniqueTrends.push(trend);
    });
    if (!uniqueTrends.length) {
      throw new Error('Keine Trenddaten verfügbar');
    }
    const drafts = [];
    for (const trend of uniqueTrends) {
      if (drafts.length >= requestedCount) break;
      try {
        const trendText = trend.description || trend.title;
        const generated = await generateDraftFromArticle(themeId, 'trend', {
          title: `Trend: ${trend.title}`,
          content: trendText,
          link: '',
          source: 'Trend-Quelle',
        });
        if (generated.skipped) {
          continue;
        }
        drafts.push(
          addPostDraft({
            theme: themeId,
            content: generated.content,
            status: 'generated',
            source_type: 'trend',
            source_ref: null,
            trend_title: trend.title,
            trend_provider: trend.provider || null,
          })
        );
      } catch (error) {
        continue;
      }
    }
    if (!drafts.length) {
      throw new Error('Trend-Idee war nicht stark genug');
    }
    return drafts;
  }
  throw new Error('source_type is invalid');
}

async function generateDraft(themeId, payload) {
  const requestedCount = payload.count || 3;
  const source = payload.source || 'trend';
  if (!['trend', 'rss'].includes(source)) {
    throw new Error('source is invalid');
  }
  const desiredCount = requestedCount;
  const limits = canGenerateDraft(themeId, desiredCount);
  if (!limits.ok) {
    const message =
      limits.reason === 'max-generated'
        ? 'Maximal 3 Entwürfe mit Status generated pro Thema erreicht.'
        : 'Maximal 5 Entwürfe pro Thema in 24 Stunden erreicht.';
    throw new Error(message);
  }
  if (source === 'trend') {
    return generateDraftForTheme(
      themeId,
      {
        source_type: 'trend',
      },
      desiredCount
    );
  }

  const hasCandidates = Array.isArray(payload.candidates) && payload.candidates.length;
  const hasArticle = Boolean(payload.article);
  if (!hasCandidates && !hasArticle) {
    throw new Error('RSS selected but no RSS data provided');
  }

  if (hasArticle) {
    const normalized = normalizeArticle(payload.article);
    if (!normalized.link) {
      throw new Error('RSS selected but no RSS data provided');
    }
    if (hasDraftForSource(normalized.link)) {
      throw new Error('Für diesen Artikel existiert bereits ein Draft.');
    }
    if (desiredCount > 1) {
      const generated = await generateDraftsFromArticle(themeId, 'rss', normalized, desiredCount);
      return generated.drafts.map((draft) =>
        addPostDraft({
          theme: themeId,
          content: draft.content,
          status: 'generated',
          source_type: 'rss',
          source_ref: normalized.link,
        })
      );
    }
    const generated = await generateDraftFromArticle(themeId, 'rss', normalized);
    if (generated.skipped) {
      throw new Error('Artikel ist für einen Draft nicht stark genug.');
    }
    return [
      addPostDraft({
        theme: themeId,
        content: generated.content,
        status: 'generated',
        source_type: 'rss',
        source_ref: normalized.link,
      }),
    ];
  }

  const drafts = await generateDraftFromCandidates(themeId, payload.candidates || [], desiredCount);
  if (drafts) {
    return drafts;
  }
  throw new Error('RSS selected but no RSS data provided');
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
