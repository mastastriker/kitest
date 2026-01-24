const topicsContainer = document.getElementById('topics');
const topicForm = document.getElementById('topic-form');
const topicNameInput = document.getElementById('topic-name');

const state = {
  topics: [],
  properties: [],
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
  const selectedCount = selectedProperties.size;
  const totalCount = state.properties.length;
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
    <details class="topic-properties">
      <summary class="properties-summary">
        <span>Post-Eigenschaften</span>
        <span class="muted small properties-count">${selectedCount} / ${totalCount} ausgewählt</span>
      </summary>
      <div class="properties-body">
        ${propertiesBody}
        <div class="properties-actions">
          <button type="button" class="ghost" data-action="save-properties">
            Eigenschaften speichern
          </button>
        </div>
      </div>
    </details>
  `;

  const nameInput = card.querySelector('.topic-name-input');
  nameInput.value = topic.name || '';

  const deleteButton = card.querySelector('button[data-action="delete"]');
  const saveTopicButton = card.querySelector('button[data-action="save-topic"]');
  const savePropertiesButton = card.querySelector('button[data-action="save-properties"]');
  const propertiesCount = card.querySelector('.properties-count');

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
  card.querySelectorAll('input[data-property]').forEach((input) => {
    input.addEventListener('change', () => {
      if (!propertiesCount) return;
      const nextCount = card.querySelectorAll('input[data-property]:checked').length;
      propertiesCount.textContent = `${nextCount} / ${totalCount} ausgewählt`;
    });
  });
  topicsContainer.appendChild(card);
}

async function init() {
  await loadProperties();
  await loadTopics();
}

init();
