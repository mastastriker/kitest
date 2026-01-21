const topicsContainer = document.getElementById('topics');
const topicForm = document.getElementById('topic-form');
const topicNameInput = document.getElementById('topic-name');
const refreshButton = document.getElementById('refresh-topics');

const state = {
  topics: [],
  posts: {}, // topicId -> posts[]
};

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

function renderTopic(topic) {
  const card = document.createElement('article');
  card.className = 'topic-card';
  card.innerHTML = `
    <div class="topic-header">
      <div>
        <div class="topic-name">${topic.name}</div>
        <div class="muted">ID: ${topic.id}</div>
      </div>
      <button type="button">Beiträge generieren</button>
    </div>
    <div class="posts" data-posts="${topic.id}"></div>
  `;

  const generateButton = card.querySelector('button');
  generateButton.addEventListener('click', () => generatePosts(topic.id, generateButton));
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
    div.textContent = post.text || post;
    container.appendChild(div);
  });
}

loadTopics();
