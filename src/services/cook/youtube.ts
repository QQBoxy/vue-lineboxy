/**
 * YouTube 連結處理。純函式、無副作用。
 *
 * 只用縮圖 + 一般連結，不嵌 iframe：不需 API key，
 * 手機上會由 YouTube App 接手，iframe 在 PWA 內體驗差且吃流量。
 */

/** YouTube 影片 id 固定為 11 碼的 [A-Za-z0-9_-] */
const ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

const HOSTS = new Set([
  'youtu.be',
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);

/**
 * 支援 youtu.be/xxx、watch?v=xxx、shorts/xxx、embed/xxx、live/xxx。
 * 非 YouTube 連結或格式不符時回傳 null。
 */
export function parseYoutubeId(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  let parsed: URL;
  try {
    // 使用者常直接貼上沒有協定的網址，補一個才解析得動
    parsed = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  if (!HOSTS.has(parsed.hostname)) return null;

  if (parsed.hostname === 'youtu.be') {
    const id = parsed.pathname.slice(1).split('/')[0];
    return ID_PATTERN.test(id) ? id : null;
  }

  const v = parsed.searchParams.get('v');
  if (v && ID_PATTERN.test(v)) return v;

  const segments = parsed.pathname.split('/').filter(Boolean);
  if (segments.length >= 2 && ['shorts', 'embed', 'live', 'v'].includes(segments[0])) {
    return ID_PATTERN.test(segments[1]) ? segments[1] : null;
  }

  return null;
}

/** hqdefault 對所有影片都存在，maxresdefault 只有高畫質影片才有，會破圖 */
export function youtubeThumbnail(id: string): string {
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
}

export function youtubeWatchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}

/**
 * 非 YouTube 連結的顯示標題：使用者填的標題優先，否則退回網域名。
 * 不抓 og:image——需要 CORS proxy，v1 不做。
 */
export function linkDisplayLabel(url: string, title?: string): string {
  if (title && title.trim()) return title.trim();
  try {
    const parsed = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** 補上協定，否則 <a href> 會被當成站內相對路徑 */
export function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}
