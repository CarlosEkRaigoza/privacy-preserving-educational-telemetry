/**
 * trackerConfig.example.js — one per deployment.
 *
 * Copy to trackerConfig.js, fill in your own values, and serve it BEFORE
 * learningTracker.js. Nothing here belongs in version control once filled in.
 */
window.LearningTrackerConfig = {

    // Institutional endpoint that receives the full event and pseudonymises it.
    // Route 1 of the dual dispatch.
    apiUrl: 'https://your-institution.example/api/track',

    // Self-hosted Open Web Analytics instance. Route 2 — receives activity id,
    // event type and numeric metadata only; never the participant identifier.
    owaUrl: 'https://your-analytics.example/',

    // Site identifier of your OWA property. Treat it as a deployment secret:
    // anyone who knows it can write to your analytics data.
    owaSiteId: '',

    // Path to the OWA tracker script inside the OWA installation.
    // Default shown; override if your deployment differs.
    owaTrackerPath: 'modules/base/dist/owa.tracker.js',
};
