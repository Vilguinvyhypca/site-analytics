// Automated native-only journey, in its own browser and disposable local server.
import { spawn, execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const port = 4311;
const server = spawn(process.execPath, ['scripts/player-prototype.mjs'], {
  env: { ...process.env, PLAYER_TEST_PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe']
});
let logs = '';
server.stdout.on('data', chunk => { logs += chunk; });
server.stderr.on('data', chunk => { logs += chunk; });
const browser = (...args) => execFileSync('node_modules/.bin/agent-browser', ['--session', 'analytics-native-regression', ...args], { encoding: 'utf8', timeout: 30000 });
const evaluate = code => JSON.parse(browser('eval', code));
try {
  let ready = false;
  for (let i = 0; i < 300; i++) {
    if (server.exitCode !== null) throw new Error(logs);
    if (logs.includes('Player prototype ready:')) { ready = true; break; }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert(ready, 'test server started');
  browser('--args', '--no-sandbox', 'open', `http://127.0.0.1:${port}`);
  const results = evaluate(`(async () => {
    const p = document.getElementById('native');
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    for(let i=0;i<100 && p.readyState<3;i++) await wait(100);
    if(p.readyState<3) throw new Error('Native video did not load');
    await p.play(); await wait(300); p.pause();
    const denied = summaries.length;
    p.currentTime=0; await wait(200);
    document.getElementById('allow').click(); await wait(200);
    await p.play(); await wait(3000); p.pause(); await wait(100);
    const played = adapters.native.snapshot();
    await wait(1200); const paused = adapters.native.snapshot();
    p.currentTime=10.196; await wait(300);
    if(Math.abs(p.currentTime-10.196)>0.1) throw new Error('Seek did not reach destination');
    const sought = adapters.native.snapshot();
    const startPosition=p.currentTime;
    await p.play();
    for(let i=0;i<50 && !p.ended;i++) await wait(100);
    const ended = adapters.native.snapshot();
    const displayed = JSON.parse(document.getElementById('native-output').textContent);
    p.currentTime=0; p.playbackRate=2; await wait(250);
    await p.play(); await wait(700); p.pause(); await wait(100);
    const replayed = adapters.native.snapshot();
    document.getElementById('withdraw').click();
    await p.play(); await wait(5200); p.pause();
    return {denied,played,paused,sought,startPosition,ended,displayed,replayed,withdrawn:summaries.length};
  })()`);
  assert.equal(results.denied, 0);
  assert(results.played.engagedSeconds > 2.5 && results.played.engagedSeconds < 3.3);
  assert.equal(results.paused.engagedSeconds, results.played.engagedSeconds);
  assert.equal(results.sought.engagedSeconds, results.paused.engagedSeconds);
  assert.equal(results.sought.coverage, results.paused.coverage);
  const tail = results.ended.engagedSeconds - results.sought.engagedSeconds;
  assert(tail > 1.4 && tail <= 12 - results.startPosition + 0.05, `1x end segment overcounted: ${tail}`);
  assert(results.ended.ended && !results.ended.completed);
  assert(results.ended.coveredIntervals.every(([a,b]) => b < 3.5 || a >= 10.19), 'seek gap excluded');
  assert.equal(results.displayed.contentId, 'synthetic-native');
  assert.equal(results.displayed.engagedSeconds, results.ended.engagedSeconds);
  const replay = results.replayed.engagedSeconds - results.ended.engagedSeconds;
  assert(replay > 0.45 && replay < 0.9, '2x replay measures elapsed rather than content seconds');
  assert(Math.abs(results.replayed.coverage - results.ended.coverage) < 0.02, 'replay does not inflate unique coverage');
  assert.equal(results.withdrawn, 0);
  assert.equal(browser('errors').trim(), '');
  console.log(JSON.stringify({ result: 'PASS', normalWatchSeconds: results.played.engagedSeconds, endSegmentSeconds: tail, replayElapsedSeconds: replay,
    checks: ['consent off','play','pause','seek exclusion','1x end-segment bound','incomplete despite ended','separate native display','2x replay coverage','withdrawal'] }, null, 2));
} finally {
  try { browser('close'); } finally {
    if (server.exitCode === null) {
      const stopped = new Promise(resolve => server.once('exit', resolve));
      server.kill('SIGTERM'); await stopped;
    }
  }
}
