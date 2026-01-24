const STORAGE_KEY = 'rssFeeds';

const form = document.getElementById('feed-form');
const urlInput = document.getElementById('feed-url');
const list = document.getElementById('feed-list');
const feedback = document.getElementById('feed-feedback');

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

const renderFeeds = (feeds) => {
  if (!feeds.length) {
    list.textContent = 'Noch keine Feeds gespeichert.';
    list.classList.add('muted');
    return;
  }

  list.classList.remove('muted');
  list.innerHTML = feeds
    .map(
      (feed) => `
      <div class="feed-item">
        <div>
          <div class="feed-url">${feed.url}</div>
          <div class="muted small">Hinzugefügt: ${new Date(feed.createdAt).toLocaleString('de-DE')}</div>
        </div>
        <button class="ghost danger" data-feed-id="${feed.id}" type="button">Entfernen</button>
      </div>
    `
    )
    .join('');
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

form.addEventListener('submit', (event) => {
  event.preventDefault();
  addFeed(urlInput.value);
});

list.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-feed-id]');
  if (!button) return;
  removeFeed(button.dataset.feedId);
});

renderFeeds(readFeeds());
