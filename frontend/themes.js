const themeList = document.getElementById('theme-list');
const themeCount = document.getElementById('theme-count');
const themeForm = document.getElementById('theme-form');
const themeKeyInput = document.getElementById('theme-key');
const themeNameInput = document.getElementById('theme-name');
const themeFormStatus = document.getElementById('theme-form-status');

const state = {
  themes: [],
};

const setFormStatus = (message, tone = 'muted') => {
  themeFormStatus.textContent = message;
  themeFormStatus.classList.toggle('danger', tone === 'danger');
};

const fetchThemes = async () => {
  themeList.innerHTML = '<p class="muted">Lade Themen ...</p>';
  const res = await fetch('/api/themes');
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Themen konnten nicht geladen werden.');
  }
  state.themes = data.themes || [];
  renderThemes();
};

const createTheme = async (payload) => {
  const res = await fetch('/api/themes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Thema konnte nicht angelegt werden.');
  }
  return data.theme;
};

const updateTheme = async (id, updates) => {
  const res = await fetch(`/api/themes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Thema konnte nicht aktualisiert werden.');
  }
  return data.theme;
};

const deleteTheme = async (id) => {
  const res = await fetch(`/api/themes/${id}`, { method: 'DELETE' });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Thema konnte nicht gelöscht werden.');
  }
  return data.theme;
};

const renderThemes = () => {
  themeCount.textContent = `${state.themes.length}`;
  if (!state.themes.length) {
    themeList.innerHTML = '<p class="muted">Noch keine Themen vorhanden.</p>';
    return;
  }
  themeList.innerHTML = '';
  state.themes.forEach((theme) => {
    const card = document.createElement('article');
    card.className = 'theme-card';

    const header = document.createElement('div');
    header.className = 'theme-card-head';
    const title = document.createElement('h3');
    title.textContent = theme.name;
    const key = document.createElement('div');
    key.className = 'muted small';
    key.textContent = `Key: ${theme.key}`;
    header.append(title, key);

    const status = document.createElement('span');
    status.className = `badge ${theme.active ? 'is-active' : 'is-inactive'}`;
    status.textContent = theme.active ? 'Aktiv' : 'Inaktiv';

    const meta = document.createElement('div');
    meta.className = 'theme-card-meta';
    meta.append(status);
    if (typeof theme.draft_count === 'number') {
      const draftInfo = document.createElement('span');
      draftInfo.className = 'muted small';
      draftInfo.textContent = `${theme.draft_count} Draft${theme.draft_count === 1 ? '' : 's'}`;
      meta.appendChild(draftInfo);
    }

    const actions = document.createElement('div');
    actions.className = 'inline-actions';

    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'ghost';
    editButton.textContent = 'Bearbeiten';
    editButton.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'text';
      input.value = theme.name;
      title.replaceWith(input);
      actions.innerHTML = '';
      const saveButton = document.createElement('button');
      saveButton.type = 'button';
      saveButton.textContent = 'Speichern';
      saveButton.addEventListener('click', async () => {
        try {
          const updated = await updateTheme(theme.id, { name: input.value });
          state.themes = state.themes.map((item) =>
            item.id === updated.id ? { ...item, ...updated } : item
          );
          renderThemes();
        } catch (error) {
          alert(error.message);
        }
      });
      const cancelButton = document.createElement('button');
      cancelButton.type = 'button';
      cancelButton.className = 'ghost';
      cancelButton.textContent = 'Abbrechen';
      cancelButton.addEventListener('click', renderThemes);
      actions.append(saveButton, cancelButton);
    });

    const toggleButton = document.createElement('button');
    toggleButton.type = 'button';
    toggleButton.textContent = theme.active ? 'Deaktivieren' : 'Aktivieren';
    toggleButton.addEventListener('click', async () => {
      try {
        const updated = await updateTheme(theme.id, { active: !theme.active });
        state.themes = state.themes.map((item) =>
          item.id === updated.id ? { ...item, ...updated } : item
        );
        renderThemes();
      } catch (error) {
        alert(error.message);
      }
    });

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'ghost danger';
    deleteButton.textContent = 'Löschen';
    deleteButton.disabled = theme.draft_count > 0;
    deleteButton.addEventListener('click', async () => {
      if (!window.confirm('Thema wirklich löschen?')) {
        return;
      }
      try {
        await deleteTheme(theme.id);
        state.themes = state.themes.filter((item) => item.id !== theme.id);
        renderThemes();
      } catch (error) {
        alert(error.message);
      }
    });

    actions.append(editButton, toggleButton, deleteButton);

    card.append(header, meta, actions);
    themeList.appendChild(card);
  });
};

themeForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setFormStatus('');
  try {
    const created = await createTheme({
      key: themeKeyInput.value,
      name: themeNameInput.value,
    });
    state.themes = [...state.themes, { ...created, draft_count: 0 }];
    themeKeyInput.value = '';
    themeNameInput.value = '';
    renderThemes();
    setFormStatus('Thema angelegt.');
  } catch (error) {
    setFormStatus(error.message, 'danger');
  }
});

fetchThemes().catch((error) => {
  themeList.innerHTML = `<p class="muted">Fehler: ${error.message}</p>`;
});
