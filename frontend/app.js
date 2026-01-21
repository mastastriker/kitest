const topicsContainer = document.getElementById('topics');
const topicForm = document.getElementById('topic-form');
const topicNameInput = document.getElementById('topic-name');
const refreshButton = document.getElementById('refresh-topics');

const state = {
  topics: [],
  posts: {}, // topicId -> posts[]
};

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
    delete state.posts[topicId];
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

refreshButton.addEventListener('click', loadTopics);

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
    state.topics.forEach((topic) => loadPosts(topic.id));
  } catch (err) {
    topicsContainer.innerHTML = `<p class="muted">Fehler beim Laden: ${err.message}</p>`;
  }
}

async function loadPosts(topicId) {
  const slot = document.querySelector(`[data-posts="${topicId}"]`);
  if (slot) slot.innerHTML = '<p class="muted">Lade Beiträge ...</p>';
  try {
    const res = await fetch(`/api/topics/${topicId}/posts`);
    const data = await res.json();
    state.posts[topicId] = data.posts || [];
    renderPosts(topicId);
  } catch (err) {
    if (slot) slot.innerHTML = `<p class="muted">Fehler: ${err.message}</p>`;
  }
}

async function generatePosts(topicId, button) {
  button.disabled = true;
  button.textContent = 'Generiere ...';
  try {
    const res = await fetch(`/api/topics/${topicId}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count: 3 }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Generierung fehlgeschlagen');
    }
    state.posts[topicId] = data.posts || [];
    renderPosts(topicId);
  } catch (err) {
    alert(err.message);
  } finally {
    button.disabled = false;
    button.textContent = 'Beiträge generieren';
  }
}

async function deletePost(topicId, postId, button) {
  if (!postId) return;
  button.disabled = true;
  try {
    const res = await fetch(`/api/posts/${postId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Löschen fehlgeschlagen');
    }
    state.posts[topicId] = (state.posts[topicId] || []).filter((p) => p.id !== postId);
    renderPosts(topicId);
  } catch (err) {
    alert(err.message);
  } finally {
    button.disabled = false;
  }
}

function renderTopic(topic) {
  const card = document.createElement('article');
  card.className = 'topic-card';
  card.dataset.topic = topic.id;
  card.innerHTML = `
    <div class="topic-header">
      <div>
        <div class="topic-name">${topic.name}</div>
        <div class="muted">ID: ${topic.id}</div>
      </div>
      <div class="topic-actions">
        <button type="button" class="ghost danger" data-action="delete">Thema löschen</button>
        <button type="button" data-action="generate">Beiträge generieren</button>
      </div>
    </div>
    <div class="posts" data-posts="${topic.id}"></div>
  `;

  const generateButton = card.querySelector('button[data-action="generate"]');
  const deleteButton = card.querySelector('button[data-action="delete"]');
  generateButton.addEventListener('click', () => generatePosts(topic.id, generateButton));
  deleteButton.addEventListener('click', () => deleteTopic(topic.id, deleteButton));
  topicsContainer.appendChild(card);
}

function renderPosts(topicId) {
  const container = document.querySelector(`[data-posts="${topicId}"]`);
  if (!container) return;
  const posts = state.posts[topicId] || [];
  if (!posts.length) {
    container.innerHTML = '<p class="muted">Keine Beiträge vorhanden.</p>';
    return;
  }
  container.innerHTML = '';
  posts.forEach((post) => {
    const div = document.createElement('div');
    div.className = 'post';

    const text = document.createElement('div');
    text.className = 'post-text';
    text.textContent = post.text || post;
    div.appendChild(text);

    if (post.id) {
      const actions = document.createElement('div');
      actions.className = 'post-actions';
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'ghost danger';
      delBtn.textContent = 'Löschen';
      delBtn.addEventListener('click', () => deletePost(topicId, post.id, delBtn));
      actions.appendChild(delBtn);
      div.appendChild(actions);
    }

    container.appendChild(div);
  });
}

loadTopics();
