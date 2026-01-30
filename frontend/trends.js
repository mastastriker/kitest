const trendForm = document.getElementById('trend-form');
const topicSelect = document.getElementById('trend-topic');
const trendList = document.getElementById('trend-list');
const trendStatus = document.getElementById('trend-status');
const trendPrompt = document.getElementById('trend-prompt');

const THEMES = [
  { id: 'crypto', label: 'crypto' },
  { id: 'camping', label: 'camping' },
];

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
  if (saved.theme) {
    topicSelect.value = saved.theme;
  }
  if (saved.mode) {
    const modeInput = trendForm.querySelector(`input[name="trend-mode"][value="${saved.mode}"]`);
    if (modeInput) modeInput.checked = true;
  }
}

function restoreResults(saved) {
  if (!saved) return;
  renderTrends(saved.trends || []);
  renderPrompt(saved.prompt);
}

function loadThemes() {
  topicSelect.innerHTML = '<option value="">Thema auswählen ...</option>';
  THEMES.forEach((theme) => {
    const option = document.createElement('option');
    option.value = theme.id;
    option.textContent = theme.label;
    topicSelect.appendChild(option);
  });
  const saved = loadResults();
  restoreSelection(saved);
  restoreResults(saved);
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
    const info = document.createElement('div');
    info.className = 'trend-info';
    const text = document.createElement('span');
    text.textContent = trend;
    const link = document.createElement('a');
    link.className = 'trend-link';
    link.href = `https://news.google.com/search?q=${encodeURIComponent(trend)}`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Passenden Link öffnen';
    info.appendChild(text);
    info.appendChild(link);
    item.appendChild(info);
    trendList.appendChild(item);
  });
}

async function submitTrends(event) {
  event.preventDefault();
  const theme = topicSelect.value;
  const mode = getSelectedMode();
  if (!theme || !mode) {
    setStatus('Bitte Thema und Modus auswählen.');
    return;
  }
  setStatus('Trends werden geladen ...');
  try {
    const res = await fetch('/api/trends', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme, mode, count: 7 }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || data.error || 'Trends konnten nicht geladen werden');
    }
    renderTrends(data.trends || []);
    renderPrompt(data.prompt);
    saveResults({
      theme,
      mode,
      trends: data.trends || [],
      prompt: data.prompt,
    });
    setStatus('');
  } catch (err) {
    setStatus(`Fehler: ${err.message}`);
  }
}

trendForm.addEventListener('submit', submitTrends);
loadThemes();
