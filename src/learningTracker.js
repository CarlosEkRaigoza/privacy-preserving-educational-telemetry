/**
 * learningTracker.js — transport layer of a pedagogical telemetry architecture.
 *
 * Captures pedagogical events from an educational activity, normalises them and
 * dispatches them over two independent routes:
 *
 *   Route 1 — institutional API: the full event, including the participant
 *             identifier. The server pseudonymises it before storage.
 *   Route 2 — self-hosted analytics engine: activity id, event type and numeric
 *             metadata only. The participant identifier never travels here.
 *
 * The two records are correlated through session_id, a random opaque value
 * generated per browser tab that identifies nobody.
 *
 * This file knows how to SEND an event but nothing about pedagogy. What counts
 * as a pedagogically meaningful event lives in the schema catalogue
 * (eventSchema.core.js and eventSchema.<project>.js). Porting the layer to
 * another project means rewriting the project catalogue only; this file and the
 * core catalogue travel unchanged.
 *
 * ── INTEGRATION ─────────────────────────────────────────────────────────────
 *
 *   <script src="/js/trackerConfig.js"></script>
 *   <script src="/js/learningTracker.js" data-game-id="my-activity"></script>
 *   <script src="/js/eventSchema.core.js"></script>
 *   <script src="/js/eventSchema.myproject.js"></script>
 *
 * Configuration precedence: data-* attribute > window.LearningTrackerConfig
 * (trackerConfig.js, one per deployment) > internal default.
 *
 *   data-api-url      institutional tracking API
 *   data-owa-url      analytics server URL
 *   data-owa-site-id  analytics site id
 *   data-game-id      activity identifier
 *   data-user-id      participant id. Normally arrives through the one-time
 *                     token ?t= instead, never as a query parameter.
 *
 * ── PUBLIC API ──────────────────────────────────────────────────────────────
 *
 *   LearningTracker.event(eventType, metadata)
 *     Low-level call. Activities use the named helpers of the catalogue,
 *     which call this one.
 *
 *   LearningTracker.timer.start(name) / .stop(name) / .elapsed(name)
 *     Named timers. stop() emits 'timer_stopped' with duration_ms.
 *
 *   LearningTracker.identified
 *     true when the activity was opened with a participant token.
 *
 * This file emits two events of its own, outside the activity lifecycle:
 *   session_active_time { active_seconds }   on beforeunload
 *   timer_stopped       { duration_ms, timer_name }
 *
 * Standard metadata names, for comparability across activities:
 *   duration_ms · score · moves_remaining · attempts · errors · level · item_id
 * ─────────────────────────────────────────────────────────────────────────────
 */

