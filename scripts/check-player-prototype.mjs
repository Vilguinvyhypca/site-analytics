import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const browser = (...args) => execFileSync('node_modules/.bin/agent-browser', ['--session', 'analytics-player-prototype', ...args], { encoding: 'utf8', timeout: 30000 });
const evaluate = code => JSON.parse(browser('eval', code));
try {
  browser('--args', '--no-sandbox', 'open', 'http://127.0.0.1:4301');
  evaluate(`(async () => {
    await customElements.whenDefined('mux-player');
    for (let i = 0; i < 100; i++) {
      if (['native','mux'].every(id => document.getElementById(id).readyState >= 3)) return true;
      await new Promise(r => setTimeout(r, 100));
    }
    throw new Error('players did not load');
  })()`);
  assert.equal(evaluate('summaries.length'), 0, 'no measurement before consent');
  evaluate("document.querySelector('#allow').click(); true");
  for (const id of ['native', 'mux']) {
    const result = evaluate(`(async () => {
      const player = document.getElementById('${id}');
      const adapter = adapters['${id}'];
      const wait = ms => new Promise(r => setTimeout(r, ms));
      await wait(200);
      const unopened = adapter.snapshot();
      await player.play(); await wait(1200); player.pause(); await wait(100);
      const normal = adapter.snapshot();
      await wait(700); const paused = adapter.snapshot();
      player.currentTime = 7;
      await wait(300); if (Math.abs(player.currentTime - 7) > 0.1) throw new Error('fixture seek failed'); const seek = adapter.snapshot();
      player.playbackRate = 2;
      await player.play(); await wait(1000); player.pause(); await wait(100);
      const fast = adapter.snapshot();
      return {unopened, normal, paused, seek, fast, events: eventLog['${id}']};
    })()`);
    assert.equal(result.unopened.engagedSeconds, 0);
    assert.equal(result.unopened.started, false);
    assert(result.normal.started);
    assert(result.normal.engagedSeconds > 0.8 && result.normal.engagedSeconds < 1.8);
    assert.equal(result.normal.engagedSeconds, result.paused.engagedSeconds, 'pause adds no time');
    assert.equal(result.paused.engagedSeconds, result.seek.engagedSeconds, 'seek adds no time');
    const elapsed = result.fast.engagedSeconds - result.seek.engagedSeconds;
    const covered = s => s.coveredIntervals.reduce((sum, [a,b]) => sum + b - a, 0);
    const advance = covered(result.fast) - covered(result.seek);
    assert(elapsed > 0.7 && elapsed < 1.4);
    assert(advance > elapsed * 1.7 && advance < elapsed * 2.3, '2x separates content seconds from elapsed time: ' + JSON.stringify({elapsed, advance, result}));
    assert.equal(result.fast.completed, false);
    assert(result.fast.coveredIntervals.every(([a,b]) => b <= 2 || a >= 7), 'seek gap is not covered');
    assert(result.events.includes('playing') && result.events.includes('seeking') && result.events.includes('seeked'));
    // Move an actively playing element outside viewport; intersection gating must stop accumulation.
    const hidden = evaluate(`(async () => {
      const p = document.getElementById('${id}'); const a = adapters['${id}'];
      p.currentTime = 0; p.playbackRate = 1;
      await new Promise(r => setTimeout(r,200)); await p.play();
      p.style.transform = 'translateY(2000px)'; await new Promise(r => setTimeout(r,400));
      const before = a.snapshot(); await new Promise(r => setTimeout(r,700));
      const after = a.snapshot(); p.pause(); p.style.transform = ''; return {before,after};
    })()`);
    assert.equal(hidden.before.engagedSeconds, hidden.after.engagedSeconds, 'offscreen playback adds no time');
    console.log(`PASS ${id}: open without play, pause, seek exclusion, 2x speed, offscreen gating`, JSON.stringify(result.fast));
  }
  // New consent boundary creates new playback IDs and clears prior local records.
  const previousId = evaluate("adapters.native.snapshot().playbackId");
  evaluate("document.querySelector('#withdraw').click(); true");
  assert.equal(evaluate('summaries.length'), 0);
  evaluate("document.querySelector('#allow').click(); true");
  assert.notEqual(evaluate('adapters.native.snapshot().playbackId'), previousId);
  for (const id of ['native','mux']) {
    const result = evaluate(`(async () => {
      const p = document.getElementById('${id}'); p.currentTime = 0; p.playbackRate = 4;
      await new Promise(r => setTimeout(r,300)); await p.play();
      for (let i = 0; i < 60 && !p.ended; i++) await new Promise(r => setTimeout(r,100));
      return adapters['${id}'].snapshot();
    })()`);
    assert(result.ended && result.completed, `${id} full playback reaches completion`);
    assert(result.coverage >= 0.95);
    assert(result.engagedSeconds > 2.5 && result.engagedSeconds < 3.5);
    assert.deepEqual(result.milestones, [0.25,0.5,0.75]);
    console.log(`PASS ${id}: observed end + 95% coverage`, JSON.stringify(result));
  }
  evaluate("document.querySelector('#withdraw').click(); true");
  evaluate(`(async () => {
    const p = document.getElementById('native'); p.currentTime = 0; p.playbackRate = 1;
    await new Promise(r => setTimeout(r,200)); await p.play();
    await new Promise(r => setTimeout(r,5300)); p.pause(); return true;
  })()`);
  assert.equal(evaluate('summaries.length'), 0, 'withdrawal removes callbacks and heartbeat timers');
  const errors = browser('errors').trim();
  assert.equal(errors, '', `unexpected page errors: ${errors}`);
  browser('screenshot', 'artifacts/day-five-players.png');
  console.log('PASS: both real player surfaces; no page errors; no production requests');
} finally { browser('close'); }
