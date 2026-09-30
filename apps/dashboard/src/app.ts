import { Component, signal } from '@angular/core';
import type { HealthResponse, ReadinessResponse } from '@site-analytics/contracts';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
})
export class App {
  readonly checking = signal(false);
  readonly connection = signal('Checking connection…');

  constructor() { void this.refresh(); }

  async refresh() {
    this.checking.set(true);
    this.connection.set('Checking connection…');
    try {
      const options = { signal: AbortSignal.timeout(5_000) };
      const [healthResponse, readyResponse] = await Promise.all([
        fetch('/api/health', options), fetch('/api/ready', options),
      ]);
      if (!healthResponse.ok) throw new Error('Unavailable');
      const health = await healthResponse.json() as HealthResponse;
      const ready = await readyResponse.json() as ReadinessResponse;
      if (health.service !== 'site-analytics' || health.status !== 'ok') throw new Error('Unexpected response');
      this.connection.set(readyResponse.ok && ready.database === 'ready'
        ? 'API and database connected' : 'API connected · database unavailable');
    } catch {
      this.connection.set('Connection unavailable. Try again shortly.');
    } finally {
      this.checking.set(false);
    }
  }
}
