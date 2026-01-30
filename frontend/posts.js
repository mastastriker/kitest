const postsContainer = document.getElementById('posts');
const state = {
  drafts: [],
};

async function loadDrafts() {
  postsContainer.innerHTML = '<p class="muted">Lade Entwürfe ...</p>';
  try {
    const res = await fetch('/api/drafts');
    const data = await res.json();
    state.drafts = data.drafts || [];
    renderDrafts();
  } catch (err) {
    postsContainer.innerHTML = `<p class="muted">Fehler beim Laden: ${err.message}</p>`;
  }
}

async function updateDraftContent(draftId, content, button) {
  button.disabled = true;
  try {
    const res = await fetch(`/api/drafts/${draftId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Speichern fehlgeschlagen');
    }
    state.drafts = state.drafts.map((draft) => (draft.id === draftId ? data.draft : draft));
    renderDrafts();
  } catch (err) {
    alert(err.message);
  } finally {
    button.disabled = false;
  }
}

async function updateDraftStatus(draftId, status, button) {
  button.disabled = true;
  try {
    const res = await fetch(`/api/drafts/${draftId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Status konnte nicht gespeichert werden');
    }
    if (data.draft.status === 'discarded') {
      state.drafts = state.drafts.filter((draft) => draft.id !== draftId);
    } else {
      state.drafts = state.drafts.map((draft) => (draft.id === draftId ? data.draft : draft));
    }
    renderDrafts();
  } catch (err) {
    alert(err.message);
  } finally {
    button.disabled = false;
  }
}

function renderDrafts() {
  if (!state.drafts.length) {
    postsContainer.innerHTML = '<p class="muted">Noch keine Entwürfe vorhanden.</p>';
    return;
  }
  postsContainer.innerHTML = '';
  const grouped = state.drafts.reduce((acc, draft) => {
    const key = draft.theme || 'Ohne Thema';
    if (!acc[key]) acc[key] = [];
    acc[key].push(draft);
    return acc;
  }, {});
  Object.entries(grouped).forEach(([theme, drafts]) => {
    const section = document.createElement('section');
    section.className = 'post-group';
    const header = document.createElement('div');
    header.className = 'post-group-head';
    const title = document.createElement('h3');
    title.textContent = theme;
    header.appendChild(title);
    section.appendChild(header);
    const list = document.createElement('div');
    list.className = 'post-group-list';
    drafts.forEach((draft) => {
      const card = document.createElement('article');
      card.className = 'post-card';
      card.innerHTML = `
        <div class="post-card-head">
          <div class="post-topic">${draft.theme || 'Ohne Thema'}</div>
          <div class="post-actions"></div>
        </div>
        <div class="post-meta">
          <span class="badge">${draft.status}</span>
          <span class="badge">${draft.source_type}</span>
          <span class="muted small">${draft.created_at ? new Date(draft.created_at).toLocaleString('de-DE') : ''}</span>
        </div>
        <div class="post-text"></div>
        <div class="post-source muted small"></div>
      `;

      const text = card.querySelector('.post-text');
      text.textContent = draft.content || '';

      const source = card.querySelector('.post-source');
      if (draft.source_type === 'rss') {
        const feedLabel = draft.source_feed_name || 'Unbekannter Feed';
        source.textContent = `Quelle: RSS – ${feedLabel}`;
      } else if (draft.source_type === 'trend') {
        source.textContent = 'Quelle: Trend-Fallback';
      } else {
        source.textContent = draft.source_ref ? `Quelle: ${draft.source_ref}` : '';
      }

      const actions = card.querySelector('.post-actions');
      if (draft.status === 'generated') {
        const approveBtn = document.createElement('button');
        approveBtn.type = 'button';
        approveBtn.textContent = 'Freigeben';
        approveBtn.addEventListener('click', () => updateDraftStatus(draft.id, 'approved', approveBtn));

        const discardBtn = document.createElement('button');
        discardBtn.type = 'button';
        discardBtn.className = 'ghost danger';
        discardBtn.textContent = 'Verwerfen';
        discardBtn.addEventListener('click', () =>
          updateDraftStatus(draft.id, 'discarded', discardBtn)
        );

        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'ghost';
        editBtn.textContent = 'Bearbeiten';
        editBtn.addEventListener('click', () => {
          const textarea = document.createElement('textarea');
          textarea.className = 'post-input';
          textarea.rows = 4;
          textarea.value = draft.content || '';
          text.innerHTML = '';
          text.appendChild(textarea);
          actions.innerHTML = '';
          const saveBtn = document.createElement('button');
          saveBtn.type = 'button';
          saveBtn.textContent = 'Speichern';
          saveBtn.addEventListener('click', () => {
            const nextText = textarea.value.trim();
            if (!nextText) {
              alert('Bitte einen gültigen Entwurfstext eingeben.');
              return;
            }
            updateDraftContent(draft.id, nextText, saveBtn);
          });
          const cancelBtn = document.createElement('button');
          cancelBtn.type = 'button';
          cancelBtn.className = 'ghost';
          cancelBtn.textContent = 'Abbrechen';
          cancelBtn.addEventListener('click', () => renderDrafts());
          actions.appendChild(saveBtn);
          actions.appendChild(cancelBtn);
        });

        actions.appendChild(approveBtn);
        actions.appendChild(discardBtn);
        actions.appendChild(editBtn);
      }

      list.appendChild(card);
    });
    section.appendChild(list);
    postsContainer.appendChild(section);
  });
}

loadDrafts();
