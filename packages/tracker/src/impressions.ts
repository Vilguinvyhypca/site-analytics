export interface ImpressionOptions {
  contentId: string;
  contentType: 'photo' | 'video';
  isPublic: () => boolean;
}

/** One observer and clock for all registered thumbnails; inactive before consent. */
export function createImpressions(host: {
  view(): string | undefined;
  emit(options: ImpressionOptions): boolean;
}) {
  const entries = new Map<HTMLElement, { options: ImpressionOptions; visible: boolean; since?: number }>();
  const recorded = new Set<string>();
  let view: string | undefined;
  let observer: IntersectionObserver | undefined;
  let active = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  function reset() { for (const entry of entries.values()) entry.since = undefined; }
  function tick() {
    const current = host.view();
    if (current !== view) { view = current; recorded.clear(); reset(); }
    const now = performance.now();
    for (const [element, entry] of entries) {
      let eligible = false;
      try { eligible = !!view && document.visibilityState === 'visible' && element.isConnected && entry.visible && entry.options.isPublic() === true; } catch { /* Unknown visibility is private. */ }
      if (!eligible) { entry.since = undefined; continue; }
      const key = `${entry.options.contentType}:${entry.options.contentId}`;
      if (recorded.has(key) || recorded.size >= 1000) continue;
      entry.since ??= now;
      if (now - entry.since >= 1000 && host.emit(entry.options)) recorded.add(key);
    }
  }
  function start() {
    active = true;
    if (observer || !entries.size || typeof IntersectionObserver === 'undefined') return;
    observer = new IntersectionObserver(changes => {
      for (const change of changes) {
        const entry = entries.get(change.target as HTMLElement);
        if (!entry) continue;
        entry.visible = change.isIntersecting && change.intersectionRatio >= 0.5;
        if (!entry.visible) entry.since = undefined;
      }
      tick();
    }, { threshold: [0, 0.5] });
    for (const element of entries.keys()) observer.observe(element);
    document.addEventListener('visibilitychange', reset);
    timer = setInterval(tick, 250);
  }
  function stop() {
    active = false;
    observer?.disconnect(); observer = undefined;
    if (timer) clearInterval(timer);
    timer = undefined;
    document.removeEventListener('visibilitychange', reset);
    recorded.clear(); view = undefined;
    for (const entry of entries.values()) { entry.visible = false; entry.since = undefined; }
  }
  function register(element: HTMLElement, options: ImpressionOptions) {
    if (!(element instanceof HTMLElement) || !/^[A-Za-z0-9_-]{1,128}$/.test(options.contentId) ||
      !['photo', 'video'].includes(options.contentType) || typeof options.isPublic !== 'function') throw new Error('Invalid impression registration');
    if (entries.has(element) || entries.size >= 200) throw new Error('Duplicate impression registration or limit reached');
    const entry = { options: { ...options }, visible: false };
    entries.set(element, entry); observer?.observe(element);
    if (active && !observer) start();
    return Object.freeze({ detach() {
      if (entries.get(element) !== entry) return;
      observer?.unobserve(element); entries.delete(element);
    } });
  }
  return { start, stop, register, reset };
}
