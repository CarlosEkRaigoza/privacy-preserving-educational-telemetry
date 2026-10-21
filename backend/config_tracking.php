<?php

/**
 * Laravel config/tracking.php
 */

return [

    /*
    |--------------------------------------------------------------------------
    | Pseudonymisation key
    |--------------------------------------------------------------------------
    |
    | Secret key used to compute the HMAC-SHA256 that replaces the participant
    | identifier before any event is stored.
    |
    | Deliberately independent of APP_KEY: rotating the application key is a
    | routine security operation and must not alter pseudonyms already issued,
    | because that would split a participant's history in two without producing
    | any visible error.
    |
    | There is no default on purpose. Pseudonymizer raises rather than hashing
    | with an empty key.
    |
    */

    'hmac_key' => env('TRACKING_HMAC_KEY'),

    /*
    |--------------------------------------------------------------------------
    | Anonymous capture
    |--------------------------------------------------------------------------
    |
    | Whether to retain events from sessions with no participant token. Useful
    | for open settings — a public demonstration, a science fair — where there
    | is no participant record to pseudonymise against.
    |
    | Turning it off makes the endpoint answer normally and discard the event,
    | so an activity never breaks because capture is closed.
    |
    */

    'accept_anonymous' => env('TRACKING_ACCEPT_ANONYMOUS', true),

];
