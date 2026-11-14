/** Bounded playback measurement shared by the native tracker and prototype. */
export interface Sample {
  now: number; position: number; duration: number; rate: number;
  eligible: boolean; seeking: boolean;
}
export function createMeasurement() {
  let previous: Sample | undefined;
  let engagedSeconds = 0;
  let durationSeconds: number | null = null;
  let intervals: [number, number][] = [];
  let ended = false;
  let truncated = false;
  let started = false;
  let sequence = 0;
  function observe(sample: Sample) {
    durationSeconds = Number.isFinite(sample.duration) && sample.duration > 0 && sample.duration <= 86400 ? sample.duration : null;
    const old = previous;
    previous = { ...sample };
    if (!old || !old.eligible || sample.seeking) return;
    const elapsed = (sample.now - old.now) / 1000;
    const advance = sample.position - old.position;
    // Discard long scheduling gaps and discontinuities; never bridge a seek.
    if (elapsed <= 0 || elapsed > 1.5 || old.rate <= 0 || !Number.isFinite(old.rate) ||
        !Number.isFinite(advance) || advance <= 0 || advance > elapsed * old.rate + 0.25) return;
    engagedSeconds = Math.min(86400, engagedSeconds + Math.min(elapsed, advance / old.rate));
    if (durationSeconds === null) return;
    const start = Math.max(0, old.position);
    const end = Math.min(durationSeconds, sample.position);
    if (end <= start) return;
    const combined: [number, number][] = [...intervals, [start, end]];
    combined.sort((a, b) => a[0] - b[0]);
    intervals = [];
    for (const interval of combined) {
      const tail = intervals.at(-1);
      if (tail && interval[0] <= tail[1]) tail[1] = Math.max(tail[1], interval[1]);
      else intervals.push([...interval]);
    }
    if (intervals.length > 100) { intervals.length = 100; truncated = true; }
  }
  function snapshot() {
    const coveredIntervals = durationSeconds === null ? [] : intervals
      .map(([a, b]): [number, number] => [a, Math.min(b, durationSeconds!)])
      .filter(([a, b]) => b > a);
    const coverage = durationSeconds === null ? null : coveredIntervals.reduce((sum, [a, b]) => sum + b - a, 0) / durationSeconds;
    return { sequence: ++sequence, started, engagedSeconds, durationSeconds, coveredIntervals,
      ended: ended && durationSeconds !== null, coverage, completed: ended && started && coverage !== null && coverage >= 0.95,
      milestones: coverage === null ? [] : [0.25, 0.5, 0.75].filter(value => coverage >= value), truncated };
  }
  return { observe, snapshot, markStarted() { started = true; }, markEnded() { ended = true; } };
}
