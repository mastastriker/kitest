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
  getThemes,
  getTheme,
  addTheme,
  updateTheme,
  deleteTheme,
  getPostDrafts,
} = require('./store');
const { getPostProperties } = require('./postProperties');
const {
  generatePostsForTopic,
  generatePostFromTrend,
  generatePostFromPrompt,
  buildPostPromptForTopic,
  buildTrendPostPrompt,
} = require('./chatgpt');
const { generateTrendsForTopic, MODE_MAP, clampCount, buildTrendPrompt } = require('./trends');
const { parseFeed } = require('./news');
const { getDraftThemes, getDraftTheme } = require('./draftConfig');
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

function getThemeSummary() {
  const themes = getThemes();
  const drafts = getPostDrafts();
  const counts = drafts.reduce((acc, draft) => {
    const key = draft.theme_id;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  return themes.map((theme) => ({
    ...theme,
    draft_count: counts[theme.id] || 0,
  }));
}

function decorateDraft(draft) {
  const theme = getTheme(draft.theme_id);
  return {
    ...draft,
    theme: theme?.name || theme?.key || draft.theme_id,
    theme_key: theme?.key || draft.theme_id,
  };
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/post-properties', (req, res) => {
  res.json({
    properties: getPostProperties().map(({ id, label }) => ({ id, label })),
  });
});

app.get('/api/themes', (req, res) => {
  res.json({ themes: getThemeSummary() });
});

app.post('/api/themes', (req, res) => {
  const { key, name } = req.body || {};
  if (!key || !name) {
    return res.status(400).json({ error: 'key and name are required' });
  }
  try {
    const theme = addTheme({ key, name });
    return res.status(201).json({ theme });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.put('/api/themes/:id', (req, res) => {
  try {
    const theme = updateTheme(req.params.id, req.body || {});
    if (!theme) {
      return res.status(404).json({ error: 'theme not found' });
    }
    return res.json({ theme });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.delete('/api/themes/:id', (req, res) => {
  try {
    const removed = deleteTheme(req.params.id);
    if (!removed) {
      return res.status(404).json({ error: 'theme not found' });
    }
    return res.json({ theme: removed });
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
  const count = Number(req.body?.count) || 3;
  try {
    const generated = await generatePostsForTopic(topic, count);
    const prompt = buildPostPromptForTopic(topic, count);
    const saved = addPosts(topic.id, generated, {
      prompt,
      promptText: formatPromptText(prompt),
      generatedPost: '',
    });
    return res.json({ topic, posts: saved });
  } catch (err) {
    return res.status(500).json({ error: 'generation failed', detail: err.message });
  }
});

app.post('/api/trends', async (req, res) => {
  const { topicId, mode, count } = req.body || {};
  const topic = getTopic(topicId);
  if (!topic) {
    return res.status(404).json({ error: 'topic not found' });
  }
  if (!MODE_MAP[mode]) {
    return res.status(400).json({ error: 'mode is invalid' });
  }
  try {
    const trends = await generateTrendsForTopic(topic.name, mode, clampCount(count));
    const prompt = buildTrendPrompt(topic.name, MODE_MAP[mode], clampCount(count));
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

app.post('/api/trends/post', async (req, res) => {
  const { topicId, trend } = req.body || {};
  const topic = getTopic(topicId);
  if (!topic) {
    return res.status(404).json({ error: 'topic not found' });
  }
  if (!trend) {
    return res.status(400).json({ error: 'trend is required' });
  }
  try {
    const text = await generatePostFromTrend(topic, trend);
    const prompt = buildTrendPostPrompt(topic, trend);
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
  if (!trend) {
    return res.status(400).json({ error: 'trend is required' });
  }
  const prompt = buildTrendPostPrompt(topic, trend);
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
  if (theme && !getTheme(theme)) {
    return res.status(400).json({ error: 'theme is invalid' });
  }
  const drafts = theme ? getDraftsForTheme(theme) : getPostDrafts();
  drafts.sort((a, b) => Date.parse(b.created_at || '') - Date.parse(a.created_at || ''));
  return res.json({ drafts: drafts.map((draft) => decorateDraft(draft)) });
});

app.post('/api/post-drafts/generate', async (req, res) => {
  const { theme, mode, article, candidates } = req.body || {};
  if (!theme || !getDraftTheme(theme)) {
    return res.status(400).json({ error: 'theme is invalid' });
  }
  if (!['auto', 'manual'].includes(mode)) {
    return res.status(400).json({ error: 'mode is invalid' });
  }
  try {
    const draft = await generateDraft(theme, { mode, article, candidates });
    return res.json({ draft: decorateDraft(draft) });
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
  return res.json({ draft: decorateDraft(draft) });
});

app.post('/api/post-drafts/:id/discard', (req, res) => {
  const draft = discardDraft(req.params.id);
  if (!draft) {
    return res.status(404).json({ error: 'draft not found' });
  }
  return res.json({ draft: decorateDraft(draft) });
});

app.put('/api/post-drafts/:id', (req, res) => {
  const { content } = req.body || {};
  try {
    const draft = editDraft(req.params.id, content);
    if (!draft) {
      return res.status(404).json({ error: 'draft not found' });
    }
    return res.json({ draft: decorateDraft(draft) });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.delete('/api/post-drafts/:id', (req, res) => {
  const removed = deleteDraft(req.params.id);
  if (!removed) {
    return res.status(404).json({ error: 'draft not found' });
  }
  return res.json({ draft: decorateDraft(removed) });
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
