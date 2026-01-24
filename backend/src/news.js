const MAX_ITEMS = 10;

const decodeEntities = (value = '') =>
  value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

const stripCdata = (value = '') => value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1');

const stripTags = (value = '') => value.replace(/<[^>]+>/g, '');

const normalize = (value) => decodeEntities(stripTags(stripCdata(value))).trim();

const extractTag = (value, tag) => {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = value.match(regex);
  return match ? normalize(match[1]) : '';
};

const extractLink = (value) => {
  const linkTag = extractTag(value, 'link');
  if (linkTag) return linkTag;

  const match = value.match(/<link[^>]*href=["']([^"']+)["'][^>]*>/i);
  return match ? match[1].trim() : '';
};

const parseItems = (xml) => {
  const itemBlocks = xml.match(/<item\b[\s\S]*?<\/item>/gi);
  const entryBlocks = xml.match(/<entry\b[\s\S]*?<\/entry>/gi);
  const blocks = itemBlocks?.length ? itemBlocks : entryBlocks || [];

  return blocks.slice(0, MAX_ITEMS).map((block) => {
    const title = extractTag(block, 'title') || 'Ohne Titel';
    const link = extractLink(block);
    const publishedAt =
      extractTag(block, 'pubDate') ||
      extractTag(block, 'updated') ||
      extractTag(block, 'published');
    const summary =
      extractTag(block, 'description') ||
      extractTag(block, 'summary') ||
      extractTag(block, 'content');

    return {
      title,
      link,
      publishedAt,
      summary,
    };
  });
};

const parseFeedMeta = (xml) => {
  const channelMatch = xml.match(/<channel\b[\s\S]*?<\/channel>/i);
  const source = channelMatch ? channelMatch[0] : xml;

  return {
    title: extractTag(source, 'title'),
    description: extractTag(source, 'description') || extractTag(source, 'subtitle'),
    link: extractLink(source),
  };
};

const parseFeed = (xml) => {
  const feed = parseFeedMeta(xml);
  const items = parseItems(xml);

  return {
    feed,
    items,
  };
};

module.exports = {
  parseFeed,
};
