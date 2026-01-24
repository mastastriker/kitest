const topicsContainer = document.getElementById('topics');
const topicForm = document.getElementById('topic-form');
const topicNameInput = document.getElementById('topic-name');
const newsSourceForm = document.getElementById('news-source-form');
const newsSourceNameInput = document.getElementById('news-source-name');
const newsSourceUrlInput = document.getElementById('news-source-url');
const newsSourceActiveInput = document.getElementById('news-source-active');
const newsSourceTopicsContainer = document.getElementById('news-source-topics');
const newsSourcesContainer = document.getElementById('news-sources');

const state = {
  topics: [],
  properties: [],
  newsSources: [],
};

async function saveTopic(topicId, updates, button) {
  button.disabled = true;
  try {
    const res = await fetch(`/api/topics/${topicId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Speichern fehlgeschlagen');
    }
    state.topics = state.topics.map((topic) => (topic.id === topicId ? data.topic : topic));
    return data.topic;
  } catch (err) {
    alert(err.message);
    return null;
  } finally {
    button.disabled = false;
  }
}

async function deleteTopic(topicId, button) {
  if (!topicId) return;
  if (!window.confirm('Thema wirklich löschen? Alle Beiträge dazu werden entfernt.')) {
    return;
  }
  button.disabled = true;
  try {
    const res = await fetch(`/api/topics/${topicId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Löschen fehlgeschlagen');
    }
    state.topics = state.topics.filter((t) => t.id !== topicId);
    const card = document.querySelector(`[data-topic="${topicId}"]`);
    if (card) card.remove();
    if (!state.topics.length) {
      topicsContainer.innerHTML = '<p class="muted">Noch keine Themen angelegt.</p>';
    }
  } catch (err) {
    alert(err.message);
  } finally {
    button.disabled = false;
  }
}

topicForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = topicNameInput.value.trim();
  if (!name) return;

  const button = topicForm.querySelector('button');
  button.disabled = true;
  try {
    const res = await fetch('/api/topics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error('Thema konnte nicht angelegt werden');
    topicNameInput.value = '';
    await loadTopics();
  } catch (err) {
    alert(err.message);
  } finally {
    button.disabled = false;
  }
});

async function loadTopics() {
  topicsContainer.innerHTML = '<p class="muted">Lade Themen ...</p>';
  try {
    const res = await fetch('/api/topics');
    const data = await res.json();
    state.topics = data.topics || [];
    topicsContainer.innerHTML = '';
    if (!state.topics.length) {
      topicsContainer.innerHTML = '<p class="muted">Noch keine Themen angelegt.</p>';
      return;
    }
    state.topics.forEach((topic) => renderTopic(topic));
    renderNewsSourceTopicOptions();
  } catch (err) {
    topicsContainer.innerHTML = `<p class="muted">Fehler beim Laden: ${err.message}</p>`;
  }
}

async function loadProperties() {
  try {
    const res = await fetch('/api/post-properties');
    const data = await res.json();
    state.properties = data.properties || [];
  } catch (err) {
    state.properties = [];
  }
}

