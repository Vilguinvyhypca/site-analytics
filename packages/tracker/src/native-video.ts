import type { PlaybackStart, PlaybackProgress, EventEnvelope } from '@site-analytics/contracts';
import { createMeasurement } from './measurement.js';
type Body = Omit<PlaybackStart, keyof EventEnvelope> | Omit<PlaybackProgress, keyof EventEnvelope>;
export interface NativeVideoOptions {
  contentId: string;
  /** Must reflect host-verified public visibility, including changes while playing. */
  isPublic: () => boolean;
  /** Host-declared automatic playback, not inferred from user identity. */
  autoplay?: boolean;
}
export function attachNativeVideo(player: HTMLVideoElement, options: NativeVideoOptions, host: {
  allowed(): boolean; session(): string; emit(body: Body, sessionId: string): boolean; flush(): void;
}) {
  let measurement = createMeasurement();
  let playbackId = '';
  let sessionId = '';
  let source = player.currentSrc;
  let visible = false;
  let playing = !player.paused && player.readyState >= 3;
  let disposed = false;
  let lastReport = performance.now();
  let lastValue = '';
  const reset = () => { measurement = createMeasurement(); playbackId = ''; sessionId = ''; lastValue = ''; };
  const allowed = () => {
    try { return host.allowed() && player.isConnected && options.isPublic() === true; } catch { return false; }
  };
  const report = () => {
    if (disposed || !allowed() || !playbackId) return;
    const value = measurement.snapshot();
    const progress = { type: 'playback_progress' as const, contentId: options.contentId, playbackId,
      sequence: value.sequence, engagedSeconds: value.engagedSeconds, durationSeconds: value.durationSeconds,
      coveredIntervals: value.coveredIntervals, ended: value.ended };
    const key = JSON.stringify({ ...progress, sequence: 0 });
    if (key !== lastValue && host.emit(progress, sessionId)) { lastValue = key; lastReport = performance.now(); }
  };
  const sample = () => {
    if (disposed) return;
    if (!allowed()) { reset(); return; }
    // A reused element must not attribute a new source to the old playback.
    if (source !== player.currentSrc) { reset(); source = player.currentSrc; }
    const active = playing && !player.paused && !player.seeking && player.readyState >= 3;
    if (active) {
      const currentSession = host.session();
      if (sessionId && sessionId !== currentSession) reset();
      if (!playbackId) {
        const id = crypto.randomUUID();
        if (!host.emit({ type: 'playback_start', contentId: options.contentId, playbackId: id, autoplay: options.autoplay === true }, currentSession)) return;
        playbackId = id; sessionId = currentSession; measurement.markStarted();
      }
    }
    measurement.observe({ now: performance.now(), position: player.currentTime, duration: player.duration,
      rate: player.playbackRate, seeking: player.seeking,
      eligible: active && visible && document.visibilityState === 'visible' });
  };
  const listeners = new Map<string, EventListener>();
  for (const name of ['playing', 'pause', 'waiting', 'stalled', 'seeking', 'seeked', 'ratechange', 'timeupdate', 'ended', 'emptied', 'error']) {
    const listener = () => {
      sample();
      if (name === 'playing') playing = true;
      if (['pause', 'waiting', 'seeking', 'ended', 'emptied', 'error'].includes(name)) playing = false;
      if (name === 'seeked') playing = !player.paused && player.readyState >= 3;
      if (name === 'ended') measurement.markEnded();
      if (name === 'emptied') reset();
      sample();
      if (['pause', 'waiting', 'ended', 'error'].includes(name)) { report(); host.flush(); }
    };
    listeners.set(name, listener); player.addEventListener(name, listener);
  }
  const observer = new IntersectionObserver(entries => {
    sample(); visible = entries[0].isIntersecting && entries[0].intersectionRatio >= 0.5; sample();
  }, { threshold: [0, 0.5, 1] });
  observer.observe(player);
  const checkpoint = () => { sample(); report(); };
  const visibility = () => { sample(); if (document.visibilityState === 'hidden') { report(); host.flush(); } };
  document.addEventListener('visibilitychange', visibility);
  const timer = setInterval(() => { sample(); if (performance.now() - lastReport >= 5000) report(); }, 250);
  return {
    checkpoint,
    dispose(withdrawn = false) {
      if (disposed) return;
      if (!withdrawn) checkpoint();
      disposed = true; clearInterval(timer); observer.disconnect();
      for (const [name, listener] of listeners) player.removeEventListener(name, listener);
      document.removeEventListener('visibilitychange', visibility);
    }
  };
}
