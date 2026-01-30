const FEED_STORAGE_KEY = 'newsFeeds';
const TOPIC_STORAGE_KEY = 'newsTopics';

const form = document.getElementById('generator-form');
const themeSelect = document.getElementById('generator-theme');
const manualPicker = document.getElementById('manual-picker');
const rssSummary = document.getElementById('rss-summary');
const statusBadge = document.getElementById('generator-status');

let themes = [];
let cachedCandidates = [];

const setStatus = (message, tone = 'default') => {
  statusBadge.textContent = message;
  statusBadge.classList.toggle('danger', tone === 'danger');
};

const readStored = (key) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    return [];
  }
};

const renderThemes = () => {
  themeSelect.innerHTML = '';
  themes.forEach((theme) => {
    const option = document.createElement('option');
    option.value = theme.id;
    option.textContent = theme.label;
    themeSelect.appendChild(option);
  });
};

const fetchThemes = async () => {
  const res = await fetch('/api/post-drafts/themes');
  const data = await res.json();
  themes = data.themes || [];
  renderThemes();
};

const fetchFeedPreview = async (feed) => {
  const response = await fetch(`/api/news/preview?url=${encodeURIComponent(feed.url)}`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Feed konnte nicht geladen werden.');
  }
  return {
    source: data.feed?.title || feed.name,
    items: data.items || [],
  };
};

const loadRssCandidates = async () => {
  const feeds = readStored(FEED_STORAGE_KEY).filter((feed) => feed.active);
  if (!feeds.length) {
    cachedCandidates = [];
    rssSummary.textContent = 'Keine aktiven RSS-Feeds gefunden.';
    return;
  }
  rssSummary.textContent = 'Lade RSS-Artikel ...';
  try {
    const results = await Promise.all(feeds.map((feed) => fetchFeedPreview(feed)));
    const merged = results.flatMap((result) =>
      (result.items || []).map((item) => ({
        title: item.title,
        summary: item.summary || item.title,
        content: item.summary || item.title,
        link: item.link,
        publishedAt: item.publishedAt,
        source: result.source,
      }))
    );
    cachedCandidates = merged
      .filter((item) => item.title && item.link)
      .sort((a, b) => Date.parse(b.publishedAt || 0) - Date.parse(a.publishedAt || 0))
      .slice(0, 10);
    rssSummary.textContent = `Bereit: ${cachedCandidates.length} RSS-Artikel geladen.`;
  } catch (error) {
    cachedCandidates = [];
    rssSummary.textContent = error.message;
  }
};

const renderManualPicker = () => {
  const storedTopics = readStored(TOPIC_STORAGE_KEY);
  if (!storedTopics.length) {
    manualPicker.innerHTML =
      '<p class="muted small">Keine gespeicherten RSS-News gefunden.</p>';
    return;
  }

  manualPicker.innerHTML = '';
  const label = document.createElement('label');
  label.textContent = 'RSS-News auswählen';
  const select = document.createElement('select');
  select.id = 'manual-selection';
  storedTopics.forEach((topic) => {
    const option = document.createElement('option');
    option.value = topic.id;
    option.textContent = `${topic.title} (${topic.source || 'Quelle'})`;
    select.appendChild(option);
  });
  label.appendChild(select);
  manualPicker.appendChild(label);

  const hint = document.createElement('p');
  hint.className = 'muted small';
  hint.textContent =
    'Manuelle Auswahl nutzt gespeicherte RSS-News aus dem News-Bereich.';
  manualPicker.appendChild(hint);
};

const getMode = () => document.querySelector('input[name="generator-mode"]:checked')?.value;

const buildManualArticle = () => {
  const storedTopics = readStored(TOPIC_STORAGE_KEY);
  const selectedId = document.getElementById('manual-selection')?.value;
  const selected = storedTopics.find((topic) => topic.id === selectedId);
  if (!selected) return null;
  return {
    title: selected.title,
    summary: selected.summary || selected.title || '',
    content: selected.summary || selected.title || '',
    link: selected.link,
    source: selected.source,
    publishedAt: selected.savedAt,
  };
};

const setModeVisibility = () => {
  const mode = getMode();
  manualPicker.classList.toggle('is-hidden', mode !== 'manual');
  rssSummary.classList.toggle('is-hidden', mode !== 'auto');
};

form.addEventListener('change', (event) => {
  if (event.target.name === 'generator-mode') {
    setModeVisibility();
  }
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  setStatus('Generiere ...');
  const mode = getMode();
  const theme = themeSelect.value;

  const payload = { theme, mode };
  if (mode === 'manual') {
    const article = buildManualArticle();
    if (!article || !article.link) {
      setStatus('Bitte einen gültigen RSS-Artikel auswählen.', 'danger');
      return;
    }
    payload.article = article;
  } else {
    payload.candidates = cachedCandidates;
  }

  try {
    const res = await fetch('/api/post-drafts/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Generierung fehlgeschlagen.');
    }
    setStatus('Draft erstellt');
  } catch (error) {
    setStatus(error.message, 'danger');
  }
});

const init = async () => {
  await fetchThemes();
  renderManualPicker();
  await loadRssCandidates();
  setModeVisibility();
};

init();
