const OpenAI = require('openai');
const { buildTrend, parseTrendPayload } = require('./utils');

const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

function buildOpenAITrendPrompt(topicName, modeLabel, count) {
  const system = [
    'Du bist Trend-Analyst für X (Twitter).',
    'Antworte immer auf Deutsch.',
    'Erkenne aktuelle Diskussionsnarrative der letzten 24–72 Stunden.',
    'Keine Meinungen, keine Empfehlungen, keine Schlussfolgerungen.',
    'Kein Post-Stil, nur sachliche Beobachtung.',
    'Output-Format: JSON mit dem Feld "trends" als Array von Objekten.',
    'Jeder Eintrag: {"title":"...","description":"...","sources":["..."]}.',
    'title: kurz, neutral, beobachtend.',
    'description: 1-2 Sätze, rein faktisch.',
    'sources: 1-4 kurze Hinweise (Hashtags, Begriffe, Accounts, Events).',
    `Gib ${count} Einträge aus.`,
    'Kein Text außerhalb des JSON.',
  ].join(' ');

  const user = [`Thema: ${topicName}`, `Modus: ${modeLabel}`, 'Beschreibe, was auf X diskutiert wird.'].join(
    '\n'
  );

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
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      const items = parseTrendPayload(content);
      const trends = items
        .map((item) =>
          buildTrend({
            title: item?.title,
            description: item?.description,
            provider: 'openai',
            sources: item?.sources,
          })
        )
        .filter(Boolean);

      if (!trends.length) {
        throw new Error('OpenAI response did not include valid trends');
      }
      return trends.slice(0, count);
    },
  };
}

module.exports = {
  createOpenAITrendProvider,
  buildOpenAITrendPrompt,
};
