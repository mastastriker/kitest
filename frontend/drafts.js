const draftsList = document.getElementById('drafts-list');
const draftsCount = document.getElementById('drafts-count');
const draftsHeading = document.getElementById('drafts-heading');
const archiveClearButton = document.getElementById('archive-clear');
const tabButtons = document.querySelectorAll('.tab-button');

const state = {
  drafts: [],
  activeTab: 'generated',
};

const statusLabels = {
  generated: 'Entwurf',
  approved: 'Freigegeben',
  discarded: 'Verworfen',
  posted: 'Gepostet',
  scheduled: 'Geplant',
};

const emptyMessages = {
  generated: 'Keine Entwürfe vorhanden.',
  approved: 'Keine freigegebenen Posts.',
  archived: 'Archiv ist leer.',
};

const setActiveTab = (tab) => {
  state.activeTab = tab;
  tabButtons.forEach((button) => {
    button.classList.toggle('is-active', button.dataset.tab === tab);
  });
  const headingMap = {
    generated: 'Entwürfe',
    approved: 'Freigegeben',
    archived: 'Archiv',
  };
  draftsHeading.textContent = headingMap[tab] || 'Entwürfe';
  renderDrafts();
};

const fetchDrafts = async () => {
  draftsList.innerHTML = '<p class="muted">Lade Entwürfe ...</p>';
  const res = await fetch('/api/post-drafts');
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Entwürfe konnten nicht geladen werden.');
  }
  state.drafts = data.drafts || [];
  renderDrafts();
};

