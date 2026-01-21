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
    'You create concise, engaging Twitter/X posts.',
    'Keep posts under 260 characters.',
    'Avoid emojis and hashtags unless essential.',
    'Return JSON: {"posts":[{"text":"..."}]} with no extra text.',
  ].join(' ');

  const user = [
    `Topic: ${topic.name}`,
    `Generate ${count} distinct posts.`,
    'Each post should be self-contained and ready to publish.',
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
      `Thought on ${topicName}: ${sampleHooks[i % sampleHooks.length]} — keep it sharp and actionable.`
    );
  }
  return variations;
}

const sampleHooks = [
  'here is a quick takeaway',
  'a small shift changes everything',
  'people overlook the simple parts',
  'try this once and see the impact',
  'cut the fluff and focus on what moves the needle',
];

module.exports = {
  generatePostsForTopic,
};
