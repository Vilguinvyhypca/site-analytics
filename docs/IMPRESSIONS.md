# Thumbnail impressions

Register public thumbnails explicitly; no images, text or URLs are discovered automatically.

```js
const thumbnail = tracker.trackImpression(element, {
  contentId: 'photo-123',
  contentType: 'photo', // or video
  isPublic: () => item.visibility === 'public'
});
// Before removing or reusing this element for another item:
thumbnail.detach();
```

Collection starts only after `tracker.start()` grants consent. At least 50% of the element must intersect the viewport for one continuous second while the document is visible, the element is connected, the route is eligible and the public predicate succeeds. Eligibility is sampled every 250 ms; observer and document visibility transitions reset the duration immediately. This measures viewport intersection, not whether another element obscures the thumbnail or a person actually sees it.

One impression is queued per content type/content ID per page view, including duplicate elements and detach/reattach. A route change or explicit `pageView()` starts a new view. The existing `content_impression` event contains the declared ID/type, anonymous session and timestamp; no media URL is sent. Failed delivery follows normal bounded tracker retries.

`stop()` disconnects observation and clears timers and pending measurement. Registrations survive reconsent, which requires fresh visibility observation; `detach()` permanently removes a registration. Unsupported IntersectionObserver means no impressions. Limits are 200 registered elements and 1,000 distinct impressions per view; hosts should detach virtualized feed items before reuse.

Verification: `tests/impressions.test.ts` covers timing, interruption, duplicate elements, privacy, routes, withdrawal and disposal. `npm run test:interactions` also exercises the real Chromium observer through collection into PostgreSQL. MediaSpace component wiring remains a separate Day 10 task.
