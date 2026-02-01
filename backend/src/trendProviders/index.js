const { createOpenAITrendProvider } = require('./openaiProvider');
const { createGrokTrendProvider } = require('./grokProvider');

function getTrendProvider(providerId) {
  if (providerId === 'openai') {
    return createOpenAITrendProvider();
  }
  if (providerId === 'grok') {
    return createGrokTrendProvider();
  }
  return null;
}

function getTrendProviderAvailability() {
  return {
    openai: Boolean(process.env.OPENAI_API_KEY),
    grok: Boolean(process.env.GROK_API_KEY),
  };
}

module.exports = {
  getTrendProvider,
  getTrendProviderAvailability,
};
