'use strict';
function parseSearch(html) {
  const marker = /(?:var\s+ytInitialData\s*=|window\["ytInitialData"\]\s*=)\s*/g;
  const match = marker.exec(html); if (!match) throw new Error('YouTube не вернул результаты поиска. Попробуй ещё раз.');
  const start = html.indexOf('{', marker.lastIndex); let depth = 0, quoted = false, escaped = false, end = start;
  for (; end < html.length; end++) {
    const c = html[end];
    if (quoted) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === '"') quoted = false; }
    else if (c === '"') quoted = true; else if (c === '{') depth++; else if (c === '}' && --depth === 0) break;
  }
  const data = JSON.parse(html.slice(start, end + 1)), results = [], seen = new Set();
  const text = v => String(v?.simpleText || v?.runs?.map(r => r.text).join('') || '').slice(0, 300);
  function visit(node) {
    if (!node || typeof node !== 'object' || results.length >= 24) return;
    const v = node.videoRenderer;
    if (v && /^[\w-]{11}$/.test(v.videoId) && !seen.has(v.videoId)) {
      seen.add(v.videoId); results.push({ videoId: v.videoId, title: text(v.title), artist: text(v.ownerText), duration: text(v.lengthText) });
    }
    for (const value of Object.values(node)) if (value && typeof value === 'object') visit(value);
  }
  visit(data); return results;
}
async function searchYouTube(query) {
  if (typeof query !== 'string' || query.trim().length < 2 || query.length > 160) throw new Error('Введи от 2 до 160 символов');
  const response = await fetch('https://www.youtube.com/results?hl=ru&search_query=' + encodeURIComponent(query), {
    signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/142.0.0.0 Safari/537.36' }
  });
  if (!response.ok) throw new Error('Поиск YouTube временно недоступен');
  let html = '', size = 0;
  const decoder = new TextDecoder();
  for await (const chunk of response.body) { size += chunk.length; if (size > 4 * 1024 * 1024) throw new Error('Слишком большой ответ поиска'); html += decoder.decode(chunk, { stream: true }); }
  return parseSearch(html + decoder.decode());
}
module.exports = { parseSearch, searchYouTube };
