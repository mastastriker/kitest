const themeSelect = document.getElementById('theme-select');
const manualPanel = document.getElementById('manual-panel');
const rssUrlInput = document.getElementById('rss-url');
const loadFeedButton = document.getElementById('load-feed');
const rssItemsContainer = document.getElementById('rss-items');
const rssFeedback = document.getElementById('rss-feedback');
const generateButton = document.getElementById('generate-button');
const draftResult = document.getElementById('draft-result');

const THEMES = [
  { id: 'crypto', label: 'crypto' },
  { id: 'camping', label: 'camping' },
];

const state = {
  mode: 'auto',
  rssItems: [],
  selectedItem: null,
};

function loadThemes() {
  themeSelect.innerHTML = '';
  THEMES.forEach((theme) => {
    const option = document.createElement('option');
    option.value = theme.id;
    option.textContent = theme.label;
    themeSelect.appendChild(option);
  });
}

function setMode(mode) {
  state.mode = mode;
  manualPanel.classList.toggle('is-hidden', mode !== 'manual');
  if (mode !== 'manual') {
    state.selectedItem = null;
    rssItemsContainer.innerHTML = '';
    rssFeedback.textContent = '';
  }
}

async function loadFeed() {
  const url = rssUrlInput.value.trim();
  if (!url) {
    rssFeedback.textContent = 'Bitte eine RSS-URL eingeben.';
    return;
  }
  rssFeedback.textContent = 'RSS-Feed wird geladen ...';
  rssItemsContainer.innerHTML = '';
  try {
    const res = await fetch(`/api/news/preview?url=${encodeURIComponent(url)}`);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Feed konnte nicht geladen werden.');
    }
    state.rssItems = data.items || [];
    renderRssItems();
    rssFeedback.textContent = data.feed?.title
      ? `Feed: ${data.feed.title}`
      : 'Feed geladen.';
  } catch (err) {
    rssFeedback.textContent = `Fehler: ${err.message}`;
  }
}

function renderRssItems() {
  if (!state.rssItems.length) {
    rssItemsContainer.innerHTML = '<p class="muted">Keine Artikel gefunden.</p>';
    return;
  }
  rssItemsContainer.innerHTML = '';
  state.rssItems.forEach((item) => {
    const card = document.createElement('article');
    card.className = 'news-item';
    card.innerHTML = `
      <h3></h3>
      <p class="muted small"></p>
      <a href="${item.link}" target="_blank" rel="noreferrer">Quelle öffnen</a>
      <div class="inline-actions"></div>
    `;
    card.querySelector('h3').textContent = item.title || 'Ohne Titel';
    card.querySelector('.muted').textContent = item.publishedAt || '';
    const actions = card.querySelector('.inline-actions');
    const selectButton = document.createElement('button');
    selectButton.type = 'button';
    selectButton.textContent =
      state.selectedItem?.link === item.link ? 'Ausgewählt' : 'Auswählen';
    selectButton.disabled = state.selectedItem?.link === item.link;
    selectButton.addEventListener('click', () => {
      state.selectedItem = item;
      renderRssItems();
    });
    actions.appendChild(selectButton);
    rssItemsContainer.appendChild(card);
  });
}

async function generateDraft() {
  draftResult.textContent = 'Entwurf wird generiert ...';
  generateButton.disabled = true;
  try {
    if (state.mode === 'manual' && !state.selectedItem) {
      throw new Error('Bitte zuerst einen RSS-Artikel auswählen.');
    }
    const res = await fetch('/api/post-drafts/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        theme: themeSelect.value,
        mode: state.mode,
        item: state.mode === 'manual' ? state.selectedItem : undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Generierung fehlgeschlagen.');
    }
    renderDraftResult(data);
  } catch (err) {
    draftResult.textContent = `Fehler: ${err.message}`;
  } finally {
    generateButton.disabled = false;
  }
}

function renderDraftResult(payload) {
  if (!payload?.draft) {
    draftResult.textContent = 'Kein Entwurf erzeugt.';
    return;
  }
  const draft = payload.draft;
  const source = payload.source || {};
  draftResult.innerHTML = `
    <article class="post-card">
      <div class="post-card-head">
        <div>
          <div class="post-topic">${draft.theme}</div>
          <div class="muted small">${draft.source_type}</div>
        </div>
      </div>
      <div class="post-text"></div>
      <div class="draft-meta muted small"></div>
    </article>
  `;
  const textEl = draftResult.querySelector('.post-text');
  textEl.textContent = draft.content;
  const meta = draftResult.querySelector('.draft-meta');
  const details = [];
  if (source.title) {
    details.push(`Quelle: ${source.title}`);
  }
  if (source.link) {
    details.push(source.link);
  }
  if (details.length) {
    meta.textContent = details.join(' · ');
  }
}

document.querySelectorAll('input[name="mode"]').forEach((input) => {
  input.addEventListener('change', (event) => setMode(event.target.value));
});

loadFeedButton.addEventListener('click', loadFeed);
generateButton.addEventListener('click', generateDraft);

loadThemes();
setMode('auto');
