const OpenAI = require('openai');
const { buildTrend, extractTrendLinesFromText, filterTrendsByRecency } = require('./utils');

const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

function buildOpenAITrendPrompt(topicName, modeLabel, count) {
  const system =
    'You are a trend detection system observing discussions on X (Twitter). Focus ONLY on very recent activity.';
  const user = [
    'List up to 10 crypto-related narratives that have emerged or significantly accelerated',
    'within the LAST 24 HOURS on X.',
    'Ignore topics that were already widely discussed before this time window.',
    'Do not explain background or history.',
    'Use plain text, one trend per line.',
    '',
    'Rules:',
    '- Do NOT ask for JSON',
    '- Do NOT ask for analysis or opinions',
    '- Do NOT include older context',
  ].join('\n');

  return { system, user };
}

function createOpenAITrendProvider() {
  const apiKey = process.env.OPENAI_API_KEY;
  const client = apiKey ? new OpenAI({ apiKey }) : null;

  return {
    id: 'openai',
    buildPrompt: buildOpenAITrendPrompt,
    async fetchTrends({ topicName, modeLabel, count }) {
      if (!client) {
        throw new Error('OpenAI API key is missing');
      }
      const { system, user } = buildOpenAITrendPrompt(topicName, modeLabel, count);
      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.4,
      });

      const content = response.choices[0]?.message?.content;
      const lines = extractTrendLinesFromText(content, count);
      const trends = lines
        .map((line) =>
          buildTrend({
            title: line,
            description: line,
            provider: 'openai',
            sources: ['x'],
          })
        )
        .filter(Boolean);
      const filtered = filterTrendsByRecency(trends);

      if (!filtered.length) {
        throw new Error('OpenAI response did not include valid trends');
      }
      return filtered.slice(0, count);
    },
  };
}

module.exports = {
  createOpenAITrendProvider,
  buildOpenAITrendPrompt,
};
