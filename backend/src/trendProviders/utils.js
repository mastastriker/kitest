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

function parseTrendPayload(payload) {
  try {
    const parsed = JSON.parse(payload);
    const items = Array.isArray(parsed.trends) ? parsed.trends : [];
    return items;
  } catch (error) {
    return [];
  }
}

module.exports = {
  buildTrend,
  parseTrendPayload,
};
