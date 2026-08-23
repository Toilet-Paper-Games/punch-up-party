import { expect, test } from "vitest";

import { createScenarioState } from "../testing/stateFactories";
import { renderController } from "./render";
import { createControllerViewModel } from "./viewModels";

test("busy writing keeps every answer and the submit action disabled until confirmation", () => {
  const state = createScenarioState("writing");
  const view = createControllerViewModel({
    state,
    playerId: "player-1",
    playerName: "Player 1",
    now: state.phaseStartedAt
  });
  const html = renderController(view, { busy: true });

  expect(html).toContain('class="controller-page" aria-busy="true"');
  expect(html).toContain('data-writing-form aria-busy="true"');
  expect(html.match(/<textarea[^>]+disabled/g)).toHaveLength(2);
  expect(html).toContain('<button class="primary-action" type="submit" disabled>Sending punchlines…</button>');
});

test("busy voting disables every visible option", () => {
  const state = createScenarioState("voting");
  const view = createControllerViewModel({
    state,
    playerId: "player-3",
    playerName: "Player 3",
    now: state.phaseStartedAt
  });
  const html = renderController(view, { busy: true });

  expect(view.canVote).toBe(true);
  expect(html.match(/class="vote-option"[^>]+disabled/g)).toHaveLength(view.answers.length);
});