function renderTopic(topic) {
  const card = document.createElement('article');
  card.className = 'topic-card';
  card.dataset.topic = topic.id;
  const selectedProperties = new Set(topic.postProperties || []);
  const propertyOptions = state.properties
    .map(
      (property) => `
        <label class="property-item">
          <input type="checkbox" data-property="${property.id}" ${
            selectedProperties.has(property.id) ? 'checked' : ''
          } />
          <span>${property.label}</span>
        </label>
      `
    )
    .join('');
  const propertiesBody = propertyOptions
    ? `<div class="properties-grid">${propertyOptions}</div>`
    : '<p class="muted small">Keine Eigenschaften verfügbar.</p>';
  card.innerHTML = `
    <div class="topic-header">
      <div class="topic-meta">
        <label class="inline-field">
          Themenname
          <input type="text" class="topic-name-input" />
        </label>
      </div>
      <div class="topic-actions">
        <button type="button" class="ghost" data-action="save-topic">Name speichern</button>
        <button type="button" class="ghost danger" data-action="delete">Thema löschen</button>
      </div>
    </div>
    <div class="topic-properties">
      <div class="properties-head">Post-Eigenschaften</div>
      ${propertiesBody}
      <div class="properties-actions">
        <button type="button" class="ghost" data-action="save-properties">
          Eigenschaften speichern
        </button>
      </div>
    </div>
  `;

  const nameInput = card.querySelector('.topic-name-input');
  nameInput.value = topic.name || '';

  const deleteButton = card.querySelector('button[data-action="delete"]');
  const saveTopicButton = card.querySelector('button[data-action="save-topic"]');
  const savePropertiesButton = card.querySelector('button[data-action="save-properties"]');

  deleteButton.addEventListener('click', () => deleteTopic(topic.id, deleteButton));
  saveTopicButton.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    if (!name) {
      alert('Bitte einen gültigen Themennamen eingeben.');
      return;
    }
    const updated = await saveTopic(topic.id, { name }, saveTopicButton);
    if (updated) {
      nameInput.value = updated.name;
    }
  });
  savePropertiesButton.addEventListener('click', async () => {
    const selected = Array.from(card.querySelectorAll('input[data-property]:checked')).map(
      (input) => input.dataset.property
    );
    await saveTopic(topic.id, { postProperties: selected }, savePropertiesButton);
  });
  topicsContainer.appendChild(card);
}

function renderNewsSourceTopicOptions(selected = []) {
  if (!newsSourceTopicsContainer) return;
  if (!state.topics.length) {
    newsSourceTopicsContainer.innerHTML = '<p class="muted small">Noch keine Themen vorhanden.</p>';
    return;
  }
  const selectedSet = new Set(selected);
  newsSourceTopicsContainer.innerHTML = state.topics
    .map(
      (topic) => `
        <label class="property-item">
          <input type="checkbox" data-news-topic="${topic.id}" ${
            selectedSet.has(topic.id) ? 'checked' : ''
          } />
          <span>${topic.name}</span>
        </label>
      `
    )
    .join('');
}

function getSelectedNewsTopics(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll('input[data-news-topic]:checked')).map(
    (input) => input.dataset.newsTopic
  );
}

async function loadNewsSources() {
  if (!newsSourcesContainer) return;
  newsSourcesContainer.innerHTML = '<p class="muted">Lade News-Quellen ...</p>';
  try {
    const res = await fetch('/api/news-sources');
    const data = await res.json();
    state.newsSources = data.sources || [];
    newsSourcesContainer.innerHTML = '';
    if (!state.newsSources.length) {
      newsSourcesContainer.innerHTML = '<p class="muted">Noch keine News-Quellen angelegt.</p>';
      return;
    }
    state.newsSources.forEach((source) => renderNewsSource(source));
  } catch (err) {
    newsSourcesContainer.innerHTML = `<p class="muted">Fehler beim Laden: ${err.message}</p>`;
  }
}

