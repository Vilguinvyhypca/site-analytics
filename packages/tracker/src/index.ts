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
  let queue: Event[] = [];
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
      if (!path || excluded(window.location.pathname) || queue.length >= 100) return false;
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
      queue.push({ id: crypto.randomUUID(), sessionId: visit.id, timestamp: new Date().toISOString(), name: 'page_view', path, properties });
      persist();
      return true;
    } catch { return false; /* Analytics must never break the host page. */ }
  }
  async function flush() {
    if (!enabled || request || !queue.length) return false;
    const controller = new AbortController();
    request = controller;
    const epoch = generation;
    const events = queue.splice(0, 10);
    const timeout = setTimeout(() => controller.abort(), 5_000);
    try {
      const response = await fetch(endpoint.href, {
        method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: 1, projectId: options.projectId, events }), signal: controller.signal,
      });
      return enabled && epoch === generation && response.status === 202;
    } catch { return false; }
    finally {
      clearTimeout(timeout);
      if (request === controller) request = undefined;
    }
  }
  function start() {
    if (enabled) return;
    enabled = true;
    page();
    timer = setInterval(() => { void flush(); }, 2_000);
  }
  function stop() {
    enabled = false;
    generation += 1;
    if (timer !== undefined) clearInterval(timer);
    timer = undefined;
    queue = [];
    request?.abort();
    request = undefined;
    session = undefined;
    try { sessionStorage.removeItem(storageKey); } catch { /* Storage may be blocked. */ }
  }
  return { start, stop, page, flush, status: () => ({ collectionEnabled: enabled, queued: queue.length }) };
}
