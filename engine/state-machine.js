/**
 * engine/state-machine.js
 * Finite state machine for the game loop.
 *
 * States and legal transitions:
 *
 *   LOBBY ──► SCENARIO_INTRO ──► WEEK_START ──► DECISION_PHASE
 *                                     ▲               │
 *                                     │          CONSEQUENCE_PHASE
 *                                     │          /           \
 *                                  WEEK_END ◄──'             GAME_OVER
 *                                     │                          │
 *                                  DEBRIEF ◄────────────────────'
 *                                     │
 *                                   LOBBY
 */

/** Enum of all valid state ids */
const STATES = Object.freeze({
  LOBBY:             'LOBBY',
  SCENARIO_INTRO:    'SCENARIO_INTRO',
  WEEK_START:        'WEEK_START',
  DECISION_PHASE:    'DECISION_PHASE',
  CONSEQUENCE_PHASE: 'CONSEQUENCE_PHASE',
  WEEK_END:          'WEEK_END',
  GAME_OVER:         'GAME_OVER',
  DEBRIEF:           'DEBRIEF',
});

/**
 * Legal transitions map.
 * Key → array of states it can move TO.
 */
const TRANSITIONS = Object.freeze({
  [STATES.LOBBY]:             [STATES.SCENARIO_INTRO],
  [STATES.SCENARIO_INTRO]:    [STATES.WEEK_START],
  [STATES.WEEK_START]:        [STATES.DECISION_PHASE],
  [STATES.DECISION_PHASE]:    [STATES.CONSEQUENCE_PHASE, STATES.GAME_OVER],
  [STATES.CONSEQUENCE_PHASE]: [STATES.WEEK_END, STATES.GAME_OVER],
  [STATES.WEEK_END]:          [STATES.WEEK_START, STATES.GAME_OVER, STATES.DEBRIEF],
  [STATES.GAME_OVER]:         [STATES.DEBRIEF],
  [STATES.DEBRIEF]:           [STATES.LOBBY],
});

const StateMachine = (() => {

  let _current = STATES.LOBBY;
  const _listeners = [];   // (from, to) => void

  return {

    /** Current state id */
    get current() { return _current; },

    /**
     * Check whether transitioning to `next` is legal from the current state.
     * @param {string} next
     * @returns {boolean}
     */
    can(next) {
      const allowed = TRANSITIONS[_current];
      return allowed ? allowed.includes(next) : false;
    },

    /**
     * Transition to `next`. Throws if the transition is not in the legal set.
     * Updates the Store and emits STATE_CHANGE via EventBus.
     * @param {string} next  — one of the STATES constants
     * @throws {Error} if the transition is illegal
     */
    transition(next) {
      if (!STATES[next]) {
        throw new Error(`[StateMachine] Unknown state: "${next}"`);
      }
      if (!this.can(next)) {
        throw new Error(
          `[StateMachine] Illegal transition: ${_current} → ${next}. ` +
          `Allowed: [${(TRANSITIONS[_current] || []).join(', ')}]`
        );
      }

      const from = _current;
      _current = next;

      console.log(`[StateMachine] ${from} → ${next}`);

      // Update Store
      if (typeof Store !== 'undefined') {
        Store.patch('screen', next);
      }

      // Notify local listeners
      for (const fn of [..._listeners]) {
        try { fn(from, next); }
        catch (e) { console.error('[StateMachine] listener error:', e); }
      }

      // Emit global event
      if (typeof EventBus !== 'undefined') {
        EventBus.emit(EVENT ? EVENT.STATE_CHANGE : 'state:change', { from, to: next });
      }
    },

    /**
     * Force-set state without validation.
     * Use ONLY when loading a saved game or for testing.
     * @param {string} state
     */
    force(state) {
      const prev = _current;
      _current = state;
      if (typeof Store !== 'undefined') Store.patch('screen', state);
      if (typeof EventBus !== 'undefined') {
        EventBus.emit(EVENT ? EVENT.STATE_CHANGE : 'state:change', { from: prev, to: state });
      }
    },

    /**
     * Register a listener called on every transition.
     * @param {Function} fn  — (from: string, to: string) => void
     * @returns {Function} — call to unsubscribe
     */
    onTransition(fn) {
      _listeners.push(fn);
      return () => {
        const i = _listeners.indexOf(fn);
        if (i !== -1) _listeners.splice(i, 1);
      };
    },

    /** Reset to LOBBY (used when returning to main menu) */
    reset() {
      _current = STATES.LOBBY;
      if (typeof Store !== 'undefined') Store.patch('screen', STATES.LOBBY);
    },

    /** Human-readable description of legal transitions from current state */
    describe() {
      return `Current: ${_current} → can go to: [${(TRANSITIONS[_current] || []).join(', ')}]`;
    },

  };

})();
