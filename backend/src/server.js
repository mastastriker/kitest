require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const {
  getTopics,
  getTopic,
  addTopic,
  addPosts,
  getPostsForTopic,
  updateTopic,
  deletePost,
  updatePost,
  updatePostWithPrompt,
  deleteTopic,
  getSettings,
  updateSettings,
  getTrends,
  setTrends,
  getThemes,
  addTheme,
  updateTheme,
  deleteTheme,
} = require('./store');
const { getPostProperties } = require('./postProperties');
const {
  generatePostsForTopic,
  generatePostFromTrend,
  generatePostFromPrompt,
  buildPostPromptForTopic,
  buildTrendPostPrompt,
} = require('./chatgpt');
const {
  generateTrendsForTopic,
  fetchTrendsForProvider,
  MODE_MAP,
  clampCount,
  buildTrendPrompt,
} = require('./trends');
const { parseFeed } = require('./news');
const { getDraftThemes, getDraftTheme } = require('./draftConfig');
const { getApiKeyStatus, setApiKey } = require('./settings');
const {
  generateDraft,
  approveDraft,
  discardDraft,
  editDraft,
  getDraftsForTheme,
  deleteDraft,
  clearArchivedDrafts,
} = require('./postDrafts');

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_DIR = path.join(__dirname, '..', '..', 'frontend');

app.use(cors());
app.use(express.json());
app.use(express.static(FRONTEND_DIR));

function formatPromptText(prompt) {
  if (!prompt) return '';
  const system = prompt.system || '';
  const user = prompt.user || '';
  return `System:\n${system}\n\nUser:\n${user}`.trim();
}

function parsePromptText(promptText) {
  if (!promptText) return null;
  const match = promptText.match(/^System:\n([\s\S]*?)\n\nUser:\n([\s\S]*)$/);
  if (!match) {
    return null;
  }
  return { system: match[1].trim(), user: match[2].trim() };
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/post-properties', (req, res) => {
  res.json({
    properties: getPostProperties().map(({ id, label }) => ({ id, label })),
  });
});

app.get('/api/trends/current', (req, res) => {
  res.json({ trends: getTrends() });
});

app.get('/api/settings', (req, res) => {
  res.json({ settings: getSettings(), providerStatus: getApiKeyStatus() });
});

