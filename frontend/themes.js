const themesContainer = document.getElementById('themes');
const themeForm = document.getElementById('theme-form');
const themeNameInput = document.getElementById('theme-name');
const themeCount = document.getElementById('theme-count');

const state = {
  topics: [],
};

async function saveTheme(topicId, updates, button) {
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

async function deleteTheme(topicId, button) {
  if (!topicId) return;
  if (!window.confirm('Thema wirklich löschen? Alle Entwürfe dazu werden entfernt.')) {
    return;
  }
  button.disabled = true;
  try {
    const res = await fetch(`/api/topics/${topicId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Löschen fehlgeschlagen');
    }
    state.topics = state.topics.filter((topic) => topic.id !== topicId);
    renderThemes();
  } catch (err) {
    alert(err.message);
  } finally {
    button.disabled = false;
  }
}

themeForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = themeNameInput.value.trim();
  if (!name) return;

  const button = themeForm.querySelector('button');
  button.disabled = true;
  try {
    const res = await fetch('/api/topics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error('Thema konnte nicht angelegt werden');
    themeNameInput.value = '';
    await loadThemes();
  } catch (err) {
    alert(err.message);
  } finally {
    button.disabled = false;
  }
});

async function loadThemes() {
  themesContainer.innerHTML = '<p class="muted">Lade Themen ...</p>';
  try {
    const res = await fetch('/api/topics');
    const data = await res.json();
    state.topics = data.topics || [];
    renderThemes();
  } catch (err) {
    themesContainer.innerHTML = `<p class="muted">Fehler beim Laden: ${err.message}</p>`;
  }
}

function renderThemes() {
  themeCount.textContent = `${state.topics.length} Themen`;
  if (!state.topics.length) {
    themesContainer.innerHTML = '<p class="muted">Noch keine Themen angelegt.</p>';
    return;
  }
  themesContainer.innerHTML = '';
  state.topics.forEach((topic) => {
    const card = document.createElement('article');
    card.className = 'topic-card';
    card.dataset.topic = topic.id;
    card.innerHTML = `
      <div class="topic-header">
        <div class="topic-meta">
          <label class="inline-field">
            Themenname
            <input type="text" class="topic-name-input" />
          </label>
          <label class="inline-field checkbox-field">
            <input type="checkbox" class="topic-active-input" />
            Aktiv
          </label>
        </div>
        <div class="topic-actions">
          <button type="button" class="ghost" data-action="save-topic">Speichern</button>
          <button type="button" class="ghost danger" data-action="delete">Löschen</button>
        </div>
      </div>
    `;
    const nameInput = card.querySelector('.topic-name-input');
    const activeInput = card.querySelector('.topic-active-input');
    nameInput.value = topic.name || '';
    activeInput.checked = topic.is_active;

    const saveButton = card.querySelector('button[data-action="save-topic"]');
    const deleteButton = card.querySelector('button[data-action="delete"]');

    saveButton.addEventListener('click', async () => {
      const name = nameInput.value.trim();
      if (!name) {
        alert('Bitte einen gültigen Themennamen eingeben.');
        return;
      }
      const updated = await saveTheme(
        topic.id,
        { name, is_active: activeInput.checked },
        saveButton
      );
      if (updated) {
        nameInput.value = updated.name;
        activeInput.checked = updated.is_active;
      }
    });
    deleteButton.addEventListener('click', () => deleteTheme(topic.id, deleteButton));
    themesContainer.appendChild(card);
  });
}

loadThemes();
