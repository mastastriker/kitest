const draftsList = document.getElementById('drafts-list');
const draftsCount = document.getElementById('drafts-count');
const draftsHeading = document.getElementById('drafts-heading');
const tabButtons = document.querySelectorAll('.tab-button');
const archiveActions = document.getElementById('archive-actions');
const deleteSelectedButton = document.getElementById('delete-selected');
const clearArchiveButton = document.getElementById('clear-archive');

const state = {
  drafts: [],
  activeTab: 'generated',
  selectedDraftIds: new Set(),
};

const statusLabels = {
  generated: 'Entwurf',
  approved: 'Freigegeben',
  discarded: 'Verworfen',
  posted: 'Gepostet',
  scheduled: 'Geplant',
};

const setActiveTab = (tab) => {
  state.activeTab = tab;
  if (tab !== 'archived') {
    state.selectedDraftIds.clear();
  }
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

const updateArchiveActions = () => {
  if (!archiveActions || !deleteSelectedButton || !clearArchiveButton) {
    return;
  }
  archiveActions.classList.toggle('is-hidden', state.activeTab !== 'archived');
  const selectedCount = state.selectedDraftIds.size;
  deleteSelectedButton.disabled = selectedCount === 0;
  deleteSelectedButton.textContent = selectedCount
    ? `Ausgewählte löschen (${selectedCount})`
    : 'Ausgewählte löschen';
  const archivedCount = state.drafts.filter(
    (draft) => draft.status === 'discarded' || draft.status === 'posted'
  ).length;
  clearArchiveButton.disabled = archivedCount === 0;
};

const deleteSelectedDrafts = async () => {
  const ids = Array.from(state.selectedDraftIds);
  if (!ids.length) {
    return;
  }
  if (!confirm(`Ausgewählte Entwürfe (${ids.length}) wirklich löschen?`)) {
    return;
  }
  const res = await fetch('/api/post-drafts', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Löschen fehlgeschlagen.');
  }
  state.drafts = state.drafts.filter((draft) => !state.selectedDraftIds.has(draft.id));
  state.selectedDraftIds.clear();
  renderDrafts();
};

const clearArchive = async () => {
  if (
    !confirm('Archiv wirklich komplett leeren? Alle verworfenen/geposteten Entwürfe werden gelöscht.')
  ) {
    return;
  }
  const res = await fetch('/api/post-drafts/archived', { method: 'DELETE' });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Archiv leeren fehlgeschlagen.');
  }
  state.drafts = state.drafts.filter(
    (draft) => draft.status !== 'discarded' && draft.status !== 'posted'
  );
  state.selectedDraftIds.clear();
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
  if (!drafts.length) {
    draftsList.innerHTML = '<p class="muted">Keine Entwürfe vorhanden.</p>';
    updateArchiveActions();
    return;
  }
  draftsList.innerHTML = '';
  drafts.forEach((draft) => {
    const card = document.createElement('article');
    card.className = 'draft-card';
    if (state.activeTab === 'archived' && state.selectedDraftIds.has(draft.id)) {
      card.classList.add('is-selected');
    }
    const meta = document.createElement('div');
    meta.className = 'draft-meta';
    const headerRow = document.createElement('div');
    headerRow.className = 'draft-meta-row';
    const title = document.createElement('h3');
    title.textContent = `${draft.theme} · ${statusLabels[draft.status] || draft.status}`;
    if (state.activeTab === 'archived') {
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'draft-select';
      checkbox.checked = state.selectedDraftIds.has(draft.id);
      checkbox.setAttribute('aria-label', `Entwurf ${draft.theme} auswählen`);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          state.selectedDraftIds.add(draft.id);
        } else {
          state.selectedDraftIds.delete(draft.id);
        }
        card.classList.toggle('is-selected', checkbox.checked);
        updateArchiveActions();
      });
      headerRow.appendChild(checkbox);
    }
    headerRow.appendChild(title);
    const date = document.createElement('div');
    date.className = 'muted small';
    date.textContent = `Erstellt: ${new Date(draft.created_at).toLocaleString('de-DE')}`;
    meta.append(headerRow, date);

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

    card.append(meta, text, source, actions);
    draftsList.appendChild(card);
  });
  updateArchiveActions();
};

tabButtons.forEach((button) => {
  button.addEventListener('click', () => setActiveTab(button.dataset.tab));
});

if (deleteSelectedButton) {
  deleteSelectedButton.addEventListener('click', () => {
    deleteSelectedDrafts().catch((error) => {
      alert(error.message);
    });
  });
}

if (clearArchiveButton) {
  clearArchiveButton.addEventListener('click', () => {
    clearArchive().catch((error) => {
      alert(error.message);
    });
  });
}

fetchDrafts().catch((error) => {
  draftsList.innerHTML = `<p class="muted">Fehler: ${error.message}</p>`;
});
