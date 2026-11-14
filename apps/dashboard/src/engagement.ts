import { Component, effect, input, output, signal, untracked, OnDestroy } from '@angular/core';
import type { EngagementReport, TrafficReportQuery, SessionList, SessionTimeline } from '@site-analytics/contracts';
@Component({ selector: 'engagement-report', templateUrl: './engagement.html' })
export class Engagement implements OnDestroy {
  readonly query = input.required<TrafficReportQuery>();
  readonly sessionExpired = output<void>();
  readonly report = signal<EngagementReport | null>(null);
  readonly sessions = signal<SessionList | null>(null);
  readonly timeline = signal<SessionTimeline | null>(null);
  readonly selectedSession = signal('');
  readonly loading = signal(false);
  readonly timelineLoading = signal(false);
  readonly error = signal('');
  readonly timelineError = signal('');
  private controller?: AbortController;
  private timelineController?: AbortController;
  private generation = 0;
  private timelineGeneration = 0;
  constructor() { effect(() => { this.query(); untracked(() => { void this.load(); }); }); }
  ngOnDestroy() { this.generation++; this.timelineGeneration++; this.controller?.abort(); this.timelineController?.abort(); }
  private async request<T>(route: string, extras: Record<string, string>, signal: AbortSignal): Promise<T> {
    const q = this.query();
    const params = new URLSearchParams({ projectId: q.projectId, startDate: q.startDate, endDate: q.endDate, timeZone: q.timeZone, ...extras });
    const response = await fetch(`/api/reports/${route}?${params}`, { cache: 'no-store', credentials: 'same-origin', signal });
    if (signal.aborted) throw new Error('Request cancelled.');
    if (response.status === 401) { this.sessionExpired.emit(); throw new Error('Session expired. Sign in again.'); }
    if (!response.ok) throw new Error('Engagement reports are unavailable. Try again.');
    return response.json();
  }
  async load(kind: 'all' | 'playbacks' | 'sessions' = 'all', after?: string) {
    const generation = ++this.generation;
    this.controller?.abort(); this.controller = new AbortController();
    const controller = this.controller;
    this.loading.set(true); this.error.set('');
    if (kind === 'all') { this.report.set(null); this.sessions.set(null); }
    if (kind !== 'playbacks') {
      this.timelineGeneration++; this.timelineController?.abort(); this.timeline.set(null); this.selectedSession.set(''); this.timelineError.set(''); this.timelineLoading.set(false);
    }
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const [report,sessions] = await Promise.all([
        kind !== 'sessions' ? this.request<EngagementReport>('engagement', after ? { after } : {}, controller.signal) : Promise.resolve(this.report()),
        kind !== 'playbacks' ? this.request<SessionList>('sessions', after ? { after } : {}, controller.signal) : Promise.resolve(this.sessions())
      ]);
      if (generation === this.generation) { this.report.set(report); this.sessions.set(sessions); }
    } catch (error) { if (generation === this.generation) this.error.set(controller.signal.aborted ? 'The report took too long. Try again.' : error instanceof Error ? error.message : 'Report unavailable.'); }
    finally { clearTimeout(timeout); if (generation === this.generation) this.loading.set(false); }
  }
  async openSession(sessionId: string, cursor?: string) {
    const generation = ++this.timelineGeneration;
    this.timelineController?.abort(); const controller = this.timelineController = new AbortController();
    this.selectedSession.set(sessionId); this.timeline.set(null); this.timelineError.set(''); this.timelineLoading.set(true);
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const timeline = await this.request<SessionTimeline>('timeline', { sessionId, ...(cursor ? { cursor } : {}) }, controller.signal);
      if (generation === this.timelineGeneration) this.timeline.set(timeline);
    } catch (error) { if (generation === this.timelineGeneration) this.timelineError.set(controller.signal.aborted ? 'The timeline took too long. Try again.' : error instanceof Error ? error.message : 'Timeline unavailable.'); }
    finally { clearTimeout(timeout); if (generation === this.timelineGeneration) this.timelineLoading.set(false); }
  }
  seconds(value: number) { return value.toFixed(1); }
  percent(value: number | null) { return value === null ? 'Unknown' : `${(value * 100).toFixed(1)}%`; }
  time(value: string) { return new Intl.DateTimeFormat('en-US', { timeZone: this.query().timeZone, dateStyle: 'medium', timeStyle: 'medium' }).format(new Date(value)); }
  describe(event: SessionTimeline['events'][number]) {
    if (event.type === 'scroll') return `Scroll: ${event.scopeId} · ${event.milestone}% of scrollable distance · ${event.path}`;
    if (event.type === 'click' || event.type === 'custom') return `${event.type === 'click' ? 'Click' : 'Custom event'}: ${event.name} · ${event.path}`;
    if (event.type === 'page_view') return `Page view: ${event.path}`;
    if (event.type === 'share') return `Share ${event.outcome}: ${event.contentId}`;
    if (event.type === 'playback_progress') return `Playback progress: ${event.contentId} · ${this.seconds(event.engagedSeconds ?? 0)} seconds cumulative · update ${event.sequence}`;
    return `${event.type.replaceAll('_', ' ')}: ${event.contentId}`;
  }
}
