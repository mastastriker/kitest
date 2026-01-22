const topicsContainer = document.getElementById('topics');
const topicForm = document.getElementById('topic-form');
const topicNameInput = document.getElementById('topic-name');

const state = {
  topics: [],
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

function renderTopic(topic) {
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
      </div>
      <div class="topic-actions">
        <button type="button" class="ghost" data-action="save-topic">Name speichern</button>
        <button type="button" class="ghost danger" data-action="delete">Thema löschen</button>
      </div>
    </div>
    <div class="topic-prompts">
      <div class="prompt-grid">
        <label>
          System Prompt
          <textarea class="prompt-input" data-prompt="system" rows="4"></textarea>
        </label>
        <label>
          User Prompt Template
          <textarea class="prompt-input" data-prompt="user" rows="4"></textarea>
        </label>
      </div>
      <p class="muted small">Platzhalter: {{topic}} für Thema, {{count}} für Anzahl.</p>
      <div class="prompt-actions">
        <button type="button" class="ghost" data-action="save-prompts">Prompts speichern</button>
      </div>
    </div>
  `;

  const nameInput = card.querySelector('.topic-name-input');
  nameInput.value = topic.name || '';

  const systemPrompt = card.querySelector('[data-prompt="system"]');
  const userPrompt = card.querySelector('[data-prompt="user"]');
  systemPrompt.value = topic.prompts?.system || '';
  userPrompt.value = topic.prompts?.user || '';

  const deleteButton = card.querySelector('button[data-action="delete"]');
  const saveTopicButton = card.querySelector('button[data-action="save-topic"]');
  const savePromptsButton = card.querySelector('button[data-action="save-prompts"]');

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
  savePromptsButton.addEventListener('click', async () => {
    const system = systemPrompt.value.trim();
    const user = userPrompt.value.trim();
    if (!system || !user) {
      alert('Bitte beide Prompts ausfüllen.');
      return;
    }
    const updated = await saveTopic(
      topic.id,
      { prompts: { system, user } },
      savePromptsButton
    );
    if (updated) {
      systemPrompt.value = updated.prompts?.system || system;
      userPrompt.value = updated.prompts?.user || user;
    }
  });
  topicsContainer.appendChild(card);
}

loadTopics();
