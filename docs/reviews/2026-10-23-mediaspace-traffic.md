# MediaSpace traffic review — October 23, 2026

Prepared for the owner from the MediaSpace Development email, message `bbdbac4347350eeb62b484937e24958e`, and repository source at commit `4fb78c9e32f88a840cd024c9272db8193c63732a`. This is analysis and proposed improvements, not a production change or a sent reply.

## Evidence and access

The supplied report covers October 19, 6 PM–October 21, 6 PM Eastern (48 hours): 24 tracked tab sessions, 35 page views, 22 video starts, four completion events, one browser/video error and a 2.78-second average recorded page load. These totals were supplied by email; I did not independently recompute them from production events. The production account's directory is not readable by this account. No credentials were requested or copied and no protected production dashboard was accessed.

I inspected the report script, event schema/summary, client tracker, playback and sharing components through the connected repository. These establish behavior at the reviewed commit, not proof that every component of that commit is deployed. The email states the scheduled report script uses this version. Its data comes from the existing MediaSpace Experience tracker, separate from the Site Analytics development pilot.

Source references:

- [Report generator](https://github.com/Vilguinvyhypca/sturdy-journey/blob/4fb78c9e32f88a840cd024c9272db8193c63732a/scripts/email-traffic-report.py)
- [Event schema and summary](https://github.com/Vilguinvyhypca/sturdy-journey/blob/4fb78c9e32f88a840cd024c9272db8193c63732a/src/lib/experience.ts)
- [Client tracking and attribution](https://github.com/Vilguinvyhypca/sturdy-journey/blob/4fb78c9e32f88a840cd024c9272db8193c63732a/src/components/ExperienceTracker.tsx)
- [Playback events](https://github.com/Vilguinvyhypca/sturdy-journey/blob/4fb78c9e32f88a840cd024c9272db8193c63732a/src/components/VideoPlayback.tsx)
- [Sharing events](https://github.com/Vilguinvyhypca/sturdy-journey/blob/4fb78c9e32f88a840cd024c9272db8193c63732a/src/components/ShareMediaButton.tsx)
- [Reporting operations](https://github.com/Vilguinvyhypca/sturdy-journey/blob/4fb78c9e32f88a840cd024c9272db8193c63732a/docs/operations/traffic-reports.md)

## What the supplied totals support

| Observation | Supported interpretation | Unsupported interpretation |
| --- | --- | --- |
| Home page: 22 of 35 views (62.9%) | Home is the most viewed reported path | 22 visitors landed there, or home causes drop-off |
| Three listed video detail pages: 3, 2 and 1 views | At least six recorded detail-page views across those three items | Most watched or most appealing videos; overlays/feed can play without visiting detail pages |
| `/videos`: two views | Two recorded listing-page views | Only two people browsed videos |
| Top five paths account for 30 views | Five views belong to paths omitted from this top-five list | Profiles received no visits because they are absent from the list |
| 35 views / 24 tracked sessions = 1.46 | Descriptive views per observed tab-session ID in this window | Bounce rate, unique people, retention or complete session depth |
| 12 `ig/social`, two Instagram-referrer and two Facebook-referrer views | Sixteen views carry social-associated attribution labels | Sixteen distinct acquired people, paid-campaign return or a reliable channel conversion rate |
| Four completions and 22 starts | Both playback-start and ended signals were observed | An 81.8% abandonment rate or a reliable 18.2% completion rate |
| One error; 2.78-second average load | At least one error event and some measured document loads | Overall reliability, mobile performance, or the cause of incomplete playback |

Hypotheses worth testing: social-associated arrivals may engage with videos; the home gallery may be a primary discovery surface; mobile startup delays may affect playback. None is established by these aggregates. Do not redesign discovery or prioritize particular videos on this evidence alone.

## Findings from the code

1. **Source counts mix attribution and missing attribution.** `ExperienceTracker` attaches source/campaign/referrer only to the first tracked page view in the tab. The email groups every page view by `source || referrerHost || 'Direct / unknown'`. Later internal navigation therefore contributes to direct/unknown. Its 19 views cannot be read as 19 direct landings. Report first observed entry attribution separately from subsequent views; missing historical attribution stays unknown.
2. **Popularity is not landing-page reporting.** The email counts all views per path. Entry pages require the first eligible page view per tab session, with window-boundary handling. A session already active before the period must not be relabeled as a newly acquired visitor merely because its first in-window event is available.
3. **Existing journey labels are loose session patterns.** The admin summary checks whether a session contains any video open, any start and any completion. A completion of video B can mask an incomplete video A; an earlier media open can mask a later profile visit with no open. Common journeys collapse consecutive equal steps and stop at six steps. These are not ordered, content-matched funnels or complete paths.
4. **Video completion means an ended event in the inspected player.** Start is emitted once per component instance; completion can emit on each ended event. Seeking/replays and differing mounts can make counts incomparable. There is no playback-attempt ID or observed coverage in the Experience schema. The new pilot has those concepts, but its synthetic verification is not production traffic evidence.
5. **Sharing records intent.** `share_link` is sent before native sharing or clipboard operations. It cannot distinguish copied, cancelled, failed, handed off or delivered. Rename this metric to share attempts until outcomes are available; delivery to a recipient is not observable here.
6. **Performance coverage is limited.** Load timing uses document navigation `loadEventEnd`, not video startup, SPA-route readiness or a mobile experience metric. The email omits sample count and distribution. The load callback checks `loadEventEnd` immediately during the load handler; verify its availability in browser fixtures before assuming every first load is represented. Page duration excludes observations below one second and depends on exit delivery.
7. **Time windows need explicit boundaries.** Monday–Wednesday reports span 48 hours; Wednesday–Monday spans 120. The scheduled script ends at invocation time rather than a fixed scheduled boundary. Delays/manual reruns can introduce overlap or mismatched labels. Use fixed start/end bounds with a half-open interval and test retries, delayed runs and daylight-saving transitions. Raw totals from unequal periods should not be presented as a like-for-like trend.

## Where progress stops

The email does not identify a trustworthy stopping point. The last recorded event is only the last observed activity, not proof of abandonment or its cause. Unload loss, blockers, private browsing, observation-window boundaries, autoplay, seeking and repeats can all change the record.

Using existing data, derive ordered per-tab/per-media sequences and show counts such as “video detail/open observed; no later matching start observed in the available window.” Label incomplete windows and missing starts explicitly. Do not force sharing into a linear post-completion funnel: a visitor can share before playing, or leave through an external link at any stage. True attempt-level playback analysis needs an attempt ID and coverage/watch-time observations.

## Reporting gaps versus tracking gaps

| Journey question | Existing evidence | Work needed |
| --- | --- | --- |
| Arrival → gallery/profile | Page paths, tab IDs, server receipt timestamps; first-view attribution | Reporting: first-observed entry, window handling, ordered transitions and channel grouping |
| Gallery/profile → media open | `media_open`, media ID/type | Reporting: match subsequent events to content; tracking: impressions needed for an exposure-to-open denominator |
| Open → playback start | `video_start` plus content ID | Reporting: match content and order; tracking: attempt identity and autoplay/user-initiated distinction |
| Start → meaningful watch/completion | `video_complete` | Tracking: engaged time, coverage, progress and attempt identity; reporting: cohort-specific denominators |
| Share | `share_link` intent | Reporting: label attempts; tracking: outcomes without claiming recipient delivery |
| Outbound click | Destination host and event path | Reporting: counts/observed sessions by origin path and destination; no recipient/conversion inference |
| Error/performance effects | Generic error type, document load and visible duration | Reporting: sample counts/distributions; tracking: bounded startup/buffering/autoplay-policy signals and optional coarse viewport category after privacy review |

## Prioritized recommendations and success criteria

1. **Fix report definitions first.** Separate entry-source sessions from page views; display timeframe, load sample count, missing-attribution counts, share attempts and observed ended events. Success: synthetic direct/social sessions with multiple internal views retain one acquisition classification, while total views still reconcile exactly; all denominators and omissions are printed.
2. **Make report windows reproducible.** Use explicit scheduled boundaries and retain report-generation time separately. Success: adjacent delayed/rerun reports neither omit nor double-count boundary events; 48/120-hour periods and DST fixtures pass. Compare matched durations or show per-day rates with sample sizes.
3. **Build ordered, content-matched journey summaries from existing events.** Include entry → gallery/profile → media-open/start patterns, with sharing and outbound actions as branches. Success: fixtures with two videos, replay, direct detail entry and truncated sessions are classified correctly; unclassified/partial observations are visible rather than forced into a funnel.
4. **Reconcile the pilot with current MediaSpace before any rollout.** The pilot was built from an older checkout that mounted Fullstory. The reviewed branch already has Experience tracking and newer playback/sharing behavior. Port the analytics changes onto the current application without losing those fixes; choose the intended collector and consent policy deliberately. Success: representative browser journeys produce one intended set of events, existing loader/autoplay/share fallback behavior remains intact, and denied consent, authenticated/private/unlisted cases produce no prohibited collection. Historical Experience counts and new coverage-based metrics remain separately labeled.
5. **Investigate the error and video startup before redesigning the UI.** Obtain the error category and affected content/path counts. Measure startup latency and playback failures with sample counts, then reproduce any affected scenario on target browsers. Success: a reproducible defect has a regression test; before/after startup distributions and failure counts are compared within equivalent cohorts. No mobile-specific conclusion or numerical speed target is justified yet by the supplied mean.
6. **Improve discovery only after obtaining exposure denominators.** Measure eligible thumbnail impressions → opens → observed starts by surface/content. Success: a predeclared change is compared against a baseline using the same visibility/consent rules and adequate observations; report uncertainty instead of claiming a lift from a few visits. No new personal identifiers, raw search terms or session replay are needed.

## Minimum additional evidence

Prefer an administrator-generated aggregate export for the exact report interval: complete page/action tables; error types and affected paths/content; load sample count and median/p75/p95; first-observed entries; and ordered content-matched session-pattern counts with unknown/partial groups. Also provide deployed commit and tracker configuration (no secrets). If aggregates cannot resolve matching, use a tightly bounded export with remapped tab IDs, relative ordering, event name, approved path and content ID; exclude credentials, IP addresses, raw referrer/query strings and private/unlisted content. Include enough boundary context to label continuing sessions, without treating tab IDs as people.

No production dataset access was available during this review, so no specific visitor sequence, device problem, drop-off location or retention claim is presented as verified.
