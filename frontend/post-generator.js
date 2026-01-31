const FEED_STORAGE_KEY = 'newsFeeds';
const TOPIC_STORAGE_KEY = 'newsTopics';

const form = document.getElementById('generator-form');
const themeSelect = document.getElementById('generator-theme');
const manualPicker = document.getElementById('manual-picker');
const rssSummary = document.getElementById('rss-summary');
const statusBadge = document.getElementById('generator-status');

let themes = [];
let cachedCandidates = [];
let cachedNewsItems = [];

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

const fetchStoredNewsItems = async () => {
  const response = await fetch('/api/news/items?used=false&discarded=false');
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Gespeicherte RSS-News konnten nicht geladen werden.');
  }
  cachedNewsItems = data.items || [];
};

const loadRssCandidates = () => {
  cachedCandidates = cachedNewsItems
    .map((item) => ({
      title: item.title,
      summary: item.content || item.title,
      content: item.content || item.title,
      link: item.url,
      publishedAt: item.published_at,
      source: item.source,
    }))
    .filter((item) => item.title && item.link)
    .sort((a, b) => Date.parse(b.publishedAt || 0) - Date.parse(a.publishedAt || 0))
    .slice(0, 10);
  rssSummary.textContent = cachedCandidates.length
    ? `Bereit: ${cachedCandidates.length} RSS-Artikel geladen.`
    : 'Keine gespeicherten RSS-Artikel verfügbar.';
};

const renderManualPicker = () => {
  if (!cachedNewsItems.length) {
    manualPicker.innerHTML =
      '<p class="muted small">Keine gespeicherten RSS-News gefunden.</p>';
    return;
  }

  manualPicker.innerHTML = '';
  const label = document.createElement('label');
  label.textContent = 'RSS-News auswählen';
  const select = document.createElement('select');
  select.id = 'manual-selection';
  cachedNewsItems.forEach((topic) => {
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
  const selectedId = document.getElementById('manual-selection')?.value;
  const selected = cachedNewsItems.find((topic) => topic.id === selectedId);
  if (!selected) return null;
  return {
    title: selected.title,
    summary: selected.content || selected.title || '',
    content: selected.content || selected.title || '',
    link: selected.url,
    source: selected.source,
    publishedAt: selected.published_at,
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
    await fetchStoredNewsItems();
    renderManualPicker();
    loadRssCandidates();
  } catch (error) {
    setStatus(error.message, 'danger');
  }
});

const init = async () => {
  await fetchThemes();
  try {
    await fetchStoredNewsItems();
  } catch (error) {
    cachedNewsItems = [];
    rssSummary.textContent = error.message;
  }
  renderManualPicker();
  loadRssCandidates();
  setModeVisibility();
};

init();