async function saveNewsSource(sourceId, updates, button) {
  button.disabled = true;
  try {
    const res = await fetch(`/api/news-sources/${sourceId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Speichern fehlgeschlagen');
    }
    state.newsSources = state.newsSources.map((source) =>
      source.id === sourceId ? data.source : source
    );
    return data.source;
  } catch (err) {
    alert(err.message);
    return null;
  } finally {
    button.disabled = false;
  }
}

async function deleteNewsSource(sourceId, button) {
  if (!sourceId) return;
  if (!window.confirm('News-Quelle wirklich löschen? Zugehörige News werden entfernt.')) {
    return;
  }
  button.disabled = true;
  try {
    const res = await fetch(`/api/news-sources/${sourceId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Löschen fehlgeschlagen');
    }
    state.newsSources = state.newsSources.filter((source) => source.id !== sourceId);
    const card = document.querySelector(`[data-news-source="${sourceId}"]`);
    if (card) card.remove();
    if (!state.newsSources.length) {
      newsSourcesContainer.innerHTML = '<p class="muted">Noch keine News-Quellen angelegt.</p>';
    }
  } catch (err) {
    alert(err.message);
  } finally {
    button.disabled = false;
  }
}

function renderNewsSource(source) {
  const card = document.createElement('article');
  card.className = 'topic-card';
  card.dataset.newsSource = source.id;
  const selectedTopics = new Set(source.topicIds || []);
  const topicOptions = state.topics.length
    ? state.topics
        .map(
          (topic) => `
          <label class="property-item">
            <input type="checkbox" data-news-topic="${topic.id}" ${
              selectedTopics.has(topic.id) ? 'checked' : ''
            } />
            <span>${topic.name}</span>
          </label>
        `
        )
        .join('')
    : '<p class="muted small">Keine Themen verfügbar.</p>';
  const statusText = source.lastStatus ? `Letzter Abruf: ${source.lastStatus}` : 'Noch kein Abruf.';
  const fetchedText = source.lastFetchedAt
    ? new Date(source.lastFetchedAt).toLocaleString('de-DE')
    : '—';
  card.innerHTML = `
    <div class="topic-header">
      <div class="topic-meta">
        <label class="inline-field">
          Quellenname
          <input type="text" class="news-source-name" />
        </label>
        <label class="inline-field">
          Feed-URL
          <input type="url" class="news-source-url" />
        </label>
        <label class="inline-field">
          Aktiv
          <input type="checkbox" class="news-source-active" />
        </label>
      </div>
      <div class="topic-actions">
        <button type="button" class="ghost" data-action="save-news">Quelle speichern</button>
        <button type="button" class="ghost danger" data-action="delete-news">Quelle löschen</button>
      </div>
    </div>
    <div class="topic-properties">
      <div class="properties-head">Zugeordnete Themen</div>
      <div class="properties-grid">${topicOptions}</div>
      <p class="muted small">${statusText} (${fetchedText})</p>
      <div class="properties-actions">
        <button type="button" class="ghost" data-action="save-topics">
          Themen speichern
        </button>
      </div>
    </div>
  `;

  const nameInput = card.querySelector('.news-source-name');
  const urlInput = card.querySelector('.news-source-url');
  const activeInput = card.querySelector('.news-source-active');
  nameInput.value = source.name || '';
  urlInput.value = source.url || '';
  activeInput.checked = Boolean(source.active);

  const saveButton = card.querySelector('[data-action="save-news"]');
  const deleteButton = card.querySelector('[data-action="delete-news"]');
  const saveTopicsButton = card.querySelector('[data-action="save-topics"]');

  saveButton.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    const url = urlInput.value.trim();
    if (!name || !url) {
      alert('Bitte Namen und URL angeben.');
      return;
    }
    const updated = await saveNewsSource(
      source.id,
      {
        name,
        url,
        active: activeInput.checked,
      },
      saveButton
    );
    if (updated) {
      nameInput.value = updated.name;
      urlInput.value = updated.url;
      activeInput.checked = Boolean(updated.active);
    }
  });

  saveTopicsButton.addEventListener('click', async () => {
    const selected = getSelectedNewsTopics(card);
    await saveNewsSource(source.id, { topicIds: selected }, saveTopicsButton);
  });

  deleteButton.addEventListener('click', () => deleteNewsSource(source.id, deleteButton));
  newsSourcesContainer.appendChild(card);
}

if (newsSourceForm) {
  newsSourceForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = newsSourceNameInput.value.trim();
    const url = newsSourceUrlInput.value.trim();
    if (!name || !url) return;
    const button = newsSourceForm.querySelector('button');
    button.disabled = true;
    try {
      const res = await fetch('/api/news-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          url,
          active: newsSourceActiveInput.checked,
          topicIds: getSelectedNewsTopics(newsSourceTopicsContainer),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Quelle konnte nicht angelegt werden');
      }
      newsSourceNameInput.value = '';
      newsSourceUrlInput.value = '';
      newsSourceActiveInput.checked = true;
      renderNewsSourceTopicOptions();
      await loadNewsSources();
    } catch (err) {
      alert(err.message);
    } finally {
      button.disabled = false;
    }
  });
}

async function init() {
  await loadProperties();
  await loadTopics();
  await loadNewsSources();
}

init();
