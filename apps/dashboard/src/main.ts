import { Component, signal } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import type { HealthResponse } from '@site-analytics/contracts';
@Component({
  selector: 'app-root',
  template: `<main><header><span class="eyebrow">PRIVATE WORKSPACE</span><h1>Site Analytics</h1><p>Understand the journey from discovery to engagement.</p></header><section aria-labelledby="status-heading"><h2 id="status-heading">Workspace status</h2><p role="status">{{ status() }}</p><button (click)="checkHealth()" [disabled]="checking()">Check connection</button></section><div class="reports"><section><h2>Content performance</h2><p>See which content visitors discover and open.</p></section><section><h2>Video engagement</h2><p>Measure observed watch time and timeline coverage.</p></section><section><h2>Session activity</h2><p>Follow anonymous journeys across content.</p></section></div><footer>Reports are coming next. Collection is disabled.</footer></main>`,
})
class App {
  readonly status = signal('Checking API connection…');
  readonly checking = signal(false);
  constructor() { void this.checkHealth(); }
  async checkHealth() {
    this.checking.set(true);
    try {
      const response = await fetch('/api/health');
      if (!response.ok) throw new Error('API unavailable');
      const health: HealthResponse = await response.json();
      if (health.status !== 'ok' || health.service !== 'site-analytics' || health.collectionEnabled !== false) throw new Error('Unexpected API response');
      this.status.set('API connected · Collection disabled');
    } catch { this.status.set('API unavailable. Start the API and try again.'); }
    finally { this.checking.set(false); }
  }
}
bootstrapApplication(App).catch(console.error);
