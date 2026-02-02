const { buildTrend, extractTrendLinesFromText, filterTrendsByRecency } = require('./utils');

const GROK_MODEL = 'grok-4-fast-non-reasoning';
const GROK_ENDPOINT = 'https://api.x.ai/v1/chat/completions';

function buildGrokTrendPrompt(topicName, modeLabel, count) {
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
      if (!filtered.length) {
        throw new Error('Grok response did not include valid trends');
      }
      return filtered;
    },
  };
}

module.exports = {
  createGrokTrendProvider,
  buildGrokTrendPrompt,
};
