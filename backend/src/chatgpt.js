const OpenAI = require('openai');
const { getDefaultPrompts, renderUserPrompt } = require('./prompts');
const { getPostPropertyMap } = require('./postProperties');

const apiKey = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const client = apiKey ? new OpenAI({ apiKey }) : null;

async function generatePostsForTopic(topic, count = 3) {
  if (!topic?.name) {
    throw new Error('Topic is required');
  }

  if (!client) {
    return buildFallback(topic.name, count);
  }

  const defaults = getDefaultPrompts();
  const system = topic.prompts?.system || defaults.system;
  const baseUser = renderUserPrompt(topic.prompts?.user || defaults.user, topic.name, count);
  const selectedProperties = selectPostProperties(topic);
  const user = appendPropertyInstructions(baseUser, selectedProperties);

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.7,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content;
  const parsed = safeParsePosts(content);
  if (!parsed.length) {
    return buildFallback(topic.name, count);
  }
  return parsed;
}

function appendPropertyInstructions(userPrompt, selectedProperties) {
  if (!selectedProperties.length) {
    return userPrompt;
  }
  const propertyMap = getPostPropertyMap();
  const lines = selectedProperties
    .map((id) => propertyMap[id]?.prompt)
    .filter(Boolean)
    .map((prompt) => `- ${prompt}`);
  if (!lines.length) {
    return userPrompt;
  }
  return `${userPrompt}\n\nZusätzliche Eigenschaften für diesen Post:\n${lines.join('\n')}`;
}

function selectPostProperties(topic, maxSelection = 3) {
  const active = Array.isArray(topic?.postProperties) ? topic.postProperties : [];
  if (!active.length) {
    return [];
  }
  const propertyMap = getPostPropertyMap();
  const candidates = active.filter((id) => propertyMap[id]);
  if (candidates.length <= maxSelection) {
    return candidates;
  }
  const shuffled = shuffle(candidates);
  const selected = [];
  shuffled.forEach((id) => {
    if (selected.length >= maxSelection) {
      return;
    }
    const conflicts = new Set(propertyMap[id]?.conflicts || []);
    const isConflicting = selected.some((picked) => {
      const pickedConflicts = propertyMap[picked]?.conflicts || [];
      return conflicts.has(picked) || pickedConflicts.includes(id);
    });
    if (!isConflicting) {
      selected.push(id);
    }
  });
  return selected;
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function safeParsePosts(payload) {
  try {
    const json = JSON.parse(payload);
    const posts = json.posts || [];
    return posts
      .map((p) => (typeof p === 'string' ? p : p?.text))
      .filter(Boolean)
      .map((text) => text.trim());
  } catch (err) {
    return [];
  }
}

function buildFallback(topicName, count) {
  const variations = [];
  for (let i = 0; i < count; i += 1) {
    variations.push(
      `Gedanke zu ${topicName}: ${sampleHooks[i % sampleHooks.length]} — kurz, konkret, umsetzbar.`
    );
  }
  return variations;
}

const sampleHooks = [
  'hier ein schneller Denkanstoß',
  'kleiner Hebel, große Wirkung',
  'oft übersehen wir das Einfache',
  'probier es einmal und sieh den Effekt',
  'streiche das Überflüssige und fokussiere aufs Wirksame',
];

module.exports = {
  generatePostsForTopic,
};
