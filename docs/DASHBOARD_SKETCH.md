# Engagement dashboard sketch

Design artifact only. All examples are illustrative; no traffic has been collected.

## Shared layout

```text
Site Analytics                         [Site: MediaSpace v] [Account]
Overview | Content | Sessions | Project settings

[Profile: All v] [Date: Last 7 days v] [Time zone: America/New_York v]
Collection: disabled / active / receiving no recent events
```

Show zero values only for successfully loaded reports with no matching observations. Errors and incomplete collection must be explicit. On narrow screens, stack summary cards and allow table scrolling without hiding metric labels.

## Overview — are visitors finding and opening content?

```text
[Observed profile sessions] [Sessions opening media] [Playback starts]

Observed journey: profile visit → media impression → open → play
                  counts and clearly labelled conversion denominators

Referral host          Sessions       Opened media       Started playback
Known host / Unknown   ...            ...                ...

Guide exposure: Not enabled
```

Use “sessions,” not “people.” No assertion that missing referrers came from social media. A session may contain multiple media opens and playback instances.

## Content — which items engage visitors?

```text
Content           Impressions  Opens  Starts  Avg watch  Completion  Link copies
Video title / ID  ...          ...    ...     ...        ...         ...
Photo title / ID  ...          ...    —       —          —           ...
```

Click a content row to inspect engaged-time distribution, unique timeline coverage, repeat playback, and separate sharing outcomes. Explain the completion definition beside the report. Show “unavailable” for unknown duration; do not use a misleading zero percentage.

Content names, if supported, come from an explicit safe catalog mapping. Never collect signed URLs or scrape page text to label reports.

## Sessions — what happened during one anonymous visit?

```text
Session (short ID)    First seen       Content opens       Observed watch time
Session A            Illustrative     2                   38 seconds

Selected session timeline:
  Profile opened
  Video 12 thumbnail visible
  Video 12 opened
  Playback started
  Playback summary: 38 engaged seconds, 63% timeline coverage
  Share link copied
  Photo 4 opened
```

Timeline summaries are not a screen recording. Last observation is labelled as such, not “user left because…”; tab closure or connection loss may prevent a final event.

## Settings and deferred features

Settings will provide installation instructions, allowed sites/origins, collection switch, retention, and owner access controls. Do not show subscriber emails, notification delivery tools, paid plans, public social counters, or invented returning-person profiles.

Later UX tests can add guide-exposure comparisons. Session replay remains outside the MVP.
