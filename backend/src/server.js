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
  getNewsSources,
  getActiveNewsSources,
  addNewsSource,
  updateNewsSource,
  deleteNewsSource,
  addNewsItems,
  getNewsItems,
  getNewsItemsForTopics,
} = require('./store');
const { getPostProperties } = require('./postProperties');
const { generatePostsForTopic } = require('./chatgpt');
const { fetchNewsForSources } = require('./news');

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_DIR = path.join(__dirname, '..', '..', 'frontend');
const NEWS_FETCH_INTERVAL_MINUTES = Number(process.env.NEWS_FETCH_INTERVAL_MINUTES) || 15;

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
    const saved = addPosts(topic.id, generated);
    return res.json({ topic, posts: saved });
  } catch (err) {
    return res.status(500).json({ error: 'generation failed', detail: err.message });
  }
});

app.get('/api/posts', (req, res) => {
  const topics = getTopics();
  const allPosts = topics.flatMap((topic) =>
    getPostsForTopic(topic.id).map((p) => ({ ...p, topicName: topic.name }))
  );
  res.json({ posts: allPosts });
});

app.get('/api/news-sources', (req, res) => {
  res.json({ sources: getNewsSources() });
});

app.post('/api/news-sources', (req, res) => {
  try {
    const source = addNewsSource(req.body || {});
    return res.status(201).json({ source });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.put('/api/news-sources/:id', (req, res) => {
  try {
    const updated = updateNewsSource(req.params.id, req.body || {});
    if (!updated) {
      return res.status(404).json({ error: 'source not found' });
    }
    return res.json({ source: updated });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.delete('/api/news-sources/:id', (req, res) => {
  const removed = deleteNewsSource(req.params.id);
  if (!removed) {
    return res.status(404).json({ error: 'source not found' });
  }
  return res.json({ source: removed });
});

app.get('/api/news-items', (req, res) => {
  const { topicId, sourceId } = req.query || {};
  res.json({ items: getNewsItems({ topicId, sourceId }) });
});

app.post('/api/news-items/filter', (req, res) => {
  const topicIds = Array.isArray(req.body?.topicIds) ? req.body.topicIds : [];
  res.json({ items: getNewsItemsForTopics(topicIds) });
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

let newsFetchInFlight = false;

async function runNewsFetch() {
  if (newsFetchInFlight) {
    return;
  }
  newsFetchInFlight = true;
  try {
    const sources = getActiveNewsSources();
    if (sources.length) {
      await fetchNewsForSources(sources, addNewsItems, updateNewsSource);
    }
  } finally {
    newsFetchInFlight = false;
  }
}

setTimeout(runNewsFetch, 2000);
setInterval(runNewsFetch, NEWS_FETCH_INTERVAL_MINUTES * 60 * 1000);
