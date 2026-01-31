const COMPLETE_SENTENCE_REGEX = /[.!?][\"'”’)]?$/;

function endsWithCompleteSentence(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return false;
  return COMPLETE_SENTENCE_REGEX.test(trimmed);
}

function hasCompleteUrls(text) {
  const trimmed = String(text || '').trim();
  const matches = trimmed.match(/https?:\/\/\S+/gi) || [];
  const hasHttp = /https?:\/\//i.test(trimmed);
  if (!matches.length) {
    return !/http/i.test(trimmed);
  }
  if (!hasHttp) {
    return false;
  }
  for (const url of matches) {
    const lower = url.toLowerCase();
    if (lower === 'http://' || lower === 'https://') {
      return false;
    }
    if (url.endsWith('...') || url.endsWith('…')) {
      return false;
    }
  }
  const lastMatch = matches[matches.length - 1];
  const lines = trimmed.split('\n').map((line) => line.trim()).filter(Boolean);
  const lastLine = lines[lines.length - 1] || '';
  if (lastLine !== lastMatch) {
    return false;
  }
  if (!trimmed.endsWith(lastMatch)) {
    return false;
  }
  return true;
}

function isCompletePostText(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return false;
  if (!endsWithCompleteSentence(trimmed)) return false;
  if (!hasCompleteUrls(trimmed)) return false;
  return true;
}

module.exports = {
  isCompletePostText,
};
