# Explicit clicks, custom events and scroll milestones

Apply migration `005_interactions.sql` before using the updated tracker. It adds the event types and a unique scroll-threshold index. No page content or input values are scraped. These APIs record observations on public, consented routes; they are not evidence of attention or proof that an action was human initiated.

```js
const click = analytics.trackClick(document.querySelector('#open-video'), {
  name: 'open-video-button',
  isPublic: () => currentPageIsPublic
});
analytics.recordEvent({ name: 'category-selected', isPublic: () => currentPageIsPublic });
const pageScroll = analytics.trackScroll(document, {
  scopeId: 'document', isPublic: () => currentPageIsPublic
});
const feedScroll = analytics.trackScroll(document.querySelector('#feed'), {
  scopeId: 'video-feed', isPublic: () => feedIsPublic
});
// These registrations can be made before consent. They stay inert until start().
// Call analytics.start() only after consent, analytics.stop() on withdrawal.
// Before removing/replacing an element:
click.detach();
feedScroll.detach();
pageScroll.detach();
```

Names/scope IDs are declared stable labels (1–128 letters, digits, hyphens or underscores), never user-provided text, URLs, account IDs or form contents. Required `isPublic()` callbacks must use host-verified visibility metadata. A false or throwing predicate blocks collection. The existing route sanitizer must return an allowed public path, and that route must have an active page-view instance. Interactions occurring during a route transition before its page view are conservatively skipped.

## Click and custom-event semantics

Only registered elements have click listeners. A click bubbling through nested registered elements is queued at most once per tracker; the first eligible registered handler wins. Ordinary native click events include keyboard-activated controls, while programmatic clicks can also emit observations. The tracker never cancels propagation or default application behavior. Do not register a broad mixed-public/private parent.

`recordEvent()` records an explicitly declared custom name with no arbitrary properties. It returns whether the event was queued, not delivered. Each explicit invocation is a distinct observation. Retries retain event IDs and are deduplicated by the collector. There are at most 100 click and 20 scroll registrations per tracker; duplicate element registrations and duplicate scroll scope IDs are rejected. Detach handles are idempotent and release the slot.

`stop()` removes active listeners and drops queued data; registrations remain for later explicit consent. No observer, listener, storage, geometry measurement or request starts merely by registering before consent. Re-start creates a new page view and activates listeners again.

## Scroll definition

Scroll thresholds are 25%, 50%, 75% and 100% of **scrollable distance**: `scrollTop / (scrollHeight - clientHeight)`. Top is 0%; bottom is 100%, with one pixel of bottom tolerance. This is not viewport-bottom percentage or watch time. Short non-scrollable surfaces produce no milestones.

- A downward scroll is required; initial layout, upward movement and stationary repeated events do not count.
- A jump can cross multiple thresholds, each recorded once. Scripted scrolls can qualify; this does not claim human attention.
- Document visibility must be visible. A registered container must be connected, have positive size and intersect the viewport.
- Each event includes sanitized path, scope ID, milestone and the current page view's event ID as `viewId`.
- Thresholds reset for a new queued page view (including explicit `pageView()`, SPA navigation or consent restart), not merely when scrolling back to the top.
- Dynamic height changes affect subsequent depth calculations, but never reset already recorded thresholds. Reaching the old bottom of a feed and loading more content does not re-emit 100% for that same page view. It also does not imply the visitor finished the expanded feed.
- Already queued thresholds stay recorded through retries. Queue limits, abrupt navigation or permanent collection rejection can lose observations; no perfect-delivery claim is made.

The collector enforces uniqueness on project, session, view ID, scope and milestone, in addition to normal event-ID deduplication. Thus an accidentally regenerated event ID does not duplicate the same threshold. Different page views, scopes and projects remain separate. The collector still treats browser claims as untrusted; a supplied view ID is not authentication.

## Reporting and verification

The engagement report has occurrence-date-scoped click/custom/scroll totals and up to 100 groups by type, declared name/scope, path and threshold, with total-group metadata. Session counts are distinct anonymous sessions within each group and must not be added across groups. Scroll event totals count thresholds, not distinct visitors or completed pages. The session timeline renders each interaction using its declared fields.

`npm run check` includes deterministic consent, public-route, dynamic-height, visibility, per-view and retry tests. `npm run test:db` verifies the migration, strict payloads, deduplication and exact project/date-scoped report/timeline values. `npm run test:interactions` builds the application and exercises real browser clicks and document/container scrolling through the collector, database and owner dashboard. It uses a disposable database on 55438 and a local app on 4314, then cleans up.

MediaSpace-specific element selection, virtualized feeds, mixed content visibility, thumbnail-impression automation and physical mobile behavior still need the Day 10 development integration and later browser matrix checks. Do not install the tracker on admin or protected/unlisted content.
