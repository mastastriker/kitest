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

module.exports = {
  buildTrend,
  extractTrendLinesFromText,
  filterTrendsByRecency,
};
