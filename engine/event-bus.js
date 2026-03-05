/**
 * engine/event-bus.js
 * Lightweight pub/sub event bus — decouples engine modules from each other.
 *
 * Usage:
 *   EventBus.on('week:start', data => console.log(data));
 *   EventBus.emit('week:start', { week: 3 });
 *   EventBus.off('week:start', handler);
 *   EventBus.once('game:over', handler); // fires once then auto-removes
 */
const EventBus = {

  /** @type {Object.<string, Function[]>} */
  _listeners: Object.create(null),

  /**
   * Subscribe to an event.
   * @param {string} event
   * @param {Function} fn  — called with (data) when event fires
   * @returns {Function} — the fn, for easy .off() chaining
   */
  on(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = [];
    if (!this._listeners[event].includes(fn)) {
      this._listeners[event].push(fn);
    }
    return fn;
  },

  /**
   * Unsubscribe a specific handler.
   * @param {string} event
   * @param {Function} fn
   */
  off(event, fn) {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter(f => f !== fn);
  },

  /**
   * Subscribe to an event exactly once.
   * The handler is automatically removed after the first call.
   * @param {string} event
   * @param {Function} fn
   */
  once(event, fn) {
    const wrapper = (data) => {
      fn(data);
      this.off(event, wrapper);
    };
    // Store reference to original so callers can still .off(event, fn)
    wrapper._original = fn;
    this.on(event, wrapper);
  },

  /**
   * Emit an event, synchronously calling all registered handlers.
   * Errors in individual handlers are caught and logged so one bad
   * subscriber does not break the others.
   * @param {string} event
   * @param {*} data
   */
  emit(event, data) {
    const handlers = this._listeners[event];
    if (!handlers || handlers.length === 0) return;
    // Iterate over a shallow copy so handlers added during emit don't fire immediately
    for (const fn of [...handlers]) {
      try {
        fn(data);
      } catch (err) {
        console.error(`[EventBus] Error in handler for "${event}":`, err);
      }
    }
  },

  /**
   * Remove ALL listeners for a given event, or ALL listeners if no event given.
   * @param {string} [event]
   */
  clear(event) {
    if (event) {
      delete this._listeners[event];
    } else {
      this._listeners = Object.create(null);
    }
  },

  /**
   * Debug helper — log all currently registered event names.
   */
  debug() {
    console.table(
      Object.fromEntries(
        Object.entries(this._listeners).map(([k, v]) => [k, v.length])
      )
    );
  },

};

/**
 * Canonical event names used throughout the engine.
 * Import this object and use EVENT.xxx to avoid magic strings.
 */
const EVENT = Object.freeze({
  // State machine
  STATE_CHANGE:       'state:change',

  // Scenario lifecycle
  SCENARIO_LOADED:    'scenario:loaded',
  SCENARIO_STARTED:   'scenario:started',

  // Week flow
  WEEK_START:         'week:start',
  WEEK_DECISION:      'week:decision',
  WEEK_CONSEQUENCE:   'week:consequence',
  WEEK_END:           'week:end',

  // Metrics
  METRICS_UPDATED:    'metrics:updated',

  // Player actions
  DECISION_MADE:      'decision:made',

  // Notifications
  NOTIFY:             'notify',

  // Game over / debrief
  GAME_OVER:          'game:over',
  DEBRIEF:            'game:debrief',

  // UI
  UI_RENDER:          'ui:render',
});
