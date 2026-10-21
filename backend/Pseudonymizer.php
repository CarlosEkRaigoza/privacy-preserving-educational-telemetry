<?php

namespace App\Support;

use RuntimeException;

/**
 * Replaces a participant identifier with a stable pseudonym, computed with
 * HMAC-SHA256 and a dedicated secret key.
 *
 * The function is one-way and deterministic: the same participant always
 * produces the same pseudonym, which is what allows the actions of a session to
 * be correlated — while the stored value does not permit recovering the
 * identifier it came from. The secret key additionally prevents reproducing the
 * computation by brute force over the space of possible identifiers, which a
 * plain hash of a short numeric id would not withstand.
 *
 * The mapping between identifier and pseudonym can only be reconstructed by
 * knowing the key, which is never stored alongside the events.
 */
class Pseudonymizer
{
    public static function hash(string $participantId): string
    {
        return hash_hmac('sha256', $participantId, self::key());
    }

    /**
     * @throws RuntimeException if the key is not configured.
     *
     * The check is deliberate: hash_hmac() accepts an empty key without error,
     * so a missing environment variable would silently produce pseudonyms
     * computed with a null key, and the failure would go unnoticed — every
     * participant would still get a distinct-looking hash.
     */
    private static function key(): string
    {
        $key = config('tracking.hmac_key');

        if (empty($key)) {
            throw new RuntimeException(
                'TRACKING_HMAC_KEY is not configured; pseudonymisation cannot operate without a key.'
            );
        }

        return $key;
    }
}
