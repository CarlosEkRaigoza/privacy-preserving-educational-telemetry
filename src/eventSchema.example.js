/**
 * eventSchema.example.js — project-specific event catalogue (template).
 *
 * This is the ONLY file you rewrite when porting the layer to another project.
 * learningTracker.js and eventSchema.core.js travel unchanged.
 *
 * The core catalogue holds what is comparable across every activity: the
 * lifecycle of an attempt and the record of answers. This file holds what is
 * specific to one mechanic and therefore NOT comparable between activities —
 * a word found in a word search means nothing in a memory game.
 *
 * The helpers below are representative examples drawn from a deployed
 * instrumentation of fourteen activities. Replace them with your own.
 *
 * Include AFTER eventSchema.core.js
 */
(function () {
    'use strict';

    var LT = window.LearningTracker;
    if (!LT) { return; }

    /* ── Progression within an attempt ───────────────────────────────────── */

    /**
     * The player completes one discrete level of a multi-level activity.
     * Note that the attempt is the whole activity, not the level: completing a
     * level is progression, not a terminal event.
     *
     * @param {number|string} level          level identifier
     * @param {number}        difficulty     mechanic-specific difficulty value
     * @param {number}        levelStartTime Date.now() when the level began
     * @param {number}        attempts       tries used to complete it
     */
    LT.levelCompleted = function (level, difficulty, levelStartTime, attempts) {
        LT.event('level_completed', {
            level:       level,
            difficulty:  difficulty,
            duration_ms: levelStartTime ? Date.now() - levelStartTime : 0,
            attempts:    attempts
        });
    };

    /**
     * The player restarts the current level without ending the attempt.
     * Distinct from game_restarted, which opens a new attempt.
     *
     * @param {number|string} level      level identifier
     * @param {number}        difficulty mechanic-specific difficulty value
     */
    LT.levelRestarted = function (level, difficulty) {
        LT.event('level_restarted', { level: level, difficulty: difficulty });
    };

    /* ── Assisted progression ────────────────────────────────────────────── */

    /**
     * The activity reveals a hint after a period without progress. Emitted by
     * the activity, not by the player: it measures where help was needed.
     *
     * @param {number|string} stepId step or item the hint applied to
     */
    LT.hintUsed = function (stepId) {
        LT.event('hint_used', { step_id: stepId });
    };

    /**
     * The player switches to a simplified variant of the activity.
     * The state at the moment of the switch is what carries meaning.
     *
     * @param {number} completedBefore items completed before switching
     * @param {Object} [extra]         mechanic-specific context
     */
    LT.easyModeSelected = function (completedBefore, extra) {
        LT.event('easy_mode_selected', Object.assign(
            { completed_before_switch: completedBefore },
            extra || {}
        ));
    };

    /* ── Placement and exploration ───────────────────────────────────────── */

    /**
     * The player places an element in its correct location.
     * @param {string} targetId  location identifier
     * @param {string} elementId element placed
     */
    LT.itemPlacedCorrect = function (targetId, elementId) {
        LT.event('item_placed_correct', { target_id: targetId, element_id: elementId });
    };

    /**
     * The player places an element in the wrong location. Recording WHICH wrong
     * location was chosen is what turns an error count into a diagnosis.
     *
     * @param {string} targetId  location chosen
     * @param {string} elementId element placed
     */
    LT.itemPlacedIncorrect = function (targetId, elementId) {
        LT.event('item_placed_incorrect', { target_id: targetId, element_id: elementId });
    };

    /**
     * The player enters a section of an exploratory activity.
     * @param {string} sectionId section identifier
     */
    LT.sectionVisited = function (sectionId) {
        LT.event('section_visited', { section_id: sectionId });
    };

    /**
     * The player collects or selects an element of the activity.
     * @param {string} itemId  element identifier
     * @param {number} [score] accumulated score, if the mechanic keeps one
     */
    LT.itemCollected = function (itemId, score) {
        var meta = { item_id: itemId };
        if (score !== undefined) { meta.score = score; }
        LT.event('item_collected', meta);
    };

}());
