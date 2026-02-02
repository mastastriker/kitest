function generateTrendId(prefix = 'trend') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeSources(sources) {
  if (!Array.isArray(sources)) {
    return [];
  }
  return sources.map((item) => String(item || '').trim()).filter(Boolean);
}

function buildTrend({ title, description, provider, sources }) {
  const cleanTitle = String(title || '').trim();
  const cleanDescription = String(description || '').trim();
  if (!cleanTitle || !cleanDescription) {
    return null;
  }
  return {
    id: generateTrendId(),
    title: cleanTitle,
    description: cleanDescription,
    provider,
    sources: normalizeSources(sources),
    created_at: new Date().toISOString(),
  };
}

function extractTrendLinesFromText(text, count) {
  if (!text) {
    return [];
  }
  const limit = Math.min(10, Math.max(1, Number(count) || 10));
  return String(text)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[-*•\d)+.\s]+/, '').trim())
    .filter(Boolean)
    .slice(0, limit);
}

const RECENCY_BLOCKLIST = [
  /\b(last week|past week|past weeks|recent weeks|weeks ago)\b/i,
  /\b(earlier this month|last month|past month|past months|months ago)\b/i,
  /\b(earlier this year|last year|years ago)\b/i,
  /\bin 20\d{2}\b/i,
];

const ABSOLUTE_CLAIM_PATTERNS = [
  /\brecord highs?\b/i,
  /\brecord lows?\b/i,
  /\bhighest ever\b/i,
  /\blowest ever\b/i,
];

const QUALIFIER_PATTERNS = [
  /\bdebate\b/i,
  /\bdiscussion\b/i,
  /\bclaims?\b/i,
  /\bclaiming\b/i,
  /\brumou?rs?\b/i,
  /\bspeculation\b/i,
  /\bunconfirmed\b/i,
  /\bconflicting\b/i,
  /\bmixed\b/i,
  /\bcontradiction\b/i,
  /\bquestion(?:ing)?\b/i,
  /\bdoubt(?:s|ful)?\b/i,
];

function referencesOlderTimeframe(text) {
  const content = String(text || '');
  return RECENCY_BLOCKLIST.some((pattern) => pattern.test(content));
}

function filterTrendsByRecency(trends = []) {
  const filtered = trends.filter(
    (trend) => !referencesOlderTimeframe(`${trend?.title || ''} ${trend?.description || ''}`)
  );
  if (trends.length && !filtered.length) {
    throw new Error('All trends were discarded because they referenced older timeframes');
  }
  return filtered;
}

function hasAbsoluteClaim(text) {
  return ABSOLUTE_CLAIM_PATTERNS.some((pattern) => pattern.test(String(text || '')));
}

function hasQualifier(text) {
  return QUALIFIER_PATTERNS.some((pattern) => pattern.test(String(text || '')));
}

function downgradeAbsoluteClaim(line) {
  const content = String(line || '').trim();
  if (!content) {
    return null;
  }
  if (!hasAbsoluteClaim(content) || hasQualifier(content)) {
    return content;
  }
  return `Debate on X about claims of ${content}`;
}

function enforceTrendPlausibility(trends = []) {
  const updated = [];
  for (const trend of trends) {
    if (!trend) {
      continue;
    }
    const combined = `${trend.title || ''} ${trend.description || ''}`.trim();
    if (!hasAbsoluteClaim(combined) || hasQualifier(combined)) {
      updated.push(trend);
      continue;
    }
    console.warn('Trend contains absolute claim without qualifiers; downgrading', {
      title: trend.title,
    });
    const downgradedTitle = downgradeAbsoluteClaim(trend.title);
    const downgradedDescription = downgradeAbsoluteClaim(trend.description);
    if (!downgradedTitle || !downgradedDescription) {
      console.warn('Discarding trend due to undowngradable absolute claim', {
        title: trend.title,
      });
      continue;
    }
    updated.push({
      ...trend,
      title: downgradedTitle,
      description: downgradedDescription,
    });
  }
  if (trends.length && !updated.length) {
    throw new Error('All trends were discarded due to implausible absolute claims');
  }
  return updated;
}

module.exports = {
  buildTrend,
  extractTrendLinesFromText,
  filterTrendsByRecency,
  enforceTrendPlausibility,
};
