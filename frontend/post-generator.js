const FEED_STORAGE_KEY = 'newsFeeds';
const TOPIC_STORAGE_KEY = 'newsTopics';

const form = document.getElementById('generator-form');
const themeSelect = document.getElementById('generator-theme');
const manualPicker = document.getElementById('manual-picker');
const rssSummary = document.getElementById('rss-summary');
const statusBadge = document.getElementById('generator-status');
const themeWarning = document.getElementById('theme-warning');
const countButtons = Array.from(document.querySelectorAll('.count-button'));
const submitButton = form.querySelector('button[type="submit"]');
const trendListGrok = document.getElementById('trend-list-grok');
const trendListOpenAI = document.getElementById('trend-list-openai');
const trendStatus = document.getElementById('trend-status');
const trendRefreshButton = document.getElementById('trend-refresh');

let themes = [];
let themeRegistry = new Map();
let cachedCandidates = [];
let isGenerating = false;
let selectedCount = 1;
let isRefreshingTrends = false;

const setStatus = (message, tone = 'default') => {
  statusBadge.textContent = message;
  statusBadge.classList.toggle('danger', tone === 'danger');
};

const setTrendStatus = (message, tone = 'default') => {
  if (!trendStatus) return;
  trendStatus.textContent = message;
  trendStatus.classList.toggle('danger', tone === 'danger');
};

const setSelectedCount = (count) => {
  selectedCount = count;
  countButtons.forEach((button) => {
    const value = Number(button.dataset.count || 0);
    button.classList.toggle('is-active', value === selectedCount);
  });
};

const readStored = (key) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    return [];
  }
};

const renderTrendColumn = (container, trends = []) => {
  if (!container) return;
  if (!Array.isArray(trends) || !trends.length) {
    container.innerHTML = '<p class="muted small">Keine Trends geladen.</p>';
    return;
  }
  container.innerHTML = '';
  trends.forEach((trend) => {
    const item = document.createElement('div');
    item.className = `trend-item${trend.is_stale ? ' is-stale' : ''}`;
    const title = document.createElement('span');
    title.className = 'trend-title';
    title.textContent = trend.title || 'Ohne Titel';
    const meta = document.createElement('span');
    meta.className = 'trend-meta muted small';
    const createdAt = trend.created_at ? new Date(trend.created_at).toLocaleString('de-DE') : '';
    const freshnessLabel = trend.is_stale ? 'Veraltet (24–72h)' : 'Frisch (<24h)';
    meta.textContent = [createdAt, freshnessLabel].filter(Boolean).join(' · ');
    item.append(title, meta);
    container.appendChild(item);
  });
};

const renderTrends = (trends = []) => {
  const byProvider = (provider) =>
    (Array.isArray(trends) ? trends : [])
      .filter((trend) => trend.provider === provider)
      .filter((trend) => trend.label !== 'technisch')
      .sort((a, b) => Date.parse(b.created_at || 0) - Date.parse(a.created_at || 0))
      .slice(0, 10);
  renderTrendColumn(trendListGrok, byProvider('grok'));
  renderTrendColumn(trendListOpenAI, byProvider('openai'));
};

const fetchCurrentTrends = async () => {
  const res = await fetch('/api/trends/current');
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Trends konnten nicht geladen werden.');
  }
  renderTrends(data.trends || []);
};

const renderThemes = () => {
  themeSelect.innerHTML = '';
  themes.forEach((theme) => {
    const option = document.createElement('option');
    option.value = theme.id;
    option.textContent = theme.label;
    themeSelect.appendChild(option);
  });
  updateThemeWarning();
};

const fetchThemes = async () => {
  const res = await fetch('/api/post-drafts/themes');
  const data = await res.json();
  themes = data.themes || [];
  renderThemes();
};

const fetchThemeRegistry = async () => {
  try {
    const res = await fetch('/api/themes');
    const data = await res.json();
    themeRegistry = new Map((data.themes || []).map((theme) => [theme.key, theme]));
  } catch (error) {
    themeRegistry = new Map();
  }
  updateThemeWarning();
};

const updateThemeWarning = () => {
  if (!themeWarning) return;
  const selected = themeSelect.value;
  const selectedTheme = themeRegistry.get(selected);
  if (selectedTheme && !selectedTheme.active) {
    themeWarning.textContent =
      'Hinweis: Dieses Theme ist in der Themenverwaltung als inaktiv markiert.';
    themeWarning.classList.remove('is-hidden');
    themeWarning.classList.add('danger');
  } else {
    themeWarning.textContent = '';
    themeWarning.classList.add('is-hidden');
    themeWarning.classList.remove('danger');
  }
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

countButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const value = Number(button.dataset.count || 1);
    setSelectedCount(value);
  });
});

themeSelect.addEventListener('change', () => {
  updateThemeWarning();
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (isGenerating) {
    return;
  }
  isGenerating = true;
  if (submitButton) {
    submitButton.disabled = true;
  }
  setStatus('Generiere ...');
  const mode = getMode();
  const theme = themeSelect.value;
  const count = selectedCount;

  const payload = { theme, mode, count };
  if (mode === 'manual') {
    const article = buildManualArticle();
    if (!article || !article.link) {
      setStatus('Bitte einen gültigen RSS-Artikel auswählen.', 'danger');
      isGenerating = false;
      if (submitButton) {
        submitButton.disabled = false;
      }
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
    const total = data.drafts?.length || 0;
    setStatus(total ? `${total} Drafts erstellt` : 'Draft erstellt');
  } catch (error) {
    setStatus(error.message, 'danger');
  } finally {
    isGenerating = false;
    if (submitButton) {
      submitButton.disabled = false;
    }
  }
});

trendRefreshButton?.addEventListener('click', async () => {
  if (isRefreshingTrends) {
    return;
  }
  const themeId = themeSelect.value;
  if (!themeId) {
    setTrendStatus('Bitte ein Thema auswählen.', 'danger');
    return;
  }
  isRefreshingTrends = true;
  trendRefreshButton.disabled = true;
  setTrendStatus('Trends werden aktualisiert ...');
  try {
    const res = await fetch('/api/trends/refresh', {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ themeId }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Trend-Aktualisierung fehlgeschlagen.');
    }
    renderTrends(data.trends || []);
    setTrendStatus('Trends aktualisiert.');
  } catch (error) {
    setTrendStatus(error.message, 'danger');
  } finally {
    isRefreshingTrends = false;
    trendRefreshButton.disabled = false;
  }
});

const init = async () => {
  await fetchThemes();
  await fetchThemeRegistry();
  renderManualPicker();
  await loadRssCandidates();
  await fetchCurrentTrends();
  setModeVisibility();
  setSelectedCount(selectedCount);
};

init();
