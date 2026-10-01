import type { TrackerOptions } from '@site-analytics/contracts';
/** Scaffold only: collection and consent lifecycle arrive in Day 4. */
export function createTracker(options: TrackerOptions) {
  if (!options.projectId || !options.collectionUrl) throw new Error('Project and collection URL are required');
  return Object.freeze({ version: 1, collectionEnabled: false });
}