(function () {
    'use strict';

    // ── 1. Configuration ──────────────────────────────────────────────────────

    var _script = document.currentScript || (function () {
        var s = document.getElementsByTagName('script');
        return s[s.length - 1];
    })();

    var _cfg       = window.LearningTrackerConfig || {};
    var _apiUrl    = _script.getAttribute('data-api-url')     || _cfg.apiUrl    || '/api/track';
    var _owaUrl    = _script.getAttribute('data-owa-url')     || _cfg.owaUrl    || '';
    var _owaSiteId = _script.getAttribute('data-owa-site-id') || _cfg.owaSiteId || '';
    var _gameId    = _script.getAttribute('data-game-id')     || 'unknown';
    var _userId    = _script.getAttribute('data-user-id')     || null;

    if (_owaUrl && _owaUrl.charAt(_owaUrl.length - 1) !== '/') { _owaUrl += '/'; }

    function _queryParam(name) {
        var m = RegExp('[?&]' + name + '=([^&]*)').exec(window.location.search);
        return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : '';
    }

    // ── 2. One-time participant token ─────────────────────────────────────────
    // The participant identifier is never exposed as a URL parameter. The
    // activity is opened with ?t=<token>, which is exchanged server-side for the
    // identifier. Events emitted while the exchange is in flight are queued and
    // released once it resolves, so none are lost.

    var _queue    = [];
    var _resolved = !!_userId;
    var _token    = _queryParam('t');

    /** true when a participant token was supplied: the session is identified. */
    var _identified = !!_token;

    if (_token && !_userId) {
        fetch(_apiUrl.replace(/\/track$/, '') + '/resolve-participant-token?t=' + encodeURIComponent(_token), {
            method: 'GET', credentials: 'omit'
        })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) { if (d && d.participant_id) { _userId = String(d.participant_id); } })
        .catch(function () {})
        .finally(function () {
            _resolved = true;
            _queue.forEach(function (payload) { payload.user_id = _userId; _sendRaw(payload); });
            _queue = [];
        });
    } else {
        // No token: an anonymous session. Events are still emitted; the server
        // decides whether to retain them.
        _userId   = _userId || null;
        _resolved = true;
    }

    // ── 3. Session id — survives reloads within the same tab ──────────────────

    function _generateId(prefix) {
        return (prefix || 'ev') + '_' + Date.now().toString(36) + '_' +
               Math.random().toString(36).slice(2, 7);
    }

    var _sessionId = sessionStorage.getItem('lt_session_id');
    if (!_sessionId) {
        _sessionId = _generateId('sess');
        sessionStorage.setItem('lt_session_id', _sessionId);
    }

    // ── 4. Analytics engine initialisation ────────────────────────────────────
    // Handles page views, visit duration, device info and navigation flow.
    // Pedagogical events are routed through the institutional API instead.

    if (_owaUrl && _owaSiteId) {
        window.owa_baseUrl = _owaUrl;
        window.owa_cmds    = window.owa_cmds || [];
        window.owa_cmds.push(['setSiteId', _owaSiteId]);
        window.owa_cmds.push(['trackPageView']);

        // Correlation anchor: records our session_id as the label of an analytics
        // action, so navigation records can be joined to stored events. Sent on
        // load, always — it carries no identity, only the opaque session id.
        window.owa_cmds.push(['trackAction', _gameId, 'session_metadata', _sessionId, 1]);

        (function () {
            var el = document.createElement('script');
            el.type = 'text/javascript';
            el.async = true;
            window.owa_baseUrl = ('https:' === document.location.protocol)
                ? (window.owa_baseSecUrl || window.owa_baseUrl.replace(/http:/, 'https:'))
                : window.owa_baseUrl;
            el.src = window.owa_baseUrl + (_cfg.owaTrackerPath || 'modules/base/dist/owa.tracker.js');
            var first = document.getElementsByTagName('script')[0];
            first.parentNode.insertBefore(el, first);
        }());
    }

    // ── 5. Active time ────────────────────────────────────────────────────────
    // Counts only seconds with recent interaction, so a tab left open does not
    // inflate the figure.

    (function () {
        var INACTIVITY_MS = 30000;
        var lastActivity  = Date.now();
        var activeSeconds = 0;

        ['mousemove', 'click', 'keydown', 'scroll', 'touchstart'].forEach(function (evt) {
            document.addEventListener(evt, function () { lastActivity = Date.now(); }, { passive: true });
        });

        setInterval(function () {
            if (Date.now() - lastActivity < INACTIVITY_MS) { activeSeconds += 5; }
        }, 5000);

        window.addEventListener('beforeunload', function () {
            _send({ event_type: 'session_active_time', metadata: { active_seconds: activeSeconds } });
        });
    }());

    // ── 6. Dual dispatch ──────────────────────────────────────────────────────

    function _sendRaw(payload) {

        // Route 1 — institutional API. Full payload, participant identifier
        // included. keepalive lets the request survive page unload.
        fetch(_apiUrl + '/event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            credentials: 'omit',
            keepalive: true
        }).catch(function () {});

        // Route 2 — analytics engine, fired from the browser so it receives its
        // own visitor context. Only activity id, event type and numeric metadata
        // travel here. payload.user_id is deliberately absent from this call.
        if (!_owaUrl || !_owaSiteId) { return; }
        window.owa_cmds = window.owa_cmds || [];
        var meta = payload.metadata || {};
        var keys = Object.keys(meta);
        if (keys.length > 0) {
            keys.forEach(function (k) {
                window.owa_cmds.push(['trackAction', _gameId, payload.event_type, k, Number(meta[k]) || 0]);
            });
        } else {
            window.owa_cmds.push(['trackAction', _gameId, payload.event_type, 'triggered', 1]);
        }
    }

    function _send(payload) {
        var body = {
            event_id:    _generateId('ev'),
            timestamp:   new Date().toISOString(),
            session_id:  _sessionId,
            user_id:     _userId,
            game_id:     _gameId,
            event_type:  payload.event_type,
            duration_ms: payload.duration_ms ||
                         (payload.metadata && payload.metadata.duration_ms) || null,
            metadata:    payload.metadata || {}
        };
        if (_resolved) { _sendRaw(body); } else { _queue.push(body); }
    }

    // ── 7. Timers ─────────────────────────────────────────────────────────────

    var _timers = {};

    var _timer = {
        start: function (name) { _timers[name] = Date.now(); },
        stop: function (name) {
            if (!_timers[name]) { return; }
            var d = Date.now() - _timers[name];
            delete _timers[name];
            _send({ event_type: 'timer_stopped', duration_ms: d, metadata: { timer_name: name } });
            return d;
        },
        elapsed: function (name) {
            return _timers[name] ? Date.now() - _timers[name] : 0;
        }
    };

    // ── 8. Public API ─────────────────────────────────────────────────────────

    window.LearningTracker = {
        /**
         * Emit a pedagogical event.
         * @param {string} eventType — name from the catalogue, e.g. 'answer_selected'
         * @param {Object} [metadata] — contextual key/value data
         */
        event: function (eventType, metadata) {
            _send({ event_type: eventType, metadata: metadata || {} });
        },

        /** true when the activity was opened with a participant token. */
        identified: _identified,

        /** Named timers: start(name), stop(name), elapsed(name). */
        timer: _timer
    };

}());
