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
  getPostDrafts,
  updatePostDraft,
  setPostDraftStatus,
} = require('./store');
const { getPostProperties } = require('./postProperties');
const { getThemeList, getThemePropertyLabels } = require('./postDraftConfig');
const {
  generatePostsForTopic,
  generatePostFromTrend,
  generatePostFromPrompt,
  buildPostPromptForTopic,
  buildTrendPostPrompt,
} = require('./chatgpt');
const { generateTrendsForTopic, MODE_MAP, clampCount, buildTrendPrompt } = require('./trends');
const { parseFeed } = require('./news');
const { generateDraft } = require('./postDraftService');

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_DIR = path.join(__dirname, '..', '..', 'frontend');
const ALLOWED_THEMES = new Set(['crypto', 'camping']);

app.use(cors());
app.use(express.json());
app.use(express.static(FRONTEND_DIR));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/post-properties', (req, res) => {
  res.json({
    properties: getPostProperties().map(({ id, label }) => ({ id, label })),
  });
});

app.get('/api/post-drafts/themes', (req, res) => {
  const themes = getThemeList().map((theme) => ({
    id: theme.id,
    label: theme.label,
    properties: getThemePropertyLabels(theme.id),
  }));
  res.json({ themes });
});

app.get('/api/post-drafts', (req, res) => {
  const { status, theme } = req.query;
  const drafts = getPostDrafts({
    status: status || undefined,
    theme: theme || undefined,
  });
  res.json({ drafts });
});

app.post('/api/post-drafts/generate', async (req, res) => {
  const { theme, mode, item } = req.body || {};
  if (!theme) {
    return res.status(400).json({ error: 'theme is required' });
  }
  if (!ALLOWED_THEMES.has(theme)) {
    return res.status(400).json({ error: 'theme is invalid' });
  }
  try {
    const result = await generateDraft({
      themeId: theme,
      mode: mode || 'auto',
      manualItem: item,
    });
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.put('/api/post-drafts/:id', (req, res) => {
  try {
    const updated = updatePostDraft(req.params.id, { content: req.body?.content });
    if (!updated) {
      return res.status(404).json({ error: 'draft not found' });
    }
    return res.json({ draft: updated });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.post('/api/post-drafts/:id/approve', (req, res) => {
  const updated = setPostDraftStatus(req.params.id, 'approved');
  if (!updated) {
    return res.status(404).json({ error: 'draft not found' });
  }
  return res.json({ draft: updated });
});

app.post('/api/post-drafts/:id/discard', (req, res) => {
  const updated = setPostDraftStatus(req.params.id, 'discarded');
  if (!updated) {
    return res.status(404).json({ error: 'draft not found' });
  }
  return res.json({ draft: updated });
});

app.post('/api/trends', async (req, res) => {
  const { theme, mode, count } = req.body || {};
  if (!theme) {
    return res.status(400).json({ error: 'theme is required' });
  }
  if (!ALLOWED_THEMES.has(theme)) {
    return res.status(400).json({ error: 'theme is invalid' });
  }
  if (!MODE_MAP[mode]) {
    return res.status(400).json({ error: 'mode is invalid' });
  }
  try {
    const trends = await generateTrendsForTopic(theme, mode, clampCount(count));
    const prompt = buildTrendPrompt(theme, MODE_MAP[mode], clampCount(count));
    return res.json({ theme, mode, trends, prompt });
  } catch (err) {
    console.error('[trends] generation failed', {
      message: err.message,
      status: err.status,
      response: err.response,
    });
    return res.status(500).json({ error: 'generation failed', detail: err.message });
  }
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
