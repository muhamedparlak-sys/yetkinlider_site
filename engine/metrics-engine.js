/**
 * engine/metrics-engine.js
 * EVM (Earned Value Management) calculations + soft metric helpers.
 *
 * All functions are pure — they take values and return values.
 * The Store interaction happens in Engine.js via MetricsEngine.snapshot().
 *
 * Key EVM formula reference:
 *   EV  = Earned Value       (work actually done, in $)
 *   PV  = Planned Value      (work planned by now, in $)
 *   AC  = Actual Cost        (money actually spent)
 *   BAC = Budget at Completion
 *
 *   CPI = EV / AC            (> 1 = under budget)
 *   SPI = EV / PV            (> 1 = ahead of schedule)
 *   CV  = EV − AC            (positive = under budget)
 *   SV  = EV − PV            (positive = ahead)
 *   EAC = BAC / CPI          (forecast final cost)
 *   ETC = EAC − AC           (remaining cost estimate)
 *   VAC = BAC − EAC          (variance at completion)
 *   TCPI= (BAC − EV) / (BAC − AC)  (efficiency needed to finish on budget)
 */

const MetricsEngine = (() => {

  // ─── EVM Core Formulas ─────────────────────────────────────────────────

  function cpi(ev, ac)          { return ac  > 0 ? ev / ac  : 1; }
  function spi(ev, pv)          { return pv  > 0 ? ev / pv  : 1; }
  function cv(ev, ac)           { return ev - ac; }
  function sv(ev, pv)           { return ev - pv; }
  function eac_cpi(bac, cpiVal) { return cpiVal > 0 ? bac / cpiVal : bac; }
  function eac_remaining(ac, bac, ev) { return ac + (bac - ev); }
  function etc(eacVal, ac)      { return eacVal - ac; }
  function vac(bac, eacVal)     { return bac - eacVal; }
  function tcpi(bac, ev, eacVal, ac) {
    const denom = eacVal - ac;
    return denom !== 0 ? (bac - ev) / denom : 1;
  }
  function pctComplete(ev, bac) { return bac > 0 ? (ev / bac) * 100 : 0; }
  function pctSpent(ac, bac)    { return bac > 0 ? (ac / bac) * 100 : 0; }

  // ─── Fail-condition thresholds ─────────────────────────────────────────

  const FAIL_THRESHOLDS = {
    cpi:                   { hard: 0.5,  soft: 0.75 },
    spi:                   { hard: 0.5,  soft: 0.75 },
    stakeholderSatisfaction: { hard: 15, soft: 35   },
    teamMorale:            { hard: 10,   soft: 30   },
    scopeCreep:            { hard: 60,   soft: 40   }, // % over original scope
  };

  // ─── Score weights for debrief ─────────────────────────────────────────

  const SCORE_WEIGHTS = {
    cpi:                     30,
    spi:                     25,
    stakeholderSatisfaction: 25,
    teamMorale:              20,
  };

  // ─── Helpers ───────────────────────────────────────────────────────────

  /** Map a 0-100 morale / satisfaction value to a 0-1 score contribution */
  function _softScore(val, max = 100) {
    return Utils.clamp(val / max, 0, 1);
  }

  /** Map a CPI/SPI ratio to a 0-1 score contribution, capped at 1.2 */
  function _evmScore(ratio) {
    if (ratio >= 1.0) return 1;
    if (ratio >= 0.9) return Utils.lerp(0.7, 1.0, (ratio - 0.9) / 0.1);
    if (ratio >= 0.8) return Utils.lerp(0.4, 0.7, (ratio - 0.8) / 0.1);
    if (ratio >= 0.7) return Utils.lerp(0.2, 0.4, (ratio - 0.7) / 0.1);
    return Utils.lerp(0, 0.2, ratio / 0.7);
  }

  // ─── Public API ────────────────────────────────────────────────────────

  return {

    // Re-export pure formulas for external use
    cpi, spi, cv, sv, eac_cpi, eac_remaining, etc, vac, tcpi, pctComplete, pctSpent,

    FAIL_THRESHOLDS,

    /**
     * Compute a full metrics snapshot from raw store values.
     * @param {Object} s — Store.getState()
     * @returns {Object} — all computed metrics, ready for UI rendering
     */
    compute(s) {
      const bac    = s.budget;
      const evVal  = s.ev;
      const pvVal  = s.pv;
      const acVal  = s.ac;

      const cpiVal = cpi(evVal, acVal);
      const spiVal = spi(evVal, pvVal);
      const cvVal  = cv(evVal, acVal);
      const svVal  = sv(evVal, pvVal);
      const eacVal = eac_cpi(bac, cpiVal);
      const etcVal = etc(eacVal, acVal);
      const vacVal = vac(bac, eacVal);
      const tcpiVal= tcpi(bac, evVal, eacVal, acVal);
      const pctDone = pctComplete(evVal, bac);
      const pctPaid = pctSpent(acVal, bac);

      return {
        bac, ev: evVal, pv: pvVal, ac: acVal,
        cpi: cpiVal, spi: spiVal,
        cv: cvVal, sv: svVal,
        eac: eacVal, etc: etcVal, vac: vacVal, tcpi: tcpiVal,
        pctComplete: pctDone,
        pctSpent: pctPaid,
        stakeholderSatisfaction: s.stakeholderSatisfaction,
        teamMorale: s.teamMorale,
        scopeCreep: s.scopeCreep,
        qualityDebt: s.qualityDebt,
      };
    },

    /**
     * Check whether any hard fail conditions are met.
     * Returns the FIRST failure found, or null.
     *
     * @param {Object} s — Store.getState() or metrics object
     * @returns {{ reason: string, metric: string } | null}
     */
    checkFail(s) {
      const m = this.compute(s);

      if (m.cpi < FAIL_THRESHOLDS.cpi.hard) {
        return {
          metric: 'CPI',
          reason: `Project budget is severely overrun (CPI = ${m.cpi.toFixed(2)}). The project has been cancelled.`,
        };
      }
      if (m.spi < FAIL_THRESHOLDS.spi.hard) {
        return {
          metric: 'SPI',
          reason: `Project schedule has collapsed (SPI = ${m.spi.toFixed(2)}). The sponsor has pulled the plug.`,
        };
      }
      if (m.stakeholderSatisfaction < FAIL_THRESHOLDS.stakeholderSatisfaction.hard) {
        return {
          metric: 'Stakeholder Satisfaction',
          reason: `Stakeholder satisfaction has hit rock bottom (${m.stakeholderSatisfaction}%). The project has been terminated.`,
        };
      }
      if (m.teamMorale < FAIL_THRESHOLDS.teamMorale.hard) {
        return {
          metric: 'Team Morale',
          reason: `Team morale has collapsed (${m.teamMorale}%). Key members have resigned and the project cannot continue.`,
        };
      }
      if (m.ac > m.bac) {
        return {
          metric: 'Budget',
          reason: `The project has exceeded its total budget (Actual Cost ${Utils.formatCurrency(m.ac)} > BAC ${Utils.formatCurrency(m.bac)}).`,
        };
      }

      return null; // no failure
    },

    /**
     * Return soft warnings (not yet failures, but approaching thresholds).
     * @param {Object} s
     * @returns {string[]} — array of warning messages (may be empty)
     */
    warnings(s) {
      const m = this.compute(s);
      const warns = [];

      if (m.cpi < FAIL_THRESHOLDS.cpi.soft && m.cpi >= FAIL_THRESHOLDS.cpi.hard) {
        warns.push(`⚠️ Budget overrun warning — CPI is ${m.cpi.toFixed(2)} (target ≥ 1.0)`);
      }
      if (m.spi < FAIL_THRESHOLDS.spi.soft && m.spi >= FAIL_THRESHOLDS.spi.hard) {
        warns.push(`⚠️ Schedule slip warning — SPI is ${m.spi.toFixed(2)} (target ≥ 1.0)`);
      }
      if (m.stakeholderSatisfaction < FAIL_THRESHOLDS.stakeholderSatisfaction.soft) {
        warns.push(`⚠️ Stakeholders are unhappy (${m.stakeholderSatisfaction}%) — take corrective action`);
      }
      if (m.teamMorale < FAIL_THRESHOLDS.teamMorale.soft) {
        warns.push(`⚠️ Team morale is low (${m.teamMorale}%) — risk of turnover`);
      }
      if (m.ac > m.bac * 0.85) {
        warns.push(`⚠️ Budget nearly exhausted — ${Utils.formatPct((m.bac - m.ac) / m.bac)} remaining`);
      }

      return warns;
    },

    /**
     * Calculate the final score (0–100) for the debrief screen.
     * @param {Object} s — final Store.getState()
     * @returns {{ score: number, grade: string, breakdown: Object }}
     */
    calculateScore(s) {
      const m = this.compute(s);

      const cpiScore  = _evmScore(m.cpi)  * SCORE_WEIGHTS.cpi;
      const spiScore  = _evmScore(m.spi)  * SCORE_WEIGHTS.spi;
      const satScore  = _softScore(m.stakeholderSatisfaction) * SCORE_WEIGHTS.stakeholderSatisfaction;
      const morScore  = _softScore(m.teamMorale)              * SCORE_WEIGHTS.teamMorale;

      const total = Math.round(cpiScore + spiScore + satScore + morScore);
      const clamped = Utils.clamp(total, 0, 100);

      let grade;
      if (clamped >= 90)      grade = 'A+';
      else if (clamped >= 80) grade = 'A';
      else if (clamped >= 70) grade = 'B';
      else if (clamped >= 60) grade = 'C';
      else if (clamped >= 50) grade = 'D';
      else                    grade = 'F';

      return {
        score: clamped,
        grade,
        passed: clamped >= 60,
        breakdown: {
          cpi:  { raw: m.cpi,  score: Math.round(cpiScore), weight: SCORE_WEIGHTS.cpi  },
          spi:  { raw: m.spi,  score: Math.round(spiScore), weight: SCORE_WEIGHTS.spi  },
          stakeholder: { raw: m.stakeholderSatisfaction, score: Math.round(satScore), weight: SCORE_WEIGHTS.stakeholderSatisfaction },
          morale:      { raw: m.teamMorale,              score: Math.round(morScore),  weight: SCORE_WEIGHTS.teamMorale },
        },
      };
    },

    /**
     * Capture a weekly snapshot of key metrics for the week-by-week chart in debrief.
     * Push the returned object into Store's weekSnapshots array.
     * @param {Object} s — Store.getState()
     * @param {number} week
     * @returns {Object}
     */
    weekSnapshot(s, week) {
      const m = this.compute(s);
      return {
        week,
        ev:  m.ev,
        pv:  m.pv,
        ac:  m.ac,
        cpi: Utils.round(m.cpi, 3),
        spi: Utils.round(m.spi, 3),
        stakeholderSatisfaction: m.stakeholderSatisfaction,
        teamMorale: m.teamMorale,
      };
    },

    /**
     * Status label for a CPI/SPI ratio.
     * @param {number} val
     * @returns {'on-track'|'warning'|'critical'}
     */
    indexStatus(val) {
      if (val >= 1.0) return 'on-track';
      if (val >= 0.8) return 'warning';
      return 'critical';
    },

    /**
     * Status label for a 0-100 soft metric.
     * @param {number} val
     * @returns {'on-track'|'warning'|'critical'}
     */
    softStatus(val) {
      if (val >= 60) return 'on-track';
      if (val >= 35) return 'warning';
      return 'critical';
    },

  };

})();
