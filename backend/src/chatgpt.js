const OpenAI = require('openai');
const { getDefaultPrompts, getMasterPrompt, renderUserPrompt } = require('./prompts');
const { getPostPropertyMap } = require('./postProperties');

const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  return apiKey ? new OpenAI({ apiKey }) : null;
}

async function generatePostsForTopic(topic, count = 3) {
  if (!topic?.name) {
    throw new Error('Topic is required');
  }

  const client = getClient();
  if (!client) {
    throw new Error('OpenAI client is not configured');
  }

  const { user } = buildPostPromptForTopic(topic, count);

  const parsed = await generateXPostDrafts({ client, user, count });
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

  const client = getClient();
  if (!client) {
    throw new Error('OpenAI client is not configured');
  }

  const { user } = buildTrendPostPrompt(topic, cleanedTrend);

  const parsed = await generateXPostDrafts({ client, user, count: 1 });
  if (!parsed) {
    throw new Error('OpenAI response did not include a valid post');
  }
  return parsed;
}

async function generatePostFromPrompt(system, user) {
  const client = getClient();
  if (!client) {
    throw new Error('OpenAI client is not configured');
  }
  if (!user) {
    throw new Error('Prompt user is required');
  }
  return generateXPostDrafts({ client, user, count: 1 });
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
  const baseUser = renderUserPrompt(defaults.user, topic.name, count);
  const selectedProperties = selectPostProperties(topic);
  const user = appendPropertyInstructions(baseUser, selectedProperties);
  return { system: getMasterPrompt(), user };
}

function buildTrendPostPrompt(topic, trend) {
  const system = getMasterPrompt();
  const selectedProperties = selectPostProperties(topic);
  const propertyHints = buildPropertyHints(selectedProperties);
  const user = [
    `Topic: ${topic.name}`,
    `Trend idea: ${trend}`,
    'Create exactly one concise X post in English.',
    'The post must stand on its own and not quote the trend idea.',
    'Write the full text first, then provide the link separately.',
    'The text must not contain URLs.',
    'The link must be only the URL and must be complete.',
    'Trim if needed, but never cut off sentences or links.',
    'No hard character limit, but keep within X limits (280 characters).',
    'No emojis. No hashtags.',
    'Return JSON only: {"text": "...", "link": "https://..." }',
    propertyHints,
  ]
    .filter(Boolean)
    .join('\n');
  return { system, user };
}

async function generateXPostDrafts({ client, user, count }) {
  if (!client) {
    throw new Error('OpenAI client is not configured');
  }
  if (!user) {
    throw new Error('Prompt user is required');
  }
  const system = getMasterPrompt();
  const isBatch = Number(count) > 1;
  if (isBatch) {
    return generateBatchWithEnglishGuard(client, system, user);
  }
  return generateSingleWithEnglishGuard(client, system, user);
}

async function requestPostBatch(client, system, user) {
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
  return safeParsePosts(content);
}

async function requestSinglePost(client, system, user) {
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
  return safeParsePost(content);
}

function getPostText(post) {
  if (typeof post !== 'string') {
    return '';
  }
  return post.split('\n\n')[0]?.trim() || '';
}

function isEnglishPost(post) {
  const text = getPostText(post);
  if (!text) {
    return false;
  }
  const lower = text.toLowerCase();
  const germanSignals = [' der ', ' die ', ' das ', ' und ', ' nicht ', ' kein ', ' eine ', ' ist ', ' mit '];
  const hasGermanChars = /[äöüß]/i.test(text);
  if (hasGermanChars || germanSignals.some((token) => lower.includes(token))) {
    return false;
  }
  return true;
}

async function generateBatchWithEnglishGuard(client, system, user) {
  const initial = await requestPostBatch(client, system, user);
  if (initial.every((post) => isEnglishPost(post))) {
    return initial;
  }
  console.error('Non-English batch detected, retrying once with the same prompt.');
  const retry = await requestPostBatch(client, system, user);
  if (retry.every((post) => isEnglishPost(post))) {
    return retry;
  }
  throw new Error('Generated posts were not in English after retry');
}

async function generateSingleWithEnglishGuard(client, system, user) {
  const initial = await requestSinglePost(client, system, user);
  if (isEnglishPost(initial)) {
    return initial;
  }
  console.error('Non-English post detected, retrying once with the same prompt.');
  const retry = await requestSinglePost(client, system, user);
  if (isEnglishPost(retry)) {
    return retry;
  }
  throw new Error('Generated post was not in English after retry');
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
  return `Additional properties for this post:\n${lines.join('\n')}`;
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
      .map((entry) => {
        if (!entry || typeof entry !== 'object') {
          return null;
        }
        const text = typeof entry.text === 'string' ? entry.text.trim() : '';
        const link = typeof entry.link === 'string' ? entry.link.trim() : '';
        if (!text || !isCompleteSentence(text)) {
          return null;
        }
        if (/https?:\/\//i.test(text)) {
          return null;
        }
        if (!isValidLink(link)) {
          return null;
        }
        return `${text}\n\n${link}`;
      })
      .filter(Boolean);
  } catch (err) {
    return [];
  }
}

function isCompleteSentence(text) {
  return /[.!?][\"'”’)]?$/.test(text);
}

function isValidLink(link) {
  const trimmed = String(link || '').trim();
  if (!trimmed) return false;
  if (!trimmed.startsWith('http')) return false;
  if (/\s/.test(trimmed)) return false;
  return true;
}

function safeParsePost(payload) {
  try {
    const json = JSON.parse(payload);
    const text = typeof json.text === 'string' ? json.text.trim() : '';
    const link = typeof json.link === 'string' ? json.link.trim() : '';
    if (!text || !isCompleteSentence(text)) {
      return null;
    }
    if (/https?:\/\//i.test(text)) {
      return null;
    }
    if (!isValidLink(link)) {
      return null;
    }
    return `${text}\n\n${link}`;
  } catch (err) {
    return null;
  }
}

module.exports = {
  generatePostsForTopic,
  generatePostFromTrend,
  generatePostFromPrompt,
  buildPostPromptForTopic,
  buildTrendPostPrompt,
};
