/**
 * engine/store.js
 * Central reactive state store.
 *
 * Single source of truth for all game state.
 * Subscribers are called synchronously whenever state changes.
 *
 * Usage:
 *   Store.init({ week: 1, budget: 500000 });
 *   Store.patch('week', 2);
 *   Store.set({ week: 3, ac: 50000 });
 *   const week = Store.get('week');
 *   Store.subscribe(newState => console.log(newState));
 */
const Store = (() => {

  /** @type {Object} — current live state */
  let _state = {};

  /** @type {Function[]} — subscriber callbacks */
  const _subscribers = [];

  /**
   * DEFAULT initial state shape.
   * Engine.init() calls Store.init() to reset to this.
   */
  const DEFAULT_STATE = {
    // ── Lifecycle ────────────────────────────────────────────
    screen: 'LOBBY',            // current StateMachine state id
    scenarioId: null,           // e.g. 'scenario-001'
    scenarioData: null,         // full loaded scenario JSON

    // ── Progress ─────────────────────────────────────────────
    week: 0,                    // current week (1-indexed during play)
    totalWeeks: 0,
    weekData: null,             // current week's scenario data slice

    // ── EVM Metrics ──────────────────────────────────────────
    budget: 0,                  // BAC (Budget at Completion)
    ev: 0,                      // Earned Value  (cumulative)
    pv: 0,                      // Planned Value (cumulative)
    ac: 0,                      // Actual Cost   (cumulative)

    // ── Soft Metrics (0-100) ─────────────────────────────────
    stakeholderSatisfaction: 75,
    teamMorale: 80,
    scopeCreep: 0,              // % scope added beyond baseline (0 = clean)
    qualityDebt: 0,             // technical / quality debt accumulation

    // ── Active Risks ─────────────────────────────────────────
    activeRisks: [],            // [{ id, title, probability, impact, type }]

    // ── History (for debrief / analytics) ───────────────────
    decisionLog: [],            // [{ week, decisionId, optionId, label, effects }]
    eventLog: [],               // [{ week, eventId, title, effects }]
    weekSnapshots: [],          // [{ week, ev, pv, ac, cpi, spi, morale, satisfaction }]

    // ── Pending UI data ──────────────────────────────────────
    lastDecisionFeedback: null, // { text, concept, effects }
    lastEventResult: null,      // { title, description, effects } | null

    // ── Game result ──────────────────────────────────────────
    gameOver: false,
    gameOverReason: null,
    finalScore: null,           // 0-100
    passed: null,               // boolean
  };

  // ─── Private helpers ───────────────────────────────────────

  function _notify(prev) {
    const snap = _snapshot();
    for (const fn of [..._subscribers]) {
      try { fn(snap, prev); }
      catch (e) { console.error('[Store] subscriber error:', e); }
    }
    // Also emit via EventBus if available
    if (typeof EventBus !== 'undefined') {
      EventBus.emit(EVENT ? EVENT.METRICS_UPDATED : 'metrics:updated', snap);
    }
  }

  function _snapshot() {
    return Utils ? Utils.clone(_state) : JSON.parse(JSON.stringify(_state));
  }

  // ─── Public API ───────────────────────────────────────────

  return {

    /**
     * Initialise (or reset) the store with a fresh state.
     * Pass partial overrides — missing keys fall back to DEFAULT_STATE.
     * @param {Object} [overrides]
     */
    init(overrides = {}) {
      const base = Utils ? Utils.clone(DEFAULT_STATE) : JSON.parse(JSON.stringify(DEFAULT_STATE));
      _state = Object.assign(base, overrides);
      _notify(null);
    },

    /**
     * Get a top-level key value (no dot-notation support intentionally —
     * keeps things simple; use getState() for nested reads).
     * @param {string} key
     * @returns {*}
     */
    get(key) {
      const val = _state[key];
      // Return primitives as-is; objects as clones to prevent mutation
      if (val !== null && typeof val === 'object') {
        return Utils ? Utils.clone(val) : JSON.parse(JSON.stringify(val));
      }
      return val;
    },

    /**
     * Batch-update multiple keys. Merges with current state.
     * Triggers subscribers once per call.
     * @param {Object} updates — plain object of key/value pairs
     */
    set(updates) {
      const prev = _snapshot();
      Object.assign(_state, updates);
      _notify(prev);
    },

    /**
     * Update a single key. Convenience wrapper around set().
     * @param {string} key
     * @param {*} value
     */
    patch(key, value) {
      this.set({ [key]: value });
    },

    /**
     * Increment a numeric key by `delta` (default 1).
     * Also supports negative delta for decrement.
     * Clamps to [min, max] if provided.
     * @param {string} key
     * @param {number} delta
     * @param {{ min?: number, max?: number }} [opts]
     */
    increment(key, delta = 1, opts = {}) {
      let val = (_state[key] || 0) + delta;
      if (opts.min !== undefined || opts.max !== undefined) {
        val = Math.min(
          Math.max(val, opts.min !== undefined ? opts.min : -Infinity),
          opts.max !== undefined ? opts.max : Infinity
        );
      }
      this.set({ [key]: val });
    },

    /**
     * Push a value onto an array key.
     * Creates the array if it doesn't exist.
     * @param {string} key
     * @param {*} value
     */
    push(key, value) {
      const arr = Array.isArray(_state[key]) ? [..._state[key]] : [];
      arr.push(value);
      this.set({ [key]: arr });
    },

    /**
     * Return a full deep-clone of the current state.
     * @returns {Object}
     */
    getState() {
      return _snapshot();
    },

    /**
     * Register a subscriber function.
     * Called with (newState, prevState) on every state change.
     * @param {Function} fn
     * @returns {Function} — unsubscribe function
     */
    subscribe(fn) {
      _subscribers.push(fn);
      return () => this.unsubscribe(fn);
    },

    /**
     * Remove a subscriber.
     * @param {Function} fn
     */
    unsubscribe(fn) {
      const idx = _subscribers.indexOf(fn);
      if (idx !== -1) _subscribers.splice(idx, 1);
    },

    /**
     * Persist current state to localStorage.
     * @param {string} [key]
     */
    save(key = 'pmp_game_state') {
      try {
        localStorage.setItem(key, JSON.stringify(_state));
      } catch (e) {
        console.warn('[Store] save failed:', e);
      }
    },

    /**
     * Restore state from localStorage and notify subscribers.
     * @param {string} [key]
     * @returns {boolean} — true if data was found and loaded
     */
    load(key = 'pmp_game_state') {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return false;
        const prev = _snapshot();
        _state = Object.assign(JSON.parse(JSON.stringify(DEFAULT_STATE)), JSON.parse(raw));
        _notify(prev);
        return true;
      } catch (e) {
        console.warn('[Store] load failed:', e);
        return false;
      }
    },

    /** Clear saved game from localStorage */
    clearSave(key = 'pmp_game_state') {
      localStorage.removeItem(key);
    },

    /**
     * Reset to defaults without persisting.
     * Useful when returning to lobby.
     */
    reset() {
      this.init();
    },

    /** Debug: log current state to console */
    debug() {
      console.log('[Store]', _snapshot());
    },
  };

})();
