const assert = require('assert');
const { decideDraftSource } = require('../src/articleSelector');

const item = (link, publishedAt = '2024-05-01T10:00:00Z') => ({
  link,
  publishedAt,
});

const withFeed = (link, name) => ({
  link,
  feedName: name,
  feedUrl: `https://${name}.example/rss`,
  publishedAt: '2024-05-02T10:00:00Z',
});

(() => {
  const result = decideDraftSource([item('https://example.com/a')]);
  assert.strictEqual(result.sourceType, 'rss');
  assert.ok(result.article);
  assert.strictEqual(result.article.link, 'https://example.com/a');
})();

(() => {
  const result = decideDraftSource([
    withFeed('https://example.com/a', 'feed-a'),
    withFeed('https://example.com/b', 'feed-b'),
  ]);
  assert.strictEqual(result.sourceType, 'rss');
  assert.ok(result.article.link);
})();

(() => {
  const result = decideDraftSource([]);
  assert.strictEqual(result.sourceType, 'trend');
  assert.strictEqual(result.article, null);
})();

(() => {
  const result = decideDraftSource([item('https://example.com/a')]);
  assert.strictEqual(result.sourceType, 'rss');
})();

console.log('articleSelector tests passed');
