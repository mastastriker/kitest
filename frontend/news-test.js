const form = document.getElementById('news-test-form');
const urlInput = document.getElementById('news-test-url');
const status = document.getElementById('news-test-status');
const itemsList = document.getElementById('news-test-items');
const output = document.getElementById('news-test-output');
const count = document.getElementById('news-test-count');

const setStatus = (message, tone = 'muted') => {
  status.textContent = message;
  status.classList.toggle('danger', tone === 'danger');
};

const renderItems = (items) => {
  itemsList.innerHTML = '';

  if (!items.length) {
    itemsList.textContent = 'Keine Artikel gefunden.';
    itemsList.classList.add('muted');
    count.textContent = '0 Artikel';
    return;
  }

  itemsList.classList.remove('muted');
  count.textContent = `${items.length} Artikel`;

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
    itemsList.appendChild(card);
  });
};

const fetchPreview = async (url) => {
  setStatus('Feed wird geladen ...');
  output.textContent = 'Lade Daten ...';
  try {
    const response = await fetch(`/api/news/preview?url=${encodeURIComponent(url)}`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Feed konnte nicht geladen werden.');
    }
    renderItems(data.items || []);
    output.textContent = JSON.stringify(data, null, 2);
    setStatus(`Feed geladen: ${data.feed?.title || data.sourceUrl}`);
  } catch (error) {
    setStatus(error.message, 'danger');
    renderItems([]);
    output.textContent = error.message;
  }
};

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const url = urlInput.value.trim();
  if (!url) {
    setStatus('Bitte eine URL angeben.', 'danger');
    return;
  }
  fetchPreview(url);
});
