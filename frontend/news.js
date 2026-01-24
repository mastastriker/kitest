const FEED_STORAGE_KEY = 'newsFeeds';
const TOPIC_STORAGE_KEY = 'newsTopics';

const feedForm = document.getElementById('feed-form');
const feedNameInput = document.getElementById('feed-name');
const feedUrlInput = document.getElementById('feed-url');
const feedCategoryInput = document.getElementById('feed-category');
const feedActiveInput = document.getElementById('feed-active');
const feedStatus = document.getElementById('feed-status');
const feedList = document.getElementById('feed-list');

const newsStatus = document.getElementById('news-status');
const newsItems = document.getElementById('news-items');
const newsCount = document.getElementById('news-count');
const refreshButton = document.getElementById('refresh-news');

const topicList = document.getElementById('topic-list');
const topicCount = document.getElementById('topic-count');

let currentNewsItems = [];

const readStored = (key) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    return [];
  }
};

const writeStored = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const setStatus = (element, message, tone = 'muted') => {
  element.textContent = message;
  element.classList.toggle('danger', tone === 'danger');
};

const isValidUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (error) {
    return false;
  }
};

const renderFeedList = (feeds) => {
  if (!feeds.length) {
    feedList.textContent = 'Noch keine Feeds gespeichert.';
    feedList.classList.add('muted');
    return;
  }

  feedList.classList.remove('muted');
  feedList.innerHTML = feeds
    .map(
      (feed) => `
      <div class="feed-item">
        <div class="feed-details">
          <div class="feed-title">${feed.name}</div>
          <a class="feed-url" href="${feed.url}" target="_blank" rel="noreferrer">${feed.url}</a>
          <div class="muted small">
            Kategorie: ${feed.category || 'Keine'} · Status: ${feed.active ? 'Aktiv' : 'Inaktiv'}
          </div>
        </div>
        <div class="feed-actions">
          <label class="inline-toggle">
            <input type="checkbox" data-feed-toggle="${feed.id}" ${feed.active ? 'checked' : ''} />
            Aktiv
          </label>
          <button class="ghost danger" data-feed-remove="${feed.id}" type="button">Entfernen</button>
        </div>
      </div>
    `
    )
    .join('');
};

const renderTopics = (topics) => {
  if (!topics.length) {
    topicList.textContent = 'Noch keine Themen gespeichert.';
    topicList.classList.add('muted');
    topicCount.textContent = '0 Themen';
    return;
  }

  topicList.classList.remove('muted');
  topicCount.textContent = `${topics.length} Themen`;
  topicList.innerHTML = topics
    .map(
      (topic) => `
      <div class="feed-item">
        <div>
          <div class="feed-title">${topic.title}</div>
          <a class="feed-url" href="${topic.link}" target="_blank" rel="noreferrer">${topic.source}</a>
          <div class="muted small">
            Gespeichert: ${new Date(topic.savedAt).toLocaleString('de-DE')}
            ${topic.category ? `· Kategorie: ${topic.category}` : ''}
          </div>
        </div>
        <button class="ghost danger" data-topic-remove="${topic.id}" type="button">Entfernen</button>
      </div>
    `
    )
    .join('');
};

const setNewsItems = (items) => {
  currentNewsItems = items;
  newsItems.innerHTML = '';

  if (!items.length) {
    newsItems.textContent = 'Noch keine News geladen.';
    newsItems.classList.add('muted');
    newsCount.textContent = '0 Artikel';
    return;
  }

  newsItems.classList.remove('muted');
  newsCount.textContent = `${items.length} Artikel`;

  items.forEach((item) => {
    const card = document.createElement('article');
    card.className = 'news-item';

    const title = document.createElement('h3');
    title.textContent = item.title || 'Ohne Titel';

    const meta = document.createElement('p');
    meta.className = 'muted small';
    meta.textContent = `${item.source || 'Unbekannte Quelle'} · ${item.publishedAt || 'Ohne Datum'}`;

    const link = document.createElement('a');
    link.href = item.link || '#';
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.textContent = 'Zum Artikel';

    const actions = document.createElement('div');
    actions.className = 'inline-actions';

    const saveButton = document.createElement('button');
    saveButton.className = 'ghost';
    saveButton.type = 'button';
    saveButton.textContent = 'Als Thema speichern';
    saveButton.dataset.topicSave = item.id;

    actions.append(saveButton);
    card.append(title, meta, link, actions);
    newsItems.appendChild(card);
  });
};

const mergeNewsItems = (feeds) => {
  const items = feeds.flatMap((feed) =>
    (feed.items || []).map((item) => ({
      id: `${feed.id}-${item.link || item.title}`,
      title: item.title,
      link: item.link,
      publishedAt: item.publishedAt,
      source: feed.source || feed.name,
      category: feed.category,
    }))
  );

  return items
    .filter((item) => item.title)
    .sort((a, b) => {
      const aTime = a.publishedAt ? Date.parse(a.publishedAt) : 0;
      const bTime = b.publishedAt ? Date.parse(b.publishedAt) : 0;
      return bTime - aTime;
    });
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
    category: feed.category,
    source: data.feed?.title || feed.name || feed.url,
    items: data.items || [],
  };
};

