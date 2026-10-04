/** Framework-independent, opt-in page collection. Loading this bundle is inert. */
export interface TrackerOptions {
  projectId: string;
  collectionUrl: string;
  /** Exact public URL paths mapped to safe report labels. Unlisted paths are excluded. */
  pages: Record<string, string>;
  /** Only these explicitly approved campaign values can leave the page. */
  campaigns?: { source?: string[]; medium?: string[]; campaign?: string[] };
}
type Event = { id: string; sessionId: string; timestamp: string; name: 'page_view'; path: string; properties: Record<string, string> };
type Pending = { event: Event; attempts: number; dueAt: number };
type Session = { id: string; lastActivity: number; attributed: boolean };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const safePath = (path: string) => path.length <= 512 && /^\/(?!\/)[^?#\\\s%]*$/.test(path) && [...path].every(character => character.charCodeAt(0) >= 32);
const safeValue = (value: string) => /^[a-zA-Z0-9_-]{1,100}$/.test(value);
const excluded = (path: string) => /^\/(admin|api)(\/|$)/i.test(path);
export function status() { return { collectionEnabled: false, reason: 'explicit-start-required' } as const; }

export function createTracker(options: TrackerOptions) {
  if (!uuid.test(options.projectId)) throw new Error('Invalid analytics project ID.');
  const endpoint = new URL(options.collectionUrl);
  if ((endpoint.protocol !== 'https:' && !(endpoint.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname))) || endpoint.username || endpoint.password || endpoint.search || endpoint.hash || endpoint.pathname !== `/v1/collect/${options.projectId}`) throw new Error('Invalid collection URL.');
  const pages = new Map(Object.entries(options.pages));
  if ([...pages].some(([path, label]) => !safePath(path) || !safePath(label) || excluded(path) || excluded(label))) throw new Error('Only safe public page paths are allowed.');
  const campaigns = Object.fromEntries(Object.entries(options.campaigns ?? {}).map(([key, values]) => [key, new Set(values.filter(safeValue))]));
  const storageKey = `site-analytics:v1:${options.projectId}`;
  let enabled = false;
  let session: Session | undefined;
  let queue: Pending[] = [];
  let inFlight = 0;
  let lastPath = "";
  let removeNavigation: (() => void) | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  let request: AbortController | undefined;
  let generation = 0;
  function persist() {
    try { sessionStorage.setItem(storageKey, JSON.stringify(session)); } catch { /* Memory-only when storage is unavailable. */ }
  }
  function currentSession() {
    const now = Date.now();
    if (!session) {
      try {
        const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null') as Session | null;
        if (saved && uuid.test(saved.id) && Number.isFinite(saved.lastActivity) && typeof saved.attributed === 'boolean') session = saved;
      } catch { /* Start fresh if storage is blocked or malformed. */ }
    }
    if (!session || now - session.lastActivity >= 30 * 60_000 || session.lastActivity > now) session = { id: crypto.randomUUID(), lastActivity: now, attributed: false };
    session.lastActivity = now;
    return session;
  }
  function page() {
    if (!enabled) return false;
    try {
      const path = pages.get(window.location.pathname);
      if (!path || excluded(window.location.pathname) || queue.length + inFlight >= 100) return false;
      const visit = currentSession();
      const properties: Record<string, string> = {};
      if (!visit.attributed) {
        const query = new URLSearchParams(window.location.search);
        for (const key of ['source', 'medium', 'campaign']) {
          const value = query.get(`utm_${key}`);
          if (value && campaigns[key]?.has(value)) properties[key] = value;
        }
        try {
          const referrer = new URL(document.referrer);
          if (['http:', 'https:'].includes(referrer.protocol) && referrer.origin !== window.location.origin && /^[a-z0-9.-]{1,128}$/i.test(referrer.hostname)) properties.referrer_host = referrer.hostname;
        } catch { /* No referrer is normal. */ }
        visit.attributed = true;
      }
      queue.push({ event: { id: crypto.randomUUID(), sessionId: visit.id, timestamp: new Date().toISOString(), name: 'page_view', path, properties }, attempts: 0, dueAt: 0 });
      persist();
      return true;
    } catch { return false; /* Analytics must never break the host page. */ }
  }
  async function flush(exit = false) {
    if (!enabled || request) return false;
    const now = Date.now();
    // Old or clock-invalid events must never poison a whole API batch.
    queue = queue.filter(({ event }) => { const age = now - Date.parse(event.timestamp); return age >= 0 && age < 86_340_000; });
    if (!queue.length || queue[0]!.dueAt > now) return false;
    const batch: Pending[] = [];
    while (batch.length < 10 && queue[0] && queue[0].dueAt <= now) batch.push(queue.shift()!);
    const controller = new AbortController();
    request = controller;
    inFlight = batch.length;
    const epoch = generation;
    for (const entry of batch) entry.attempts += 1;
    const timeout = setTimeout(() => controller.abort(), 5_000);
    let retry = false;
    let retryAfter = 0;
    try {
      const response = await fetch(endpoint.href, {
        method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer', keepalive: exit,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: 1, projectId: options.projectId, events: batch.map(entry => entry.event) }), signal: controller.signal,
      });
      retry = response.status === 429 || response.status >= 500;
      const header = response.headers?.get('Retry-After');
      if (retry && header) {
        const seconds = Number(header);
        const delay = Number.isFinite(seconds) ? seconds * 1_000 : Date.parse(header) - Date.now();
        if (Number.isFinite(delay)) retryAfter = Math.min(30_000, Math.max(0, delay));
      }
      return enabled && epoch === generation && response.status === 202;
    } catch { retry = true; return false; }
    finally {
      clearTimeout(timeout);
      if (enabled && epoch === generation && retry) {
        const pending = batch.filter(entry => entry.attempts < 3);
        for (const entry of pending) entry.dueAt = Date.now() + Math.max(retryAfter, 1_000 * 2 ** (entry.attempts - 1));
        queue = [...pending, ...queue];
      }
      if (request === controller) { request = undefined; inFlight = 0; }
    }
  }
  function routeChanged() {
    if (!enabled || window.location.pathname === lastPath) return;
    lastPath = window.location.pathname;
    page();
  }
  function leaving() { void flush(true); }
  function visibilityChanged() { if (document.visibilityState === 'hidden') leaving(); }
  function restored(event: PageTransitionEvent) {
    // A BFCache restore is another visible visit without a new document.
    if (event.persisted) { lastPath = window.location.pathname; page(); }
  }
  function watchNavigation() {
    const originalPush = window.history.pushState;
    const originalReplace = window.history.replaceState;
    const push: History['pushState'] = function (this: History, ...args) { originalPush.apply(this, args); routeChanged(); };
    const replace: History['replaceState'] = function (this: History, ...args) { originalReplace.apply(this, args); routeChanged(); };
    window.history.pushState = push;
    window.history.replaceState = replace;
    window.addEventListener('popstate', routeChanged);
    window.addEventListener('pagehide', leaving);
    window.addEventListener('pageshow', restored);
    document.addEventListener('visibilitychange', visibilityChanged);
    return () => {
      // Preserve wrappers installed later by the host or another tracker.
      if (window.history.pushState === push) window.history.pushState = originalPush;
      if (window.history.replaceState === replace) window.history.replaceState = originalReplace;
      window.removeEventListener('popstate', routeChanged);
      window.removeEventListener('pagehide', leaving);
      window.removeEventListener('pageshow', restored);
      document.removeEventListener('visibilitychange', visibilityChanged);
    };
  }
  function start() {
    if (enabled) return;
    enabled = true;
    lastPath = window.location.pathname;
    page();
    removeNavigation = watchNavigation();
    timer = setInterval(() => { void flush(); }, 2_000);
  }
  function stop() {
    enabled = false;
    generation += 1;
    if (timer !== undefined) clearInterval(timer);
    timer = undefined;
    queue = [];
    inFlight = 0;
    removeNavigation?.();
    removeNavigation = undefined;
    request?.abort();
    request = undefined;
    session = undefined;
    try { sessionStorage.removeItem(storageKey); } catch { /* Storage may be blocked. */ }
  }
  return { start, stop, page, flush, status: () => ({ collectionEnabled: enabled, queued: queue.length }) };
}
