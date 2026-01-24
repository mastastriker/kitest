const topicsContainer = document.getElementById('news-topics');
const loadButton = document.getElementById('load-news');
const resultsContainer = document.getElementById('news-results');
const countLabel = document.getElementById('news-count');

const state = {
  topics: [],
};

function renderTopics() {
  if (!state.topics.length) {
    topicsContainer.innerHTML = '<p class="muted small">Noch keine Themen vorhanden.</p>';
    loadButton.disabled = true;
    return;
  }
  topicsContainer.innerHTML = state.topics
    .map(
      (topic) => `
        <label class="property-item">
          <input type="checkbox" data-topic-id="${topic.id}" />
          <span>${topic.name}</span>
        </label>
      `
    )
    .join('');
  loadButton.disabled = false;
}

function getSelectedTopicIds() {
  return Array.from(document.querySelectorAll('input[data-topic-id]:checked')).map(
    (input) => input.dataset.topicId
  );
}

function renderNews(items) {
  resultsContainer.innerHTML = '';
  if (!items.length) {
    resultsContainer.innerHTML = '<p class="muted">Keine News für die Auswahl gefunden.</p>';
    countLabel.textContent = '';
    return;
  }
  countLabel.textContent = `${items.length} Treffer`;
  items.forEach((item) => {
    const card = document.createElement('article');
    card.className = 'post-card';
    const published = item.publishedAt
      ? new Date(item.publishedAt).toLocaleString('de-DE')
      : '—';
    const excerpt = item.content ? item.content.slice(0, 220) : '';
    card.innerHTML = `
      <div class="post-card-head">
        <div>
          <div class="post-topic">${item.title}</div>
          <div class="muted small">${item.sourceName || 'Unbekannte Quelle'}</div>
        </div>
        <div class="muted small">${published}</div>
      </div>
      <p class="muted">${excerpt || 'Kein Textauszug vorhanden.'}</p>
    `;
    resultsContainer.appendChild(card);
  });
}

async function loadTopics() {
  try {
    const res = await fetch('/api/topics');
    const data = await res.json();
    state.topics = data.topics || [];
    renderTopics();
  } catch (err) {
    topicsContainer.innerHTML = `<p class="muted">Fehler: ${err.message}</p>`;
    loadButton.disabled = true;
  }
}

async function loadNews() {
  const selectedTopics = getSelectedTopicIds();
  if (!selectedTopics.length) {
    alert('Bitte mindestens ein Thema auswählen.');
    return;
  }
  resultsContainer.innerHTML = '<p class="muted">News werden geladen ...</p>';
  countLabel.textContent = '';
  try {
    const responses = await Promise.all(
      selectedTopics.map((topicId) => fetch(`/api/news-items?topicId=${topicId}`))
    );
    const payloads = await Promise.all(responses.map((res) => res.json()));
    const items = payloads.flatMap((payload) => payload.items || []);
    const unique = new Map();
    items.forEach((item) => {
      unique.set(item.uniqueKey || item.id, item);
    });
    const sorted = Array.from(unique.values()).sort((a, b) => {
      const aTime = new Date(a.publishedAt || 0).getTime();
      const bTime = new Date(b.publishedAt || 0).getTime();
      return bTime - aTime;
    });
    renderNews(sorted);
  } catch (err) {
    resultsContainer.innerHTML = `<p class="muted">Fehler: ${err.message}</p>`;
  }
}

loadButton.addEventListener('click', loadNews);

loadTopics();
