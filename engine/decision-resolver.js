/**
 * engine/decision-resolver.js
 * Applies a player's chosen option to the game state.
 *
 * A decision option's "effects" object may contain:
 *   ev:                    number  (Earned Value delta in $)
 *   ac:                    number  (Actual Cost delta in $)
 *   pv:                    number  (Planned Value delta — rare, for scope changes)
 *   stakeholderSatisfaction: number (delta, clamped to 0-100)
 *   teamMorale:            number  (delta, clamped to 0-100)
 *   scopeCreep:            number  (delta %, clamped to 0-100)
 *   qualityDebt:           number  (delta %, clamped to 0-100)
 *   addRisk:               Object  ({ id, title, probability, impact, type }) — adds an active risk
 *   removeRisk:            string  (risk id to remove from activeRisks)
 *
 * Numeric deltas are additive. All metrics are clamped after application.
 */
const DecisionResolver = (() => {

  // ─── Clamp limits for each metric ──────────────────────────────────────

  const CLAMPS = {
    stakeholderSatisfaction: [0, 100],
    teamMorale:              [0, 100],
    scopeCreep:              [0, 100],
    qualityDebt:             [0, 100],
    ev:                      [0, Infinity],
    ac:                      [0, Infinity],
    pv:                      [0, Infinity],
  };

  /** Apply one numeric delta to the state, respecting clamp limits */
  function _applyDelta(state, key, delta) {
    const current = state[key] || 0;
    const [min, max] = CLAMPS[key] || [-Infinity, Infinity];
    return Utils.clamp(current + delta, min, max);
  }

  // ─── Public API ─────────────────────────────────────────────────────────

  return {

    /**
     * Resolve an option's effects into a concrete state delta object.
     * Does NOT mutate anything — returns { updates: {}, log: {} }.
     *
     * @param {Object} option     — the chosen option from the scenario JSON
     * @param {Object} state      — current Store.getState()
     * @returns {{ updates: Object, risksToAdd: Object[], risksToRemove: string[] }}
     */
    resolve(option, state) {
      const effects  = option.effects || {};
      const updates  = {};
      const risksToAdd    = [];
      const risksToRemove = [];

      // Numeric deltas
      const numericKeys = ['ev', 'ac', 'pv', 'stakeholderSatisfaction', 'teamMorale', 'scopeCreep', 'qualityDebt'];
      for (const key of numericKeys) {
        if (effects[key] !== undefined) {
          updates[key] = _applyDelta(state, key, effects[key]);
        }
      }

      // Risk mutations
      if (effects.addRisk) {
        risksToAdd.push({ ...effects.addRisk, id: effects.addRisk.id || Utils.uid() });
      }
      if (effects.removeRisk) {
        risksToRemove.push(effects.removeRisk);
      }

      return { updates, risksToAdd, risksToRemove };
    },

    /**
     * Apply a resolved delta to the Store.
     * Also handles risk list mutations.
     *
     * @param {{ updates: Object, risksToAdd: Object[], risksToRemove: string[] }} resolved
     */
    apply(resolved) {
      const { updates, risksToAdd, risksToRemove } = resolved;

      // Apply scalar updates
      Store.set(updates);

      // Manage active risks
      if (risksToAdd.length || risksToRemove.length) {
        let risks = Store.get('activeRisks') || [];

        // Remove first to avoid duplicates
        if (risksToRemove.length) {
          risks = risks.filter(r => !risksToRemove.includes(r.id));
        }

        // Add new risks (avoid duplicate IDs)
        for (const risk of risksToAdd) {
          if (!risks.find(r => r.id === risk.id)) {
            risks.push(risk);
          }
        }

        Store.patch('activeRisks', risks);
      }
    },

    /**
     * Full resolve + apply pipeline. Returns the resolved delta for display.
     *
     * @param {Object} option
     * @param {Object} state
     * @returns {{ updates: Object, risksToAdd: Object[], risksToRemove: string[] }}
     */
    execute(option, state) {
      const resolved = this.resolve(option, state);
      this.apply(resolved);
      return resolved;
    },

    /**
     * Build a human-readable feedback object from an option.
     * @param {Object} option
     * @param {{ updates: Object }} resolved
     * @returns {{ text: string, concept: string, effectSummary: string[] }}
     */
    buildFeedback(option, resolved) {
      const lines = [];
      const eff = option.effects || {};

      // EVM effects
      if (eff.ev !== undefined) {
        const label = eff.ev >= 0 ? `+${Utils.formatCurrency(eff.ev)}` : Utils.formatCurrency(eff.ev);
        lines.push(`📊 Earned Value ${label}`);
      }
      if (eff.ac !== undefined) {
        const label = eff.ac >= 0 ? `+${Utils.formatCurrency(eff.ac)}` : Utils.formatCurrency(eff.ac);
        lines.push(`💰 Actual Cost ${label}`);
      }

      // Soft metrics
      if (eff.stakeholderSatisfaction !== undefined) {
        const sign = eff.stakeholderSatisfaction >= 0 ? '+' : '';
        lines.push(`🤝 Stakeholder Satisfaction ${sign}${eff.stakeholderSatisfaction}%`);
      }
      if (eff.teamMorale !== undefined) {
        const sign = eff.teamMorale >= 0 ? '+' : '';
        lines.push(`💪 Team Morale ${sign}${eff.teamMorale}%`);
      }
      if (eff.scopeCreep !== undefined && eff.scopeCreep !== 0) {
        const sign = eff.scopeCreep >= 0 ? '+' : '';
        lines.push(`📋 Scope Creep ${sign}${eff.scopeCreep}%`);
      }
      if (eff.qualityDebt !== undefined && eff.qualityDebt !== 0) {
        const sign = eff.qualityDebt >= 0 ? '+' : '';
        lines.push(`🔧 Quality Debt ${sign}${eff.qualityDebt}%`);
      }

      // Risks
      if (eff.addRisk) {
        lines.push(`⚠️ New risk added: "${eff.addRisk.title}"`);
      }
      if (eff.removeRisk) {
        lines.push(`✅ Risk resolved: "${eff.removeRisk}"`);
      }

      return {
        text:          option.feedback || 'Decision applied.',
        concept:       option.pmpConcept || '',
        effectSummary: lines,
      };
    },

    /**
     * Record a decision to the Store's decisionLog.
     * @param {number} week
     * @param {string} decisionId
     * @param {Object} option
     * @param {Object} resolved
     */
    record(week, decisionId, option, resolved) {
      Store.push('decisionLog', {
        week,
        decisionId,
        optionId:  option.id,
        label:     option.text,
        effects:   resolved.updates,
        timestamp: Date.now(),
      });
    },

  };

})();
