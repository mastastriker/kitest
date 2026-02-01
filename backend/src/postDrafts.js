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
const X_MASTER_PROMPT = `You generate DRAFTS for X (Twitter).
These are NOT explanations. These are NOT summaries.

Hard rules:
- Total length: 120–200 characters
- Max 4 sentences
- Prefer 2–3 short sentences
- Each sentence must stand on its own

Structure:
- Sentence 1: a simple observation
- Sentence 2: a clear stance
- Optional sentence 3: provocation or question
- No conclusions

Style rules (non-negotiable):
- Do NOT explain anything
- Do NOT define terms
- Do NOT summarize
- Do NOT teach
- Do NOT use metaphors
- Do NOT use technical or academic language
- Do NOT be neutral or balanced
- Do NOT sound like a journalist
- Do NOT sound like an influencer
- Do NOT use phrases like:
  "this shows that", "here's why", "in summary", "let's talk about"

Tone:
- pro crypto
- skeptical toward power, actors, narratives
- calm, direct, slightly annoyed
- opinionated
- not hype-driven

Writing rules:
- No emojis
- No hashtags
- No call to action
- No explanations hidden as opinions

Validation:
If the text explains anything, it is wrong.
If the text sounds informative, it is wrong.
If the text could be a blog intro, it is wrong.

Output:
Generate {N} different drafts.
Each draft must follow ALL rules above.
Do not comment on the drafts.
Do not explain your choices.
Only output the drafts.`;

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

function renderMasterPrompt(count) {
  return X_MASTER_PROMPT.replace('{N}', String(count));
}

function buildRewritePrompt(theme, article, idea, includeLink, count) {
  const system = [
    'Du bist Social Editor für X.',
    'Antwort-Format: JSON mit Feld "drafts". Kein zusätzlicher Text.',
  ].join(' ');

  const linkLine = includeLink && article.link ? `Link: ${article.link}` : '';
  const sourceLine = article.source ? `Quelle: ${article.source}` : '';
  const user = [
    renderMasterPrompt(count),
    `Thema: ${theme.label}`,
    `These: ${idea}`,
    `Titel: ${article.title}`,
    `Inhalt: ${article.content}`,
    sourceLine,
    linkLine,
    'Gib das Ergebnis als JSON zurück: {"drafts":[{"text":"...","link":"..."}]}',
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
  if (text.length < 120 || text.length > 200) {
    return false;
  }
  const sentences = text.match(/[^.!?]+[.!?]/g)?.length || 0;
  if (sentences > 4) {
    return false;
  }
  if (/https?:\/\//i.test(text)) {
    return false;
  }
  return true;
}

async function runRewrite(theme, article, idea, includeLink, count) {
  const prompt = buildRewritePrompt(theme, article, idea, includeLink, count);
  const data = await runOpenAiJson(prompt);
  const drafts = Array.isArray(data?.drafts) ? data.drafts : [];
  if (!drafts.length || drafts.length !== count) {
    throw new Error('Post text was incomplete');
  }

  return drafts.map((draft) => {
    const text = String(draft?.text || '').trim();
    const link = String(draft?.link || '').trim();
    if (!validateDraftText(text)) {
      throw new Error('Post text was incomplete');
    }
    if (includeLink) {
      if (!link.startsWith('http') || /\s/.test(link)) {
        throw new Error('Post text was incomplete');
      }
    }
    return { text, link };
  });
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
  const drafts = await runRewrite(theme, normalized, idea, includeLink, 1);
  let text = drafts[0].text;
  if (drafts[0].link) {
    text = `${text}\n\n${drafts[0].link}`;
  }
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
  const generatedDrafts = await runRewrite(theme, normalized, idea, includeLink, count);
  const drafts = generatedDrafts.map((draft) => {
    let text = draft.text;
    if (draft.link) {
      text = `${text}\n\n${draft.link}`;
    }
    text = enforceNoDashes(text);
    if (includeLink && normalized.link && !text.includes(normalized.link)) {
      throw new Error('Post text was incomplete');
    }
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

  const sourceType = payload.source_type || 'rss';

  if (sourceType === 'trend') {
    const trends = await generateTrendsForTopic(themeId, 'current', Math.max(requestedCount, 5));
    const uniqueTrends = [...new Set(trends.filter(Boolean).map((trend) => String(trend).trim()))]
      .filter(Boolean);
    if (!uniqueTrends.length) {
      throw new Error('Keine Trenddaten verfügbar');
    }
    const drafts = [];
    for (const trend of uniqueTrends) {
      if (drafts.length >= requestedCount) break;
      try {
        const generated = await generateDraftFromArticle(themeId, 'trend', {
          title: `Trend: ${trend}`,
          content: trend,
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
  return [
    addPostDraft({
      theme: themeId,
      content: generated.content,
      status: 'generated',
      source_type: sourceType,
      source_ref: normalized.link,
    }),
  ];
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

async function generateDraft(themeId, payload) {
  const requestedCount = payload.count || 3;
  let desiredCount = requestedCount;
  if (payload.mode === 'manual') {
    desiredCount = 1;
  } else if (Array.isArray(payload.candidates)) {
    const availableCount = pickEligibleArticles(payload.candidates)
      .filter((article) => !hasDraftForSource(article.link)).length;
    if (availableCount > 0) {
      desiredCount = Math.min(requestedCount, availableCount);
    }
  }
  const limits = canGenerateDraft(themeId, desiredCount);
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
    }, desiredCount);
  }

  const drafts = await generateDraftFromCandidates(themeId, payload.candidates || [], desiredCount);
  if (drafts) {
    return drafts;
  }

  return generateDraftForTheme(themeId, {
    source_type: 'trend',
  }, desiredCount);
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