const updateDraft = async (id, updates) => {
  const res = await fetch(`/api/post-drafts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Speichern fehlgeschlagen.');
  }
  state.drafts = state.drafts.map((draft) => (draft.id === id ? data.draft : draft));
  renderDrafts();
};

const approveDraft = async (id) => {
  const res = await fetch(`/api/post-drafts/${id}/approve`, { method: 'POST' });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Freigeben fehlgeschlagen.');
  }
  state.drafts = state.drafts.map((draft) => (draft.id === id ? data.draft : draft));
  renderDrafts();
};

const discardDraft = async (id) => {
  const res = await fetch(`/api/post-drafts/${id}/discard`, { method: 'POST' });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Verwerfen fehlgeschlagen.');
  }
  state.drafts = state.drafts.map((draft) => (draft.id === id ? data.draft : draft));
  renderDrafts();
};

const deleteDraft = async (id) => {
  const res = await fetch(`/api/post-drafts/${id}`, { method: 'DELETE' });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Löschen fehlgeschlagen.');
  }
  state.drafts = state.drafts.filter((draft) => draft.id !== id);
  renderDrafts();
};

const copyDraftContent = async (content, button) => {
  if (!navigator.clipboard) {
    alert('Clipboard API ist nicht verfügbar.');
    return;
  }
  button.disabled = true;
  try {
    await navigator.clipboard.writeText(content);
    button.textContent = 'Kopiert!';
    setTimeout(() => {
      button.textContent = 'Für X kopieren';
      button.disabled = false;
    }, 1200);
  } catch (error) {
    button.disabled = false;
    alert('Kopieren fehlgeschlagen.');
  }
};

const clearArchivedDrafts = async () => {
  const res = await fetch('/api/post-drafts/archived', { method: 'DELETE' });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Archiv leeren fehlgeschlagen.');
  }
  const removedIds = new Set((data.removed || []).map((draft) => draft.id));
  if (removedIds.size) {
    state.drafts = state.drafts.filter((draft) => !removedIds.has(draft.id));
  }
  renderDrafts();
};

const filterDrafts = () => {
  if (state.activeTab === 'approved') {
    return state.drafts.filter((draft) => draft.status === 'approved');
  }
  if (state.activeTab === 'archived') {
    return state.drafts.filter((draft) => draft.status === 'discarded' || draft.status === 'posted');
  }
  return state.drafts.filter((draft) => draft.status === 'generated');
};

const renderDrafts = () => {
  const drafts = filterDrafts();
  draftsCount.textContent = `${drafts.length}`;
  if (archiveClearButton) {
    const hasArchived = state.drafts.some((draft) => draft.status === 'discarded');
    archiveClearButton.hidden = state.activeTab !== 'archived';
    archiveClearButton.disabled = !hasArchived;
  }
  if (!drafts.length) {
    const message = emptyMessages[state.activeTab] || emptyMessages.generated;
    draftsList.innerHTML = `<p class="muted">${message}</p>`;
    return;
  }
  draftsList.innerHTML = '';
  drafts.forEach((draft) => {
    const card = document.createElement('article');
    card.className = 'draft-card';
    const meta = document.createElement('div');
    meta.className = 'draft-meta';
    const title = document.createElement('h3');
    title.textContent = `${draft.theme} · ${statusLabels[draft.status] || draft.status}`;
    const date = document.createElement('div');
    date.className = 'muted small';
    date.textContent = `Erstellt: ${new Date(draft.created_at).toLocaleString('de-DE')}`;
    meta.append(title, date);

    const text = document.createElement('div');
    text.className = 'draft-text';
    text.textContent = draft.content;

    const source = document.createElement('div');
    source.className = 'draft-source muted small';
    if (draft.source_ref) {
      source.innerHTML = `Quelle: <a href="${draft.source_ref}" target="_blank" rel="noreferrer">${draft.source_ref}</a>`;
    } else {
      source.textContent = `Quelle: ${draft.source_type}`;
    }

    const actions = document.createElement('div');
    actions.className = 'inline-actions';

    if (draft.status === 'generated') {
      const approveButton = document.createElement('button');
      approveButton.type = 'button';
      approveButton.textContent = 'Freigeben';
      approveButton.addEventListener('click', () => approveDraft(draft.id));
      actions.appendChild(approveButton);
    }

    if (draft.status === 'approved') {
      const copyButton = document.createElement('button');
      copyButton.type = 'button';
      copyButton.textContent = 'Für X kopieren';
      copyButton.addEventListener('click', () => copyDraftContent(draft.content, copyButton));
      actions.appendChild(copyButton);
    }

    if (draft.status === 'generated' || draft.status === 'approved') {
      const editButton = document.createElement('button');
      editButton.type = 'button';
      editButton.className = 'ghost';
      editButton.textContent = 'Bearbeiten';
      editButton.addEventListener('click', () => {
        const textarea = document.createElement('textarea');
        textarea.className = 'post-input';
        textarea.rows = 4;
        textarea.value = draft.content;
        text.innerHTML = '';
        text.appendChild(textarea);
        actions.innerHTML = '';
        const saveButton = document.createElement('button');
        saveButton.type = 'button';
        saveButton.textContent = 'Speichern';
        saveButton.addEventListener('click', () => {
          const next = textarea.value.trim();
          if (!next) {
            alert('Bitte einen gültigen Text eingeben.');
            return;
          }
          updateDraft(draft.id, { content: next });
        });
        const cancelButton = document.createElement('button');
        cancelButton.type = 'button';
        cancelButton.className = 'ghost';
        cancelButton.textContent = 'Abbrechen';
        cancelButton.addEventListener('click', renderDrafts);
        actions.append(saveButton, cancelButton);
      });
      actions.appendChild(editButton);

      const discardButton = document.createElement('button');
      discardButton.type = 'button';
      discardButton.className = 'ghost danger';
      discardButton.textContent = 'Verwerfen';
      discardButton.addEventListener('click', () => discardDraft(draft.id));
      actions.appendChild(discardButton);
    }

    if (state.activeTab === 'archived' && draft.status === 'discarded') {
      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'ghost danger';
      deleteButton.textContent = 'Löschen';
      deleteButton.addEventListener('click', () => {
        if (window.confirm('Archivierten Draft endgültig löschen?')) {
          deleteDraft(draft.id);
        }
      });
      actions.appendChild(deleteButton);
    }

    card.append(meta, text, source, actions);
    draftsList.appendChild(card);
  });
};

tabButtons.forEach((button) => {
  button.addEventListener('click', () => setActiveTab(button.dataset.tab));
});

if (archiveClearButton) {
  archiveClearButton.addEventListener('click', () => {
    if (window.confirm('Archiv endgültig leeren?')) {
      clearArchivedDrafts().catch((error) => {
        draftsList.innerHTML = `<p class="muted">Fehler: ${error.message}</p>`;
      });
    }
  });
}

fetchDrafts().catch((error) => {
  draftsList.innerHTML = `<p class="muted">Fehler: ${error.message}</p>`;
});