const refreshNews = async () => {
  const feeds = readStored(FEED_STORAGE_KEY).filter((feed) => feed.active);
  if (!feeds.length) {
    setStatus(newsStatus, 'Keine aktiven Feeds vorhanden.', 'danger');
    setNewsItems([]);
    return;
  }

  setStatus(newsStatus, 'News werden geladen ...');
  refreshButton.disabled = true;

  try {
    const results = await Promise.all(feeds.map((feed) => fetchFeedPreview(feed)));
    const merged = mergeNewsItems(results);
    setNewsItems(merged);
    setStatus(newsStatus, `Aktualisiert: ${results.length} aktive Feeds`);
  } catch (error) {
    setStatus(newsStatus, error.message, 'danger');
    setNewsItems([]);
  } finally {
    refreshButton.disabled = false;
  }
};

const addFeed = (event) => {
  event.preventDefault();
  const name = feedNameInput.value.trim();
  const url = feedUrlInput.value.trim();
  const category = feedCategoryInput.value.trim();
  const active = feedActiveInput.checked;

  if (!name) {
    setStatus(feedStatus, 'Bitte einen Namen angeben.', 'danger');
    return;
  }

  if (!isValidUrl(url)) {
    setStatus(feedStatus, 'Bitte eine gültige RSS-URL angeben.', 'danger');
    return;
  }

  const feeds = readStored(FEED_STORAGE_KEY);
  if (feeds.some((feed) => feed.url === url)) {
    setStatus(feedStatus, 'Diese URL ist bereits gespeichert.', 'danger');
    return;
  }

  const next = [
    ...feeds,
    {
      id: crypto.randomUUID(),
      name,
      url,
      category,
      active,
      createdAt: new Date().toISOString(),
    },
  ];

  writeStored(FEED_STORAGE_KEY, next);
  renderFeedList(next);
  setStatus(feedStatus, 'Feed gespeichert.');
  feedForm.reset();
  feedActiveInput.checked = true;
};

const removeFeed = (id) => {
  const next = readStored(FEED_STORAGE_KEY).filter((feed) => feed.id !== id);
  writeStored(FEED_STORAGE_KEY, next);
  renderFeedList(next);
};

const toggleFeed = (id, active) => {
  const feeds = readStored(FEED_STORAGE_KEY).map((feed) =>
    feed.id === id ? { ...feed, active } : feed
  );
  writeStored(FEED_STORAGE_KEY, feeds);
  renderFeedList(feeds);
};

const saveTopic = (item) => {
  const topics = readStored(TOPIC_STORAGE_KEY);
  if (!item?.link) {
    setStatus(newsStatus, 'Thema ohne Link kann nicht gespeichert werden.', 'danger');
    return;
  }
  if (topics.some((topic) => topic.link === item.link)) {
    setStatus(newsStatus, 'Dieses Thema ist bereits gespeichert.', 'danger');
    return;
  }

  const next = [
    {
      id: crypto.randomUUID(),
      title: item.title,
      source: item.source,
      link: item.link,
      category: item.category,
      savedAt: new Date().toISOString(),
    },
    ...topics,
  ];

  writeStored(TOPIC_STORAGE_KEY, next);
  renderTopics(next);
  setStatus(newsStatus, 'Thema gespeichert.');
};

const removeTopic = (id) => {
  const next = readStored(TOPIC_STORAGE_KEY).filter((topic) => topic.id !== id);
  writeStored(TOPIC_STORAGE_KEY, next);
  renderTopics(next);
};

feedForm.addEventListener('submit', addFeed);

feedList.addEventListener('click', (event) => {
  const removeButton = event.target.closest('[data-feed-remove]');
  if (removeButton) {
    removeFeed(removeButton.dataset.feedRemove);
    return;
  }

  const toggleInput = event.target.closest('[data-feed-toggle]');
  if (toggleInput) {
    toggleFeed(toggleInput.dataset.feedToggle, toggleInput.checked);
  }
});

refreshButton.addEventListener('click', refreshNews);

newsItems.addEventListener('click', (event) => {
  const button = event.target.closest('[data-topic-save]');
  if (!button) return;

  const item = currentNewsItems.find((entry) => entry.id === button.dataset.topicSave);
  if (!item) {
    setStatus(newsStatus, 'Thema konnte nicht gefunden werden.', 'danger');
    return;
  }

  saveTopic(item);
});

topicList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-topic-remove]');
  if (!button) return;
  removeTopic(button.dataset.topicRemove);
});

renderFeedList(readStored(FEED_STORAGE_KEY));
renderTopics(readStored(TOPIC_STORAGE_KEY));
setNewsItems([]);
