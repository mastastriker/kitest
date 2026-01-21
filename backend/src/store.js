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

function getTopics() {
  const store = readStore();
  return store.topics;
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

module.exports = {
  getTopics,
  getTopic,
  addTopic,
  addPosts,
  getPostsForTopic,
};
