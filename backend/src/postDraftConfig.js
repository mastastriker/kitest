const { getPostPropertyMap } = require('./postProperties');

const THEME_CONFIGS = {
  crypto: {
    id: 'crypto',
    label: 'Crypto',
    allowedProperties: ['critical', 'provocative', 'educational', 'question-end', 'short-sentences'],
    rssFeeds: [
      'https://cointelegraph.com/rss',
      'https://www.coindesk.com/arc/outboundfeeds/rss/',
    ],
  },
  camping: {
    id: 'camping',
    label: 'Camping',
    allowedProperties: ['educational', 'optimistic', 'story', 'question-end', 'short-sentences'],
    rssFeeds: ['https://www.outsideonline.com/feed/', 'https://www.backpacker.com/feed/'],
  },
};

function getThemeList() {
  return Object.values(THEME_CONFIGS).map((theme) => ({ ...theme }));
}

function getThemeConfig(themeId) {
  return THEME_CONFIGS[themeId] ? { ...THEME_CONFIGS[themeId] } : null;
}

function getThemePropertyLabels(themeId) {
  const theme = THEME_CONFIGS[themeId];
  if (!theme) return [];
  const propertyMap = getPostPropertyMap();
  return theme.allowedProperties
    .map((id) => propertyMap[id])
    .filter(Boolean)
    .map((property) => ({ id: property.id, label: property.label }));
}

module.exports = {
  getThemeList,
  getThemeConfig,
  getThemePropertyLabels,
};
