# Privacy-Preserving Educational Telemetry

Reference implementation of the instrumentation and pseudonymisation layers of
a modular telemetry architecture for educational web platforms operating in
sensitive contexts.

This repository accompanies the article:

> C. R. Ek Raigoza and V. H. Menéndez Domínguez, "A Modular Privacy-Preserving
> Telemetry Architecture for Educational Web Platforms in Sensitive Contexts."

The mechanisms here — dual dispatch, token exchange, server-side
pseudonymisation, event store — are those of a deployment instrumenting
fourteen educational activities. Deployment-specific capture modes, interface
chrome and the project's own event catalogue have been removed so that the
architecture can be read, and reused, on its own.

---

## What this is

The architecture has four layers. This repository contains the two that
constitute the contribution of the article:

| Layer | Component | Here |
|---|---|---|
| 1 — Pedagogical telemetry instrumentation | `learningTracker.js` + schema catalogue | yes |
| 2 — Privacy-preserving middleware | `Pseudonymizer`, `TrackingController` | yes |
| 3 — Self-hosted analytics engine | Open Web Analytics | upstream project |
| 4 — Institutional storage and dashboards | application-specific | no |

The analytics engine is an unmodified installation of
[Open Web Analytics](https://www.openwebanalytics.com/). The dashboards are
specific to the host institution and fall outside the contribution.

---

## Layout

```
src/
  learningTracker.js        Transport: normalises events, dispatches them over
                            two independent routes, resolves the participant
                            token, measures active time
  eventSchema.core.js       Domain-independent catalogue: lifecycle of an
                            attempt, answers, tries
  eventSchema.example.js    Project catalogue template — the only file you
                            rewrite when porting the layer
backend/
  TrackingController.php            Validation, pseudonymisation, storage,
                                    diagnostics
  Pseudonymizer.php                 HMAC-SHA256 with a dedicated secret key
  config_tracking.php               Laravel config/tracking.php
  create_learning_events_table.php  Event store schema
example/
  index.html                Minimal instrumented activity, runs as-is
  trackerConfig.example.js  Per-deployment configuration template
```

---

## The design

### Two components, not one

The instrumentation layer is deliberately split. `learningTracker.js` knows how
to *send* an event but nothing about pedagogy; the catalogue knows what a
pedagogically meaningful event *is* but nothing about transport. An activity
calls named helpers:

```js
LearningTracker.gameStarted();
LearningTracker.answerSelected('option-b', true, 2400);
LearningTracker.gameCompleted(startTime, { correct_answers: 7 });
```

Instrumenting an activity takes three script tags. Porting to another project
means rewriting `eventSchema.<project>.js` only; the transport and the core
catalogue travel unchanged.

### Two routes, carrying different things

Every event is dispatched twice, and the two payloads are not the same:

- **To the institutional API** goes the full event, participant identifier
  included. The server pseudonymises it before storage.
- **To the analytics engine** go only the activity id, the event type and the
  numeric metadata. The participant identifier never enters this route.

Correlation is done through `session_id`, a random opaque value generated per
browser tab that identifies nobody. See `_sendRaw()` in `learningTracker.js`:
the two calls are adjacent, and what each one carries is visible at a glance.

### The identifier is never a URL parameter

An activity is opened with a short-lived single-use token, `?t=…`, which the
transport exchanges server-side for the participant identifier. Events emitted
while that exchange is in flight are queued and released when it resolves, so
none are lost. The identifier therefore never appears in the address bar,
browser history, or a `Referer` header.

### Pseudonymisation happens on arrival, not in transit

The identifier travels to the institutional endpoint over TLS and the
middleware applies HMAC-SHA256 with a server-side secret key before persisting
it. The guarantee is about **storage**: no identifier in the clear is ever
written to the event store. `user_id_hash` is the only identity-bearing column,
and it holds a hash.

The key is deliberately independent of the application key, so that rotating
the latter does not silently split a participant's history in two.
`Pseudonymizer` raises rather than hashing with an empty key, because
`hash_hmac()` accepts one without error and the failure would otherwise go
unnoticed.

### The server decides the session source

A browser can claim anything. What it cannot do is produce a participant
identifier it was not given — so the source is resolved server-side from
whether pseudonymisation happened, not from what the client declared.

---

## Configuration

Nothing is hardcoded. Copy `example/trackerConfig.example.js` to
`trackerConfig.js`, fill it in, and serve it first:

```html
<script src="/js/trackerConfig.js"></script>
<script src="/js/learningTracker.js" data-game-id="my-activity"></script>
<script src="/js/eventSchema.core.js"></script>
<script src="/js/eventSchema.myproject.js"></script>
```

On the server:

```
TRACKING_HMAC_KEY=<a long random value, not shared with any other subsystem>
TRACKING_ACCEPT_ANONYMOUS=true
```

The application refuses to pseudonymise without the key.

To try the example, copy `trackerConfig.example.js` to
`example/trackerConfig.js` and open `example/index.html`. With no configuration
present, dispatch fails silently and the activity still works — which is the
intended behaviour: instrumentation must never break the activity it observes.

---

## What is not here

No data, no credentials, no analytics site identifiers, no participant records.
The telemetry layer never reads the institutional case-file schema the original
platform operates on, and nothing of it appears here.

---

## Licence

MIT — see [LICENSE](LICENSE).
