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
  deleteTopic,
} = require('./store');
const { getPostProperties } = require('./postProperties');
const {
  generatePostsForTopic,
  generatePostFromTrend,
  buildPostPromptForTopic,
  buildTrendPostPrompt,
} = require('./chatgpt');
const { generateTrendsForTopic, MODE_MAP, clampCount, buildTrendPrompt } = require('./trends');
const { parseFeed } = require('./news');

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

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/post-properties', (req, res) => {
  res.json({
    properties: getPostProperties().map(({ id, label }) => ({ id, label })),
  });
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
    return res.status(500).json({ error: 'generation failed', detail: err.message });
  }
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
