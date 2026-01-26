const trendForm = document.getElementById('trend-form');
const topicSelect = document.getElementById('trend-topic');
const trendList = document.getElementById('trend-list');
const trendStatus = document.getElementById('trend-status');
const trendPrompt = document.getElementById('trend-prompt');

const state = {
  topics: [],
  postIds: {},
  promptTexts: {},
};

const STORAGE_KEY = 'trendResults';

function setStatus(message) {
  trendStatus.textContent = message;
}

function resetResults() {
  trendList.innerHTML = '';
}

function renderPrompt(prompt) {
  if (!trendPrompt) return;
  if (!prompt) {
    trendPrompt.textContent = 'Kein Prompt verfügbar.';
    return;
  }
  const system = prompt.system || '';
  const user = prompt.user || '';
  trendPrompt.textContent = `System:\n${system}\n\nUser:\n${user}`.trim();
}

function saveResults(payload) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    // ignore storage errors
  }
}

function loadResults() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

function restoreSelection(saved) {
  if (!saved) return;
  if (saved.topicId) {
    topicSelect.value = saved.topicId;
  }
  if (saved.mode) {
    const modeInput = trendForm.querySelector(`input[name="trend-mode"][value="${saved.mode}"]`);
    if (modeInput) modeInput.checked = true;
  }
}

function restoreResults(saved) {
  if (!saved) return;
  state.postIds = saved.postIds || {};
  state.promptTexts = saved.promptTexts || {};
  renderTrends(saved.trends || []);
  renderPrompt(saved.prompt);
}

async function loadTopics() {
  setStatus('Lade Themen ...');
  try {
    const res = await fetch('/api/topics');
    const data = await res.json();
    state.topics = data.topics || [];
    topicSelect.innerHTML = '<option value="">Thema auswählen ...</option>';
    if (!state.topics.length) {
      setStatus('Noch keine Themen angelegt.');
      return;
    }
    state.topics.forEach((topic) => {
      const option = document.createElement('option');
      option.value = topic.id;
      option.textContent = topic.name;
      topicSelect.appendChild(option);
    });
    setStatus('');
    const saved = loadResults();
    restoreSelection(saved);
    restoreResults(saved);
  } catch (err) {
    setStatus(`Fehler beim Laden: ${err.message}`);
  }
}

function getSelectedMode() {
  const checked = trendForm.querySelector('input[name="trend-mode"]:checked');
  return checked ? checked.value : null;
}

function renderTrends(trends) {
  resetResults();
  if (!trends.length) {
    const item = document.createElement('li');
    item.textContent = 'Keine Trends verfügbar.';
    trendList.appendChild(item);
    return;
  }
  trends.forEach((trend) => {
    const item = document.createElement('li');
    const text = document.createElement('span');
    text.textContent = trend;
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = 'X-Post-Prompt anzeigen';
    details.appendChild(summary);
    const textarea = document.createElement('textarea');
    textarea.className = 'post-input';
    textarea.rows = 6;
    const cachedPrompt = state.promptTexts[trend];
    if (cachedPrompt) {
      textarea.value = cachedPrompt;
    }
    details.addEventListener('toggle', async () => {
      if (!details.open || textarea.value.trim()) {
        return;
      }
      const topicId = topicSelect.value;
      if (!topicId) {
        setStatus('Bitte zuerst ein Thema auswählen.');
        return;
      }
      try {
        const res = await fetch('/api/trends/post/prompt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topicId, trend }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.detail || data.error || 'Prompt konnte nicht geladen werden');
        }
        textarea.value = data.prompt_text || '';
        state.promptTexts[trend] = textarea.value;
        saveResults({
          topicId,
          mode: getSelectedMode(),
          trends,
          prompt: loadResults()?.prompt,
          postIds: state.postIds,
          promptTexts: state.promptTexts,
        });
      } catch (err) {
        setStatus(`Fehler: ${err.message}`);
      }
    });
    details.appendChild(textarea);
    const updateButton = document.createElement('button');
    updateButton.type = 'button';
    updateButton.className = 'ghost';
    updateButton.textContent = 'X Post aktualisieren';
    updateButton.addEventListener('click', async () => {
      const postId = state.postIds[trend];
      if (!postId) {
        setStatus('Bitte zuerst einen X-Post erzeugen.');
        return;
      }
      const promptText = textarea.value.trim();
      if (!promptText) {
        setStatus('Bitte einen Prompt eingeben.');
        return;
      }
      updateButton.disabled = true;
      setStatus('Post wird aktualisiert ...');
      try {
        const res = await fetch(`/api/posts/${postId}/regenerate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt_text: promptText }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.detail || data.error || 'Aktualisierung fehlgeschlagen');
        }
        state.promptTexts[trend] = promptText;
        saveResults({
          topicId: topicSelect.value,
          mode: getSelectedMode(),
          trends,
          prompt: loadResults()?.prompt,
          postIds: state.postIds,
          promptTexts: state.promptTexts,
        });
        setStatus('Entwurf aktualisiert. Auf der Startseite verfügbar.');
      } catch (err) {
        setStatus(`Fehler: ${err.message}`);
      } finally {
        updateButton.disabled = false;
      }
    });
    details.appendChild(updateButton);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ghost';
    button.textContent = 'X Post erzeugen';
    button.addEventListener('click', async () => {
      const topicId = topicSelect.value;
      if (!topicId) {
        setStatus('Bitte zuerst ein Thema auswählen.');
        return;
      }
      button.disabled = true;
      setStatus('Post-Entwurf wird erzeugt ...');
      try {
        const res = await fetch('/api/trends/post', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topicId, trend }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.detail || data.error || 'Post-Erstellung fehlgeschlagen');
        }
        if (data.post?.id) {
          state.postIds[trend] = data.post.id;
        }
        if (data.post?.prompt_text) {
          textarea.value = data.post.prompt_text;
          state.promptTexts[trend] = data.post.prompt_text;
        }
        saveResults({
          topicId: topicSelect.value,
          mode: getSelectedMode(),
          trends,
          prompt: loadResults()?.prompt,
          postIds: state.postIds,
          promptTexts: state.promptTexts,
        });
        setStatus('Entwurf erstellt. Auf der Startseite verfügbar.');
      } catch (err) {
        setStatus(`Fehler: ${err.message}`);
      } finally {
        button.disabled = false;
      }
    });
    item.appendChild(text);
    item.appendChild(details);
    item.appendChild(button);
    trendList.appendChild(item);
  });
}

trendForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const topicId = topicSelect.value;
  const mode = getSelectedMode();
  if (!topicId || !mode) {
    setStatus('Bitte Thema und Modus auswählen.');
    return;
  }

  const button = trendForm.querySelector('button[type="submit"]');
  button.disabled = true;
  setStatus('Trends werden generiert ...');
  resetResults();

  try {
    const res = await fetch('/api/trends', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topicId, mode }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Generierung fehlgeschlagen');
    }
    renderTrends(data.trends || []);
    renderPrompt(data.prompt);
    saveResults({
      topicId,
      mode,
      trends: data.trends || [],
      prompt: data.prompt,
      postIds: state.postIds,
      promptTexts: state.promptTexts,
    });
    setStatus('');
  } catch (err) {
    setStatus(`Fehler: ${err.message}`);
  } finally {
    button.disabled = false;
  }
});

loadTopics();
