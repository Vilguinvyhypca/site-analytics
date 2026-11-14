import { Component, computed, input, output, signal, OnDestroy } from '@angular/core';
import { Engagement } from './engagement';
import type { ProjectConfiguration, TrafficReport } from '@site-analytics/contracts';

function today() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  return ['year', 'month', 'day'].map(type => parts.find(p => p.type === type)!.value).join('-');
}
const end = today();
const start = new Date(Date.parse(end) - 6 * 86400000).toISOString().slice(0, 10);

@Component({ selector: 'traffic-report', imports: [Engagement], templateUrl: './traffic.html' })
export class Traffic implements OnDestroy {
  readonly projects = input.required<ProjectConfiguration[]>();
  readonly sessionExpired = output<void>();
  readonly projectId = signal('');
  readonly startDate = signal(start);
  readonly endDate = signal(end);
  readonly timeZone = signal('America/New_York');
  readonly report = signal<TrafficReport | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly peak = computed(() => Math.max(1, ...this.report()?.daily.map(d => d.pageViews) ?? []));
  readonly points = computed(() => {
    const days = this.report()?.daily ?? [];
    return days.map((d, i) => `${days.length === 1 ? 300 : 10 + i * 580 / (days.length - 1)},${150 - d.pageViews / this.peak() * 130}`).join(' ');
  });
  readonly projectName = computed(() => this.projects().find(p => p.id === this.report()?.projectId)?.name ?? '');
  private controller?: AbortController;
  private revision = 0;
  change(field: 'projectId' | 'startDate' | 'endDate' | 'timeZone', value: string) {
    this[field].set(value); this.invalidate();
  }
  private invalidate() {
    this.revision++; this.controller?.abort(); this.report.set(null); this.error.set(''); this.loading.set(false);
  }
  ngOnDestroy() { this.invalidate(); }
  async load(event?: Event) {
    event?.preventDefault(); this.invalidate();
    if (!this.projectId()) { this.error.set('Choose a project.'); return; }
    const days = (Date.parse(this.endDate()) - Date.parse(this.startDate())) / 86400000 + 1;
    if (!Number.isFinite(days) || days < 1 || days > 366) { this.error.set('Choose an end date on or after the start date, within 366 days.'); return; }
    const revision = this.revision;
    const controller = this.controller = new AbortController();
    this.loading.set(true);
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const params = new URLSearchParams({ projectId: this.projectId(), startDate: this.startDate(), endDate: this.endDate(), timeZone: this.timeZone() });
      const response = await fetch(`/api/reports/overview?${params}`, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
      if (revision !== this.revision) return;
      if (response.status === 401) { this.sessionExpired.emit(); return; }
      if (!response.ok) throw new Error(response.status === 400 ? 'Check the date range and time zone, then try again.' : response.status === 404 ? 'This project is no longer available. Reload the project list.' : 'Reports are unavailable. Try again.');
      const report: TrafficReport = await response.json();
      if (revision === this.revision) this.report.set(report);
    } catch (error) {
      if (revision === this.revision) this.error.set(controller.signal.aborted ? 'The report took too long. Try again.' : error instanceof Error ? error.message : 'Reports are unavailable. Try again.');
    } finally { clearTimeout(timer); if (revision === this.revision) this.loading.set(false); }
  }
  formatTime(value: string, zone: string) { return new Intl.DateTimeFormat('en-US', { timeZone: zone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
}
