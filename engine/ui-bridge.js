/**
 * engine/ui-bridge.js
 * ALL DOM reads and writes go through this module.
 *
 * Engine modules call UIBridge.render*(…) methods; this module translates
 * state data into HTML. No game logic lives here — only presentation.
 *
 * Screen ids in game.html:
 *   #screen-lobby
 *   #screen-scenario-intro
 *   #screen-week
 *   #screen-consequence
 *   #screen-game-over
 *   #screen-debrief
 */
const UIBridge = (() => {

  // ─── DOM Helpers ─────────────────────────────────────────────────────────

  function el(id)              { return document.getElementById(id); }
  function qs(selector, root)  { return (root || document).querySelector(selector); }
  function qsa(selector, root) { return [...(root || document).querySelectorAll(selector)]; }

  function html(id, content) {
    const node = el(id);
    if (node) node.innerHTML = content;
  }

  function text(id, content) {
    const node = el(id);
    if (node) node.textContent = content;
  }

  function show(id) { const n = el(id); if (n) n.classList.remove('hidden'); }
  function hide(id) { const n = el(id); if (n) n.classList.add('hidden'); }

  function enable(id)  { const n = el(id); if (n) n.disabled = false; }
  function disable(id) { const n = el(id); if (n) n.disabled = true;  }

  /** Generate a metric status badge */
  function _badge(status) {
    const map = { 'on-track': '🟢', 'warning': '🟡', 'critical': '🔴' };
    return map[status] || '⚪';
  }

  /** Build a metric row HTML */
  function _metricRow(label, value, status) {
    return `<div class="metric-row metric-${status}">
      <span class="metric-label">${label}</span>
      <span class="metric-value">${value} ${_badge(status)}</span>
    </div>`;
  }

  /** Build a progress bar HTML (val 0-100) */
  function _progressBar(val, status) {
    const w = Utils.clamp(val, 0, 100);
    return `<div class="prog-bar"><div class="prog-fill prog-${status}" style="width:${w}%"></div></div>`;
  }

  /** Render a risk badge */
  function _riskBadge(risk) {
    const cls = risk.type === 'opportunity' ? 'risk-opp' : 'risk-threat';
    const ico = risk.type === 'opportunity' ? '📈' : '⚠️';
    return `<span class="risk-badge ${cls}">${ico} ${Utils.escapeHtml(risk.title)}</span>`;
  }

  // ─── Screen Management ───────────────────────────────────────────────────

  const SCREENS = [
    'screen-lobby',
    'screen-scenario-intro',
    'screen-week',
    'screen-consequence',
    'screen-game-over',
    'screen-debrief',
  ];

  function showScreen(screenId) {
    SCREENS.forEach(id => {
      const node = el(id);
      if (!node) return;
      if (id === screenId) {
        node.classList.remove('hidden');
        node.classList.add('screen-active');
        node.scrollTop = 0;
      } else {
        node.classList.add('hidden');
        node.classList.remove('screen-active');
      }
    });
    window.scrollTo(0, 0);
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  return {

    el, qs, qsa, html, text, show, hide, enable, disable, showScreen,

    // ── LOBBY SCREEN ──────────────────────────────────────────────────────

    /**
     * Render scenario selection cards in the lobby.
     * @param {Object[]} scenarios — from ScenarioLoader.loadIndex()
     * @param {Function} onPlay    — (id) => void
     */
    renderLobby(scenarios, onPlay) {
      showScreen('screen-lobby');

      const grid = el('lobby-scenarios');
      if (!grid) return;

      grid.innerHTML = scenarios.map(s => {
        const diffCls = {
          'Beginner':     'diff-easy',
          'Intermediate': 'diff-med',
          'Advanced':     'diff-hard',
        }[s.difficulty] || 'diff-med';

        const tags = (s.tags || []).map(t => `<span class="tag-chip">${t}</span>`).join('');

        return `<div class="scenario-card">
          <div class="sc-header">
            <span class="diff-badge ${diffCls}">${s.difficulty || 'Intermediate'}</span>
            <span class="sc-weeks">⏱ ${s.weeks} weeks</span>
          </div>
          <h3 class="sc-title">${Utils.escapeHtml(s.title)}</h3>
          <p class="sc-desc">${Utils.escapeHtml(s.description)}</p>
          <div class="sc-tags">${tags}</div>
          <button class="btn-play" data-id="${s.id}">▶ Start Scenario</button>
        </div>`;
      }).join('');

      // Bind play buttons
      grid.querySelectorAll('.btn-play').forEach(btn => {
        btn.addEventListener('click', () => onPlay(btn.dataset.id));
      });
    },

    // ── SCENARIO INTRO SCREEN ─────────────────────────────────────────────

    /**
     * @param {Object} scenario — full scenario data
     * @param {Function} onStart — () => void
     */
    renderScenarioIntro(scenario, onStart) {
      showScreen('screen-scenario-intro');

      html('intro-title',       Utils.escapeHtml(scenario.title));
      html('intro-description', Utils.escapeHtml(scenario.description || ''));

      // Briefing details
      html('intro-details', `
        <div class="intro-kv"><span>📅 Duration</span><strong>${scenario.totalWeeks} weeks</strong></div>
        <div class="intro-kv"><span>💰 Budget (BAC)</span><strong>${Utils.formatCurrency(scenario.budget)}</strong></div>
        <div class="intro-kv"><span>🏢 Domain</span><strong>${Utils.escapeHtml(scenario.domain || 'General')}</strong></div>
        <div class="intro-kv"><span>🎯 Objective</span><strong>${Utils.escapeHtml(scenario.objective || 'Deliver the project successfully')}</strong></div>
      `);

      // Role / flavour text
      html('intro-role', Utils.escapeHtml(scenario.roleDescription || 'You are the Project Manager. Every decision counts.'));

      const btn = el('btn-start-scenario');
      if (btn) {
        btn.onclick = null;
        btn.addEventListener('click', onStart);
      }
    },

    // ── WEEK SCREEN ───────────────────────────────────────────────────────

    /**
     * Render the week header bar (progress + date).
     * @param {Object} state — Store.getState()
     */
    renderWeekHeader(state) {
      const pct = state.totalWeeks > 0
        ? Math.round((state.week / state.totalWeeks) * 100)
        : 0;

      html('week-label',    `Week ${state.week} of ${state.totalWeeks}`);
      html('week-progress', `${pct}%`);

      const bar = el('week-progress-bar');
      if (bar) bar.style.width = `${pct}%`;

      const dateStr = Utils.addWeeks(state.scenarioData?.startDate || '2026-01-05', state.week - 1);
      html('week-date', Utils.formatDate(dateStr));
    },

    /**
     * Render the EVM + soft metrics panel.
     * @param {Object} state — Store.getState()
     */
    renderMetrics(state) {
      const m = MetricsEngine.compute(state);

      // EVM
      html('metric-cpi', `
        ${_metricRow('CPI', Utils.formatIndex(m.cpi), MetricsEngine.indexStatus(m.cpi))}
        ${_metricRow('SPI', Utils.formatIndex(m.spi), MetricsEngine.indexStatus(m.spi))}
        ${_metricRow('CV',  Utils.formatCurrency(m.cv), m.cv >= 0 ? 'on-track' : 'warning')}
        ${_metricRow('SV',  Utils.formatCurrency(m.sv), m.sv >= 0 ? 'on-track' : 'warning')}
        ${_metricRow('EAC', Utils.formatCurrency(m.eac), MetricsEngine.indexStatus(m.cpi))}
        ${_metricRow('VAC', Utils.formatCurrency(m.vac), m.vac >= 0 ? 'on-track' : 'warning')}
      `);

      // Budget bar
      const budgetPct = Utils.clamp((m.ac / m.bac) * 100, 0, 100);
      const budgetStatus = m.cpi >= 1.0 ? 'on-track' : m.cpi >= 0.8 ? 'warning' : 'critical';
      html('metric-budget', `
        <div class="budget-row">
          <span>Spent: ${Utils.formatCurrency(m.ac)}</span>
          <span>BAC: ${Utils.formatCurrency(m.bac)}</span>
        </div>
        ${_progressBar(budgetPct, budgetStatus)}
        <div class="budget-row" style="margin-top:4px">
          <span>EV: ${Utils.formatCurrency(m.ev)}</span>
          <span>PV: ${Utils.formatCurrency(m.pv)}</span>
        </div>
      `);

      // Soft metrics
      const satStatus  = MetricsEngine.softStatus(m.stakeholderSatisfaction);
      const morStatus  = MetricsEngine.softStatus(m.teamMorale);

      html('metric-soft', `
        <div class="soft-metric">
          <div class="soft-label">
            <span>🤝 Stakeholders ${Utils.moodEmoji(m.stakeholderSatisfaction)}</span>
            <strong>${m.stakeholderSatisfaction}%</strong>
          </div>
          ${_progressBar(m.stakeholderSatisfaction, satStatus)}
        </div>
        <div class="soft-metric">
          <div class="soft-label">
            <span>💪 Team Morale ${Utils.moodEmoji(m.teamMorale)}</span>
            <strong>${m.teamMorale}%</strong>
          </div>
          ${_progressBar(m.teamMorale, morStatus)}
        </div>
      `);

      // Active risks
      const risks = state.activeRisks || [];
      html('metric-risks', risks.length > 0
        ? risks.map(_riskBadge).join('')
        : '<span class="no-risks">No active risks</span>');
    },

    /**
     * Render the weekly narrative and decision card.
     * @param {Object} weekData    — scenario week object
     * @param {Function} onChoose  — (optionId) => void
     */
    renderDecision(weekData, onChoose) {
      // Narrative
      html('week-narrative', Utils.escapeHtml(weekData.narrative || ''));

      // Decision
      const decision = weekData.decisions && weekData.decisions[0];
      if (!decision) {
        html('decision-panel', '<p class="no-decision">No decision this week — carry on.</p>');
        // Show a "Next Week" button
        html('decision-actions', `<button class="btn-primary" id="btn-no-decision">Continue →</button>`);
        const btn = el('btn-no-decision');
        if (btn) btn.addEventListener('click', () => onChoose(null));
        return;
      }

      html('decision-question', Utils.escapeHtml(decision.text));

      const optionsHtml = decision.options.map(opt => `
        <button class="decision-option" data-id="${opt.id}">
          <span class="opt-label">${Utils.escapeHtml(opt.text)}</span>
        </button>
      `).join('');

      html('decision-options', optionsHtml);

      // Bind option buttons
      qsa('.decision-option').forEach(btn => {
        btn.addEventListener('click', () => {
          // Visual selection feedback
          qsa('.decision-option').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          onChoose(btn.dataset.id);
        });
      });
    },

    // ── CONSEQUENCE SCREEN ────────────────────────────────────────────────

    /**
     * @param {Object} result     — from ConsequenceEngine.buildConsequenceResult()
     * @param {Object} state      — Store.getState() AFTER effects applied
     * @param {Function} onCont   — () => void (continue to next week / debrief)
     */
    renderConsequence(result, state, onCont) {
      showScreen('screen-consequence');

      // Decision feedback
      const d = result.decision;
      html('consequence-feedback', `
        <p class="feedback-text">${Utils.escapeHtml(d.text)}</p>
        ${d.concept ? `<p class="feedback-concept">📚 PMP Concept: <em>${Utils.escapeHtml(d.concept)}</em></p>` : ''}
      `);

      html('consequence-effects', d.effectSummary
        .map(line => `<div class="effect-line">${Utils.escapeHtml(line)}</div>`)
        .join(''));

      // Events
      if (result.hasEvents) {
        const eventsHtml = result.events.map(evt => `
          <div class="event-card">
            <strong>🎲 ${Utils.escapeHtml(evt.title)}</strong>
            <p>${Utils.escapeHtml(evt.description || '')}</p>
          </div>
        `).join('');
        html('consequence-events', eventsHtml);
        show('consequence-events-section');
      } else {
        hide('consequence-events-section');
      }

      // Metric changes summary
      const m = MetricsEngine.compute(state);
      html('consequence-metrics-summary', `
        <span class="cm-item">CPI: <strong>${Utils.formatIndex(m.cpi)}</strong></span>
        <span class="cm-item">SPI: <strong>${Utils.formatIndex(m.spi)}</strong></span>
        <span class="cm-item">Stakeholders: <strong>${m.stakeholderSatisfaction}%</strong></span>
        <span class="cm-item">Team: <strong>${m.teamMorale}%</strong></span>
      `);

      // Warnings
      if (result.warnings && result.warnings.length > 0) {
        html('consequence-warnings', result.warnings
          .map(w => `<div class="warn-line">${Utils.escapeHtml(w)}</div>`)
          .join(''));
        show('consequence-warnings-section');
      } else {
        hide('consequence-warnings-section');
      }

      const btn = el('btn-continue');
      if (btn) {
        btn.onclick = null;
        btn.addEventListener('click', onCont);
      }
    },

    // ── GAME OVER SCREEN ──────────────────────────────────────────────────

    /**
     * @param {{ metric: string, reason: string }} failInfo
     * @param {Object} state
     * @param {Function} onDebrief — () => void
     */
    renderGameOver(failInfo, state, onDebrief) {
      showScreen('screen-game-over');

      html('gameover-reason',  Utils.escapeHtml(failInfo.reason));
      html('gameover-metric',  `Failed metric: <strong>${Utils.escapeHtml(failInfo.metric)}</strong>`);
      html('gameover-week',    `Project terminated at end of Week ${state.week} of ${state.totalWeeks}`);

      const btn = el('btn-see-debrief');
      if (btn) {
        btn.onclick = null;
        btn.addEventListener('click', onDebrief);
      }
    },

    // ── DEBRIEF SCREEN ────────────────────────────────────────────────────

    /**
     * @param {Object} scoreResult — from MetricsEngine.calculateScore()
     * @param {Object} state       — final Store.getState()
     * @param {Function} onLobby   — () => void
     */
    renderDebrief(scoreResult, state, onLobby) {
      showScreen('screen-debrief');

      const { score, grade, passed, breakdown } = scoreResult;
      const m = MetricsEngine.compute(state);

      // Grade display
      html('debrief-grade',  grade);
      html('debrief-score',  `${score} / 100`);
      html('debrief-result', passed ? '✅ Project Delivered' : '❌ Project Failed');
      el('debrief-grade')?.classList.toggle('grade-pass', passed);
      el('debrief-grade')?.classList.toggle('grade-fail', !passed);

      // Score breakdown
      html('debrief-breakdown', `
        ${_debriefRow('Budget Performance (CPI)', Utils.formatIndex(breakdown.cpi.raw), breakdown.cpi.score, breakdown.cpi.weight)}
        ${_debriefRow('Schedule Performance (SPI)', Utils.formatIndex(breakdown.spi.raw), breakdown.spi.score, breakdown.spi.weight)}
        ${_debriefRow('Stakeholder Satisfaction', `${breakdown.stakeholder.raw}%`, breakdown.stakeholder.score, breakdown.stakeholder.weight)}
        ${_debriefRow('Team Morale', `${breakdown.morale.raw}%`, breakdown.morale.score, breakdown.morale.weight)}
      `);

      // Final EVM snapshot
      html('debrief-evm', `
        <div class="debrief-evm-grid">
          <div class="evm-cell"><span>Final CPI</span><strong class="evm-val ${MetricsEngine.indexStatus(m.cpi)}">${Utils.formatIndex(m.cpi)}</strong></div>
          <div class="evm-cell"><span>Final SPI</span><strong class="evm-val ${MetricsEngine.indexStatus(m.spi)}">${Utils.formatIndex(m.spi)}</strong></div>
          <div class="evm-cell"><span>Actual Cost</span><strong>${Utils.formatCurrency(m.ac)}</strong></div>
          <div class="evm-cell"><span>Budget (BAC)</span><strong>${Utils.formatCurrency(m.bac)}</strong></div>
          <div class="evm-cell"><span>VAC</span><strong class="${m.vac >= 0 ? 'on-track' : 'critical'}">${Utils.formatCurrency(m.vac)}</strong></div>
          <div class="evm-cell"><span>% Complete</span><strong>${Utils.round(m.pctComplete, 1)}%</strong></div>
        </div>
      `);

      // Decision log summary
      const log = state.decisionLog || [];
      html('debrief-decisions', log.length > 0
        ? log.map(d => `<div class="log-item">
            <span class="log-week">Wk ${d.week}</span>
            <span class="log-label">${Utils.escapeHtml(d.label)}</span>
          </div>`).join('')
        : '<p class="empty">No decisions recorded.</p>');

      // Event log
      const evLog = state.eventLog || [];
      html('debrief-events', evLog.length > 0
        ? evLog.map(e => `<div class="log-item">
            <span class="log-week">Wk ${e.week}</span>
            <span class="log-label">${Utils.escapeHtml(e.title)}</span>
          </div>`).join('')
        : '<p class="empty">No random events occurred.</p>');

      const btn = el('btn-return-lobby');
      if (btn) {
        btn.onclick = null;
        btn.addEventListener('click', onLobby);
      }
    },

    // ─── Internal helpers ─────────────────────────────────────────────────

  };

  /** Debrief score breakdown row */
  function _debriefRow(label, rawVal, points, weight) {
    return `<div class="debrief-row">
      <span class="dr-label">${label}</span>
      <span class="dr-raw">${rawVal}</span>
      <span class="dr-pts">${points} / ${weight}</span>
    </div>`;
  }

})();
