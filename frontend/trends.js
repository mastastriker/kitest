const trendForm = document.getElementById('trend-form');
const topicSelect = document.getElementById('trend-topic');
const trendList = document.getElementById('trend-list');
const trendStatus = document.getElementById('trend-status');
const trendPrompt = document.getElementById('trend-prompt');

const state = {
  topics: [],
};

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
          throw new Error(data.error || 'Post-Erstellung fehlgeschlagen');
        }
        setStatus('Entwurf erstellt. Auf der Startseite verfügbar.');
      } catch (err) {
        setStatus(`Fehler: ${err.message}`);
      } finally {
        button.disabled = false;
      }
    });
    item.appendChild(text);
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
    setStatus('');
  } catch (err) {
    setStatus(`Fehler: ${err.message}`);
  } finally {
    button.disabled = false;
  }
});

loadTopics();
