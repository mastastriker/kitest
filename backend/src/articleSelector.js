function normalizeText(value) {
  return String(value || '').toLowerCase();
}

function chooseArticle(items) {
  if (!items.length) return null;
  const sorted = [...items].sort((a, b) => {
    const aTime = a.publishedAt ? Date.parse(a.publishedAt) : 0;
    const bTime = b.publishedAt ? Date.parse(b.publishedAt) : 0;
    return bTime - aTime;
  });
  return sorted[0] || null;
}

function decideDraftSource(items) {
  const valid = items.filter((item) => normalizeText(item?.link));
  if (!valid.length) {
    return { sourceType: 'trend', article: null };
  }
  const article = chooseArticle(valid);
  return { sourceType: 'rss', article };
}

module.exports = {
  chooseArticle,
  decideDraftSource,
};
