<?php

namespace App\Http\Controllers;

use App\Models\LearningEvent;
use App\Support\Pseudonymizer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Privacy-preserving middleware: the single point through which every
 * pedagogical event passes before it is stored.
 *
 * Responsibilities, in order:
 *   1. structural validation of the event
 *   2. substitution of the participant identifier by its pseudonym
 *   3. server-side resolution of the session source
 *   4. storage, idempotent with respect to event_id
 *   5. technical diagnostics, kept apart from the pedagogical event model
 *
 * The participant identifier reaches this endpoint over TLS and is hashed
 * before persistence. The guarantee is about STORAGE: no identifier in the
 * clear is ever written to the event store.
 *
 * The companion endpoint that exchanges a one-time token for a participant
 * identifier is deployment-specific and not included here. Its contract is:
 *   GET /api/resolve-participant-token?t=<token>  ->  { "participant_id": "..." }
 * The token should be short-lived and single-use, so that the identifier never
 * appears as a URL parameter in the browser.
 */
class TrackingController extends Controller
{
    public function storeEvent(Request $request)
    {
        $start        = microtime(true);
        $payloadBytes = strlen($request->getContent());

        $validated = $request->validate([
            'event_id'    => 'required|string|max:100',
            'timestamp'   => 'required|date',
            'session_id'  => 'required|string|max:100',
            'user_id'     => 'nullable|string|max:255',
            'game_id'     => 'required|string|max:100',
            'event_type'  => 'required|string|max:100',
            'duration_ms' => 'nullable|integer|min:0',
            'metadata'    => 'nullable|array',
        ]);

        // Pseudonymisation. From here on the raw identifier is out of scope:
        // it is never assigned to anything that reaches the model.
        $userIdHash = $validated['user_id']
            ? Pseudonymizer::hash($validated['user_id'])
            : null;

        // The source is decided by the SERVER, never taken from the client.
        // A browser can claim anything; what it cannot do is produce a
        // participant identifier it was not given.
        $sessionSource = $userIdHash !== null ? 'identified' : 'anonymous';

        if ($sessionSource === 'anonymous' && ! config('tracking.accept_anonymous', true)) {
            return response()->json(['status' => 'ignored'], 201);
        }

        try {
            LearningEvent::create([
                'event_id'       => $validated['event_id'],
                'occurred_at'    => $validated['timestamp'],
                'session_id'     => $validated['session_id'],
                'user_id_hash'   => $userIdHash,
                'session_source' => $sessionSource,
                'game_id'        => $validated['game_id'],
                'event_type'     => $validated['event_type'],
                'duration_ms'    => $validated['duration_ms'] ?? null,
                'metadata'       => $validated['metadata'] ?? [],
            ]);
        } catch (\Illuminate\Database\QueryException $e) {
            // event_id is unique. A retransmission of the same request cannot
            // duplicate the record, so it is answered without error: the event
            // is already stored. This matters because the transport uses
            // keepalive requests, which may be retried on page unload.
            if ($e->getCode() === '23000') {
                return response()->json(['status' => 'duplicate'], 200);
            }
            throw $e;
        }

        // Technical diagnostics — payload size and server-side processing time.
        // Deliberately written to a separate channel and NOT to learning_events:
        // the pedagogical event model stays free of operational instrumentation.
        Log::channel('performance')->info('event', [
            'event_type'    => $validated['event_type'],
            'game_id'       => $validated['game_id'],
            'bytes'         => $payloadBytes,
            'processing_ms' => (int) round((microtime(true) - $start) * 1000),
        ]);

        return response()->json(['status' => 'ok'], 201);
    }
}
