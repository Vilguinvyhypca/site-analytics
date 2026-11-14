import test from 'node:test';
import assert from 'node:assert/strict';
import { createMeasurement, type Sample } from '../experiments/player/measurement.js';

const base: Sample = { now: 0, position: 0, duration: 10, rate: 1, eligible: true, seeking: false };
test('player experiment separates elapsed time, coverage, seeks, repeats and completion', () => {
  const m = createMeasurement();
  assert.equal(m.snapshot().started, false);
  assert.equal(m.snapshot().engagedSeconds, 0);
  m.markStarted(); m.observe(base);
  m.observe({ ...base, now: 1000, position: 1 });
  m.observe({ ...base, now: 2000, position: 2, rate: 2 });
  m.observe({ ...base, now: 3000, position: 4, rate: 2 });
  assert.equal(m.snapshot().engagedSeconds, 3);
  assert.equal(m.snapshot().coverage, 0.4);
  m.observe({ ...base, now: 3100, position: 9, seeking: true, eligible: false });
  m.observe({ ...base, now: 3200, position: 9 });
  m.observe({ ...base, now: 4200, position: 10, eligible: false });
  m.markEnded();
  assert.equal(m.snapshot().completed, false, 'seek to end is not completion');
  assert.deepEqual(m.snapshot().coveredIntervals, [[0, 4], [9, 10]]);
  m.observe({ ...base, now: 4300, position: 0, seeking: true, eligible: false });
  m.observe({ ...base, now: 4400, position: 0 });
  for (let i = 1; i <= 10; i++) m.observe({ ...base, now: 4400 + i * 1000, position: i });
  const result = m.snapshot();
  assert.equal(result.engagedSeconds, 14);
  assert.equal(result.coverage, 1);
  assert.equal(result.completed, true);
  assert.deepEqual(result.milestones, [0.25, 0.5, 0.75]);
});

test('ineligible playback, stalls and scheduling gaps do not inflate time; unknown duration has no percentage', () => {
  const m = createMeasurement();
  m.observe({ ...base, eligible: false });
  m.observe({ ...base, now: 1000, position: 1, eligible: false });
  assert.equal(m.snapshot().engagedSeconds, 0);
  m.observe({ ...base, now: 2000, position: 1 });
  m.observe({ ...base, now: 3000, position: 1 });
  m.observe({ ...base, now: 20000, position: 5 });
  assert.equal(m.snapshot().engagedSeconds, 0);
  m.observe({ ...base, now: 21000, position: 6, duration: Infinity });
  const result = m.snapshot();
  assert.equal(result.engagedSeconds, 1);
  assert.equal(result.coverage, null);
  assert.deepEqual(result.coveredIntervals, []);
  assert.equal(result.completed, false);
});

test('completion requires observed end plus 95 percent; snapshots are bounded copies', () => {
  const m = createMeasurement(); m.markStarted(); m.observe(base);
  for (let i = 1; i <= 9; i++) m.observe({ ...base, now: i * 1000, position: i });
  m.markEnded(); assert.equal(m.snapshot().completed, false);
  m.observe({ ...base, now: 9500, position: 9.5 });
  assert.equal(m.snapshot().completed, true);
  const snapshot = m.snapshot(); snapshot.coveredIntervals[0][1] = 0;
  assert.equal(m.snapshot().coverage, 0.95, 'caller cannot mutate measurement state');
  const fragmented = createMeasurement();
  for (let i = 0; i < 105; i++) {
    fragmented.observe({ ...base, now: i * 2000, position: i * 2, duration: 1000, seeking: true });
    fragmented.observe({ ...base, now: i * 2000 + 100, position: i * 2, duration: 1000 });
    fragmented.observe({ ...base, now: i * 2000 + 1100, position: i * 2 + 1, duration: 1000 });
  }
  assert.equal(fragmented.snapshot().coveredIntervals.length, 100);
  assert.equal(fragmented.snapshot().truncated, true);
});

test('normal-speed paused seek to 10.196 seconds cannot add more than the final 1.804 seconds', () => {
  const m = createMeasurement();
  const s = { ...base, duration: 12 };
  m.markStarted(); m.observe(s);
  for(let i=1;i<=6;i++) m.observe({...s,now:i*1000,position:i});
  m.observe({...s,now:6000,position:6,eligible:false});
  m.observe({...s,now:60000,position:6,eligible:false});
  m.observe({...s,now:60100,position:10.196,eligible:false,seeking:true});
  m.observe({...s,now:60200,position:10.196,eligible:false});
  const before=m.snapshot();
  assert.equal(before.engagedSeconds,6);
  m.observe({...s,now:61000,position:10.196});
  m.observe({...s,now:62000,position:11.196});
  m.observe({...s,now:62804,position:12,eligible:false});
  m.markEnded();
  const after=m.snapshot();
  assert(Math.abs(after.engagedSeconds-before.engagedSeconds-1.804)<1e-9);
  assert.deepEqual(after.coveredIntervals,[[0,6],[10.196,12]]);
  assert.equal(after.completed,false);
});
