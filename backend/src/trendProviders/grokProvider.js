const {
  buildTrend,
  extractTrendLinesFromText,
  filterTrendsByRecency,
  enforceTrendPlausibility,
} = require('./utils');

const GROK_MODEL = 'grok-4-fast-non-reasoning';
const GROK_ENDPOINT = 'https://api.x.ai/v1/chat/completions';

function buildGrokTrendPrompt(topicName, modeLabel, count) {
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

function createGrokTrendProvider() {
  const apiKey = process.env.GROK_API_KEY;

  return {
    id: 'grok',
    buildPrompt: buildGrokTrendPrompt,
    async fetchTrends({ topicName, modeLabel, count }) {
      if (!apiKey) {
        throw new Error('Grok API key is missing');
      }
      const { system, user } = buildGrokTrendPrompt(topicName, modeLabel, count);
      let response;
      let responseBody;

      try {
        response = await fetch(GROK_ENDPOINT, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: GROK_MODEL,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: user },
            ],
            temperature: 0.2,
          }),
        });
        responseBody = await response.text();
        if (!response.ok) {
          console.error('Grok API error', {
            status: response.status,
            body: responseBody,
          });
          throw new Error(`Grok request failed: ${response.status}`);
        }
      } catch (error) {
        if (!response) {
          console.error('Grok API error', { status: null, body: error.message });
        }
        throw error;
      }

      let data;
      try {
        data = JSON.parse(responseBody);
      } catch (error) {
        console.error('Grok API error', { status: response?.status, body: responseBody });
        throw new Error('Grok response was not valid JSON');
      }
      const content = data.choices?.[0]?.message?.content;
      const lines = extractTrendLinesFromText(content, count);
      const trends = lines
        .map((line) =>
          buildTrend({
            title: line,
            description: line,
            provider: 'grok',
            sources: ['x'],
          })
        )
        .filter(Boolean);
      const filtered = filterTrendsByRecency(trends);
      const plausible = enforceTrendPlausibility(filtered);
      if (!plausible.length) {
        throw new Error('Grok response did not include valid trends');
      }
      return plausible;
    },
  };
}

module.exports = {
  createGrokTrendProvider,
  buildGrokTrendPrompt,
};
