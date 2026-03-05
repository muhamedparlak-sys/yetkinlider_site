/**
 * engine/scenario-loader.js
 * Fetches and validates scenario data from JSON files.
 *
 * Files expected:
 *   data/scenario-index.json         — list of all available scenarios
 *   data/scenarios/<id>.json         — individual scenario definition
 *
 * Implements a simple cache so the same scenario isn't re-fetched
 * during a session (or if the player restarts the same scenario).
 */
const ScenarioLoader = (() => {

  const BASE_PATH = 'data/';
  const SCENARIOS_PATH = 'data/scenarios/';

  /** @type {Object|null} — cached scenario index */
  let _index = null;

  /** @type {Object.<string, Object>} — scenario id → scenario data cache */
  const _cache = Object.create(null);

  // ─── Validation ─────────────────────────────────────────────────────────

  /**
   * Validate a loaded scenario object.
   * Returns an array of validation errors (empty = valid).
   * @param {Object} s
   * @returns {string[]}
   */
  function _validate(s) {
    const errors = [];

    if (!s.id)          errors.push('Missing: id');
    if (!s.title)       errors.push('Missing: title');
    if (!s.totalWeeks || typeof s.totalWeeks !== 'number') {
      errors.push('Missing or invalid: totalWeeks (must be a number)');
    }
    if (!s.budget || typeof s.budget !== 'number') {
      errors.push('Missing or invalid: budget (must be a number)');
    }
    if (!s.initialState) {
      errors.push('Missing: initialState');
    }
    if (!Array.isArray(s.weeks) || s.weeks.length === 0) {
      errors.push('Missing or empty: weeks array');
    } else {
      // Spot-check week structure
      s.weeks.forEach((w, i) => {
        if (typeof w.week !== 'number') {
          errors.push(`weeks[${i}]: missing "week" number`);
        }
        if (typeof w.plannedValue !== 'number') {
          errors.push(`weeks[${i}]: missing "plannedValue" number`);
        }
        if (!Array.isArray(w.decisions)) {
          errors.push(`weeks[${i}]: "decisions" must be an array`);
        } else {
          w.decisions.forEach((d, di) => {
            if (!d.id)   errors.push(`weeks[${i}].decisions[${di}]: missing "id"`);
            if (!d.text) errors.push(`weeks[${i}].decisions[${di}]: missing "text"`);
            if (!Array.isArray(d.options) || d.options.length < 2) {
              errors.push(`weeks[${i}].decisions[${di}]: "options" must have ≥ 2 entries`);
            }
          });
        }
      });
    }

    return errors;
  }

  /**
   * Validate a scenario-index entry.
   * @param {Object} entry
   * @returns {string[]}
   */
  function _validateIndexEntry(entry) {
    const errors = [];
    if (!entry.id)          errors.push('Missing: id');
    if (!entry.title)       errors.push('Missing: title');
    if (!entry.description) errors.push('Missing: description');
    return errors;
  }

  // ─── Fetch helper ───────────────────────────────────────────────────────

  async function _fetchJSON(url) {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`[ScenarioLoader] HTTP ${res.status} fetching ${url}`);
    }
    return res.json();
  }

  // ─── Public API ─────────────────────────────────────────────────────────

  return {

    /**
     * Load the scenario index.
     * Returns the index object (also cached internally).
     * @returns {Promise<Object>}
     */
    async loadIndex() {
      if (_index) return _index;

      const data = await _fetchJSON(`${BASE_PATH}scenario-index.json`);

      if (!Array.isArray(data.scenarios)) {
        throw new Error('[ScenarioLoader] scenario-index.json must have a "scenarios" array');
      }

      // Validate each entry
      data.scenarios.forEach((entry, i) => {
        const errs = _validateIndexEntry(entry);
        if (errs.length) {
          console.warn(`[ScenarioLoader] Index entry [${i}] issues:`, errs);
        }
      });

      _index = data;
      return _index;
    },

    /**
     * Return the cached index (must have called loadIndex first).
     * @returns {Object|null}
     */
    getIndex() {
      return _index;
    },

    /**
     * Load a single scenario by id.
     * Validates structure before returning.
     * @param {string} id  — e.g. 'scenario-001'
     * @returns {Promise<Object>}
     */
    async loadScenario(id) {
      if (_cache[id]) return _cache[id];

      const data = await _fetchJSON(`${SCENARIOS_PATH}${id}.json`);

      const errors = _validate(data);
      if (errors.length) {
        console.error(`[ScenarioLoader] Validation errors in scenario "${id}":`, errors);
        throw new Error(`Invalid scenario "${id}" — see console for details.`);
      }

      // Freeze a deep clone so nobody mutates the cached copy
      _cache[id] = Object.freeze(Utils.clone(data));
      console.log(`[ScenarioLoader] Loaded scenario: "${data.title}" (${data.totalWeeks} weeks)`);

      return _cache[id];
    },

    /**
     * Get the week data for a specific week number from the loaded scenario.
     * Week numbers are 1-indexed in the JSON ("week": 1 ... "week": N).
     * Returns null if the week isn't defined (unexpected skip in scenario data).
     * @param {Object} scenario
     * @param {number} weekNum
     * @returns {Object|null}
     */
    getWeek(scenario, weekNum) {
      return scenario.weeks.find(w => w.week === weekNum) || null;
    },

    /**
     * Compute the cumulative PV for a given week number.
     * Sums plannedValue for weeks 1 through weekNum.
     * @param {Object} scenario
     * @param {number} weekNum
     * @returns {number}
     */
    cumulativePV(scenario, weekNum) {
      return scenario.weeks
        .filter(w => w.week <= weekNum)
        .reduce((sum, w) => sum + (w.plannedValue || 0), 0);
    },

    /**
     * Clear the cache (useful for hot-reloading in development).
     * @param {string} [id] — if omitted, clears everything
     */
    clearCache(id) {
      if (id) {
        delete _cache[id];
      } else {
        Object.keys(_cache).forEach(k => delete _cache[k]);
        _index = null;
      }
    },

  };

})();
