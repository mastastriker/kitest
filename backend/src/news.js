const crypto = require('crypto');

function decodeEntities(value = '') {
  return value
    .replace(/<!\[CDATA\[(.*?)\]\]>/gis, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripTags(value = '') {
  return value.replace(/<[^>]+>/g, '');
}

function extractTag(block, tagName) {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'i');
  const match = block.match(regex);
  if (!match) {
    return '';
  }
  return decodeEntities(match[1]).trim();
}

function extractLink(block) {
  const linkText = extractTag(block, 'link');
  if (linkText) {
    return linkText;
  }
  const linkMatch = block.match(/<link[^>]*href=["']([^"']+)["'][^>]*>/i);
  return linkMatch ? linkMatch[1].trim() : '';
}

function parseFeedItems(xml) {
  const itemBlocks = xml.match(/<item\b[\s\S]*?<\/item>/gi);
  const entryBlocks = xml.match(/<entry\b[\s\S]*?<\/entry>/gi);
  const blocks = itemBlocks || entryBlocks || [];
  return blocks.map((block) => {
    const title = extractTag(block, 'title');
    const guid = extractTag(block, 'guid') || extractTag(block, 'id');
    const pubDate =
      extractTag(block, 'pubDate') ||
      extractTag(block, 'published') ||
      extractTag(block, 'updated');
    const content =
      extractTag(block, 'content:encoded') ||
      extractTag(block, 'content') ||
      extractTag(block, 'description') ||
      extractTag(block, 'summary');
    return {
      title,
      guid,
      link: extractLink(block),
      pubDate,
      content,
    };
  });
}

function buildUniqueKey(source, item) {
  const identity = [
    source.id,
    item.guid,
    item.link,
    item.title,
    item.pubDate,
  ]
    .filter(Boolean)
    .join('|');
  return crypto.createHash('sha256').update(identity).digest('hex');
}

function normalizeItem(source, item) {
  const title = stripTags(item.title || '').trim() || 'Untitled';
  const content = stripTags(item.content || '').trim();
  const publishedAt = item.pubDate || new Date().toISOString();
  return {
    sourceId: source.id,
    sourceName: source.name,
    sourceUrl: source.url,
    title,
    content,
    publishedAt,
    topicIds: source.topicIds || [],
    uniqueKey: buildUniqueKey(source, item),
  };
}

async function fetchNewsForSource(source) {
  const res = await fetch(source.url);
  if (!res.ok) {
    throw new Error(`Feed error (${res.status})`);
  }
  const xml = await res.text();
  const items = parseFeedItems(xml).map((item) => normalizeItem(source, item));
  return items;
}

async function fetchNewsForSources(sources, addNewsItems, updateNewsSource) {
  const results = [];
  for (const source of sources) {
    try {
      const items = await fetchNewsForSource(source);
      const added = addNewsItems(items);
      updateNewsSource(source.id, {
        lastFetchedAt: new Date().toISOString(),
        lastStatus: `ok (${added.length} neu)`,
      });
      results.push({ sourceId: source.id, added: added.length });
    } catch (err) {
      updateNewsSource(source.id, {
        lastFetchedAt: new Date().toISOString(),
        lastStatus: `error: ${err.message}`,
      });
      results.push({ sourceId: source.id, added: 0, error: err.message });
    }
  }
  return results;
}

module.exports = {
  fetchNewsForSource,
  fetchNewsForSources,
};
