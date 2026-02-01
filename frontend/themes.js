const themeList = document.getElementById('theme-list');
const themeCount = document.getElementById('theme-count');
const themeForm = document.getElementById('theme-form');
const themeStatus = document.getElementById('theme-status');
const themeKeyInput = document.getElementById('theme-key');
const themeNameInput = document.getElementById('theme-name');
const themeActiveInput = document.getElementById('theme-active');

const state = {
  themes: [],
};

const setStatus = (message, tone = 'default') => {
  if (!themeStatus) return;
  themeStatus.textContent = message;
  themeStatus.classList.toggle('danger', tone === 'danger');
};

async function fetchThemes() {
  themeList.innerHTML = '<p class="muted">Lade Themes ...</p>';
  try {
    const res = await fetch('/api/themes');
    const data = await res.json();
    state.themes = data.themes || [];
    renderThemes();
  } catch (error) {
    themeList.innerHTML = `<p class="muted">Fehler beim Laden: ${error.message}</p>`;
  }
}

async function createTheme(payload) {
  setStatus('');
  const res = await fetch('/api/themes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Theme konnte nicht erstellt werden.');
  }
  return data.theme;
}

async function updateTheme(themeId, updates) {
  const res = await fetch(`/api/themes/${themeId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Theme konnte nicht gespeichert werden.');
  }
  return data.theme;
}

async function removeTheme(themeId) {
  const res = await fetch(`/api/themes/${themeId}`, { method: 'DELETE' });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Theme konnte nicht gelöscht werden.');
  }
  return data.theme;
}

function renderThemes() {
  if (!state.themes.length) {
    themeList.innerHTML = '<p class="muted">Noch keine Themes erfasst.</p>';
    themeCount.textContent = '0';
    return;
  }

  themeList.innerHTML = '';
  themeCount.textContent = `${state.themes.length}`;

  state.themes.forEach((theme) => {
    const card = document.createElement('article');
    card.className = 'theme-card';
    card.innerHTML = `
      <div class="theme-card-head">
        <div>
          <div class="theme-key">${theme.key}</div>
          <div class="theme-name">${theme.name}</div>
        </div>
        <span class="badge">${theme.active ? 'Aktiv' : 'Inaktiv'}</span>
      </div>
      <div class="theme-details muted small">
        <span>Key: ${theme.key}</span>
        <span>Name: ${theme.name}</span>
        <span>Status: ${theme.active ? 'Aktiv' : 'Inaktiv'}</span>
      </div>
      <div class="inline-actions"></div>
    `;

    const actions = card.querySelector('.inline-actions');
    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'ghost';
    toggleBtn.textContent = theme.active ? 'Inaktiv schalten' : 'Aktiv schalten';
    toggleBtn.addEventListener('click', async () => {
      toggleBtn.disabled = true;
      try {
        const updated = await updateTheme(theme.id, { active: !theme.active });
        state.themes = state.themes.map((entry) => (entry.id === theme.id ? updated : entry));
        renderThemes();
      } catch (error) {
        alert(error.message);
      } finally {
        toggleBtn.disabled = false;
      }
    });

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'ghost';
    editBtn.textContent = 'Bearbeiten';
    editBtn.addEventListener('click', () => renderEditForm(theme, card));

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'ghost danger';
    deleteBtn.textContent = 'Löschen';
    deleteBtn.addEventListener('click', async () => {
      if (!window.confirm(`Theme "${theme.name}" wirklich löschen?`)) {
        return;
      }
      deleteBtn.disabled = true;
      try {
        await removeTheme(theme.id);
        state.themes = state.themes.filter((entry) => entry.id !== theme.id);
        renderThemes();
      } catch (error) {
        alert(error.message);
      } finally {
        deleteBtn.disabled = false;
      }
    });

    actions.appendChild(toggleBtn);
    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    themeList.appendChild(card);
  });
}

function renderEditForm(theme, card) {
  card.innerHTML = '';
  const form = document.createElement('form');
  form.className = 'stack';
  form.innerHTML = `
    <label>
      Key
      <input type="text" name="key" value="${theme.key}" required />
    </label>
    <label>
      Name
      <input type="text" name="name" value="${theme.name}" required />
    </label>
    <label class="checkbox-field">
      <input type="checkbox" name="active" ${theme.active ? 'checked' : ''} />
      Aktiv
    </label>
    <div class="inline-actions"></div>
  `;

  const actions = form.querySelector('.inline-actions');
  const saveBtn = document.createElement('button');
  saveBtn.type = 'submit';
  saveBtn.textContent = 'Speichern';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'ghost';
  cancelBtn.textContent = 'Abbrechen';
  cancelBtn.addEventListener('click', () => renderThemes());

  actions.appendChild(saveBtn);
  actions.appendChild(cancelBtn);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    saveBtn.disabled = true;
    try {
      const formData = new FormData(form);
      const updated = await updateTheme(theme.id, {
        key: String(formData.get('key') || '').trim(),
        name: String(formData.get('name') || '').trim(),
        active: formData.get('active') === 'on',
      });
      state.themes = state.themes.map((entry) => (entry.id === theme.id ? updated : entry));
      renderThemes();
    } catch (error) {
      alert(error.message);
      saveBtn.disabled = false;
    }
  });

  card.appendChild(form);
}

themeForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = {
    key: themeKeyInput.value.trim(),
    name: themeNameInput.value.trim(),
    active: themeActiveInput.checked,
  };
  if (!payload.key || !payload.name) {
    setStatus('Bitte Key und Name angeben.', 'danger');
    return;
  }
  try {
    const theme = await createTheme(payload);
    state.themes = [theme, ...state.themes];
    themeForm.reset();
    themeActiveInput.checked = true;
    setStatus('Theme angelegt.');
    renderThemes();
  } catch (error) {
    setStatus(error.message, 'danger');
  }
});

fetchThemes();
