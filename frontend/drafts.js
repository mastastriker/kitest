const draftsContainer = document.getElementById('drafts-container');
const tabButtons = document.querySelectorAll('.tab-button');

const state = {
  status: 'generated',
  drafts: [],
};

async function loadDrafts(status) {
  draftsContainer.innerHTML = '<p class="muted">Lade Entwürfe ...</p>';
  const queryStatus = status === 'archived' ? 'discarded' : status;
  try {
    const res = await fetch(`/api/post-drafts?status=${queryStatus}`);
    const data = await res.json();
    state.drafts = data.drafts || [];
    if (status === 'archived') {
      const postedRes = await fetch('/api/post-drafts?status=posted');
      const postedData = await postedRes.json();
      state.drafts = [...state.drafts, ...(postedData.drafts || [])];
    }
    renderDrafts(status);
  } catch (err) {
    draftsContainer.innerHTML = `<p class="muted">Fehler: ${err.message}</p>`;
  }
}

function renderDrafts(status) {
  if (!state.drafts.length) {
    draftsContainer.innerHTML = '<p class="muted">Keine Einträge vorhanden.</p>';
    return;
  }
  draftsContainer.innerHTML = '';
  state.drafts.forEach((draft) => {
    const card = document.createElement('article');
    card.className = 'post-card';
    card.innerHTML = `
      <div class="post-card-head">
        <div>
          <div class="post-topic">${draft.theme}</div>
          <div class="muted small">${draft.source_type}</div>
        </div>
        <div class="post-actions"></div>
      </div>
      <div class="post-text"></div>
      <div class="draft-meta muted small"></div>
    `;
    const text = card.querySelector('.post-text');
    text.textContent = draft.content;
    const meta = card.querySelector('.draft-meta');
    const metaItems = [
      `Status: ${draft.status}`,
      `Erstellt: ${formatDate(draft.created_at)}`,
    ];
    if (draft.approved_at) {
      metaItems.push(`Freigegeben: ${formatDate(draft.approved_at)}`);
    }
    if (draft.source_ref) {
      metaItems.push(draft.source_ref);
    }
    meta.textContent = metaItems.join(' · ');

    const actions = card.querySelector('.post-actions');
    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'ghost';
    editButton.textContent = 'Bearbeiten';
    editButton.addEventListener('click', () => editDraft(card, draft));
    actions.appendChild(editButton);

    if (status === 'generated') {
      const approveButton = document.createElement('button');
      approveButton.type = 'button';
      approveButton.textContent = 'Freigeben';
      approveButton.addEventListener('click', () => approveDraft(draft.id, approveButton));
      const discardButton = document.createElement('button');
      discardButton.type = 'button';
      discardButton.className = 'ghost danger';
      discardButton.textContent = 'Verwerfen';
      discardButton.addEventListener('click', () => discardDraft(draft.id, discardButton));
      actions.appendChild(approveButton);
      actions.appendChild(discardButton);
    }

    if (status === 'approved') {
      const discardButton = document.createElement('button');
      discardButton.type = 'button';
      discardButton.className = 'ghost danger';
      discardButton.textContent = 'Verwerfen';
      discardButton.addEventListener('click', () => discardDraft(draft.id, discardButton));
      actions.appendChild(discardButton);
    }

    draftsContainer.appendChild(card);
  });
}

function editDraft(card, draft) {
  const text = card.querySelector('.post-text');
  const actions = card.querySelector('.post-actions');
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
  saveButton.addEventListener('click', () => saveDraft(draft.id, textarea.value, saveButton));
  const cancelButton = document.createElement('button');
  cancelButton.type = 'button';
  cancelButton.className = 'ghost';
  cancelButton.textContent = 'Abbrechen';
  cancelButton.addEventListener('click', () => loadDrafts(state.status));
  actions.appendChild(saveButton);
  actions.appendChild(cancelButton);
}

async function saveDraft(draftId, content, button) {
  const text = content.trim();
  if (!text) {
    alert('Bitte einen gültigen Text eingeben.');
    return;
  }
  button.disabled = true;
  try {
    const res = await fetch(`/api/post-drafts/${draftId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: text }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Speichern fehlgeschlagen.');
    }
    state.drafts = state.drafts.map((draft) => (draft.id === draftId ? data.draft : draft));
    renderDrafts(state.status);
  } catch (err) {
    alert(err.message);
  } finally {
    button.disabled = false;
  }
}

async function approveDraft(draftId, button) {
  await updateStatus(draftId, 'approve', button);
}

async function discardDraft(draftId, button) {
  await updateStatus(draftId, 'discard', button);
}

async function updateStatus(draftId, action, button) {
  button.disabled = true;
  try {
    const res = await fetch(`/api/post-drafts/${draftId}/${action}`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Aktion fehlgeschlagen.');
    }
    state.drafts = state.drafts.filter((draft) => draft.id !== draftId);
    renderDrafts(state.status);
  } catch (err) {
    alert(err.message);
  } finally {
    button.disabled = false;
  }
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('de-DE');
}

tabButtons.forEach((button) => {
  button.addEventListener('click', () => {
    tabButtons.forEach((btn) => btn.classList.remove('is-active'));
    button.classList.add('is-active');
    state.status = button.dataset.status;
    loadDrafts(state.status);
  });
});

loadDrafts(state.status);
