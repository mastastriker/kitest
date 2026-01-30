const fs = require('fs');
const path = require('path');
const STORE_PATH = path.join(__dirname, '..', 'data', 'store.json');
const ENCODING = 'utf-8';

function ensureStoreFile() {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(STORE_PATH)) {
    const initial = { postDrafts: [] };
    fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2), ENCODING);
  }
}

function readStore() {
  ensureStoreFile();
  const raw = fs.readFileSync(STORE_PATH, ENCODING);
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed.postDrafts)) {
    parsed.postDrafts = [];
    writeStore(parsed);
  }
  return parsed;
}

function writeStore(data) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), ENCODING);
}

function generateId(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function addPostDraft(draft) {
  const store = readStore();
  const prepared = {
    id: generateId('draft'),
    theme: draft.theme,
    content: draft.content,
    status: draft.status,
    source_type: draft.source_type,
    source_ref: draft.source_ref || null,
    created_at: draft.created_at || new Date().toISOString(),
    approved_at: draft.approved_at || null,
  };
  store.postDrafts.push(prepared);
  writeStore(store);
  return prepared;
}

function getPostDrafts(filters = {}) {
  const store = readStore();
  const { status, theme } = filters;
  return store.postDrafts
    .filter((draft) => {
      if (status && draft.status !== status) {
        return false;
      }
      if (theme && draft.theme !== theme) {
        return false;
      }
      return true;
    })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function updatePostDraft(draftId, updates = {}) {
  const store = readStore();
  const index = store.postDrafts.findIndex((draft) => draft.id === draftId);
  if (index === -1) {
    return null;
  }
  const current = store.postDrafts[index];
  if (typeof updates.content === 'string') {
    const trimmed = updates.content.trim();
    if (!trimmed) {
      throw new Error('Draft content is required');
    }
    current.content = trimmed;
  }
  if (typeof updates.status === 'string') {
    current.status = updates.status;
  }
  if (updates.approved_at !== undefined) {
    current.approved_at = updates.approved_at;
  }
  store.postDrafts[index] = current;
  writeStore(store);
  return current;
}

function setPostDraftStatus(draftId, status) {
  const updates = { status };
  if (status === 'approved') {
    updates.approved_at = new Date().toISOString();
  }
  return updatePostDraft(draftId, updates);
}

function getDraftBySourceRef(sourceRef) {
  if (!sourceRef) {
    return null;
  }
  const store = readStore();
  return store.postDrafts.find((draft) => draft.source_ref === sourceRef) || null;
}

function getDraftStatsByTheme(theme) {
  const store = readStore();
  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;
  const themeDrafts = store.postDrafts.filter((draft) => draft.theme === theme);
  const generatedCount = themeDrafts.filter((draft) => draft.status === 'generated').length;
  const recentCount = themeDrafts.filter((draft) => {
    const created = Date.parse(draft.created_at);
    return Number.isFinite(created) && created >= dayAgo;
  }).length;
  return {
    generatedCount,
    recentCount,
  };
}

module.exports = {
  addPostDraft,
  getPostDrafts,
  updatePostDraft,
  setPostDraftStatus,
  getDraftBySourceRef,
  getDraftStatsByTheme,
};
