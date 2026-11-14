import assert from 'node:assert/strict';
import { firefox, webkit } from 'playwright';
import { createApp } from '../apps/api/src/app.ts';

const accepted = [];
const app = createApp({
  async collect(batch, origin) {
    accepted.push({ batch, origin });
    return { accepted: batch.events.length, duplicates: 0 };
  }
});
app.get('/fixture', async (_request, reply) => reply.type('text/html').send(`<!doctype html>
  <meta charset="utf-8"><title>Browser matrix fixture</title>
  <button id="allow">Allow analytics</button>
  <script src="/api/tracker.js"></script>
  <script>
    window.tracker = SiteAnalytics.createTracker({
      projectId: 'browser-matrix',
      collectionUrl: '/api/collect',
      publicPath: url => url.pathname === '/fixture' ? '/fixture' : null
    });
    document.querySelector('#allow').addEventListener('click', () => window.tracker.start());
  </script>`));

const address = await app.listen({ port: 0, host: '127.0.0.1' });
const base = address.replace(/\/$/, '');
const cases = [['Firefox', firefox], ['WebKit', webkit]];
let failures = 0;
try {
  for (const [name, engine] of cases) {
    accepted.length = 0;
    let browser;
    try {
      browser = await engine.launch({ headless: true });
      const page = await browser.newPage();
      const pageErrors = [];
      page.on('pageerror', error => pageErrors.push(error.message));
      await page.goto(`${base}/fixture?search=browser-matrix-private-sentinel`);
      await page.waitForTimeout(300);
      assert.equal(accepted.length, 0, 'tracker must remain inert before consent');

      const collection = page.waitForResponse(response => response.url().endsWith('/api/collect') && response.status() === 202);
      await page.getByRole('button', { name: 'Allow analytics' }).click();
      await collection;
      assert.equal(accepted.length, 1, 'consent should deliver one initial page view');
      assert.equal(accepted[0].batch.events[0].path, '/fixture');
      assert.equal(accepted[0].origin, base);
      assert.equal(JSON.stringify(accepted).includes('browser-matrix-private-sentinel'), false);

      await page.evaluate(async () => {
        history.pushState({}, '', '/excluded?search=browser-matrix-private-sentinel');
        await window.tracker.flush();
      });
      await page.waitForTimeout(250);
      assert.equal(accepted.length, 1, 'excluded query route must not add an event');

      await page.evaluate(async () => { window.tracker.stop(); await window.tracker.flush(); });
      await page.waitForTimeout(250);
      assert.equal(accepted.length, 1, 'withdrawal must stop further delivery');
      assert.deepEqual(pageErrors, [], 'browser should have no page errors');
      console.log(`PASS ${name}: consent gate, sanitized page view, excluded route, withdrawal`);
    } catch (error) {
      failures++;
      console.error(`FAIL ${name}: ${error?.stack ?? error}`);
    } finally { await browser?.close(); }
  }
} finally { await app.close(); }
if (failures) process.exitCode = 1;
