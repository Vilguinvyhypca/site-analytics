import { Component, signal } from '@angular/core';
import { Traffic } from './traffic';
import { bootstrapApplication } from '@angular/platform-browser';
import type { HealthResponse, ProjectConfiguration } from '@site-analytics/contracts';
@Component({ selector: 'app-root', imports: [Traffic], templateUrl: './main.html' })
class App {
  readonly status = signal('Checking API connection…');
  readonly checking = signal(false);
  readonly busy = signal(false);
  readonly ready = signal(false);
  readonly authenticated = signal(false);
  readonly message = signal('');
  readonly projects = signal<ProjectConfiguration[]>([]);
  readonly selected = signal<ProjectConfiguration | null>(null);
  readonly snippet = signal('');
  readonly deleteConfirmation = signal('');
  private csrfToken = '';
  constructor() { void this.checkHealth(); void this.refreshSession(); }
  async checkHealth() {
    this.checking.set(true);
    try {
      const response = await fetch('/api/health');
      if (!response.ok) throw new Error('API unavailable');
      const health: HealthResponse = await response.json();
      if (health.status !== 'ok' || health.service !== 'site-analytics' || typeof health.collectionEnabled !== 'boolean') throw new Error('Unexpected API response');
      this.status.set(health.collectionEnabled ? 'API connected · Collection endpoint enabled' : 'API connected · Collection disabled');
    } catch { this.status.set('API unavailable. Start the API and try again.'); }
    finally { this.checking.set(false); }
  }
  reportSessionExpired() { this.clearOwner(); this.message.set('Your session expired. Sign in again.'); }
  private clearOwner() {
    this.authenticated.set(false); this.projects.set([]); this.selected.set(null); this.snippet.set(''); this.csrfToken = '';
  }
  private async request(path: string, method = 'GET', body?: object) {
    const response = await fetch(path, { method, credentials: 'same-origin', cache: 'no-store',
      headers: method === 'GET' ? {} : { ...(body ? { 'Content-Type': 'application/json' } : {}), 'X-CSRF-Token': this.csrfToken },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    if (!response.ok) {
      if (response.status === 401) this.clearOwner();
      const value = await response.json().catch(() => ({}));
      throw new Error(value.error || 'Request failed. Try again.');
    }
    return response.status === 204 ? null : response.json();
  }
  async refreshSession() {
    try {
      const session = await this.request('/api/auth/session');
      this.csrfToken = session.csrfToken;
      this.authenticated.set(session.authenticated === true); this.ready.set(true);
      if (session.authenticated) await this.loadProjects();
    } catch (error) { this.ready.set(false); this.message.set(this.errorMessage(error)); }
  }
  private async loadProjects() { this.projects.set((await this.request('/api/admin/projects')).projects); }
  async login(event: Event, password: HTMLInputElement) {
    event.preventDefault(); if (this.busy()) return;
    this.busy.set(true); this.message.set('');
    try {
      // Renew the token after a failed login or a session revoked in another tab.
      await this.refreshSession();
      if (!this.ready()) throw new Error('Owner access is unavailable. Retry after checking the API.');
      await this.request('/api/auth/login', 'POST', { password: password.value });
      await this.refreshSession();
      if (this.ready() && this.authenticated()) this.message.set('Signed in.');
    } catch (error) { this.message.set(this.errorMessage(error)); }
    finally { password.value = ''; this.busy.set(false); }
  }
  async logout() {
    this.busy.set(true);
    try { await this.request('/api/auth/logout', 'POST'); this.clearOwner(); await this.refreshSession(); this.message.set('Signed out.'); }
    catch (error) { this.message.set(this.errorMessage(error)); }
    finally { this.busy.set(false); }
  }
  choose(project: ProjectConfiguration | null) {
    this.selected.set(project); this.deleteConfirmation.set(''); this.message.set('');
    this.snippet.set(project ? this.installation(project.id) : '');
  }
  async deleteSelected() {
    const project=this.selected();if(!project||this.busy())return;
    if(this.deleteConfirmation()!==project.id){this.message.set('Type the exact project ID to confirm deletion.');return;}
    this.busy.set(true);this.message.set('');
    try{await this.request(`/api/admin/projects/${encodeURIComponent(project.id)}`,'DELETE',{confirm:this.deleteConfirmation()});
      await this.loadProjects();this.choose(null);this.message.set('Project and its analytics data deleted.');
    }catch(error){this.message.set(this.errorMessage(error));}finally{this.busy.set(false);}
  }
  async saveProject(event: Event, id: string, name: string, origins: string, enabled: boolean) {
    event.preventDefault(); if (this.busy()) return;
    this.busy.set(true); this.message.set('');
    const project: ProjectConfiguration = { id: id.trim(), name: name.trim(), allowedOrigins: origins.split(/\r?\n/).map(v => v.trim()).filter(Boolean), collectionEnabled: enabled };
    try {
      await this.request(this.selected() ? `/api/admin/projects/${encodeURIComponent(project.id)}` : '/api/admin/projects', this.selected() ? 'PUT' : 'POST', project);
      await this.loadProjects(); this.choose(project); this.message.set('Project saved.');
    } catch (error) { this.message.set(this.errorMessage(error)); }
    finally { this.busy.set(false); }
  }
  private installation(id: string) {
    const base = location.origin;
    return `<script src="${base}/api/tracker.js"></script>\n<script>\nconst analytics = SiteAnalytics.createTracker({\n  projectId: ${JSON.stringify(id)},\n  collectionUrl: ${JSON.stringify(base + '/api/collect')},\n  publicPath: url => url.pathname === '/' ? '/' : null\n});\n// Connect these to your consent controls:\n// analytics.start(); // only after consent\n// analytics.stop();  // on withdrawal\n</script>`;
  }
  async copySnippet() {
    try { await navigator.clipboard.writeText(this.snippet()); this.message.set('Installation snippet copied.'); }
    catch { this.message.set('Clipboard unavailable. Select and copy the snippet below.'); }
  }
  private errorMessage(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong. Try again.'; }
}
bootstrapApplication(App).catch(console.error);
