const { getSettings, setTrends } = require('./store');
const { getTrendProvider, getTrendProviderAvailability } = require('./trendProviders');

const MODE_MAP = {
  current: 'Aktuelle Trends',
  controversy: 'Kontroverse Themen',
  questions: 'Offene Fragen',
};

async function generateTrendsForTopic(topicName, mode, count = 7) {
  if (!topicName) {
    throw new Error('topicName is required');
  }
  const modeLabel = MODE_MAP[mode];
  if (!modeLabel) {
    throw new Error('mode is invalid');
  }
  const clamped = clampCount(count);
  const { providerId, provider } = resolveTrendProvider();
  const trends = await provider.fetchTrends({ topicName, mode, modeLabel, count: clamped });
  if (!Array.isArray(trends) || !trends.length) {
    throw new Error('Trend provider did not return any trends');
  }
  setTrends(trends);
  return trends;
}

function buildTrendPrompt(topicName, mode, count) {
  const modeLabel = MODE_MAP[mode];
  if (!modeLabel) {
    throw new Error('mode is invalid');
  }
  const clamped = clampCount(count);
  const { provider } = resolveTrendProvider();
  if (!provider?.buildPrompt) {
    return null;
  }
  return provider.buildPrompt(topicName, modeLabel, clamped);
}

function clampCount(value) {
  const number = Number(value) || 7;
  return Math.min(10, Math.max(5, number));
}

function resolveTrendProvider() {
  const settings = getSettings();
  const providerId = settings.trendProvider || 'openai';
  const provider = getTrendProvider(providerId);
  if (!provider) {
    throw new Error('trend provider is invalid');
  }
  const availability = getTrendProviderAvailability();
  if (!availability[providerId]) {
    throw new Error(`API key for ${providerId} is missing`);
  }
  return { providerId, provider };
}

module.exports = {
  generateTrendsForTopic,
  MODE_MAP,
  clampCount,
  buildTrendPrompt,
};
