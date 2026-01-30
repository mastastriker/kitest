const FEED_STORAGE_KEY = 'newsFeeds';
const HIDDEN_STORAGE_KEY = 'newsHiddenItems';

const feedForm = document.getElementById('feed-form');
const feedNameInput = document.getElementById('feed-name');
const feedUrlInput = document.getElementById('feed-url');
const feedActiveInput = document.getElementById('feed-active');
const feedStatus = document.getElementById('feed-status');
const feedList = document.getElementById('feed-list');

const newsStatus = document.getElementById('news-status');
const newsItems = document.getElementById('news-items');
const newsCount = document.getElementById('news-count');
const refreshButton = document.getElementById('refresh-news');
const resetHiddenButton = document.getElementById('reset-hidden');

let currentNewsItems = [];
let allNewsItems = [];

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
            Status: ${feed.active ? 'Aktiv' : 'Inaktiv'}
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

const setNewsItems = (items) => {
  const hiddenIds = new Set(readStored(HIDDEN_STORAGE_KEY));
  const visibleItems = items.filter((item) => !hiddenIds.has(item.id));
  const limitedItems = visibleItems.slice(0, 5);
  currentNewsItems = limitedItems;
  newsItems.innerHTML = '';

  if (!limitedItems.length) {
    newsItems.textContent = 'Noch keine News geladen.';
    newsItems.classList.add('muted');
    newsCount.textContent = '0 Artikel';
    return;
  }

  newsItems.classList.remove('muted');
  newsCount.textContent = `${limitedItems.length} Artikel`;

  limitedItems.forEach((item) => {
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

    const hideButton = document.createElement('button');
    hideButton.className = 'ghost';
    hideButton.type = 'button';
    hideButton.textContent = 'Ausblenden';
    hideButton.dataset.newsHide = item.id;

    actions.append(hideButton);
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
    allNewsItems = merged;
    setNewsItems(merged);
    setStatus(newsStatus, `Aktualisiert: ${results.length} aktive Feeds`);
  } catch (error) {
    setStatus(newsStatus, error.message, 'danger');
    setNewsItems([]);
  } finally {
    refreshButton.disabled = false;
  }
};

const fetchFeedTitle = async (url) => {
  const response = await fetch(`/api/news/preview?url=${encodeURIComponent(url)}`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Feed konnte nicht geladen werden.');
  }
  return data.feed?.title;
};

const addFeed = async (event) => {
  event.preventDefault();
  let name = feedNameInput.value.trim();
  const url = feedUrlInput.value.trim();
  const active = feedActiveInput.checked;

  if (!isValidUrl(url)) {
    setStatus(feedStatus, 'Bitte eine gültige RSS-URL angeben.', 'danger');
    return;
  }

  if (!name) {
    setStatus(feedStatus, 'Feed-Name wird geladen ...');
    try {
      name = (await fetchFeedTitle(url)) || 'Unbekannter Feed';
      feedNameInput.value = name;
    } catch (error) {
      setStatus(feedStatus, error.message, 'danger');
      return;
    }
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

const updateFeed = (id, updates) => {
  const feeds = readStored(FEED_STORAGE_KEY).map((feed) =>
    feed.id === id ? { ...feed, ...updates } : feed
  );
  writeStored(FEED_STORAGE_KEY, feeds);
  renderFeedList(feeds);
};

const hideNewsItem = (id) => {
  const hiddenItems = readStored(HIDDEN_STORAGE_KEY);
  if (hiddenItems.includes(id)) return;
  const next = [...hiddenItems, id];
  writeStored(HIDDEN_STORAGE_KEY, next);
  setNewsItems(allNewsItems);
};

const resetHiddenItems = () => {
  writeStored(HIDDEN_STORAGE_KEY, []);
  setNewsItems(allNewsItems);
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
    updateFeed(toggleInput.dataset.feedToggle, { active: toggleInput.checked });
  }
});

refreshButton.addEventListener('click', refreshNews);
resetHiddenButton.addEventListener('click', resetHiddenItems);

newsItems.addEventListener('click', (event) => {
  const hideButton = event.target.closest('[data-news-hide]');
  if (hideButton) {
    hideNewsItem(hideButton.dataset.newsHide);
  }
});

renderFeedList(readStored(FEED_STORAGE_KEY));
allNewsItems = [];
setNewsItems([]);
