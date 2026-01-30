const fs = require('fs');
const path = require('path');
const { getDefaultPrompts } = require('./prompts');
const { getPostPropertyMap } = require('./postProperties');

const STORE_PATH = path.join(__dirname, '..', 'data', 'store.json');
const ENCODING = 'utf-8';

function ensureStoreFile() {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(STORE_PATH)) {
    const initial = { topics: [], posts: [], postDrafts: [] };
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

function applyPromptDefaults(topic) {
  const defaults = getDefaultPrompts();
  const prompts = {
    ...defaults,
    ...(topic.prompts || {}),
  };
  const postProperties = Array.isArray(topic.postProperties) ? topic.postProperties : [];
  return { ...topic, prompts, postProperties };
}

function normalizeTopics(store) {
  let changed = false;
  const topics = store.topics.map((topic) => {
    const normalized = applyPromptDefaults(topic);
    if (
      normalized.prompts.system !== topic.prompts?.system ||
      normalized.prompts.user !== topic.prompts?.user
    ) {
      changed = true;
    }
    return normalized;
  });
  if (changed) {
    store.topics = topics;
    writeStore(store);
  }
  return topics;
}

function getTopics() {
  const store = readStore();
  return normalizeTopics(store);
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
  const prompts = getDefaultPrompts();
  const topic = {
    id: generateId('topic'),
    name: trimmed,
    prompts,
    postProperties: [],
    createdAt: new Date().toISOString(),
  };
  store.topics.push(topic);
  writeStore(store);
  return topic;
}

function addPosts(topicId, entries, defaults = {}) {
  const store = readStore();
  const prepared = entries.map((entry) => {
    const text = typeof entry === 'string' ? entry : entry?.text;
    const mergedMeta =
      typeof entry === 'string' ? defaults : { ...defaults, ...(entry?.meta || {}) };
    const safeText = String(text || '').trim();
    const generatedPost = String(mergedMeta?.generatedPost || safeText || '').trim();
    const promptText = mergedMeta?.promptText ? String(mergedMeta.promptText).trim() : undefined;
    return {
      id: generateId('post'),
      topicId,
      text: safeText,
      generated_post: generatedPost,
      prompt_text: promptText,
      createdAt: new Date().toISOString(),
      source: mergedMeta?.source || 'openai',
      prompt: mergedMeta?.prompt,
    };
  });
  store.posts.push(...prepared);
  writeStore(store);
  return prepared;
}

function getPostsForTopic(topicId) {
  const store = readStore();
  return store.posts.filter((p) => p.topicId === topicId);
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
  if (updates.prompts) {
    const defaults = getDefaultPrompts();
    const nextPrompts = {
      ...defaults,
      ...updates.prompts,
    };
    topic.prompts = nextPrompts;
  } else if (!topic.prompts) {
    topic.prompts = getDefaultPrompts();
  }
  if (Array.isArray(updates.postProperties)) {
    const propertyMap = getPostPropertyMap();
    topic.postProperties = updates.postProperties.filter((id) => propertyMap[id]);
  } else if (!Array.isArray(topic.postProperties)) {
    topic.postProperties = [];
  }
  store.topics[index] = topic;
  writeStore(store);
  return applyPromptDefaults(topic);
}

function deleteTopic(topicId) {
  const store = readStore();
  const index = store.topics.findIndex((t) => t.id === topicId);
  if (index === -1) {
    return null;
  }
  const [removedTopic] = store.topics.splice(index, 1);
  const before = store.posts.length;
  store.posts = store.posts.filter((p) => p.topicId !== topicId);
  const removedPosts = before - store.posts.length;
  writeStore(store);
  return { topic: removedTopic, removedPosts };
}

function deletePost(postId) {
  const store = readStore();
  const index = store.posts.findIndex((p) => p.id === postId);
  if (index === -1) {
    return null;
  }
  const [removed] = store.posts.splice(index, 1);
  writeStore(store);
  return removed;
}

function updatePost(postId, text) {
  const trimmed = text?.trim();
  if (!trimmed) {
    throw new Error('Post text is required');
  }
  const store = readStore();
  const index = store.posts.findIndex((p) => p.id === postId);
  if (index === -1) {
    return null;
  }
  store.posts[index].text = trimmed;
  store.posts[index].generated_post = trimmed;
  writeStore(store);
  return store.posts[index];
}

function updatePostWithPrompt(postId, text, promptText, prompt) {
  const trimmed = text?.trim();
  if (!trimmed) {
    throw new Error('Post text is required');
  }
  const store = readStore();
  const index = store.posts.findIndex((p) => p.id === postId);
  if (index === -1) {
    return null;
  }
  store.posts[index].text = trimmed;
  store.posts[index].generated_post = trimmed;
  if (promptText) {
    store.posts[index].prompt_text = String(promptText).trim();
  }
  if (prompt) {
    store.posts[index].prompt = prompt;
  }
  writeStore(store);
  return store.posts[index];
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
  getTopics,
  getTopic,
  addTopic,
  addPosts,
  getPostsForTopic,
  updateTopic,
  deletePost,
  updatePost,
  updatePostWithPrompt,
  deleteTopic,
  addPostDraft,
  getPostDrafts,
  updatePostDraft,
  setPostDraftStatus,
  getDraftBySourceRef,
  getDraftStatsByTheme,
};
