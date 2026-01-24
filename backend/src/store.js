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
    const initial = { topics: [], posts: [], newsSources: [], newsItems: [] };
    fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2), ENCODING);
  }
}

function ensureStoreShape(store) {
  let changed = false;
  if (!Array.isArray(store.topics)) {
    store.topics = [];
    changed = true;
  }
  if (!Array.isArray(store.posts)) {
    store.posts = [];
    changed = true;
  }
  if (!Array.isArray(store.newsSources)) {
    store.newsSources = [];
    changed = true;
  }
  if (!Array.isArray(store.newsItems)) {
    store.newsItems = [];
    changed = true;
  }
  return changed;
}

function readStore() {
  ensureStoreFile();
  const raw = fs.readFileSync(STORE_PATH, ENCODING);
  const store = JSON.parse(raw);
  const changed = ensureStoreShape(store);
  if (changed) {
    writeStore(store);
  }
  return store;
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
  const newsFeedUrl = typeof topic.newsFeedUrl === 'string' ? topic.newsFeedUrl : '';
  return { ...topic, prompts, postProperties, newsFeedUrl };
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
    newsFeedUrl: '',
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

function getNewsSources() {
  const store = readStore();
  return store.newsSources;
}

function getActiveNewsSources() {
  return getNewsSources().filter((source) => source.active);
}

function addNewsSource({ name, url, topicIds = [], active = true }) {
  const trimmedName = name?.trim();
  const trimmedUrl = url?.trim();
  if (!trimmedName) {
    throw new Error('Source name is required');
  }
  if (!trimmedUrl) {
    throw new Error('Source url is required');
  }
  const store = readStore();
  const validTopicIds = Array.isArray(topicIds)
    ? topicIds.filter((id) => store.topics.some((topic) => topic.id === id))
    : [];
  const source = {
    id: generateId('source'),
    name: trimmedName,
    url: trimmedUrl,
    active: Boolean(active),
    topicIds: validTopicIds,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastFetchedAt: null,
    lastStatus: null,
  };
  store.newsSources.push(source);
  writeStore(store);
  return source;
}

function updateNewsSource(sourceId, updates = {}) {
  const store = readStore();
  const index = store.newsSources.findIndex((source) => source.id === sourceId);
  if (index === -1) {
    return null;
  }
  const source = store.newsSources[index];
  if (typeof updates.name === 'string') {
    const trimmedName = updates.name.trim();
    if (!trimmedName) {
      throw new Error('Source name is required');
    }
    source.name = trimmedName;
  }
  if (typeof updates.url === 'string') {
    const trimmedUrl = updates.url.trim();
    if (!trimmedUrl) {
      throw new Error('Source url is required');
    }
    source.url = trimmedUrl;
  }
  if (typeof updates.active === 'boolean') {
    source.active = updates.active;
  }
  if (Array.isArray(updates.topicIds)) {
    source.topicIds = updates.topicIds.filter((id) =>
      store.topics.some((topic) => topic.id === id)
    );
  }
  if (typeof updates.lastFetchedAt === 'string' || updates.lastFetchedAt === null) {
    source.lastFetchedAt = updates.lastFetchedAt;
  }
  if (typeof updates.lastStatus === 'string' || updates.lastStatus === null) {
    source.lastStatus = updates.lastStatus;
  }
  source.updatedAt = new Date().toISOString();
  store.newsSources[index] = source;
  writeStore(store);
  return source;
}

function deleteNewsSource(sourceId) {
  const store = readStore();
  const index = store.newsSources.findIndex((source) => source.id === sourceId);
  if (index === -1) {
    return null;
  }
  const [removed] = store.newsSources.splice(index, 1);
  store.newsItems = store.newsItems.filter((item) => item.sourceId !== sourceId);
  writeStore(store);
  return removed;
}

function addNewsItems(items) {
  const store = readStore();
  const existingKeys = new Set(store.newsItems.map((item) => item.uniqueKey));
  const added = [];
  items.forEach((item) => {
    if (!item.uniqueKey || existingKeys.has(item.uniqueKey)) {
      return;
    }
    const entry = {
      id: generateId('news'),
      sourceId: item.sourceId,
      sourceName: item.sourceName,
      sourceUrl: item.sourceUrl,
      title: item.title,
      content: item.content,
      publishedAt: item.publishedAt,
      topicIds: item.topicIds || [],
      uniqueKey: item.uniqueKey,
      createdAt: new Date().toISOString(),
    };
    existingKeys.add(item.uniqueKey);
    store.newsItems.push(entry);
    added.push(entry);
  });
  if (added.length) {
    writeStore(store);
  }
  return added;
}

function getNewsItems({ topicId, sourceId } = {}) {
  const store = readStore();
  return store.newsItems.filter((item) => {
    if (topicId && !item.topicIds?.includes(topicId)) {
      return false;
    }
    if (sourceId && item.sourceId !== sourceId) {
      return false;
    }
    return true;
  });
}

function getNewsItemsForTopics(topicIds = []) {
  const store = readStore();
  if (!Array.isArray(topicIds) || topicIds.length === 0) {
    return [];
  }
  const topicSet = new Set(topicIds);
  return store.newsItems.filter((item) => {
    if (!Array.isArray(item.topicIds)) {
      return false;
    }
    return item.topicIds.some((topicId) => topicSet.has(topicId));
  });
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
  if (typeof updates.newsFeedUrl === 'string') {
    topic.newsFeedUrl = updates.newsFeedUrl.trim();
  } else if (typeof topic.newsFeedUrl !== 'string') {
    topic.newsFeedUrl = '';
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
  getNewsSources,
  getActiveNewsSources,
  addNewsSource,
  updateNewsSource,
  deleteNewsSource,
  addNewsItems,
  getNewsItems,
  getNewsItemsForTopics,
};
