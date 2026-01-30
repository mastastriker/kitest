const FEED_STORAGE_KEY = 'newsFeeds';

const form = document.getElementById('generator-form');
const topicSelect = document.getElementById('generator-topic');
const modeInputs = Array.from(document.querySelectorAll('input[name="generator-mode"]'));
const manualPanel = document.getElementById('manual-panel');
const manualStatus = document.getElementById('manual-status');
const manualArticles = document.getElementById('manual-articles');
const loadArticlesButton = document.getElementById('load-articles');
const generatorStatus = document.getElementById('generator-status');

const state = {
  topics: [],
  articles: [],
};

const readStored = (key) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    return [];
  }
};

const setStatus = (element, message, tone = 'muted') => {
  element.textContent = message;
  element.classList.toggle('danger', tone === 'danger');
};

const renderTopics = () => {
  topicSelect.innerHTML = '<option value="">Thema auswählen ...</option>';
  state.topics.forEach((topic) => {
    const option = document.createElement('option');
    option.value = topic.id;
    option.textContent = topic.name;
    topicSelect.appendChild(option);
  });
};

const loadTopics = async () => {
  try {
    const res = await fetch('/api/topics');
    const data = await res.json();
    state.topics = (data.topics || []).filter((topic) => topic.is_active);
    renderTopics();
  } catch (error) {
    state.topics = [];
    renderTopics();
  }
};

const renderArticles = () => {
  if (!state.articles.length) {
    manualArticles.textContent = 'Keine passenden Artikel gefunden.';
    manualArticles.classList.add('muted');
    return;
  }
  manualArticles.classList.remove('muted');
  manualArticles.innerHTML = '';
  state.articles.forEach((article) => {
    const card = document.createElement('label');
    card.className = 'manual-article';
    card.innerHTML = `
      <input type="radio" name="article-choice" value="${article.id}" />
      <div class="manual-article-body">
        <div class="manual-article-title">${article.title || 'Ohne Titel'}</div>
        <div class="muted small">
          ${article.source || 'Unbekannte Quelle'} · ${article.publishedAt || 'Ohne Datum'}
        </div>
        <a href="${article.link}" target="_blank" rel="noreferrer">Zum Artikel</a>
      </div>
    `;
    manualArticles.appendChild(card);
  });
};

const fetchFeedPreview = async (feed) => {
  const response = await fetch(`/api/news/preview?url=${encodeURIComponent(feed.url)}`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Feed konnte nicht geladen werden.');
  }
  return {
    feed,
    source: data.feed?.title || feed.name || feed.url,
    items: data.items || [],
  };
};

const loadArticles = async () => {
  const topicId = topicSelect.value;
  if (!topicId) {
    setStatus(manualStatus, 'Bitte zuerst ein Thema auswählen.', 'danger');
    return;
  }
  const feeds = readStored(FEED_STORAGE_KEY).filter(
    (feed) => feed.active && feed.topicId === topicId
  );
  if (!feeds.length) {
    setStatus(manualStatus, 'Keine aktiven Feeds für dieses Thema.', 'danger');
    state.articles = [];
    renderArticles();
    return;
  }
  setStatus(manualStatus, 'Lade Artikel ...');
  loadArticlesButton.disabled = true;
  try {
    const results = await Promise.all(feeds.map((feed) => fetchFeedPreview(feed)));
    const merged = results.flatMap((result) =>
      (result.items || []).map((item) => ({
        id: `${result.feed.id}-${item.link || item.title}`,
        title: item.title,
        link: item.link,
        summary: item.summary,
        publishedAt: item.publishedAt,
        source: result.source,
      }))
    );
    state.articles = merged
      .filter((item) => item.link)
      .sort((a, b) => {
        const aTime = a.publishedAt ? Date.parse(a.publishedAt) : 0;
        const bTime = b.publishedAt ? Date.parse(b.publishedAt) : 0;
        return bTime - aTime;
      })
      .slice(0, 20);
    renderArticles();
    setStatus(manualStatus, `${state.articles.length} Artikel geladen.`);
  } catch (error) {
    setStatus(manualStatus, error.message, 'danger');
    state.articles = [];
    renderArticles();
  } finally {
    loadArticlesButton.disabled = false;
  }
};

const getMode = () => modeInputs.find((input) => input.checked)?.value;

const updateMode = () => {
  const mode = getMode();
  manualPanel.classList.toggle('hidden', mode !== 'manual');
};

modeInputs.forEach((input) => {
  input.addEventListener('change', updateMode);
});

loadArticlesButton.addEventListener('click', loadArticles);

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const topicId = topicSelect.value;
  const mode = getMode();
  if (!topicId || !mode) {
    setStatus(generatorStatus, 'Bitte Thema und Modus auswählen.', 'danger');
    return;
  }

  const payload = { topicId, mode };
  if (mode === 'manual') {
    const selected = document.querySelector('input[name="article-choice"]:checked');
    if (!selected) {
      setStatus(generatorStatus, 'Bitte einen RSS-Artikel auswählen.', 'danger');
      return;
    }
    const article = state.articles.find((item) => item.id === selected.value);
    if (!article) {
      setStatus(generatorStatus, 'Artikel konnte nicht gefunden werden.', 'danger');
      return;
    }
    payload.article = article;
  } else {
    payload.feeds = readStored(FEED_STORAGE_KEY);
  }

  setStatus(generatorStatus, 'Generiere Entwurf ...');
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  try {
    const res = await fetch('/api/drafts/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Generierung fehlgeschlagen');
    }
    setStatus(generatorStatus, 'Entwurf erstellt. Du findest ihn unter "Entwürfe".');
  } catch (error) {
    setStatus(generatorStatus, error.message, 'danger');
  } finally {
    submitButton.disabled = false;
  }
});

loadTopics();
updateMode();
