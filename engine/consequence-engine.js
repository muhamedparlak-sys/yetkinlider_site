/**
 * engine/consequence-engine.js
 * Handles random events and triggered consequences during each week.
 *
 * A week's "events" array in the scenario JSON looks like:
 *   [
 *     {
 *       "id": "evt-001",
 *       "title": "Key Developer Sick",
 *       "description": "Your lead dev called in sick for the whole week.",
 *       "probability": 0.3,        // 0-1 roll chance
 *       "condition": null,         // optional: "cpi < 0.9" | "teamMorale < 50" etc.
 *       "effects": {
 *         "ev": -5000,
 *         "teamMorale": -10
 *       },
 *       "notification": "warning"  // 'info' | 'warning' | 'danger'
 *     }
 *   ]
 *
 * Events can be:
 *   - Random (rolled each week based on probability)
 *   - Conditional (triggered only if a state condition is true)
 *   - Forced (probability: 1)
 *
 * "condition" is a simple expression string evaluated against the current state.
 * Supported operators: <  >  <=  >=  ==  !=
 * Supported fields: cpi, spi, teamMorale, stakeholderSatisfaction,
 *                   scopeCreep, qualityDebt, week, budget, ev, pv, ac
 */
const ConsequenceEngine = (() => {

  // ─── Condition parser ────────────────────────────────────────────────────

  /** Parsed condition tokens */
  const CONDITION_PATTERN = /^(\w+)\s*(<=|>=|==|!=|<|>)\s*([\d.]+)$/;

  /**
   * Evaluate a simple condition string against computed metrics + state.
   * @param {string} condition — e.g. "cpi < 0.9"
   * @param {Object} ctx       — { cpi, spi, teamMorale, ... }
   * @returns {boolean}
   */
  function _evalCondition(condition, ctx) {
    if (!condition) return true; // no condition = always eligible

    const m = condition.trim().match(CONDITION_PATTERN);
    if (!m) {
      console.warn(`[ConsequenceEngine] Cannot parse condition: "${condition}"`);
      return false;
    }

    const [, field, op, rawVal] = m;
    const stateVal = ctx[field];
    const threshold = parseFloat(rawVal);

    if (stateVal === undefined) {
      console.warn(`[ConsequenceEngine] Unknown field in condition: "${field}"`);
      return false;
    }

    switch (op) {
      case '<':  return stateVal <  threshold;
      case '>':  return stateVal >  threshold;
      case '<=': return stateVal <= threshold;
      case '>=': return stateVal >= threshold;
      case '==': return stateVal === threshold;
      case '!=': return stateVal !== threshold;
      default:   return false;
    }
  }

  /**
   * Build a context object for condition evaluation.
   * Merges raw state with computed metrics (CPI, SPI).
   * @param {Object} state — Store.getState()
   * @returns {Object}
   */
  function _buildContext(state) {
    const m = MetricsEngine.compute(state);
    return {
      ...state,
      cpi: m.cpi,
      spi: m.spi,
    };
  }

  // ─── Effect application ─────────────────────────────────────────────────

  /**
   * Apply an event's effects to the Store (same shape as decision effects).
   * @param {Object} effects
   * @param {Object} state — current Store.getState()
   */
  function _applyEffects(effects, state) {
    if (!effects) return;

    // Reuse DecisionResolver's resolution logic
    const fakeOption = { effects, id: '_event_', text: '' };
    const resolved   = DecisionResolver.resolve(fakeOption, state);
    DecisionResolver.apply(resolved);
  }

  // ─── Public API ─────────────────────────────────────────────────────────

  return {

    /**
     * Process all events defined for a given week.
     * Each event is rolled / condition-checked, and triggered events
     * are applied to the Store.
     *
     * Returns an array of triggered event objects (may be empty).
     *
     * @param {Object[]} events  — from weekData.events
     * @param {Object}   state   — Store.getState() BEFORE effects
     * @returns {Object[]} — triggered events
     */
    processWeekEvents(events, state) {
      if (!events || events.length === 0) return [];

      const ctx = _buildContext(state);
      const triggered = [];

      for (const evt of events) {
        // 1. Check condition (always evaluated first)
        if (!_evalCondition(evt.condition || null, ctx)) continue;

        // 2. Probability roll
        const probability = typeof evt.probability === 'number' ? evt.probability : 0;
        if (!Utils.chance(probability)) continue;

        // 3. Event fires — apply effects and record
        _applyEffects(evt.effects || {}, state);
        triggered.push(evt);

        // Log to Store
        Store.push('eventLog', {
          week:        state.week,
          eventId:     evt.id,
          title:       evt.title,
          description: evt.description,
          effects:     evt.effects || {},
          timestamp:   Date.now(),
        });

        console.log(`[ConsequenceEngine] Event triggered: "${evt.title}" (week ${state.week})`);
      }

      return triggered;
    },

    /**
     * Process risk escalation each week.
     * Each active risk has a probability of escalating into an event.
     *
     * @param {Object} state — Store.getState()
     * @returns {Object[]} — escalated risk events
     */
    processRiskEscalation(state) {
      const risks = state.activeRisks || [];
      const escalated = [];
      const currentWeek = state.week || 0;

      // Don't process risk escalation in the first 3 weeks —
      // let the player establish baseline metrics first.
      if (currentWeek <= 3) return [];

      for (const risk of risks) {
        // Softer roll: probability × 0.2 so risks don't fire constantly
        const rollChance = (risk.probability || 0.1) * 0.2;
        if (!Utils.chance(rollChance)) continue;

        // Risk escalates into a consequence — scale down impact for playability
        const impact = risk.impact || 5;
        const isNeg  = risk.type !== 'opportunity';

        const effects = isNeg
          ? { ev: -(impact * 300), ac: impact * 150, teamMorale: -Math.round(impact * 0.4) }
          : { ev:  impact * 300,                     teamMorale:  Math.round(impact * 0.4) };

        _applyEffects(effects, state);

        const evt = {
          week:        state.week,
          eventId:     `risk-escalation-${risk.id}`,
          title:       `Risk Escalated: ${risk.title}`,
          description: isNeg
            ? `The risk "${risk.title}" has materialised, impacting the project.`
            : `The opportunity "${risk.title}" has been realised, benefiting the project.`,
          effects,
          timestamp: Date.now(),
        };

        Store.push('eventLog', evt);
        escalated.push(evt);
      }

      return escalated;
    },

    /**
     * Build a combined consequence result object for the UI.
     * Called after decisions + events are all processed for the week.
     *
     * @param {Object} decisionFeedback  — from DecisionResolver.buildFeedback()
     * @param {Object[]} triggeredEvents — from processWeekEvents()
     * @param {Object[]} escalatedRisks  — from processRiskEscalation()
     * @param {Object} metricsAfter      — MetricsEngine.compute(Store.getState())
     * @returns {Object}
     */
    buildConsequenceResult(decisionFeedback, triggeredEvents, escalatedRisks, metricsAfter) {
      const events = [...triggeredEvents, ...escalatedRisks];

      return {
        decision:  decisionFeedback,
        events,
        hasEvents: events.length > 0,
        metrics:   metricsAfter,
        warnings:  MetricsEngine.warnings(Store.getState()),
      };
    },

    /**
     * Evaluate a condition string against the current Store state.
     * Useful for scenario scripting / debugging.
     * @param {string} condition
     * @returns {boolean}
     */
    evalCondition(condition) {
      return _evalCondition(condition, _buildContext(Store.getState()));
    },

  };

})();
