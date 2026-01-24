const DEFAULT_MAX_ITEMS = 5;

async function fetchNewsFromFeed(feedUrl, maxItems = DEFAULT_MAX_ITEMS) {
  if (!feedUrl) {
    return [];
  }
  const response = await fetch(feedUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; KitestBot/1.0)',
      Accept: 'application/rss+xml, application/xml;q=0.9, */*;q=0.8',
    },
  });
  if (!response.ok) {
    throw new Error(`Feed request failed (${response.status})`);
  }
  const xml = await response.text();
  const items = parseFeedItems(xml);
  return items.slice(0, maxItems);
}

function renderNewsContext(items) {
  if (!items.length) {
    return '';
  }
  const lines = items
    .filter((item) => item.title)
    .map((item) => {
      if (item.link) {
        return `- ${item.title} (${item.link})`;
      }
      return `- ${item.title}`;
    });
  if (!lines.length) {
    return '';
  }
  return `\n\nAktuelle News aus dem Feed:\n${lines.join('\n')}`;
}

function parseFeedItems(xml) {
  const normalized = xml.replace(/\r?\n/g, ' ');
  const itemBlocks = extractBlocks(normalized, 'item');
  const entryBlocks = extractBlocks(normalized, 'entry');
  const blocks = itemBlocks.length ? itemBlocks : entryBlocks;
  return blocks
    .map((block) => ({
      title: extractValue(block, 'title'),
      link: extractLink(block),
    }))
    .filter((item) => item.title);
}

function extractBlocks(source, tag) {
  const regex = new RegExp(`<${tag}[^>]*>(.*?)</${tag}>`, 'gi');
  const blocks = [];
  let match = regex.exec(source);
  while (match) {
    blocks.push(match[1]);
    match = regex.exec(source);
  }
  return blocks;
}

function extractValue(source, tag) {
  const regex = new RegExp(`<${tag}[^>]*>(.*?)</${tag}>`, 'i');
  const match = regex.exec(source);
  if (!match) {
    return '';
  }
  return stripCdata(match[1]).trim();
}

function extractLink(source) {
  const linkTag = /<link[^>]*>(.*?)<\/link>/i.exec(source);
  if (linkTag) {
    return stripCdata(linkTag[1]).trim();
  }
  const atomLink = /<link[^>]*href="([^"]+)"[^>]*\/?>/i.exec(source);
  if (atomLink) {
    return atomLink[1].trim();
  }
  return '';
}

function stripCdata(value) {
  return value.replace(/<!\[CDATA\[(.*?)\]\]>/gi, '$1');
}

module.exports = {
  fetchNewsFromFeed,
  renderNewsContext,
};
