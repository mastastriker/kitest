const { buildTrend, parseTrendPayload } = require('./utils');

const model = process.env.GROK_MODEL || 'grok-2-latest';
const GROK_ENDPOINT = 'https://api.x.ai/v1/chat/completions';

function buildGrokTrendPrompt(topicName, modeLabel, count) {
  const system = [
    'Du bist Trend-Analyst für X (Twitter).',
    'Deine Aufgabe ist ausschließlich Trend-Erkennung auf X.',
    'Antworte immer auf Deutsch.',
    'Beschreibe nur beobachtete Diskussionen, keine Meinungen.',
    'Keine Empfehlungen, keine Schlussfolgerungen, kein Kommentarstil.',
    'Output-Format: JSON mit dem Feld "trends" als Array von Objekten.',
    'Jeder Eintrag: {"title":"...","description":"...","sources":["..."]}.',
    'title: kurz, neutral, beobachtend.',
    'description: 1-2 Sätze, rein faktisch.',
    'sources: 1-4 kurze Hinweise (Hashtags, Begriffe, Accounts, Events).',
    `Gib ${count} Einträge aus.`,
    'Kein Text außerhalb des JSON.',
  ].join(' ');

  const user = [
    `Thema: ${topicName}`,
    `Modus: ${modeLabel}`,
    'Nutze ausschließlich X als Quelle.',
    'Beschreibe, was auf X diskutiert wird.',
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
      const systemMessage =
        'You detect trending topics on X. Do not write posts or opinions.';
      const topicLabel = topicName || 'crypto';
      const userMessage = `List up to 10 current trending narratives on X about ${topicLabel}. Return short, neutral descriptions.`;
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
            model,
            messages: [
              { role: 'system', content: systemMessage },
              { role: 'user', content: userMessage },
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
      const items = parseTrendPayload(content);
      const trends = items
        .map((item) =>
          buildTrend({
            title: item?.title,
            description: item?.description,
            provider: 'grok',
            sources: item?.sources,
          })
        )
        .filter(Boolean);

      if (!trends.length) {
        throw new Error('Grok response did not include valid trends');
      }
      return trends.slice(0, count);
    },
  };
}

module.exports = {
  createGrokTrendProvider,
  buildGrokTrendPrompt,
};
