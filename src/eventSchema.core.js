/**
 * eventSchema.core.js — core of the event catalogue.
 *
 * Holds only the events that guarantee comparability across activities: the
 * lifecycle of an attempt, and the record of answers and tries. From these the
 * base metrics derive — time spent, correct answers, errors, attempts made —
 * and they can be computed the same way in any instrumented activity.
 *
 * This file is domain-independent: it contains nothing belonging to any
 * particular project and can be reused as-is. Events specific to a mechanic
 * live in eventSchema.<project>.js
 *
 * Include AFTER learningTracker.js and BEFORE the project catalogue.
 */
(function () {
    'use strict';

    var LT = window.LearningTracker;
    if (!LT) { return; }

    /* ── Lifecycle of an attempt ─────────────────────────────────────────── */

    /** The player starts the activity. */
    LT.gameStarted = function () {
        LT.event('game_started');
    };

    /**
     * The player wins, in an activity that can also be lost.
     * @param {number} startTime Date.now() when the attempt began
     * @param {Object} [extra]   activity-specific metadata
     */
    LT.gameWon = function (startTime, extra) {
        LT.event('game_finished_won', Object.assign(
            { duration_ms: startTime ? Date.now() - startTime : 0 },
            extra || {}
        ));
    };

    /**
     * The player reaches the end of an activity with no losing condition — a
     * quiz, a puzzle, an exploration. Reaching the end is completing it, not
     * winning it, and the distinction matters when computing success rates:
     * an activity that cannot be lost would otherwise report 0% success.
     *
     * @param {number} startTime Date.now() when the attempt began
     * @param {Object} [extra]   activity-specific metadata
     */
    LT.gameCompleted = function (startTime, extra) {
        LT.event('game_completed', Object.assign(
            { duration_ms: startTime ? Date.now() - startTime : 0 },
            extra || {}
        ));
    };

    /**
     * The player loses, or runs out of tries or time.
     * @param {number} startTime Date.now() when the attempt began
     * @param {Object} [extra]   activity-specific metadata
     */
    LT.gameLost = function (startTime, extra) {
        LT.event('game_finished_lost', Object.assign(
            { duration_ms: startTime ? Date.now() - startTime : 0 },
            extra || {}
        ));
    };

    /** The player chooses to play again, opening a new attempt. */
    LT.gameRestarted = function () {
        LT.event('game_restarted');
    };

    /**
     * The player leaves with an attempt in progress, through a control of the
     * activity or a navigation link. Closes the attempt.
     *
     * Distinct from silent abandonment — closing the tab — which leaves a
     * game_started with no terminal event. This one implies explicit intent,
     * and the two should not be counted together.
     *
     * @param {number} [startTime] Date.now() when the attempt began
     */
    LT.gameAbandoned = function (startTime) {
        LT.event('game_abandoned', startTime ? { duration_ms: Date.now() - startTime } : {});
    };

    /* ── Answers and tries ───────────────────────────────────────────────── */

    /**
     * The player gives an incorrect answer.
     * Accepts flexible metadata because the shape varies by activity
     * (e.g. { level, attempts } or { errors }).
     *
     * @param {Object} [meta] context of the error
     */
    LT.answerIncorrect = function (meta) {
        LT.event('answer_incorrect', meta || {});
    };

    /**
     * The player selects an answer in a quiz-type activity.
     *
     * Recording the answer chosen, not just whether it was right, is what
     * allows the analysis to move from "how many errors" to "in which
     * situations does this participant fail".
     *
     * @param {string}  selectedAnswer value of the option chosen
     * @param {boolean} isCorrect      whether it is pedagogically correct
     * @param {number}  responseTimeMs ms since the question appeared
     */
    LT.answerSelected = function (selectedAnswer, isCorrect, responseTimeMs) {
        LT.event('answer_selected', {
            selected_answer:  selectedAnswer,
            is_correct:       isCorrect,
            response_time_ms: responseTimeMs
        });
    };

}());
