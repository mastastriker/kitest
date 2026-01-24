const STORAGE_KEY = 'rssFeeds';
const DEFAULT_ROUTE = 'feeds';

const form = document.getElementById('feed-form');
const urlInput = document.getElementById('feed-url');
const list = document.getElementById('feed-list');
const feedback = document.getElementById('feed-feedback');
const routeLinks = Array.from(document.querySelectorAll('[data-route-link]'));
const routePanels = Array.from(document.querySelectorAll('.route-panel'));
const feedSelect = document.getElementById('feed-select');
const manualUrlInput = document.getElementById('manual-url');
const fetchButton = document.getElementById('fetch-feed');
const clearButton = document.getElementById('clear-preview');
const newsStatus = document.getElementById('news-status');
const newsItems = document.getElementById('news-items');
const readerCount = document.getElementById('reader-count');

const readFeeds = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    return [];
  }
};

const writeFeeds = (feeds) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(feeds));
};

const setFeedback = (message, tone = 'muted') => {
  feedback.textContent = message;
  feedback.classList.toggle('danger', tone === 'danger');
};

const setNewsStatus = (message, tone = 'muted') => {
  newsStatus.textContent = message;
  newsStatus.classList.toggle('danger', tone === 'danger');
};

const setRoute = (route) => {
  routePanels.forEach((panel) => {
    panel.classList.toggle('is-active', panel.dataset.route === route);
  });

  routeLinks.forEach((link) => {
    link.classList.toggle('is-active', link.dataset.routeLink === route);
  });
};

const updateRouteFromHash = () => {
  const route = window.location.hash.replace('#', '') || DEFAULT_ROUTE;
  setRoute(route);
};

const renderFeedOptions = (feeds) => {
  const current = feedSelect.value;
  feedSelect.innerHTML = '<option value="">Bitte auswählen</option>';

  feeds.forEach((feed) => {
    const option = document.createElement('option');
    option.value = feed.url;
    option.textContent = feed.url;
    if (feed.url === current) {
      option.selected = true;
    }
    feedSelect.appendChild(option);
  });
};

const renderFeeds = (feeds) => {
  if (!feeds.length) {
    list.textContent = 'Noch keine Feeds gespeichert.';
    list.classList.add('muted');
    renderFeedOptions([]);
    return;
  }

  list.classList.remove('muted');
  list.innerHTML = feeds
    .map(
      (feed) => `
      <div class="feed-item">
        <div>
          <a class="feed-url" href="${feed.url}" target="_blank" rel="noreferrer">${feed.url}</a>
          <div class="muted small">Hinzugefügt: ${new Date(feed.createdAt).toLocaleString('de-DE')}</div>
        </div>
        <button class="ghost danger" data-feed-id="${feed.id}" type="button">Entfernen</button>
      </div>
    `
    )
    .join('');

  renderFeedOptions(feeds);
};

const isValidUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (error) {
    return false;
  }
};

const addFeed = (url) => {
  const feeds = readFeeds();
  const normalized = url.trim();

  if (!isValidUrl(normalized)) {
    setFeedback('Bitte eine gültige http(s)-URL angeben.', 'danger');
    return;
  }

  if (feeds.some((feed) => feed.url === normalized)) {
    setFeedback('Dieser Feed ist bereits gespeichert.', 'danger');
    return;
  }

  const nextFeeds = [
    ...feeds,
    {
      id: crypto.randomUUID(),
      url: normalized,
      createdAt: new Date().toISOString(),
    },
  ];

  writeFeeds(nextFeeds);
  renderFeeds(nextFeeds);
  setFeedback('Feed gespeichert.');
  form.reset();
};

const removeFeed = (id) => {
  const nextFeeds = readFeeds().filter((feed) => feed.id !== id);
  writeFeeds(nextFeeds);
  renderFeeds(nextFeeds);
  setFeedback('Feed entfernt.');
};

const resetPreview = () => {
  newsItems.textContent = 'Noch keine Artikel geladen.';
  newsItems.classList.add('muted');
  readerCount.textContent = '0 Artikel';
  setNewsStatus('');
};

const renderNewsItems = (items) => {
  newsItems.innerHTML = '';

  if (!items.length) {
    newsItems.textContent = 'Keine Artikel gefunden.';
    newsItems.classList.add('muted');
    readerCount.textContent = '0 Artikel';
    return;
  }

  newsItems.classList.remove('muted');
  readerCount.textContent = `${items.length} Artikel`;

  items.forEach((item) => {
    const card = document.createElement('article');
    card.className = 'news-item';

    const title = document.createElement('h3');
    title.textContent = item.title || 'Ohne Titel';

    const meta = document.createElement('p');
    meta.className = 'muted small';
    meta.textContent = item.publishedAt ? `Veröffentlicht: ${item.publishedAt}` : 'Ohne Datum';

    const link = document.createElement('a');
    link.href = item.link || '#';
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.textContent = item.link ? 'Artikel öffnen' : 'Kein Link verfügbar';

    const summary = document.createElement('p');
    summary.textContent = item.summary || 'Keine Vorschau verfügbar.';

    card.append(title, meta, link, summary);
    newsItems.appendChild(card);
  });
};

const fetchPreview = async (url) => {
  if (!isValidUrl(url)) {
    setNewsStatus('Bitte eine gültige http(s)-URL angeben.', 'danger');
    return;
  }

  setNewsStatus('Feed wird geladen ...');
  fetchButton.disabled = true;

  try {
    const response = await fetch(`/api/news/preview?url=${encodeURIComponent(url)}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Feed konnte nicht geladen werden.');
    }

    renderNewsItems(data.items || []);
    setNewsStatus(`Feed geladen: ${data.feed?.title || data.sourceUrl}`);
  } catch (error) {
    setNewsStatus(error.message, 'danger');
    renderNewsItems([]);
  } finally {
    fetchButton.disabled = false;
  }
};

form.addEventListener('submit', (event) => {
  event.preventDefault();
  addFeed(urlInput.value);
});

list.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-feed-id]');
  if (!button) return;
  removeFeed(button.dataset.feedId);
});

feedSelect?.addEventListener('change', () => {
  manualUrlInput.value = feedSelect.value;
});

fetchButton?.addEventListener('click', () => {
  const url = manualUrlInput.value.trim() || feedSelect.value;
  if (!url) {
    setNewsStatus('Bitte einen Feed auswählen oder eine URL eingeben.', 'danger');
    return;
  }
  fetchPreview(url);
});

clearButton?.addEventListener('click', () => {
  resetPreview();
  manualUrlInput.value = '';
  feedSelect.value = '';
});

window.addEventListener('hashchange', updateRouteFromHash);

renderFeeds(readFeeds());
resetPreview();
updateRouteFromHash();
