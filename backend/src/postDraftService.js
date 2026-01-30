const { parseFeed } = require('./news');
const { generateTrendsForTopic } = require('./trends');
const { getThemeConfig } = require('./postDraftConfig');
const { generateDraftFromSource } = require('./postDraftGenerator');
const {
  addPostDraft,
  getDraftBySourceRef,
  getDraftStatsByTheme,
} = require('./store');

const MAX_GENERATED_PER_THEME = 3;
const MAX_PER_DAY = 5;

async function generateDraft({ themeId, mode, manualItem }) {
  const theme = getThemeConfig(themeId);
  if (!theme) {
    throw new Error('theme is invalid');
  }
  enforceLimits(theme.id);

  if (mode === 'manual') {
    if (!manualItem?.title || !manualItem?.link) {
      throw new Error('manual RSS item is required');
    }
    const manualResult = await generateFromItem(theme, manualItem, {
      sourceType: 'manual',
      requireLink: true,
      skipOnLowScore: false,
    });
    if (!manualResult) {
      throw new Error('article did not meet analysis threshold');
    }
    return manualResult;
  }

  const rssDraft = await generateFromRss(theme);
  if (rssDraft) {
    return rssDraft;
  }

  const trendDraft = await generateFromTrend(theme);
  if (trendDraft) {
    return trendDraft;
  }

  throw new Error('no eligible sources available');
}

function enforceLimits(themeId) {
  const stats = getDraftStatsByTheme(themeId);
  if (stats.generatedCount >= MAX_GENERATED_PER_THEME) {
    throw new Error('max generated drafts reached for theme');
  }
  if (stats.recentCount >= MAX_PER_DAY) {
    throw new Error('max drafts per day reached for theme');
  }
}

async function generateFromRss(theme) {
  const feeds = Array.isArray(theme.rssFeeds) ? theme.rssFeeds : [];
  if (!feeds.length) {
    return null;
  }
  for (const feedUrl of feeds) {
    const items = await fetchFeedItems(feedUrl);
    const item = selectEligibleItem(items);
    if (!item) {
      continue;
    }
    const result = await generateFromItem(theme, item, {
      sourceType: 'rss',
      requireLink: true,
      skipOnLowScore: true,
    });
    if (result) {
      return result;
    }
  }
  return null;
}

async function generateFromItem(theme, item, options) {
  const sourceRef = item.link;
  if (getDraftBySourceRef(sourceRef)) {
    throw new Error('source already used');
  }
  const source = {
    title: item.title,
    content: item.summary || item.content || item.title,
    link: item.link,
    publishedAt: item.publishedAt,
  };
  const generated = await generateDraftFromSource({
    theme: theme.id,
    source,
    allowedProperties: theme.allowedProperties,
    requireLink: options.requireLink,
  });
  if (!generated.eligible) {
    if (options.skipOnLowScore) {
      return null;
    }
    throw new Error('analysis score below threshold');
  }
  const draft = addPostDraft({
    theme: theme.id,
    content: generated.content,
    status: 'generated',
    source_type: options.sourceType,
    source_ref: sourceRef,
  });
  return {
    draft,
    analysis: generated.analysis,
    idea: generated.idea,
    source,
  };
}

async function generateFromTrend(theme) {
  const trends = await generateTrendsForTopic(theme.label, 'current', 6);
  for (const trend of trends) {
    const sourceRef = `trend:${trend}`;
    if (getDraftBySourceRef(sourceRef)) {
      continue;
    }
    const source = {
      title: trend,
      content: trend,
      link: '',
      publishedAt: '',
    };
    const generated = await generateDraftFromSource({
      theme: theme.id,
      source,
      allowedProperties: theme.allowedProperties,
      requireLink: false,
    });
    if (!generated.eligible) {
      continue;
    }
    const draft = addPostDraft({
      theme: theme.id,
      content: generated.content,
      status: 'generated',
      source_type: 'trend',
      source_ref: sourceRef,
    });
    return {
      draft,
      analysis: generated.analysis,
      idea: generated.idea,
      source,
    };
  }
  return null;
}

async function fetchFeedItems(feedUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(feedUrl, {
      headers: { accept: 'application/rss+xml, application/xml, text/xml, */*' },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) {
      return [];
    }
    const xml = await response.text();
    const parsed = parseFeed(xml);
    return parsed.items || [];
  } catch (err) {
    clearTimeout(timeout);
    return [];
  }
}

function selectEligibleItem(items = []) {
  const sorted = [...items];
  sorted.sort((a, b) => Date.parse(b.publishedAt || 0) - Date.parse(a.publishedAt || 0));
  return (
    sorted.find((item) => {
      if (!item.link) {
        return false;
      }
      return !getDraftBySourceRef(item.link);
    }) || null
  );
}

module.exports = {
  generateDraft,
};