app.put('/api/settings', (req, res) => {
  const { trendProvider } = req.body || {};
  const providerStatus = getApiKeyStatus();
  if (trendProvider && !providerStatus[trendProvider]) {
    return res.status(400).json({ error: 'provider is unavailable' });
  }
  try {
    const settings = updateSettings({ trendProvider });
    return res.json({ settings, providerStatus });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.post('/api/settings/api-keys', (req, res) => {
  const { provider, apiKey } = req.body || {};
  try {
    setApiKey(provider, apiKey);
    return res.json({ providerStatus: getApiKeyStatus() });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.get('/api/topics', (req, res) => {
  res.json({ topics: getTopics() });
});

app.post('/api/topics', (req, res) => {
  const { name } = req.body || {};
  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }
  try {
    const topic = addTopic(name);
    return res.status(201).json({ topic });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.get('/api/themes', (req, res) => {
  res.json({ themes: getThemes() });
});

app.post('/api/themes', (req, res) => {
  const { key, name, active } = req.body || {};
  if (!key || !name) {
    return res.status(400).json({ error: 'key and name are required' });
  }
  try {
    const theme = addTheme({ key, name, active });
    return res.status(201).json({ theme });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.put('/api/themes/:id', (req, res) => {
  try {
    const updates = req.body || {};
    if (Object.prototype.hasOwnProperty.call(updates, 'active')) {
      if (typeof updates.active === 'string') {
        updates.active = updates.active.toLowerCase() === 'true';
      } else {
        updates.active = Boolean(updates.active);
      }
    }
    const updated = updateTheme(req.params.id, updates);
    if (!updated) {
      return res.status(404).json({ error: 'theme not found' });
    }
    return res.json({ theme: updated });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.delete('/api/themes/:id', (req, res) => {
  const removed = deleteTheme(req.params.id);
  if (!removed) {
    return res.status(404).json({ error: 'theme not found' });
  }
  return res.json({ theme: removed });
});

app.get('/api/topics/:id/posts', (req, res) => {
  const topic = getTopic(req.params.id);
  if (!topic) {
    return res.status(404).json({ error: 'topic not found' });
  }
  const posts = getPostsForTopic(topic.id);
  return res.json({ topic, posts });
});

app.put('/api/topics/:id', (req, res) => {
  try {
    const updated = updateTopic(req.params.id, req.body || {});
    if (!updated) {
      return res.status(404).json({ error: 'topic not found' });
    }
    return res.json({ topic: updated });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.post('/api/topics/:id/generate', async (req, res) => {
  const topic = getTopic(req.params.id);
  if (!topic) {
    return res.status(404).json({ error: 'topic not found' });
  }
  const count = Number(req.body?.count);
  const topics = Number.isFinite(count) ? getTopics(count) : [topic];
  try {
    const posts = [];
    for (const selectedTopic of topics) {
      const generated = await generatePostsForTopic(selectedTopic, 1);
      const prompt = buildPostPromptForTopic(selectedTopic, 1);
      const saved = addPosts(selectedTopic.id, generated, {
        prompt,
        promptText: formatPromptText(prompt),
        generatedPost: '',
      });
      posts.push(...saved);
    }
    return res.json({ topics, posts });
  } catch (err) {
    return res.status(500).json({ error: 'generation failed', detail: err.message });
  }
});

app.post('/api/trends', async (req, res) => {
  const { topicId, mode } = req.body || {};
  const topic = getTopic(topicId);
  if (!topic) {
    return res.status(404).json({ error: 'topic not found' });
  }
  if (!MODE_MAP[mode]) {
    return res.status(400).json({ error: 'mode is invalid' });
  }
  const { trendProvider } = getSettings();
  const providerStatus = getApiKeyStatus();
  if (!providerStatus[trendProvider]) {
    return res.status(400).json({ error: `API key for ${trendProvider} is missing` });
  }
  try {
    const trends = await generateTrendsForTopic(topic.name, mode);
    const prompt = buildTrendPrompt(topic.name, mode);
    return res.json({ topic, mode, trends, prompt });
  } catch (err) {
    console.error('[trends] generation failed', {
      message: err.message,
      status: err.status,
      response: err.response,
    });
    return res.status(500).json({ error: 'generation failed', detail: err.message });
  }
});

app.post('/api/trends/refresh', async (req, res) => {
  const { themeId } = req.body || {};
  const theme = themeId ? getDraftTheme(themeId) : null;
  if (!theme) {
    return res.status(400).json({ error: 'theme is invalid' });
  }
  try {
    const [grokTrends, openaiTrends] = await Promise.all([
      fetchTrendsForProvider('grok', theme.label, 'current'),
      fetchTrendsForProvider('openai', theme.label, 'current'),
    ]);
    const merged = [...grokTrends, ...openaiTrends];
    if (!merged.length) {
      return res.status(400).json({ error: 'No providers are available' });
    }
    setTrends(merged);
    return res.json({ trends: getTrends() });
  } catch (err) {
    console.error('[trends-refresh] generation failed', {
      message: err.message,
      status: err.status,
      response: err.response,
    });
    return res.status(500).json({ error: 'generation failed', detail: err.message });
  }
});

app.post('/api/trends/post', async (req, res) => {
  const { topicId, trend } = req.body || {};
  const topic = getTopic(topicId);
  if (!topic) {
    return res.status(404).json({ error: 'topic not found' });
  }
  const trendText =
    typeof trend === 'string' ? trend : trend?.description || trend?.title || '';
  if (!trendText) {
    return res.status(400).json({ error: 'trend is required' });
  }
  try {
    const text = await generatePostFromTrend(topic, trendText);
    const prompt = buildTrendPostPrompt(topic, trendText);
    const [post] = addPosts(topic.id, [text], {
      prompt,
      promptText: formatPromptText(prompt),
      generatedPost: text,
    });
    return res.json({ topic, post });
  } catch (err) {
    console.error('[trends-post] generation failed', {
      message: err.message,
      status: err.status,
      response: err.response,
    });
    return res.status(500).json({ error: 'generation failed', detail: err.message });
  }
});

app.post('/api/trends/post/prompt', (req, res) => {
  const { topicId, trend } = req.body || {};
  const topic = getTopic(topicId);
  if (!topic) {
    return res.status(404).json({ error: 'topic not found' });
  }
  const trendText =
    typeof trend === 'string' ? trend : trend?.description || trend?.title || '';
  if (!trendText) {
    return res.status(400).json({ error: 'trend is required' });
  }
  const prompt = buildTrendPostPrompt(topic, trendText);
  return res.json({ prompt, prompt_text: formatPromptText(prompt) });
});

app.get('/api/posts', (req, res) => {
  const topics = getTopics();
  const allPosts = topics.flatMap((topic) =>
    getPostsForTopic(topic.id).map((p) => ({
      ...p,
      topicName: topic.name,
      prompt: p.prompt || buildPostPromptForTopic(topic, 1),
      promptText: p.prompt_text || formatPromptText(p.prompt || buildPostPromptForTopic(topic, 1)),
      generatedPost: p.generated_post || p.text,
      prompt_text: p.prompt_text || formatPromptText(p.prompt || buildPostPromptForTopic(topic, 1)),
      generated_post: p.generated_post || p.text,
    }))
  );
  res.json({ posts: allPosts });
});

app.get('/api/post-drafts/themes', (req, res) => {
  res.json({ themes: getDraftThemes() });
});

app.get('/api/post-drafts', (req, res) => {
  const { theme } = req.query || {};
  if (theme && !getDraftTheme(theme)) {
    return res.status(400).json({ error: 'theme is invalid' });
  }
  const drafts = theme
    ? getDraftsForTheme(theme)
    : getDraftsForTheme('crypto').concat(getDraftsForTheme('camping'));
  drafts.sort((a, b) => Date.parse(b.created_at || '') - Date.parse(a.created_at || ''));
  return res.json({ drafts });
});

app.post('/api/post-drafts/generate', async (req, res) => {
  const { theme, mode, article, candidates, count, source } = req.body || {};
  if (!theme || !getDraftTheme(theme)) {
    return res.status(400).json({ error: 'theme is invalid' });
  }
  const resolvedSource = source || 'trend';
  if (!['trend', 'rss'].includes(resolvedSource)) {
    return res.status(400).json({ error: 'source is invalid' });
  }
  if (mode && !['auto', 'manual'].includes(mode)) {
    return res.status(400).json({ error: 'mode is invalid' });
  }
  const requestedCount = Number(req.body.count);
  if (![1, 3, 5].includes(requestedCount)) {
    return res.status(400).json({ error: 'count is invalid' });
  }
  try {
    const drafts = await generateDraft(theme, {
      mode,
      article,
      candidates,
      count: requestedCount,
      source: resolvedSource,
    });
    return res.json({ drafts });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.delete('/api/post-drafts/archived', (req, res) => {
  const removed = clearArchivedDrafts();
  return res.json({ removed });
});

app.post('/api/post-drafts/:id/approve', (req, res) => {
  const draft = approveDraft(req.params.id);
  if (!draft) {
    return res.status(404).json({ error: 'draft not found' });
  }
  return res.json({ draft });
});

app.post('/api/post-drafts/:id/discard', (req, res) => {
  const draft = discardDraft(req.params.id);
  if (!draft) {
    return res.status(404).json({ error: 'draft not found' });
  }
  return res.json({ draft });
});

app.put('/api/post-drafts/:id', (req, res) => {
  const { content } = req.body || {};
  try {
    const draft = editDraft(req.params.id, content);
    if (!draft) {
      return res.status(404).json({ error: 'draft not found' });
    }
    return res.json({ draft });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.delete('/api/post-drafts/:id', (req, res) => {
  const removed = deleteDraft(req.params.id);
  if (!removed) {
    return res.status(404).json({ error: 'draft not found' });
  }
  return res.json({ draft: removed });
});

app.get('/api/news/preview', async (req, res) => {
  const url = req.query?.url;
  if (!url) {
    return res.status(400).json({ error: 'url is required' });
  }
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch (err) {
    return res.status(400).json({ error: 'url must be valid' });
  }
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return res.status(400).json({ error: 'url must use http or https' });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(parsedUrl.toString(), {
      headers: { accept: 'application/rss+xml, application/xml, text/xml, */*' },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) {
      return res.status(502).json({ error: 'feed request failed', status: response.status });
    }
    const xml = await response.text();
    const parsed = parseFeed(xml);
    return res.json({ ...parsed, sourceUrl: parsedUrl.toString(), fetchedAt: new Date().toISOString() });
  } catch (err) {
    clearTimeout(timeout);
    return res.status(500).json({ error: 'feed request failed', detail: err.message });
  }
});

app.delete('/api/posts/:id', (req, res) => {
  const removed = deletePost(req.params.id);
  if (!removed) {
    return res.status(404).json({ error: 'post not found' });
  }
  return res.json({ post: removed });
});

app.put('/api/posts/:id', (req, res) => {
  try {
    const updated = updatePost(req.params.id, req.body?.text);
    if (!updated) {
      return res.status(404).json({ error: 'post not found' });
    }
    return res.json({ post: updated });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.post('/api/posts/:id/regenerate', async (req, res) => {
  const { prompt_text: promptText } = req.body || {};
  const parsed = parsePromptText(promptText);
  if (!parsed) {
    return res.status(400).json({ error: 'prompt_text is invalid' });
  }
  try {
    const text = await generatePostFromPrompt(parsed.system, parsed.user);
    const updated = updatePostWithPrompt(req.params.id, text, promptText, {
      system: parsed.system,
      user: parsed.user,
    });
    if (!updated) {
      return res.status(404).json({ error: 'post not found' });
    }
    return res.json({ post: updated });
  } catch (err) {
    console.error('[posts-regenerate] generation failed', {
      message: err.message,
      status: err.status,
      response: err.response,
    });
    return res.status(500).json({ error: 'generation failed', detail: err.message });
  }
});

app.delete('/api/topics/:id', (req, res) => {
  const removed = deleteTopic(req.params.id);
  if (!removed) {
    return res.status(404).json({ error: 'topic not found' });
  }
  return res.json({ topic: removed.topic, removedPosts: removed.removedPosts });
});

// Serve frontend index for root (keeps API 404 JSON for other unknown routes)
app.get('/', (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

app.use((req, res) => {
  res.status(404).json({ error: 'not found' });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server running on http://localhost:${PORT}`);
});
