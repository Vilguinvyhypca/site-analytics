import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app';

bootstrapApplication(App).catch(() => {
  document.body.textContent = 'Site Analytics could not start. Please reload the page.';
});
