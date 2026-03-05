/**
 * engine/engine.js
 * Main game orchestrator — the only file that talks to all other modules.
 *
 * Dependency order (all loaded as plain <script> tags before this file):
 *   utils.js → event-bus.js → store.js → state-machine.js →
 *   metrics-engine.js → scenario-loader.js → decision-resolver.js →
 *   consequence-engine.js → notification-manager.js → ui-bridge.js →
 *   engine.js
 *
 * Public API used by game.html:
 *   Engine.init()                 — call once on DOMContentLoaded
 *   Engine.startScenario(id)      — called when player clicks Play
 *   Engine.makeDecision(optionId) — called when player chooses an option
 *   Engine.continueAfterConsequence() — called when player clicks Continue
 *   Engine.goToDebrief()          — called from Game Over screen
 *   Engine.returnToLobby()        — called from Debrief screen
 */
const Engine = (() => {

  // ─── Internal state ───────────────────────────────────────────────────────

  /** Which decision is currently active this week */
  let _activeDecision = null;

  /** Which option the player last chose */
  let _chosenOption   = null;

  // ─── Initialisation ───────────────────────────────────────────────────────

  async function init() {
    console.log('[Engine] Initialising…');

    // Reset all modules to clean state
    Store.init();
    StateMachine.reset();
    NotificationManager.clear();

    // Boot the lobby
    await _enterLobby();
  }

  // ─── Screen handlers ──────────────────────────────────────────────────────

  async function _enterLobby() {
    StateMachine.force(STATES.LOBBY);

    try {
      const index = await ScenarioLoader.loadIndex();
      UIBridge.renderLobby(index.scenarios, startScenario);
    } catch (err) {
      console.error('[Engine] Failed to load scenario index:', err);
      NotificationManager.danger('Could not load scenarios. Please refresh the page.');
    }
  }

  async function _enterScenarioIntro(scenarioId) {
    // Already transitioned before this is called
    const scenario = Store.get('scenarioData');
    if (!scenario) {
      console.error('[Engine] No scenario data in Store when entering intro');
      return;
    }
    UIBridge.renderScenarioIntro(scenario, _startWeekLoop);
  }

  function _startWeekLoop() {
    StateMachine.transition(STATES.WEEK_START);
    _enterWeekStart();
  }

  function _enterWeekStart() {
    const state = Store.getState();
    const nextWeek = state.week + 1;

    // Check if scenario is complete
    if (nextWeek > state.totalWeeks) {
      _enterDebrief();
      return;
    }

    Store.set({ week: nextWeek });

    // Accumulate planned value for this week
    const scenario = Store.get('scenarioData');
    const weekData = ScenarioLoader.getWeek(scenario, nextWeek);

    if (!weekData) {
      console.warn(`[Engine] No week data for week ${nextWeek}; skipping to next`);
      // If the scenario has fewer weeks defined than totalWeeks, treat as pass-through
      _advanceFromWeekEnd();
      return;
    }

    // Update cumulative PV
    const cumulPV = ScenarioLoader.cumulativePV(scenario, nextWeek);
    Store.set({ pv: cumulPV, weekData: Utils.clone(weekData) });

    // Save weekly snapshot BEFORE decisions (for charts)
    Store.push('weekSnapshots', MetricsEngine.weekSnapshot(Store.getState(), nextWeek));

    EventBus.emit(EVENT.WEEK_START, { week: nextWeek });

    // Transition and render
    StateMachine.transition(STATES.DECISION_PHASE);
    _enterDecisionPhase(weekData);
  }

  function _enterDecisionPhase(weekData) {
    UIBridge.showScreen('screen-week');
    UIBridge.renderWeekHeader(Store.getState());
    UIBridge.renderMetrics(Store.getState());

    // Pick the first decision (MVP: one decision per week)
    _activeDecision = weekData.decisions && weekData.decisions[0] || null;
    _chosenOption   = null;

    UIBridge.renderDecision(weekData, makeDecision);
  }

  async function _enterConsequencePhase(optionId) {
    const state    = Store.getState();
    const scenario = state.scenarioData;
    const weekData = state.weekData;

    // ── 1. Resolve decision ───────────────────────────────────────────────
    let decisionFeedback = { text: 'You continued without making a decision.', concept: '', effectSummary: [] };

    if (_activeDecision && optionId) {
      const option = (_activeDecision.options || []).find(o => o.id === optionId);
      if (option) {
        const resolved = DecisionResolver.execute(option, Store.getState());
        decisionFeedback = DecisionResolver.buildFeedback(option, resolved);
        DecisionResolver.record(state.week, _activeDecision.id, option, resolved);
        _chosenOption = option;
      }
    }

    // ── 2. Process random events ──────────────────────────────────────────
    const events   = weekData?.events || [];
    const triggered  = ConsequenceEngine.processWeekEvents(events, Store.getState());
    const escalated  = ConsequenceEngine.processRiskEscalation(Store.getState());

    // ── 3. Emit metrics updated ───────────────────────────────────────────
    EventBus.emit(EVENT.METRICS_UPDATED, Store.getState());

    // ── 4. Check fail conditions ──────────────────────────────────────────
    // Grace period: no hard fail before Week 3 — give the player time to
    // establish baseline metrics before penalties can end the game.
    const currentWeek = Store.get('week') || 0;
    const fail = currentWeek >= 3 ? MetricsEngine.checkFail(Store.getState()) : null;
    if (fail) {
      Store.set({ gameOver: true, gameOverReason: fail.reason });
      StateMachine.transition(STATES.GAME_OVER);
      _enterGameOver(fail);
      return;
    }

    // ── 5. Push warnings as notifications ─────────────────────────────────
    NotificationManager.pushWarnings(MetricsEngine.warnings(Store.getState()));

    // ── 6. Render consequence screen ──────────────────────────────────────
    const metricsAfter = MetricsEngine.compute(Store.getState());
    const result = ConsequenceEngine.buildConsequenceResult(
      decisionFeedback, triggered, escalated, metricsAfter
    );

    StateMachine.transition(STATES.CONSEQUENCE_PHASE);
    UIBridge.renderConsequence(result, Store.getState(), continueAfterConsequence);

    EventBus.emit(EVENT.WEEK_CONSEQUENCE, { week: state.week, result });
  }

  function _enterWeekEnd() {
    StateMachine.transition(STATES.WEEK_END);
    _advanceFromWeekEnd();
  }

  function _advanceFromWeekEnd() {
    const state = Store.getState();

    // Check hard fail once more — grace period: no fail before Week 3
    const fail = state.week >= 3 ? MetricsEngine.checkFail(state) : null;
    if (fail) {
      Store.set({ gameOver: true, gameOverReason: fail.reason });
      StateMachine.transition(STATES.GAME_OVER);
      _enterGameOver(fail);
      return;
    }

    // Check if scenario complete
    if (state.week >= state.totalWeeks) {
      _enterDebrief();
      return;
    }

    // Next week
    StateMachine.transition(STATES.WEEK_START);
    _enterWeekStart();
  }

  function _enterGameOver(failInfo) {
    const state = Store.getState();
    UIBridge.renderGameOver(failInfo, state, goToDebrief);
    NotificationManager.danger(failInfo.reason, 6000);
  }

  function _enterDebrief() {
    StateMachine.force(STATES.DEBRIEF);
    const state       = Store.getState();
    const scoreResult = MetricsEngine.calculateScore(state);

    Store.set({ finalScore: scoreResult.score, passed: scoreResult.passed });

    UIBridge.renderDebrief(scoreResult, Store.getState(), returnToLobby);
    EventBus.emit(EVENT.DEBRIEF, { score: scoreResult });
  }

  // ─── Public player actions ────────────────────────────────────────────────

  /**
   * Called when the player clicks "Play" on a scenario card.
   * @param {string} id — scenario id
   */
  async function startScenario(id) {
    console.log(`[Engine] Starting scenario: ${id}`);
    NotificationManager.info('Loading scenario…', 1500);

    try {
      const scenario = await ScenarioLoader.loadScenario(id);

      // Initialise store for this scenario
      Store.init({
        screen:       STATES.SCENARIO_INTRO,
        scenarioId:   id,
        scenarioData: Utils.clone(scenario),
        totalWeeks:   scenario.totalWeeks,
        budget:       scenario.budget,
        week:         0,
        // Override soft metrics from scenario's initial state
        ...scenario.initialState,
      });

      StateMachine.transition(STATES.SCENARIO_INTRO);
      await _enterScenarioIntro(id);

      EventBus.emit(EVENT.SCENARIO_STARTED, { id, title: scenario.title });

    } catch (err) {
      console.error('[Engine] Failed to load scenario:', err);
      NotificationManager.danger(`Could not load scenario "${id}". See console for details.`);
    }
  }

  /**
   * Called when the player selects a decision option.
   * @param {string|null} optionId — null means no decision this week (auto-advance)
   */
  async function makeDecision(optionId) {
    if (!StateMachine.can(STATES.CONSEQUENCE_PHASE) &&
        !StateMachine.can(STATES.GAME_OVER)) {
      console.warn('[Engine] makeDecision called in unexpected state:', StateMachine.current);
      return;
    }

    EventBus.emit(EVENT.DECISION_MADE, { optionId });
    await _enterConsequencePhase(optionId);
  }

  /**
   * Called when the player clicks "Continue" on the consequence screen.
   */
  function continueAfterConsequence() {
    _enterWeekEnd();
  }

  /**
   * Called from the Game Over screen to proceed to the debrief.
   */
  function goToDebrief() {
    StateMachine.transition(STATES.DEBRIEF);
    _enterDebrief();
  }

  /**
   * Called from the Debrief screen to return to the lobby.
   */
  function returnToLobby() {
    Store.reset();
    StateMachine.reset();
    _enterLobby();
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  return {
    init,
    startScenario,
    makeDecision,
    continueAfterConsequence,
    goToDebrief,
    returnToLobby,
  };

})();
