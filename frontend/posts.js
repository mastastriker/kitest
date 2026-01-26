const postsContainer = document.getElementById('posts');
const state = {
  posts: [],
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

function formatPrompt(promptText, prompt) {
  if (promptText) return promptText;
  if (!prompt) return 'Kein Prompt verfügbar.';
  const system = prompt.system || '';
  const user = prompt.user || '';
  return `System:\n${system}\n\nUser:\n${user}`.trim();
}

function renderPosts() {
  if (!state.posts.length) {
    postsContainer.innerHTML = '<p class="muted">Noch keine Beiträge vorhanden.</p>';
    return;
  }
  postsContainer.innerHTML = '';
  const grouped = state.posts.reduce((acc, post) => {
    const key = post.topicName || 'Ohne Thema';
    if (!acc[key]) acc[key] = [];
    acc[key].push(post);
    return acc;
  }, {});
  Object.entries(grouped).forEach(([topicName, posts]) => {
    const section = document.createElement('section');
    section.className = 'post-group';
    const header = document.createElement('div');
    header.className = 'post-group-head';
    const title = document.createElement('h3');
    title.textContent = topicName;
    header.appendChild(title);
    section.appendChild(header);
    const list = document.createElement('div');
    list.className = 'post-group-list';
    posts.forEach((post) => {
      const card = document.createElement('article');
      card.className = 'post-card';
      card.innerHTML = `
        <div class="post-card-head">
          <div class="post-topic">${post.topicName || 'Ohne Thema'}</div>
          <div class="post-actions"></div>
        </div>
        <div class="post-text"></div>
        <pre class="code-block"></pre>
      `;

      const text = card.querySelector('.post-text');
      text.textContent = post.generatedText || post.text || '';

      const actions = card.querySelector('.post-actions');
      const promptBlock = card.querySelector('.code-block');
      promptBlock.textContent = formatPrompt(post.promptText, post.prompt);
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

      list.appendChild(card);
    });
    section.appendChild(list);
    postsContainer.appendChild(section);
  });
}

loadPosts();
