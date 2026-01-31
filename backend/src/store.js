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
    const initial = { topics: [], posts: [], drafts: [] };
    fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2), ENCODING);
  }
}

function readStore() {
  ensureStoreFile();
  const raw = fs.readFileSync(STORE_PATH, ENCODING);
  const parsed = JSON.parse(raw);
  let changed = false;
  if (!Array.isArray(parsed.topics)) {
    parsed.topics = [];
    changed = true;
  }
  if (!Array.isArray(parsed.posts)) {
    parsed.posts = [];
    changed = true;
  }
  if (!Array.isArray(parsed.drafts)) {
    parsed.drafts = [];
    changed = true;
  }
  if (changed) {
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

function getPostDrafts(filters = {}) {
  const store = readStore();
  const { theme, status } = filters;
  return store.drafts.filter((draft) => {
    if (theme && draft.theme !== theme) return false;
    if (status && draft.status !== status) return false;
    return true;
  });
}

function addPostDraft(draft) {
  const store = readStore();
  const now = new Date().toISOString();
  const created = {
    id: generateId('draft'),
    theme: draft.theme,
    content: draft.content,
    status: draft.status || 'generated',
    source_type: draft.source_type,
    source_ref: draft.source_ref || null,
    created_at: now,
    approved_at: draft.approved_at || null,
  };
  store.drafts.push(created);
  writeStore(store);
  return created;
}

function updatePostDraft(draftId, updates = {}) {
  const store = readStore();
  const index = store.drafts.findIndex((draft) => draft.id === draftId);
  if (index === -1) {
    return null;
  }
  const draft = store.drafts[index];
  if (typeof updates.content === 'string') {
    const trimmed = updates.content.trim();
    if (!trimmed) {
      throw new Error('Draft content is required');
    }
    draft.content = trimmed;
  }
  if (typeof updates.status === 'string') {
    draft.status = updates.status;
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'approved_at')) {
    draft.approved_at = updates.approved_at;
  }
  store.drafts[index] = draft;
  writeStore(store);
  return draft;
}

function updatePostDraftStatus(draftId, status) {
  const store = readStore();
  const index = store.drafts.findIndex((draft) => draft.id === draftId);
  if (index === -1) {
    return null;
  }
  const draft = store.drafts[index];
  draft.status = status;
  if (status === 'approved') {
    draft.approved_at = new Date().toISOString();
  }
  store.drafts[index] = draft;
  writeStore(store);
  return draft;
}

function deletePostDraft(draftId) {
  const store = readStore();
  const index = store.drafts.findIndex((draft) => draft.id === draftId);
  if (index === -1) {
    return null;
  }
  const [removed] = store.drafts.splice(index, 1);
  writeStore(store);
  return removed;
}

function deletePostDraftsByStatus(status) {
  const store = readStore();
  const removed = store.drafts.filter((draft) => draft.status === status);
  if (!removed.length) {
    return [];
  }
  store.drafts = store.drafts.filter((draft) => draft.status !== status);
  writeStore(store);
  return removed;
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
  getPostDrafts,
  addPostDraft,
  updatePostDraft,
  updatePostDraftStatus,
  deletePostDraft,
  deletePostDraftsByStatus,
};
