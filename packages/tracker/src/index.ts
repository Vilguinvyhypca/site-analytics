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
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let retryAttempt = 0;
  let retriesExhausted = false;
  let controller: AbortController | undefined;
  let generation = 0;
  let lastRoute: string | undefined;
  let originalPushState: History['pushState'] | undefined;
  let originalReplaceState: History['replaceState'] | undefined;
  let trackedPushState: History['pushState'] | undefined;
  let trackedReplaceState: History['replaceState'] | undefined;
  const onPopState = () => { recordRoute(); };
  const onHashChange = () => { recordRoute(); };
  const onVisibilityChange = () => { if (document.visibilityState === 'hidden') void flush(true, true); };
  const onPageHide = () => { void flush(true, true); };

  function readSession() {
    try {
      const value = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null');
      if (value && typeof value.id === 'string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value.id) &&
          Number.isFinite(value.last) && value.last <= Date.now() && Date.now() - value.last < 1800000) session = value;
    } catch { /* Storage unavailable: consented memory fallback. */ }
  }
  function publicPath(): string | null {
    try {
      const path = options.publicPath(new URL(location.href));
      return path && path.length <= 1024 && /^\/(?!\/)[^?#\\\s\u0000-\u0020]*$/.test(path) ? path : null;
    } catch { return null; }
  }
  function pageView() {
    if (!enabled) return false;
    const path = publicPath();
    if (!path) return false;
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
  function recordRoute() {
    if (!enabled) return false;
    const path = publicPath();
    if (!path) { lastRoute = undefined; return false; }
    if (path === lastRoute) return false;
    lastRoute = path;
    const added = pageView();
    if (added) void flush(false, true);
    return added;
  }
  function requestEvents(): PageView[] {
    const events: PageView[] = [];
    for (const event of queue.slice(0, 50)) {
      const candidate = [...events, event];
      if (new TextEncoder().encode(JSON.stringify({ version: 1, projectId: options.projectId, events: candidate })).length > 65536) break;
      events.push(event);
    }
    return events;
  }
  function scheduleRetry() {
    if (!enabled || retryTimer) return;
    if (retryAttempt >= 5) { retriesExhausted = true; return; }
    const delay = Math.min(1000 * 2 ** retryAttempt, 30000);
    retryAttempt++;
    retryTimer = setTimeout(() => { retryTimer = undefined; void flush(false, true); }, delay);
  }
  async function flush(keepalive = false, automatic = false) {
    if (automatic && retriesExhausted) return false;
    if (!automatic) { retriesExhausted = false; retryAttempt = 0; }
    if (!enabled || controller || !queue.length) return false;
    const events = requestEvents();
    if (!events.length) return false;
    const currentGeneration = generation;
    const request = new AbortController();
    controller = request;
    const timeout = setTimeout(() => request.abort(), keepalive ? 1500 : 5000);
    try {
      const response = await fetch(endpoint.href, { method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer', keepalive,
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version: 1, projectId: options.projectId, events }), signal: request.signal });
      if (response.ok && generation === currentGeneration) {
        queue.splice(0, events.length);
        retryAttempt = 0;
        retriesExhausted = false;
        if (retryTimer) clearTimeout(retryTimer);
        retryTimer = undefined;
        return true;
      }
      // Retry network/5xx/rate-limit failures only. Other 4xx responses are permanent.
      if ((response.status === 429 || response.status >= 500) && generation === currentGeneration) scheduleRetry();
      else if (!response.ok && generation === currentGeneration) queue.splice(0, events.length);
      return false;
    } catch {
      if (generation === currentGeneration) scheduleRetry();
      return false;
    } finally {
      clearTimeout(timeout);
      if (generation === currentGeneration) controller = undefined;
    }
  }
  function restoreHistory() {
    if (originalPushState && history.pushState === trackedPushState) history.pushState = originalPushState;
    if (originalReplaceState && history.replaceState === trackedReplaceState) history.replaceState = originalReplaceState;
    originalPushState = undefined;
    originalReplaceState = undefined;
    trackedPushState = undefined;
    trackedReplaceState = undefined;
  }
  function stop() {
    enabled = false;
    generation++;
    if (timer) clearInterval(timer);
    if (retryTimer) clearTimeout(retryTimer);
    timer = undefined;
    retryTimer = undefined;
    retryAttempt = 0;
    retriesExhausted = false;
    window.removeEventListener('popstate', onPopState);
    window.removeEventListener('hashchange', onHashChange);
    window.removeEventListener('pagehide', onPageHide);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    restoreHistory();
    controller?.abort();
    controller = undefined;
    queue = [];
    session = undefined;
    lastRoute = undefined;
    try { sessionStorage.removeItem(storageKey); } catch { /* Storage unavailable. */ }
  }
  function start() {
    if (enabled) return;
    enabled = true;
    readSession();
    lastRoute = undefined;
    recordRoute();
    originalPushState = history.pushState;
    originalReplaceState = history.replaceState;
    trackedPushState = function (this: History, ...args: Parameters<History['pushState']>) {
      const result = originalPushState!.apply(this, args);
      queueMicrotask(recordRoute);
      return result;
    };
    trackedReplaceState = function (this: History, ...args: Parameters<History['replaceState']>) {
      const result = originalReplaceState!.apply(this, args);
      queueMicrotask(recordRoute);
      return result;
    };
    history.pushState = trackedPushState;
    history.replaceState = trackedReplaceState;
    window.addEventListener('popstate', onPopState);
    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibilityChange);
    timer = setInterval(() => { void flush(false, true); }, 2000);
  }
  return Object.freeze({ version: 1, get collectionEnabled() { return enabled; }, start, stop, pageView, flush, recordRoute });
}
