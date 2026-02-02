const OpenAI = require('openai');
const {
  buildTrend,
  extractTrendLinesFromText,
  filterTrendsByRecency,
  enforceTrendPlausibility,
} = require('./utils');

const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

function buildOpenAITrendPrompt(topicName, modeLabel, count) {
  const system = [
    'You are a trend detection system observing discussions on X (Twitter).',
    'You must understand what is being discussed AND whether the direction',
    'of claims is plausible given generally known current conditions.',
  ].join('\n');
  const user = [
    'List up to 10 crypto-related narratives that have emerged or accelerated',
    'within the LAST 24 HOURS on X.',
    '',
    'IMPORTANT RULES:',
    '- Describe WHAT is being discussed, not WHAT is claimed as fact.',
    '- If discussions make strong claims (e.g. record highs, record lows,',
    '  massive inflows, extreme drops) but such direction is uncertain',
    '  or contradicted by commonly known current data,',
    '  you MUST neutralize the wording.',
    '- In such cases, describe the debate or contradiction instead of',
    '  repeating the claim.',
    '',
    'Examples:',
    '- Instead of "ETF inflows hitting record highs"',
    '  write "Debate on X about Bitcoin ETF inflows despite weak flow data".',
    '- Instead of "massive institutional buying"',
    '  write "Conflicting claims about institutional activity".',
    '',
    'Do NOT:',
    '- invent confirmations',
    '- invent records',
    '- exaggerate direction',
    '- explain background',
    '- output JSON',
    '',
    'Use plain text, one trend per line.',
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
      const plausible = enforceTrendPlausibility(filtered);

      if (!plausible.length) {
        throw new Error('OpenAI response did not include valid trends');
      }
      return plausible.slice(0, count);
    },
  };
}

module.exports = {
  createOpenAITrendProvider,
  buildOpenAITrendPrompt,
};
