import { createMeasurement } from '../../packages/tracker/src/measurement.js';
export { createMeasurement, type Sample } from '../../packages/tracker/src/measurement.js';

export interface MediaSurface extends HTMLElement {
  currentTime: number; duration: number; playbackRate: number;
  paused: boolean; seeking: boolean; readyState: number;
}
/** Shared public media-event adapter for native video and Mux's web component. */
export function attachPrototype(player: MediaSurface, contentId: string, emit: (value: object) => void) {
  const measurement = createMeasurement();
  const playbackId = crypto.randomUUID();
  let playing = false;
  let visible = false;
  let disposed = false;
  let lastHeartbeat = performance.now();
  const sample = () => measurement.observe({ now: performance.now(), position: player.currentTime,
    duration: player.duration, rate: player.playbackRate, seeking: player.seeking,
    eligible: playing && !player.paused && !player.seeking && player.readyState >= 3 && visible && document.visibilityState === 'visible' });
  const snapshot = () => ({ contentId, playbackId, ...measurement.snapshot() });
  const report = () => { if (!disposed) emit(snapshot()); };
  const listeners = new Map<string, EventListener>();
  for (const name of ['playing', 'pause', 'waiting', 'seeking', 'seeked', 'ratechange', 'timeupdate', 'ended', 'emptied', 'error']) {
    const listener = () => {
      sample();
      if (name === 'playing') { playing = true; measurement.markStarted(); }
      if (['pause', 'waiting', 'seeking', 'ended', 'emptied', 'error'].includes(name)) playing = false;
      if (name === 'seeked') playing = !player.paused && player.readyState >= 3;
      if (name === 'ended') measurement.markEnded();
      sample();
      if (['pause', 'ended', 'waiting'].includes(name)) report();
    };
    listeners.set(name, listener); player.addEventListener(name, listener);
  }
  const observer = new IntersectionObserver(entries => {
    sample(); visible = entries[0].isIntersecting && entries[0].intersectionRatio >= 0.5; sample();
  }, { threshold: [0, 0.5, 1] });
  observer.observe(player);
  const visibility = () => { sample(); if (document.visibilityState === 'hidden') report(); };
  const pagehide = () => { sample(); report(); };
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('pagehide', pagehide);
  const timer = setInterval(() => {
    sample();
    if (performance.now() - lastHeartbeat >= 5000) { report(); lastHeartbeat = performance.now(); }
  }, 250);
  return {
    snapshot() { if (!disposed) sample(); return snapshot(); },
    dispose(withdrawn = false) {
      if (disposed) return;
      if (!withdrawn) { sample(); report(); }
      disposed = true;
      clearInterval(timer); observer.disconnect();
      for (const [name, listener] of listeners) player.removeEventListener(name, listener);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', pagehide);
    }
  };
}
