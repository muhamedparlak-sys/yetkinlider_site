/**
 * engine/notification-manager.js
 * Toast notification queue rendered in the top-right corner.
 *
 * Types: 'info' | 'warning' | 'danger' | 'success'
 *
 * Usage:
 *   NotificationManager.push('Budget on track!', 'success');
 *   NotificationManager.push('Risk materialised!', 'danger', 5000);
 *   NotificationManager.clear();
 */
const NotificationManager = (() => {

  /** @type {{ msg: string, type: string, duration: number }[]} */
  const _queue = [];

  let _container = null;
  let _busy      = false;

  // Default display durations per type (ms)
  const DURATIONS = {
    info:    3000,
    success: 3500,
    warning: 4000,
    danger:  5000,
  };

  // Type → CSS class suffix + icon
  const TYPE_META = {
    info:    { cls: 'n-info',    icon: 'ℹ️' },
    success: { cls: 'n-success', icon: '✅' },
    warning: { cls: 'n-warning', icon: '⚠️' },
    danger:  { cls: 'n-danger',  icon: '🚨' },
  };

  /** Lazily create (or find) the container div in the DOM */
  function _getContainer() {
    if (_container && document.body.contains(_container)) return _container;
    _container = document.getElementById('notification-container');
    if (!_container) {
      _container = document.createElement('div');
      _container.id = 'notification-container';
      document.body.appendChild(_container);
    }
    return _container;
  }

  /**
   * Display the next notification in the queue.
   * Auto-chains to the next one after duration elapses.
   */
  async function _next() {
    if (_busy || _queue.length === 0) return;
    _busy = true;

    const { msg, type, duration } = _queue.shift();
    const meta = TYPE_META[type] || TYPE_META.info;

    const el = document.createElement('div');
    el.className = `notification ${meta.cls}`;
    el.innerHTML = `<span class="n-icon">${meta.icon}</span><span class="n-msg">${Utils.escapeHtml(msg)}</span>`;

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className  = 'n-close';
    closeBtn.innerHTML  = '×';
    closeBtn.onclick    = () => _dismiss(el);
    el.appendChild(closeBtn);

    _getContainer().appendChild(el);

    // Animate in
    requestAnimationFrame(() => el.classList.add('n-visible'));

    // Wait for duration then dismiss
    await Utils.sleep(duration);
    _dismiss(el);
  }

  function _dismiss(el) {
    el.classList.remove('n-visible');
    el.classList.add('n-hiding');
    setTimeout(() => {
      el.remove();
      _busy = false;
      _next();
    }, 300); // match CSS transition
  }

  // ─── Public API ─────────────────────────────────────────────────────────

  return {

    /**
     * Queue a notification toast.
     * @param {string} msg
     * @param {'info'|'success'|'warning'|'danger'} [type]
     * @param {number} [duration] — ms before auto-dismiss
     */
    push(msg, type = 'info', duration) {
      const dur = duration || DURATIONS[type] || DURATIONS.info;
      _queue.push({ msg, type, dur });

      // Emit via EventBus so other systems can react
      if (typeof EventBus !== 'undefined') {
        EventBus.emit(EVENT ? EVENT.NOTIFY : 'notify', { msg, type });
      }

      _next();
    },

    /** Shorthand helpers */
    info   (msg, dur) { this.push(msg, 'info',    dur); },
    success(msg, dur) { this.push(msg, 'success', dur); },
    warn   (msg, dur) { this.push(msg, 'warning', dur); },
    danger (msg, dur) { this.push(msg, 'danger',  dur); },

    /**
     * Immediately clear all queued AND displayed notifications.
     */
    clear() {
      _queue.length = 0;
      const container = _getContainer();
      [...container.children].forEach(el => el.remove());
      _busy = false;
    },

    /**
     * Push multiple notifications from an array of warning strings
     * (as returned by MetricsEngine.warnings()).
     * @param {string[]} warnings
     */
    pushWarnings(warnings) {
      warnings.forEach(w => this.warn(w));
    },

  };

})();
