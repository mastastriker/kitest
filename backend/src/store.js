const fs = require('fs');
const path = require('path');
const { getDefaultPrompts } = require('./prompts');

const STORE_PATH = path.join(__dirname, '..', 'data', 'store.json');
const ENCODING = 'utf-8';

function ensureStoreFile() {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(STORE_PATH)) {
    const initial = { topics: [], posts: [] };
    fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2), ENCODING);
  }
}

function readStore() {
  ensureStoreFile();
  const raw = fs.readFileSync(STORE_PATH, ENCODING);
  return JSON.parse(raw);
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
  return { ...topic, prompts };
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
    createdAt: new Date().toISOString(),
  };
  store.topics.push(topic);
  writeStore(store);
  return topic;
}

function addPosts(topicId, texts) {
  const store = readStore();
  const entries = texts.map((text) => ({
    id: generateId('post'),
    topicId,
    text: text.trim(),
    createdAt: new Date().toISOString(),
    source: 'openai',
  }));
  store.posts.push(...entries);
  writeStore(store);
  return entries;
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
  writeStore(store);
  return store.posts[index];
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
  deleteTopic,
};
