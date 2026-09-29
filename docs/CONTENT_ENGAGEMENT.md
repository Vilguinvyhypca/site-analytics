# Content engagement requirements

Status: requirements recorded; not implemented.

## Product priority

The owner wants to understand how visitors engage with individual content items: which videos they open, how long they watch, and whether they use sharing actions. The desired reporting resembles creator engagement insights rather than only website traffic counts.

Keep the dashboard private initially. Public-facing counters, profiles, social features, and customer signup are future possibilities, not current requirements. The generic page/click/scroll tracker remains useful, but video measurements need an explicit player integration as well.

## First three dashboard reports

1. **Content performance:** per-content opens, playback starts, engaged playback time, completion milestones, and sharing actions, filtered by site and date.
2. **Video engagement:** watch-time distribution, percentage of timeline actually played, repeat playback, and last observed position when a playback stops reporting. A last observation is not proof of why someone left.
3. **Anonymous session activity:** a visitor session's ordered content opens, playback summaries, and sharing actions. This is an event timeline, not visual session replay.

Illustrative dashboard entry, not actual collected data:

> Session A opened Video 12, recorded 38 seconds of engaged playback, covered 63% of its timeline, and copied its share link.

## Identity boundary

Initially, “each user” means an anonymous browser session, not a verified person. Session IDs are scoped to a project. Returning-visitor recognition across sessions needs a separate identifier/consent decision; cross-device recognition cannot be inferred from anonymous sessions. If an integrated app later has user accounts, an optional opaque account identifier could be separately scoped. Do not introduce fingerprinting or require public accounts for the MVP.

## Measurement definitions to implement and verify

| Signal | Proposed definition and limits |
| --- | --- |
| Content open | An explicit open/click action with a stable content ID; distinguish it from merely displaying a thumbnail |
| Playback start | The player reports actual playback; opening the overlay alone does not count |
| Playback instance | A unique ID for one playback attempt, separate from visitor session and content IDs, allowing multiple videos/tabs and repeat plays |
| Engaged playback seconds | Accumulated elapsed time while playing, not seeking/buffering/paused, with a visible document and a player meeting an agreed on-screen visibility threshold; this is an engagement proxy, not proof of human attention |
| Timeline coverage | Union of video intervals actually played; seeking ahead does not count skipped intervals and repeat playback does not inflate unique coverage |
| Milestones | Once-per-playback thresholds based on actual timeline coverage, such as 25%, 50%, 75%, and 100%; define end tolerance and unknown-duration behavior before implementation |
| Repeat playback | Replayed content time is separate from unique timeline coverage; total engaged playback can exceed the video's duration |
| Sharing action | Distinguish share-button click, successful clipboard copy, and native share handoff outcome where observable; none proves that a recipient received or viewed it |

Display engaged elapsed seconds separately from timeline seconds. Playback at 2× speed can cover 20 seconds of content in about 10 seconds of elapsed playback. Counts of clicks, playback instances, and anonymous sessions must have separate labels and denominators.

Pause, buffering, seeking, document visibility, player visibility, playback speed, overlay close, navigation, end, and looping all need defined behavior. Choose the visibility threshold, heartbeat interval, end tolerance, and reporting denominators in Day 1's decisions document.

## Implementation steps

- [ ] Extend shared contracts with stable content IDs, content type, playback IDs, bounded progress summaries, and sharing outcome categories. Do not send raw signed playback URLs.
- [ ] Add a small player adapter API alongside the framework-independent tracker. Implement adapters for MediaSpace's native video and Mux players through their supported events.
- [ ] Accumulate playback measurements locally; send periodic bounded summaries and a best-effort final summary instead of every player time-update event.
- [ ] Make progress updates idempotent using playback ID and sequence/version information. Retries must not double count time; reject implausible values and handle out-of-order updates.
- [ ] Store/report engaged playback, unique timeline coverage, playback starts, and sharing actions by project/content/session/date.
- [ ] Render the three priority reports and label missing or partial observations honestly.
- [ ] Verify overlays, the feed's scrolling container, concurrent players, and switching between videos without mixing their measurements.

The collector's browser input remains untrusted. Validate bounds and quotas; do not treat anonymous measurements as audit-grade records. Unexpected browser termination can lose the final interval, so report observed time rather than claiming perfect capture.

## Acceptance scenarios

- Opening a video without playback produces an open but no watch time.
- Pausing, buffering, seeking, hiding the tab, or moving the player out of the agreed visible region stops engaged-time accumulation.
- Seeking from the beginning to the end does not report that the whole video was watched.
- Replaying a segment increases elapsed engagement but does not duplicate unique timeline coverage.
- Playback speed changes do not confuse elapsed time with covered content duration.
- Duplicate or out-of-order progress batches do not inflate totals or overwrite a newer summary.
- Closing an overlay or switching feed videos attributes the final available summary to the correct playback instance.
- A failed/cancelled share is not reported as a successful share; clipboard success is labelled “link copied,” not “content posted.”
- Two projects using the same content ID remain isolated; consent/admin/private-content exclusions still apply.

## Schedule impact

This expands the original generic click/scroll scope. Pull video contracts into Days 1–3 and a player prototype into Days 4–5 so measurement risk is discovered early. Day 9 becomes multiple packages: **9A player measurements**, **9B sharing and aggregation**, and **9C engagement reports/fixtures**. Day 10 remains the MediaSpace integration check.

Provisionally allow **2–4 additional working days** beyond the previous MVP plan; actual effort depends on the player prototype and chosen report detail. Re-estimate after Day 5. The original two-week MVP is a target to revisit, not an unchanged promise after adding watch-time reporting. Session replay is still deferred and is not needed for these reports.
