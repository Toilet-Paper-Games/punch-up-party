import type { GamePhase } from "./domain/types";
import { renderController, renderHost } from "./presentation/render";
import { createControllerViewModel, createHostViewModel } from "./presentation/viewModels";
import {
  createEightPlayerFinaleScenario,
  createEightPlayerLongFinaleScenario,
  createEightPlayerFinaleResultsScenario,
  createLongContentVotingScenario,
  createScenarioState,
  createSubmittedScenario
} from "./testing/stateFactories";

const root = document.getElementById("scenario-root");
const surfaceSelect = document.getElementById("surface");
const scenarioSelect = document.getElementById("scenario");
if (!root || !(surfaceSelect instanceof HTMLSelectElement) || !(scenarioSelect instanceof HTMLSelectElement)) {
  throw new Error("Scenario gallery controls are missing.");
}
const galleryRoot: HTMLElement = root;
const surfaceControl: HTMLSelectElement = surfaceSelect;
const scenarioControl: HTMLSelectElement = scenarioSelect;

const phases = new Set<GamePhase>(["instructions", "writing", "voting", "results", "round-break", "finale", "finale-voting", "finale-results", "game-over"]);

function paint(): void {
  const surface = surfaceControl.value;
  const scenario = scenarioControl.value;
  galleryRoot.dataset.surface = surface;
  const state = scenario === "waiting"
    ? undefined
    : scenario === "submitted"
      ? createSubmittedScenario()
      : scenario === "finale-voting-8"
        ? createEightPlayerFinaleScenario()
      : scenario === "finale-results-8"
          ? createEightPlayerFinaleResultsScenario()
          : scenario === "finale-voting-8-long"
            ? createEightPlayerLongFinaleScenario()
          : scenario === "long-voting"
            ? createLongContentVotingScenario()
            : createScenarioState(scenario === "voting-active" ? "voting" : phases.has(scenario as GamePhase) ? scenario as GamePhase : "writing");
  if (surface === "controller") {
    const controllerPlayerId = scenario === "voting-active" ? "player-3" : "player-1";
    galleryRoot.innerHTML = renderController(createControllerViewModel({
      state,
      playerId: controllerPlayerId,
      playerName: "Avery-with-a-purposefully-long-name",
      issue: scenario === "reconnecting" ? "Reconnecting to the writers’ room…" : undefined,
      now: state?.phaseStartedAt
    }));
  } else {
    galleryRoot.innerHTML = renderHost(createHostViewModel(state, state?.phaseStartedAt), surface === "spectator");
  }
}

surfaceControl.addEventListener("change", paint);
scenarioControl.addEventListener("change", paint);
paint();
