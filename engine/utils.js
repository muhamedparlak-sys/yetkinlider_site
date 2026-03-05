/**
 * engine/utils.js
 * Pure utility functions — no side effects, no imports.
 * Everything here is deterministic and testable in isolation.
 */
const Utils = {

  /**
   * Fisher-Yates in-place shuffle — returns the SAME array (mutates).
   * Clone first if you need the original: Utils.shuffle([...arr])
   */
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },

  /** Clamp n to [min, max] */
  clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
  },

  /** Round n to `dec` decimal places */
  round(n, dec = 2) {
    const f = Math.pow(10, dec);
    return Math.round(n * f) / f;
  },

  /**
   * Format a number as currency string.
   * formatCurrency(1234567) → "$1,234,567"
   */
  formatCurrency(n, symbol = '$') {
    if (n === null || n === undefined || isNaN(n)) return `${symbol}0`;
    const abs = Math.abs(Math.round(n));
    const formatted = abs.toLocaleString('en-US');
    return n < 0 ? `-${symbol}${formatted}` : `${symbol}${formatted}`;
  },

  /**
   * Format a number as a percentage string.
   * formatPct(0.854) → "85.4%"
   * formatPct(85.4, 0, false) → "85%"  (when value is already ×100)
   */
  formatPct(n, decimals = 1, multiply = true) {
    if (n === null || n === undefined || isNaN(n)) return '0%';
    const val = multiply ? n * 100 : n;
    return `${val.toFixed(decimals)}%`;
  },

  /**
   * Format an index ratio like CPI / SPI.
   * formatIndex(0.923) → "0.92"
   */
  formatIndex(n, dec = 2) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    return n.toFixed(dec);
  },

  /** Safe JSON deep-clone (must be JSON-serialisable) */
  clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  },

  /** Shallow merge multiple objects → new object */
  merge(...objs) {
    return Object.assign({}, ...objs);
  },

  /**
   * Add `weeks` calendar weeks to an ISO date string.
   * addWeeks('2026-01-01', 3) → '2026-01-22'
   */
  addWeeks(dateStr, weeks) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + weeks * 7);
    return d.toISOString().slice(0, 10);
  },

  /**
   * Format an ISO date string as "Jan 15, 2026".
   */
  formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  /**
   * Return a CSS class suffix based on an EVM index value.
   * ≥ 1.0 → 'good'   ≥ 0.8 → 'warn'   < 0.8 → 'bad'
   * Customise thresholds via options.
   */
  metricStatus(val, opts = {}) {
    const { good = 1.0, warn = 0.8 } = opts;
    if (val >= good) return 'good';
    if (val >= warn) return 'warn';
    return 'bad';
  },

  /**
   * Return a CSS class suffix based on a 0-100 score.
   * ≥ 70 → 'good'   ≥ 50 → 'warn'   < 50 → 'bad'
   */
  scoreStatus(val) {
    if (val >= 70) return 'good';
    if (val >= 50) return 'warn';
    return 'bad';
  },

  /** Generate a short collision-resistant ID (not crypto-safe) */
  uid() {
    return Math.random().toString(36).slice(2, 10);
  },

  /**
   * Return an ordinal string for a number.
   * ordinal(1) → "1st"   ordinal(12) → "12th"
   */
  ordinal(n) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  },

  /**
   * Linear interpolation between a and b by factor t ∈ [0,1].
   */
  lerp(a, b, t) {
    return a + (b - a) * this.clamp(t, 0, 1);
  },

  /**
   * Roll a weighted random pick from an array of { weight, ... } items.
   * Returns the item or null if array is empty.
   */
  weightedRandom(items) {
    if (!items || items.length === 0) return null;
    const total = items.reduce((s, i) => s + (i.weight || 1), 0);
    let r = Math.random() * total;
    for (const item of items) {
      r -= (item.weight || 1);
      if (r <= 0) return item;
    }
    return items[items.length - 1];
  },

  /**
   * Probability check: returns true with probability p (0-1).
   */
  chance(p) {
    return Math.random() < p;
  },

  /**
   * Truncate a string to maxLen, appending '…' if needed.
   */
  truncate(str, maxLen = 80) {
    if (!str) return '';
    return str.length <= maxLen ? str : str.slice(0, maxLen - 1) + '…';
  },

  /**
   * Escape HTML special characters for safe innerHTML insertion.
   */
  escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  /**
   * Convert a 0-100 morale/satisfaction value to an emoji indicator.
   */
  moodEmoji(val) {
    if (val >= 80) return '😄';
    if (val >= 60) return '🙂';
    if (val >= 40) return '😐';
    if (val >= 20) return '😟';
    return '😫';
  },

  /**
   * Delay helper for async/await flows.
   * await Utils.sleep(300)
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

};

// Freeze so nothing accidentally mutates the Utils object
Object.freeze(Utils);
