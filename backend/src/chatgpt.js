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
    throw new Error('OpenAI client is not configured');
  }

  const { system, user } = buildPostPromptForTopic(topic, count);

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
    throw new Error('OpenAI response did not include valid posts');
  }
  return parsed;
}

async function generatePostFromTrend(topic, trend) {
  if (!topic?.name) {
    throw new Error('Topic is required');
  }
  const cleanedTrend = String(trend || '').trim();
  if (!cleanedTrend) {
    throw new Error('Trend is required');
  }

  if (!client) {
    throw new Error('OpenAI client is not configured');
  }

  const { system, user } = buildTrendPostPrompt(topic, cleanedTrend);

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
  const parsed = safeParsePost(content);
  if (!parsed) {
    throw new Error('OpenAI response did not include a valid post');
  }
  return parsed;
}

function appendPropertyInstructions(userPrompt, selectedProperties) {
  if (!selectedProperties.length) {
    return userPrompt;
  }
  const lines = buildPropertyHints(selectedProperties);
  if (!lines) {
    return userPrompt;
  }
  return `${userPrompt}\n\n${lines}`;
}

function buildPostPromptForTopic(topic, count = 3) {
  const defaults = getDefaultPrompts();
  const system = topic.prompts?.system || defaults.system;
  const baseUser = renderUserPrompt(topic.prompts?.user || defaults.user, topic.name, count);
  const selectedProperties = selectPostProperties(topic);
  const user = appendPropertyInstructions(baseUser, selectedProperties);
  return { system, user };
}

function buildTrendPostPrompt(topic, trend) {
  const defaults = getDefaultPrompts();
  const baseSystem = topic.prompts?.system || defaults.system;
  const system = [
    baseSystem,
    'Antwort-Format: JSON mit Feld "post" (String), keine weiteren Felder.',
  ].join(' ');
  const selectedProperties = selectPostProperties(topic);
  const propertyHints = buildPropertyHints(selectedProperties);
  const user = [
    `Thema: ${topic.name}`,
    `Trend-Idee: ${trend}`,
    'Erstelle genau einen prägnanten X-Post auf Deutsch.',
    'Der Post soll eigenständig formuliert sein und nicht nur die Trend-Idee zitieren.',
    'Maximal 260 Zeichen, keine Emojis, keine Hashtags.',
    'Antwort im JSON-Format: {"post": "..." }',
    propertyHints,
  ]
    .filter(Boolean)
    .join('\n');
  return { system, user };
}

function buildPropertyHints(selectedProperties) {
  const propertyMap = getPostPropertyMap();
  const lines = selectedProperties
    .map((id) => propertyMap[id]?.prompt)
    .filter(Boolean)
    .map((prompt) => `- ${prompt}`);
  if (!lines.length) {
    return '';
  }
  return `Zusätzliche Eigenschaften für diesen Post:\n${lines.join('\n')}`;
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

function safeParsePost(payload) {
  try {
    const json = JSON.parse(payload);
    const post = typeof json.post === 'string' ? json.post.trim() : '';
    return post || null;
  } catch (err) {
    return null;
  }
}

module.exports = {
  generatePostsForTopic,
  generatePostFromTrend,
  buildPostPromptForTopic,
  buildTrendPostPrompt,
};
