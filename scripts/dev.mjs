import { spawn } from 'node:child_process';
const children = ['@site-analytics/api', '@site-analytics/dashboard'].map(workspace => spawn('npm', ['run', 'dev', '-w', workspace], { stdio: 'inherit', env: process.env, detached: process.platform !== 'win32' }));
let stopping = false;
function stop(code) { if (stopping) return; stopping = true; for (const child of children) { if (!child.pid) continue; try { if (process.platform === 'win32') child.kill('SIGTERM'); else process.kill(-child.pid, 'SIGTERM'); } catch (error) { if (error.code !== 'ESRCH') console.error(error); } } process.exitCode = code; }
for (const child of children) { child.on('error', error => { console.error(error); stop(1); }); child.on('exit', code => stop(code ?? 1)); }
for (const signal of ['SIGINT','SIGTERM']) process.once(signal, () => stop(0));
