import { attachClick, attachScroll, type ClickOptions, type ScrollOptions, type InteractionHost } from './interactions.js';
export type { ClickOptions, ScrollOptions } from './interactions.js';
import { attachNativeVideo, type NativeVideoOptions } from './native-video.js';
export type { NativeVideoOptions } from './native-video.js';
import type { AnalyticsEvent, TrackerOptions, ContentEvent, ShareEvent } from '@site-analytics/contracts';
import { createImpressions } from './impressions.js';
export type { ImpressionOptions } from './impressions.js';

export interface ContentActionOptions { contentId: string; isPublic: () => boolean }
/** No storage, timers or requests until the host explicitly starts collection. */
export function createTracker(options: TrackerOptions) {
  const endpoint = new URL(options.collectionUrl, location.href);
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(options.projectId) ||
      !['http:', 'https:'].includes(endpoint.protocol) || endpoint.username || endpoint.password ||
      typeof options.publicPath !== 'function') throw new Error('Invalid tracker configuration');
  const storageKey = `site-analytics:session:v1:${options.projectId}`;
  let enabled = false;
  let session: { id: string; last: number } | undefined;
  let queue: AnalyticsEvent[] = [];
  let timer: ReturnType<typeof setInterval> | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let retryAttempt = 0;
  let retriesExhausted = false;
  let controller: AbortController | undefined;
  let generation = 0;
  let lastRoute: string | undefined;
  let view: { path: string; viewId: string } | undefined;
  const impressions = createImpressions({
    view: () => enabled && view?.path === publicPath() ? view?.viewId : undefined,
    emit(action) {
      if (!contentAllowed(action)) return false;
      queue.push({ version: 1, projectId: options.projectId, eventId: crypto.randomUUID(), sessionId: currentSession(),
        occurredAt: new Date().toISOString(), type: 'content_impression', contentId: action.contentId, contentType: action.contentType });
      return true;
    }
  });
  const clicks = new Map<HTMLElement, { options: ClickOptions; adapter?: ReturnType<typeof attachClick> }>();
  const scrolls = new Map<Document | HTMLElement, { options: ScrollOptions; adapter?: ReturnType<typeof attachScroll> }>();
  const validName = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
  const handledClicks = new WeakSet<Event>();
  const interactionHost: InteractionHost = {
    context() { const path = publicPath(); return enabled && view && view.path === path ? view : null; },
    emit(body,path,clickEvent) {
      if (clickEvent && handledClicks.has(clickEvent)) return false;
      if (!enabled || publicPath() !== path || queue.length >= 100) return false;
      queue.push({ ...body,path,version:1,projectId:options.projectId,eventId:crypto.randomUUID(),sessionId:currentSession(),occurredAt:new Date().toISOString() });
      if (clickEvent) handledClicks.add(clickEvent);
      return true;
    }
  };
  function trackClick(element: HTMLElement, settings: ClickOptions) {
    if (!(element instanceof HTMLElement) || !validName(settings.name) || typeof settings.isPublic !== 'function') throw new Error('Invalid click registration');
    if (clicks.has(element) || clicks.size >= 100) throw new Error('Duplicate click registration or limit reached');
    const entry: { options: ClickOptions; adapter?: ReturnType<typeof attachClick> } = { options: { ...settings } };
    clicks.set(element,entry); if (enabled) entry.adapter = attachClick(element,entry.options,interactionHost);
    return Object.freeze({ detach() { if (clicks.get(element)!==entry) return; entry.adapter?.dispose(); clicks.delete(element); } });
  }
  function trackScroll(target: Document | HTMLElement, settings: ScrollOptions) {
    if ((target !== document && !(target instanceof HTMLElement)) || !validName(settings.scopeId) || typeof settings.isPublic !== 'function') throw new Error('Invalid scroll registration');
    if (scrolls.has(target) || scrolls.size >= 20 || [...scrolls.values()].some(e=>e.options.scopeId===settings.scopeId)) throw new Error('Duplicate scroll registration or limit reached');
    const entry: { options: ScrollOptions; adapter?: ReturnType<typeof attachScroll> } = { options: { ...settings } };
    scrolls.set(target,entry); if (enabled) entry.adapter = attachScroll(target,entry.options,interactionHost);
    return Object.freeze({ detach() { if(scrolls.get(target)!==entry) return; entry.adapter?.dispose(); scrolls.delete(target); } });
  }
  function recordEvent(settings: ClickOptions) {
    const context = interactionHost.context();
    if (!context || !validName(settings.name) || queue.length >= 100) return false;
    try { if (settings.isPublic() !== true) return false; } catch { return false; }
    queue.push({version:1,projectId:options.projectId,eventId:crypto.randomUUID(),sessionId:currentSession(),occurredAt:new Date().toISOString(),type:'custom',name:settings.name,path:context.path});
    return true;
  }
  let originalPushState: History['pushState'] | undefined;
  let originalReplaceState: History['replaceState'] | undefined;
  let trackedPushState: History['pushState'] | undefined;
  let trackedReplaceState: History['replaceState'] | undefined;
  const videos = new Map<HTMLVideoElement, { options: NativeVideoOptions; adapter?: ReturnType<typeof attachNativeVideo> }>();
  const checkpointVideos = () => { for (const video of videos.values()) video.adapter?.checkpoint(); };
  const onPopState = () => { recordRoute(); };
  const onHashChange = () => { recordRoute(); };
  const onVisibilityChange = () => { if (document.visibilityState === 'hidden') { checkpointVideos(); void flush(true, true); } };
  const onPageHide = () => { checkpointVideos(); void flush(true, true); };
  const onPageShow = (event: PageTransitionEvent) => {
    if (!event.persisted || !enabled) return;
    lastRoute = undefined;
    recordRoute();
  };

  function readSession() {
    try {
      const value = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null');
      // A same-origin window.open can copy the opener's sessionStorage. Do not
      // reuse that session in the child; subsequent reloads retain its new ID.
      try {
        if (window.opener && value?.id) {
          const parent = JSON.parse(window.opener.sessionStorage.getItem(storageKey) ?? 'null');
          if (parent?.id === value.id) return;
        }
      } catch { /* Cross-origin or inaccessible opener: retain normal storage behavior. */ }
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
  function currentSession() {
    const now = Date.now();
    if (!session || now - session.last >= 1800000) session = { id: crypto.randomUUID(), last: now };
    session.last = now;
    try { sessionStorage.setItem(storageKey, JSON.stringify(session)); } catch { /* Memory fallback. */ }
    return session.id;
  }
  function activateVideo(player: HTMLVideoElement, video: { options: NativeVideoOptions; adapter?: ReturnType<typeof attachNativeVideo> }) {
    if (video.adapter || typeof IntersectionObserver === 'undefined') return;
    video.adapter = attachNativeVideo(player, video.options, {
      allowed: () => enabled && !!publicPath(), session: currentSession,
      emit(body, sessionId) {
        if (!enabled || !publicPath() || queue.length >= 100) return false;
        queue.push({ ...body, version: 1, projectId: options.projectId, eventId: crypto.randomUUID(), sessionId, occurredAt: new Date().toISOString() });
        return true;
      },
      flush: () => { void flush(document.visibilityState === 'hidden', true); }
    });
  }
  function trackVideo(player: HTMLVideoElement, videoOptions: NativeVideoOptions) {
    if (!(player instanceof HTMLVideoElement) || !/^[A-Za-z0-9_-]{1,128}$/.test(videoOptions.contentId) || typeof videoOptions.isPublic !== 'function' ||
      (videoOptions.autoplay !== undefined && typeof videoOptions.autoplay !== 'boolean')) throw new Error('Invalid native video configuration');
    if (videos.has(player)) throw new Error('Video is already registered; detach before reusing it');
    if (videos.size >= 20) throw new Error('At most 20 native video registrations are supported');
    const video: { options: NativeVideoOptions; adapter?: ReturnType<typeof attachNativeVideo> } = { options: { ...videoOptions } };
    videos.set(player, video);
    if (enabled) activateVideo(player, video);
    return Object.freeze({ detach() {
      if (videos.get(player) !== video) return;
      video.adapter?.dispose(); videos.delete(player); void flush(false, true);
    } });
  }
  function contentAllowed(action: ContentActionOptions) {
    if (!enabled || !publicPath() || queue.length >= 100 || !/^[A-Za-z0-9_-]{1,128}$/.test(action.contentId)) return false;
    try { return action.isPublic() === true; } catch { return false; }
  }
  function contentOpen(action: ContentActionOptions & { contentType: ContentEvent['contentType'] }) {
    if (!contentAllowed(action) || !['photo', 'video'].includes(action.contentType)) return false;
    queue.push({ version: 1, projectId: options.projectId, eventId: crypto.randomUUID(), sessionId: currentSession(),
      occurredAt: new Date().toISOString(), type: 'content_open', contentId: action.contentId, contentType: action.contentType });
    void flush(false, true); return true;
  }
  function recordShare(action: ContentActionOptions & { outcome: ShareEvent['outcome'] }) {
    if (!contentAllowed(action) || !['clicked', 'copied', 'handoff', 'cancelled', 'failed'].includes(action.outcome)) return false;
    queue.push({ version: 1, projectId: options.projectId, eventId: crypto.randomUUID(), sessionId: currentSession(),
      occurredAt: new Date().toISOString(), type: 'share', contentId: action.contentId, outcome: action.outcome });
    void flush(false, true); return true;
  }
  function pageView() {
    if (!enabled) return false;
    const path = publicPath();
    if (!path) return false;
    const now = Date.now();
    const sessionId = currentSession();
    let referrerHost: string | undefined;
    try {
      const referrer = new URL(document.referrer);
      if (['http:', 'https:'].includes(referrer.protocol) && referrer.hostname.length <= 253 && /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(referrer.hostname)) referrerHost = referrer.hostname;
    } catch { /* No eligible referrer. */ }
    if (queue.length >= 100) return false;
    const eventId = crypto.randomUUID();
    view = { path, viewId:eventId };
    impressions.reset();
    queue.push({ version: 1, projectId: options.projectId, eventId, sessionId,
      occurredAt: new Date(now).toISOString(), type: 'page_view', path, ...(referrerHost ? { referrerHost } : {}) });
    return true;
  }
  function recordRoute() {
    if (!enabled) return false;
    checkpointVideos();
    const path = publicPath();
    if (!path) { view = undefined; impressions.reset(); lastRoute = undefined; return false; }
    if (path === lastRoute) return false;
    lastRoute = path;
    const added = pageView();
    if (added) void flush(false, true);
    return added;
  }
  function requestEvents(): AnalyticsEvent[] {
    const events: AnalyticsEvent[] = [];
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
    if (automatic && !keepalive && (retriesExhausted || retryTimer)) return false;
    if (!automatic) {
      retriesExhausted = false; retryAttempt = 0;
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = undefined;
    }
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
      else if (!response.ok && generation === currentGeneration) {
        queue.splice(0, events.length);
        retryAttempt = 0;
        retriesExhausted = false;
        if (retryTimer) clearTimeout(retryTimer);
        retryTimer = undefined;
      }
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
    impressions.stop();
    view = undefined;
    for (const entry of [...clicks.values(),...scrolls.values()]) { entry.adapter?.dispose(); entry.adapter=undefined; }
    for (const video of videos.values()) { video.adapter?.dispose(true); video.adapter = undefined; }
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
    window.removeEventListener('pageshow', onPageShow);
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
    impressions.start();
    for (const [element,entry] of clicks) entry.adapter=attachClick(element,entry.options,interactionHost);
    for (const [target,entry] of scrolls) entry.adapter=attachScroll(target,entry.options,interactionHost);
    for (const [player, video] of videos) activateVideo(player, video);
    originalPushState = history.pushState;
    originalReplaceState = history.replaceState;
    const pushState = originalPushState;
    const replaceState = originalReplaceState;
    trackedPushState = function (this: History, ...args: Parameters<History['pushState']>) {
      const result = pushState.apply(this, args);
      queueMicrotask(recordRoute);
      return result;
    };
    trackedReplaceState = function (this: History, ...args: Parameters<History['replaceState']>) {
      const result = replaceState.apply(this, args);
      queueMicrotask(recordRoute);
      return result;
    };
    history.pushState = trackedPushState;
    history.replaceState = trackedReplaceState;
    window.addEventListener('popstate', onPopState);
    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('pageshow', onPageShow);
    document.addEventListener('visibilitychange', onVisibilityChange);
    timer = setInterval(() => { void flush(false, true); }, 2000);
  }
  return Object.freeze({ version: 1, get collectionEnabled() { return enabled; }, start, stop, pageView, flush, recordRoute, trackVideo, contentOpen, recordShare, trackClick, trackScroll, recordEvent, trackImpression: impressions.register });
}
