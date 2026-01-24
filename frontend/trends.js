const FEED_STORAGE_KEY = 'newsFeeds';

const refreshButton = document.getElementById('refresh-trends');
const trendsStatus = document.getElementById('trends-status');
const trendsContent = document.getElementById('trends-content');

const readStored = (key) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    return [];
  }
};

const setStatus = (message, tone = 'muted') => {
  trendsStatus.textContent = message;
  trendsStatus.classList.toggle('danger', tone === 'danger');
};

const normalizeTitle = (value) =>
  value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

const toTimestamp = (value) => {
  if (!value) return 0;
  const time = Date.parse(value);
  return Number.isNaN(time) ? 0 : time;
};

const fetchFeedPreview = async (feed) => {
  const response = await fetch(`/api/news/preview?url=${encodeURIComponent(feed.url)}`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Feed konnte nicht geladen werden.');
  }
  return {
    id: feed.id,
    name: feed.name,
    topicName: feed.topicName,
    source: data.feed?.title || feed.name || feed.url,
    items: data.items || [],
  };
};

const buildTrendMaps = (feeds, previews) => {
  const topics = new Map();

  previews.forEach((preview) => {
    const feed = feeds.find((item) => item.id === preview.id);
    const topicName = feed?.topicName || preview.topicName || 'Ohne Thema';
    if (!topics.has(topicName)) {
      topics.set(topicName, new Map());
    }
    const trendMap = topics.get(topicName);
    preview.items.forEach((item) => {
      if (!item?.title) return;
      const key = normalizeTitle(item.title);
      if (!key) return;
      if (!trendMap.has(key)) {
        trendMap.set(key, {
          id: `${topicName}-${key}`.slice(0, 180),
          title: item.title,
          link: item.link,
          summary: item.summary,
          count: 0,
          sources: new Set(),
          latestAt: 0,
        });
      }
      const entry = trendMap.get(key);
      entry.count += 1;
      if (!entry.summary && item.summary) {
        entry.summary = item.summary;
      }
      entry.sources.add(preview.source);
      entry.latestAt = Math.max(entry.latestAt, toTimestamp(item.publishedAt));
    });
  });

  return topics;
};

const renderTrends = (topics) => {
  trendsContent.innerHTML = '';
  if (!topics.size) {
    trendsContent.textContent = 'Noch keine Trends geladen.';
    trendsContent.classList.add('muted');
    return [];
  }

  trendsContent.classList.remove('muted');
  const summaryTargets = [];

  topics.forEach((trendMap, topicName) => {
    const entries = [...trendMap.values()]
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return b.latestAt - a.latestAt;
      })
      .slice(0, 10);

    const section = document.createElement('section');
    section.className = 'trend-topic';

    const head = document.createElement('div');
    head.className = 'trend-topic-head';

    const title = document.createElement('h3');
    title.textContent = topicName;

    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = `${entries.length} Trends`;

    head.append(title, badge);

    const list = document.createElement('ol');
    list.className = 'trend-list';

    entries.forEach((entry, index) => {
      const item = document.createElement('li');
      item.className = 'trend-item';

      const titleWrap = document.createElement('div');
      titleWrap.className = 'trend-title';

      const link = document.createElement('a');
      link.href = entry.link || '#';
      link.textContent = entry.title;
      link.target = '_blank';
      link.rel = 'noreferrer';
      titleWrap.appendChild(link);

      const meta = document.createElement('div');
      meta.className = 'trend-meta muted small';
      meta.textContent = `Häufigkeit: ${entry.count} · Quellen: ${[
        ...entry.sources,
      ].join(', ')}`;

      item.append(titleWrap, meta);

      if (index < 3) {
        const summary = document.createElement('p');
        summary.className = 'trend-summary muted small';
        summary.dataset.summaryId = entry.id;
        summary.textContent = 'Zusammenfassung wird geladen ...';
        item.appendChild(summary);
        summaryTargets.push({
          id: entry.id,
          title: entry.title,
          summary: entry.summary,
        });
      }

      list.appendChild(item);
    });

    section.append(head, list);
    trendsContent.appendChild(section);
  });

  return summaryTargets;
};

const hydrateSummaries = (summaries) => {
  summaries.forEach((entry) => {
    const element = trendsContent.querySelector(`[data-summary-id="${entry.id}"]`);
    if (element) {
      element.textContent = entry.summary;
    }
  });
};

const fetchSummaries = async (summaryTargets) => {
  if (!summaryTargets.length) return;
  try {
    const response = await fetch('/api/trends/summaries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: summaryTargets }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Zusammenfassungen konnten nicht geladen werden.');
    }
    hydrateSummaries(data.summaries || []);
  } catch (error) {
    setStatus(error.message, 'danger');
  }
};

const refreshTrends = async () => {
  const feeds = readStored(FEED_STORAGE_KEY).filter((feed) => feed.active);
  if (!feeds.length) {
    setStatus('Keine aktiven Feeds vorhanden.', 'danger');
    trendsContent.textContent = 'Noch keine Trends geladen.';
    trendsContent.classList.add('muted');
    return;
  }

  setStatus('Trends werden geladen ...');
  refreshButton.disabled = true;

  try {
    const previews = await Promise.all(feeds.map((feed) => fetchFeedPreview(feed)));
    const topics = buildTrendMaps(feeds, previews);
    const summaryTargets = renderTrends(topics);
    setStatus(`Aktualisiert: ${previews.length} aktive Feeds`);
    await fetchSummaries(summaryTargets);
  } catch (error) {
    setStatus(error.message, 'danger');
    trendsContent.textContent = 'Noch keine Trends geladen.';
    trendsContent.classList.add('muted');
  } finally {
    refreshButton.disabled = false;
  }
};

refreshButton.addEventListener('click', refreshTrends);

setStatus('Noch keine Trends geladen.');
