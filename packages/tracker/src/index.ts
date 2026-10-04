import type { PageView, TrackerOptions } from '@site-analytics/contracts';

/** No storage, timers or requests until the host explicitly starts collection. */
export function createTracker(options: TrackerOptions) {
  const endpoint = new URL(options.collectionUrl, location.href);
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(options.projectId) ||
      !['http:', 'https:'].includes(endpoint.protocol) || endpoint.username || endpoint.password ||
      typeof options.publicPath !== 'function') throw new Error('Invalid tracker configuration');
  const storageKey = `site-analytics:session:v1:${options.projectId}`;
  let enabled = false;
  let session: { id: string; last: number } | undefined;
  let queue: PageView[] = [];
  let timer: ReturnType<typeof setInterval> | undefined;
  let controller: AbortController | undefined;
  let generation = 0;
  function readSession() {
    try {
      const value = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null');
      if (value && typeof value.id === 'string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value.id) &&
          Number.isFinite(value.last) && value.last <= Date.now() && Date.now() - value.last < 1800000) session = value;
    } catch { /* Storage unavailable: consented memory fallback. */ }
  }
  function pageView() {
    if (!enabled) return false;
    let path: string | null;
    try { path = options.publicPath(new URL(location.href)); } catch { return false; }
    if (!path || path.length > 1024 || !/^\/(?!\/)[^?#\\\s\u0000-\u0020]*$/.test(path)) return false;
    const now = Date.now();
    if (!session || now - session.last >= 1800000) session = { id: crypto.randomUUID(), last: now };
    session.last = now;
    try { sessionStorage.setItem(storageKey, JSON.stringify(session)); } catch { /* Memory fallback. */ }
    let referrerHost: string | undefined;
    try {
      const referrer = new URL(document.referrer);
      if (['http:', 'https:'].includes(referrer.protocol) && referrer.hostname.length <= 253 && /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(referrer.hostname)) referrerHost = referrer.hostname;
    } catch { /* No eligible referrer. */ }
    if (queue.length >= 100) return false;
    queue.push({ version: 1, projectId: options.projectId, eventId: crypto.randomUUID(), sessionId: session.id,
      occurredAt: new Date(now).toISOString(), type: 'page_view', path, ...(referrerHost ? { referrerHost } : {}) });
    return true;
  }
  async function flush() {
    if (!enabled || controller || !queue.length) return false;
    const currentGeneration = generation;
    const events: PageView[] = [];
    for (const event of queue.slice(0, 50)) {
      const candidate = [...events, event];
      if (new TextEncoder().encode(JSON.stringify({ version: 1, projectId: options.projectId, events: candidate })).length > 65536) break;
      events.push(event);
    }
    queue.splice(0, events.length);
    const request = new AbortController();
    controller = request;
    const timeout = setTimeout(() => request.abort(), 5000);
    try {
      const response = await fetch(endpoint.href, { method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version: 1, projectId: options.projectId, events }), signal: request.signal });
      return response.ok;
    } catch { return false; }
    finally {
      clearTimeout(timeout);
      if (generation === currentGeneration) controller = undefined;
    }
    // Failed batches are discarded. Bounded retry/backoff is Day 5.
  }
  function stop() {
    enabled = false;
    generation++;
    if (timer) clearInterval(timer);
    timer = undefined;
    controller?.abort();
    controller = undefined;
    queue = [];
    session = undefined;
    try { sessionStorage.removeItem(storageKey); } catch { /* Storage unavailable. */ }
  }
  function start() {
    if (enabled) return;
    enabled = true;
    readSession();
    pageView();
    timer = setInterval(() => { void flush(); }, 2000);
  }
  return Object.freeze({ version: 1, get collectionEnabled() { return enabled; }, start, stop, pageView, flush });
}
