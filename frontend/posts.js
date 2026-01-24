const postsContainer = document.getElementById('posts');
const topicsContainer = document.getElementById('topics-overview');
const generationTopicsContainer = document.getElementById('generation-topics');
const prepareButton = document.getElementById('prepare-generation');
const generationNewsContainer = document.getElementById('generation-news');
const generationCount = document.getElementById('generation-count');

const state = {
  posts: [],
  topics: [],
};

async function loadPosts() {
  postsContainer.innerHTML = '<p class="muted">Lade Beiträge ...</p>';
  try {
    const res = await fetch('/api/posts');
    const data = await res.json();
    state.posts = data.posts || [];
    renderPosts();
  } catch (err) {
    postsContainer.innerHTML = `<p class="muted">Fehler beim Laden: ${err.message}</p>`;
  }
}

async function loadTopics() {
  topicsContainer.innerHTML = '<p class="muted">Lade Themen ...</p>';
  try {
    const res = await fetch('/api/topics');
    const data = await res.json();
    state.topics = data.topics || [];
    renderTopics();
    renderGenerationTopics();
  } catch (err) {
    topicsContainer.innerHTML = `<p class="muted">Fehler beim Laden: ${err.message}</p>`;
  }
}

async function generatePost(topicId, button) {
  button.disabled = true;
  try {
    const res = await fetch(`/api/topics/${topicId}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count: 1 }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Generierung fehlgeschlagen');
    }
    await loadPosts();
  } catch (err) {
    alert(err.message);
  } finally {
    button.disabled = false;
  }
}

function renderTopics() {
  if (!state.topics.length) {
    topicsContainer.innerHTML = '<p class="muted">Noch keine Themen angelegt.</p>';
    return;
  }
  topicsContainer.innerHTML = '';
  state.topics.forEach((topic) => {
    const card = document.createElement('article');
    card.className = 'topic-card';
    card.innerHTML = `
      <div class="topic-header">
        <div class="topic-meta">
          <div class="topic-name">${topic.name || 'Unbenanntes Thema'}</div>
          <div class="muted small">Prompt-Templates hinterlegt: ${
            topic.prompts?.system && topic.prompts?.user ? 'Ja' : 'Nein'
          }</div>
        </div>
        <div class="topic-actions">
          <button type="button" class="ghost" data-action="generate">Post generieren</button>
        </div>
      </div>
    `;
    const generateButton = card.querySelector('[data-action="generate"]');
    generateButton.addEventListener('click', () => generatePost(topic.id, generateButton));
    topicsContainer.appendChild(card);
  });
}

function renderGenerationTopics() {
  if (!generationTopicsContainer) return;
  if (!state.topics.length) {
    generationTopicsContainer.innerHTML = '<p class="muted small">Noch keine Themen vorhanden.</p>';
    if (prepareButton) prepareButton.disabled = true;
    return;
  }
  generationTopicsContainer.innerHTML = state.topics
    .map(
      (topic) => `
        <label class="property-item">
          <input type="checkbox" data-generation-topic="${topic.id}" />
          <span>${topic.name}</span>
        </label>
      `
    )
    .join('');
  if (prepareButton) prepareButton.disabled = false;
}

function getSelectedGenerationTopics() {
  return Array.from(document.querySelectorAll('input[data-generation-topic]:checked')).map(
    (input) => input.dataset.generationTopic
  );
}

function renderGenerationNews(items) {
  if (!generationNewsContainer) return;
  generationNewsContainer.innerHTML = '';
  if (!items.length) {
    generationNewsContainer.innerHTML = '<p class="muted">Keine News für die Auswahl gefunden.</p>';
    if (generationCount) generationCount.textContent = '';
    return;
  }
  if (generationCount) generationCount.textContent = `${items.length} Treffer`;
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
    generationNewsContainer.appendChild(card);
  });
}

async function prepareGenerationNews() {
  const selectedTopics = getSelectedGenerationTopics();
  if (!selectedTopics.length) {
    alert('Bitte mindestens ein Thema auswählen.');
    return;
  }
  if (generationNewsContainer) {
    generationNewsContainer.innerHTML = '<p class="muted">News werden geladen ...</p>';
  }
  if (generationCount) generationCount.textContent = '';
  try {
    const res = await fetch('/api/news-items/filter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topicIds: selectedTopics }),
    });
    const data = await res.json();
    const items = data.items || [];
    const sorted = items.sort((a, b) => {
      const aTime = new Date(a.publishedAt || 0).getTime();
      const bTime = new Date(b.publishedAt || 0).getTime();
      return bTime - aTime;
    });
    renderGenerationNews(sorted);
  } catch (err) {
    if (generationNewsContainer) {
      generationNewsContainer.innerHTML = `<p class="muted">Fehler: ${err.message}</p>`;
    }
  }
}

async function deletePost(postId, button) {
  button.disabled = true;
  try {
    const res = await fetch(`/api/posts/${postId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Löschen fehlgeschlagen');
    }
    state.posts = state.posts.filter((post) => post.id !== postId);
    renderPosts();
  } catch (err) {
    alert(err.message);
  } finally {
    button.disabled = false;
  }
}

async function updatePost(postId, text, button) {
  button.disabled = true;
  try {
    const res = await fetch(`/api/posts/${postId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Speichern fehlgeschlagen');
    }
    state.posts = state.posts.map((post) => (post.id === postId ? data.post : post));
    renderPosts();
  } catch (err) {
    alert(err.message);
  } finally {
    button.disabled = false;
  }
}

function renderPosts() {
  if (!state.posts.length) {
    postsContainer.innerHTML = '<p class="muted">Noch keine Beiträge vorhanden.</p>';
    return;
  }
  postsContainer.innerHTML = '';
  state.posts.forEach((post) => {
    const card = document.createElement('article');
    card.className = 'post-card';
    card.innerHTML = `
      <div class="post-card-head">
        <div class="post-topic">${post.topicName || 'Ohne Thema'}</div>
        <div class="post-actions"></div>
      </div>
      <div class="post-text"></div>
    `;

    const text = card.querySelector('.post-text');
    text.textContent = post.text || '';

    const actions = card.querySelector('.post-actions');
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'ghost';
    editBtn.textContent = 'Bearbeiten';
    editBtn.addEventListener('click', () => {
      const textarea = document.createElement('textarea');
      textarea.className = 'post-input';
      textarea.rows = 4;
      textarea.value = post.text || '';
      text.innerHTML = '';
      text.appendChild(textarea);
      actions.innerHTML = '';
      const saveBtn = document.createElement('button');
      saveBtn.type = 'button';
      saveBtn.textContent = 'Speichern';
      saveBtn.addEventListener('click', () => {
        const nextText = textarea.value.trim();
        if (!nextText) {
          alert('Bitte einen gültigen Beitragstext eingeben.');
          return;
        }
        updatePost(post.id, nextText, saveBtn);
      });
      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'ghost';
      cancelBtn.textContent = 'Abbrechen';
      cancelBtn.addEventListener('click', () => renderPosts());
      actions.appendChild(saveBtn);
      actions.appendChild(cancelBtn);
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'ghost danger';
    deleteBtn.textContent = 'Löschen';
    deleteBtn.addEventListener('click', () => deletePost(post.id, deleteBtn));

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    postsContainer.appendChild(card);
  });
}

loadPosts();
loadTopics();

if (prepareButton) {
  prepareButton.addEventListener('click', prepareGenerationNews);
}
