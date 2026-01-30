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
    const initial = { topics: [], drafts: [] };
    fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2), ENCODING);
  }
}

function readStore() {
  ensureStoreFile();
  const raw = fs.readFileSync(STORE_PATH, ENCODING);
  const parsed = JSON.parse(raw);
  return normalizeStore(parsed);
}

function writeStore(data) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), ENCODING);
}

function generateId(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function normalizeStore(store) {
  let changed = false;
  if (!store || typeof store !== 'object') {
    store = { topics: [], drafts: [] };
    changed = true;
  }
  if (!Array.isArray(store.topics)) {
    store.topics = [];
    changed = true;
  }
  store.topics = store.topics.map((topic) => {
    const name = String(topic?.name || '').trim();
    const normalized = {
      id: topic?.id || generateId('topic'),
      name: name || 'Unbenanntes Thema',
      is_active:
        typeof topic?.is_active === 'boolean'
          ? topic.is_active
          : typeof topic?.active === 'boolean'
            ? topic.active
            : true,
      created_at: topic?.created_at || topic?.createdAt || new Date().toISOString(),
      updated_at: topic?.updated_at || topic?.updatedAt || null,
    };
    if (
      topic?.prompts ||
      topic?.postProperties ||
      topic?.createdAt ||
      topic?.updatedAt ||
      topic?.active !== undefined
    ) {
      changed = true;
    }
    return normalized;
  });
  if (!Array.isArray(store.drafts)) {
    if (Array.isArray(store.posts)) {
      store.drafts = store.posts.map((post) => {
        const topic = store.topics.find((t) => t.id === post.topicId);
        return {
          id: post.id || generateId('draft'),
          theme: topic?.name || 'Unbekannt',
          theme_id: post.topicId || topic?.id || null,
          content: String(post.text || post.generated_post || '').trim(),
          status: 'generated',
          source_type: 'trend',
          source_ref: 'Legacy Import',
          created_at: post.createdAt || new Date().toISOString(),
          approved_at: null,
        };
      });
      changed = true;
    } else {
      store.drafts = [];
      changed = true;
    }
  }
  if (store.posts) {
    delete store.posts;
    changed = true;
  }
  if (changed) {
    writeStore(store);
  }
  return store;
}

function getTopic(id) {
  return getTopics().find((t) => t.id === id);
}

function addTopic(name) {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Topic name is required');
  }
  const store = readStore();
  const topic = {
    id: generateId('topic'),
    name: trimmed,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: null,
  };
  store.topics.push(topic);
  writeStore(store);
  return topic;
}

function getTopics() {
  const store = readStore();
  return store.topics;
}

function addDraft(draft) {
  const store = readStore();
  const entry = {
    id: generateId('draft'),
    theme: draft.theme,
    theme_id: draft.theme_id || null,
    content: draft.content,
    status: 'generated',
    source_type: draft.source_type,
    source_ref: draft.source_ref,
    created_at: new Date().toISOString(),
    approved_at: null,
  };
  store.drafts.unshift(entry);
  writeStore(store);
  return entry;
}

function getDrafts() {
  return readStore().drafts;
}

function updateTopic(topicId, updates = {}) {
  const store = readStore();
  const index = store.topics.findIndex((t) => t.id === topicId);
  if (index === -1) {
    return null;
  }
  const topic = store.topics[index];
  if (typeof updates.name === 'string') {
    const trimmed = updates.name.trim();
    if (!trimmed) {
      throw new Error('Topic name is required');
    }
    topic.name = trimmed;
  }
  if (typeof updates.is_active === 'boolean') {
    topic.is_active = updates.is_active;
  }
  topic.updated_at = new Date().toISOString();
  store.topics[index] = topic;
  writeStore(store);
  return topic;
}

function deleteTopic(topicId) {
  const store = readStore();
  const index = store.topics.findIndex((t) => t.id === topicId);
  if (index === -1) {
    return null;
  }
  const [removedTopic] = store.topics.splice(index, 1);
  const before = store.drafts.length;
  store.drafts = store.drafts.filter((p) => p.theme_id !== topicId);
  const removedPosts = before - store.drafts.length;
  writeStore(store);
  return { topic: removedTopic, removedPosts };
}

function updateDraftContent(draftId, content) {
  const trimmed = content?.trim();
  if (!trimmed) {
    throw new Error('Draft content is required');
  }
  const store = readStore();
  const index = store.drafts.findIndex((p) => p.id === draftId);
  if (index === -1) {
    return null;
  }
  store.drafts[index].content = trimmed;
  writeStore(store);
  return store.drafts[index];
}

function updateDraftStatus(draftId, status) {
  const store = readStore();
  const index = store.drafts.findIndex((p) => p.id === draftId);
  if (index === -1) {
    return null;
  }
  if (!['approved', 'discarded', 'generated'].includes(status)) {
    throw new Error('Invalid status');
  }
  store.drafts[index].status = status;
  store.drafts[index].approved_at = status === 'approved' ? new Date().toISOString() : null;
  writeStore(store);
  return store.drafts[index];
}

module.exports = {
  getTopics,
  getTopic,
  addTopic,
  addDraft,
  getDrafts,
  updateTopic,
  updateDraftContent,
  updateDraftStatus,
  deleteTopic,
};
