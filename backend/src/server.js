require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const {
  getTopics,
  getTopic,
  addTopic,
  updateTopic,
  addDraft,
  getDrafts,
  updateDraftContent,
  updateDraftStatus,
  deleteTopic,
} = require('./store');
const {
  pickStyleModule,
  generateDraftFromArticle,
  generateDraftFromTrend,
  generateTrendSignal,
} = require('./chatgpt');
const { fetchFeed } = require('./news');

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_DIR = path.join(__dirname, '..', '..', 'frontend');

app.use(cors());
app.use(express.json());
app.use(express.static(FRONTEND_DIR));

const clampText = (value = '') => String(value || '').toLowerCase();

async function fetchArticlesForFeeds(feeds) {
  const results = await Promise.all(
    feeds.map(async (feed) => {
      try {
        const parsed = await fetchFeed(feed.url);
        return (parsed.items || []).map((item) => ({
          title: item.title,
          link: item.link,
          summary: item.summary,
          publishedAt: item.publishedAt,
          source: parsed.feed?.title || feed.name || feed.url,
        }));
      } catch (err) {
        return [];
      }
    })
  );
  return results.flat().filter((item) => item.link);
}

function selectArticle(items, trends) {
  if (!items.length) return null;
  const trendTerms = trends.map((trend) => clampText(trend)).filter(Boolean);
  const scored = items.map((item) => {
    const text = clampText(`${item.title || ''} ${item.summary || ''}`);
    const score = trendTerms.reduce((acc, term) => (text.includes(term) ? acc + 1 : acc), 0);
    const published = item.publishedAt ? Date.parse(item.publishedAt) : 0;
    return { item, score, published };
  });
  const hasMatches = scored.some((entry) => entry.score > 0);
  const filtered = hasMatches ? scored.filter((entry) => entry.score > 0) : scored;
  filtered.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return b.published - a.published;
  });
  return filtered[0]?.item || null;
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
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

app.get('/api/drafts', (req, res) => {
  res.json({ drafts: getDrafts() });
});

app.get('/api/news/preview', async (req, res) => {
  const url = req.query?.url;
  if (!url) {
    return res.status(400).json({ error: 'url is required' });
  }
  try {
    const parsed = await fetchFeed(url);
    return res.json({ ...parsed, sourceUrl: url, fetchedAt: new Date().toISOString() });
  } catch (err) {
    return res.status(500).json({ error: 'feed request failed', detail: err.message });
  }
});

app.post('/api/drafts/generate', async (req, res) => {
  const { topicId, mode, feeds, article } = req.body || {};
  const topic = getTopic(topicId);
  if (!topic) {
    return res.status(404).json({ error: 'topic not found' });
  }
  if (!['auto', 'manual'].includes(mode)) {
    return res.status(400).json({ error: 'mode is invalid' });
  }

  try {
    const styleModule = pickStyleModule();
    if (mode === 'manual') {
      if (!article?.link) {
        return res.status(400).json({ error: 'article is required' });
      }
      const content = await generateDraftFromArticle(topic.name, article, styleModule);
      const draft = addDraft({
        theme: topic.name,
        theme_id: topic.id,
        content,
        source_type: 'rss',
        source_ref: article.link,
      });
      return res.json({ draft });
    }

    const feedList = Array.isArray(feeds) ? feeds : [];
    const relevantFeeds = feedList.filter(
      (feed) => feed.active && feed.topicId === topic.id && feed.url
    );
    const trendSignals = await generateTrendSignal(topic.name, 7);
    const items = await fetchArticlesForFeeds(relevantFeeds);
    const selected = selectArticle(items, trendSignals);

    if (!selected) {
      const fallbackTrend = trendSignals[0] || `Trend rund um ${topic.name}`;
      const content = await generateDraftFromTrend(topic.name, fallbackTrend, styleModule);
      const draft = addDraft({
        theme: topic.name,
        theme_id: topic.id,
        content,
        source_type: 'trend',
        source_ref: fallbackTrend,
      });
      return res.json({ draft, usedFallback: true });
    }

    const content = await generateDraftFromArticle(topic.name, selected, styleModule);
    const draft = addDraft({
      theme: topic.name,
      theme_id: topic.id,
      content,
      source_type: 'rss',
      source_ref: selected.link,
    });
    return res.json({ draft, usedFallback: false });
  } catch (err) {
    console.error('[drafts-generate] generation failed', {
      message: err.message,
      status: err.status,
      response: err.response,
    });
    return res.status(500).json({ error: 'generation failed', detail: err.message });
  }
});

app.put('/api/drafts/:id', (req, res) => {
  try {
    const updated = updateDraftContent(req.params.id, req.body?.content);
    if (!updated) {
      return res.status(404).json({ error: 'draft not found' });
    }
    return res.json({ draft: updated });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.post('/api/drafts/:id/status', (req, res) => {
  try {
    const updated = updateDraftStatus(req.params.id, req.body?.status);
    if (!updated) {
      return res.status(404).json({ error: 'draft not found' });
    }
    return res.json({ draft: updated });
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
