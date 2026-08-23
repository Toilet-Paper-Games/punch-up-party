import { expect, test } from "vitest";

import { createScenarioState, playerFixtures } from "../testing/stateFactories";
import { createControllerViewModel, createHostViewModel } from "./viewModels";

test("the finale lets every writer vote while hiding their own answer", () => {
  const state = createScenarioState("finale-voting");
  const playerId = playerFixtures.typical.playerIds[0];
  const controller = createControllerViewModel({
    state,
    playerId,
    playerName: state.players[playerId].name,
    now: state.phaseStartedAt
  });

  expect(controller.scene).toBe("voting");
  expect(controller.canVote).toBe(true);
  expect(controller.answers).toHaveLength(playerFixtures.typical.playerIds.length - 1);
  expect(controller.answers.some((answer) => answer.playerId === playerId)).toBe(false);
  expect(createHostViewModel(state, state.phaseStartedAt).instruction).toContain("never for their own line");
});
