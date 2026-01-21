const OpenAI = require('openai');

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

  const system = [
    'Du schreibst prägnante, ansprechende X/Twitter-Posts auf Deutsch.',
    'Maximal 260 Zeichen, keine Emojis oder Hashtags außer wenn wirklich nötig.',
    'Liefere nur JSON: {"posts":[{"text":"..."}]} ohne zusätzlichen Text.',
  ].join(' ');

  const user = [
    `Thema: ${topic.name}`,
    `Erzeuge ${count} unterschiedliche Posts.`,
    'Jeder Post soll selbsterklärend und direkt postbar sein.',
  ].join('\n');

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
