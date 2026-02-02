const { getSettings, setTrends } = require('./store');
const { getTrendProvider, getTrendProviderAvailability } = require('./trendProviders');

const MODE_MAP = {
  current: 'Aktuelle Trends',
  controversy: 'Kontroverse Themen',
  questions: 'Offene Fragen',
};

const TECHNICAL_STRONG_PATTERNS = [
  /\bEIP-\d+\b/i,
  /\bBIP-\d+\b/i,
  /\bCIP-\d+\b/i,
  /\bERC-\d+\b/i,
  /\bBEP-\d+\b/i,
];

const TECHNICAL_PATTERNS = [
  /\bprotocol\b/i,
  /\bupgrade\b/i,
  /\bhard fork\b/i,
  /\bsoft fork\b/i,
  /\bmainnet\b/i,
  /\btestnet\b/i,
  /\bdevnet\b/i,
  /\bconsensus\b/i,
  /\bvalidator\b/i,
  /\bexecution layer\b/i,
  /\bconsensus layer\b/i,
  /\bsmart contract\b/i,
  /\bsolidity\b/i,
  /\bvirtual machine\b/i,
  /\bnode\b/i,
  /\bclient\b/i,
  /\brpc\b/i,
  /\bthroughput\b/i,
  /\btps\b/i,
  /\bblock time\b/i,
  /\bblock size\b/i,
  /\bgas\b/i,
  /\bfee model\b/i,
  /\bsequencer\b/i,
  /\brollup\b/i,
  /\bzk\b/i,
  /\boptimistic\b/i,
  /\barchitecture\b/i,
  /\bimplementation\b/i,
  /\bparameter\b/i,
  /\bupgrade\b/i,
  /\brelease\b/i,
  /\bversion\b/i,
];

const NARRATIVE_PATTERNS = [
  /\bregulat/i,
  /\bsec\b/i,
  /\bcftc\b/i,
  /\bgovernment\b/i,
  /\bpolicy\b/i,
  /\blaw\b/i,
  /\blawsuit\b/i,
  /\bcourt\b/i,
  /\bsettlement\b/i,
  /\bban\b/i,
  /\betf\b/i,
  /\binstitution\b/i,
  /\bbank\b/i,
  /\bfund\b/i,
  /\bmacro\b/i,
  /\binflation\b/i,
  /\brate\b/i,
  /\bmarket\b/i,
  /\bprice\b/i,
  /\brally\b/i,
  /\bdump\b/i,
  /\bcrash\b/i,
  /\bcapitulation\b/i,
  /\bsentiment\b/i,
  /\bwhale\b/i,
  /\bhype\b/i,
  /\bfear\b/i,
  /\bgreed\b/i,
  /\badoption\b/i,
  /\bpartnership\b/i,
  /\bexchange\b/i,
  /\blisting\b/i,
  /\bdelisting\b/i,
  /\bhack\b/i,
  /\bexploit\b/i,
  /\bscam\b/i,
  /\bairdrop\b/i,
  /\btoken unlock\b/i,
  /\btreasury\b/i,
];

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
  const labeled = applyTrendLabels(trends);
  if (!Array.isArray(labeled) || !labeled.length) {
    throw new Error('Trend provider did not return any trends');
  }
  setTrends(labeled);
  return labeled;
}

async function fetchTrendsForProvider(providerId, topicName, mode, count = 7) {
  if (!topicName) {
    throw new Error('topicName is required');
  }
  const modeLabel = MODE_MAP[mode];
  if (!modeLabel) {
    throw new Error('mode is invalid');
  }
  const clamped = clampCount(count);
  const provider = getTrendProvider(providerId);
  if (!provider) {
    throw new Error('trend provider is invalid');
  }
  const availability = getTrendProviderAvailability();
  if (!availability[providerId]) {
    throw new Error(`API key for ${providerId} is missing`);
  }
  try {
    const trends = await provider.fetchTrends({ topicName, mode, modeLabel, count: clamped });
    const labeled = applyTrendLabels(trends);
    if (!Array.isArray(labeled) || !labeled.length) {
      throw new Error('Trend provider did not return any trends');
    }
    return labeled.slice(0, clamped);
  } catch (error) {
    if (providerId === 'grok') {
      console.error('Grok TrendProvider failed', error);
    }
    throw error;
  }
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

function applyTrendLabels(trends = []) {
  if (!Array.isArray(trends)) {
    return [];
  }
  return trends
    .map((trend) => {
      if (!trend) {
        return null;
      }
      const label = assignTrendLabel(trend);
      return { ...trend, label };
    })
    .filter(Boolean)
    .filter((trend) => trend.label !== 'technisch');
}

function assignTrendLabel(trend) {
  const content = `${trend?.title || ''} ${trend?.description || ''}`.trim();
  if (!content) {
    return 'sachlich';
  }
  if (isTechnicalTrend(content)) {
    return 'technisch';
  }
  if (isNarrativeTrend(content)) {
    return 'narrativ';
  }
  return 'sachlich';
}

function countMatches(text, patterns) {
  return patterns.reduce((total, pattern) => total + (pattern.test(text) ? 1 : 0), 0);
}

function isTechnicalTrend(text) {
  const strong = TECHNICAL_STRONG_PATTERNS.some((pattern) => pattern.test(text));
  if (strong) {
    return true;
  }
  const technicalScore = countMatches(text, TECHNICAL_PATTERNS);
  if (technicalScore >= 2 && !isNarrativeTrend(text)) {
    return true;
  }
  return technicalScore >= 3;
}

function isNarrativeTrend(text) {
  return countMatches(text, NARRATIVE_PATTERNS) > 0;
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
  fetchTrendsForProvider,
  MODE_MAP,
  clampCount,
  buildTrendPrompt,
};
