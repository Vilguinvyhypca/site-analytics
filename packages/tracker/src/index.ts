/** Inert foundation: no storage, network requests, or automatic collection. */
export function status() {
  return { collectionEnabled: false, reason: 'not-implemented' } as const;
}
