import type { PlayerId, Prompt, RoundDefinition } from "../domain/types";
import type { SessionPlan, SessionPlanDependencies } from "../ports";

function duelAssignments(playerIds: PlayerId[], prompts: Prompt[]): Record<PlayerId, string[]> {
  return Object.fromEntries(
    playerIds.map((playerId, index) => [
      playerId,
      [prompts[index].id, prompts[(index - 1 + playerIds.length) % playerIds.length].id]
    ])
  );
}

export function createSessionPlan(
  playerIds: PlayerId[],
  dependencies: SessionPlanDependencies
): SessionPlan {
  if (playerIds.length < 3 || playerIds.length > 8) {
    throw new Error("Punch Up! requires 3–8 players before a session plan can be created.");
  }
  const shuffledPlayers = dependencies.random.shuffle(playerIds);
  const duelPrompts = dependencies.random.shuffle(dependencies.prompts.duelPrompts());
  const finalePrompt = dependencies.random.shuffle(dependencies.prompts.finalePrompts())[0];
  const firstPrompts = duelPrompts.slice(0, playerIds.length);
  const secondPrompts = duelPrompts.slice(playerIds.length, playerIds.length * 2);
  if (secondPrompts.length !== playerIds.length || !finalePrompt) {
    throw new Error("The prompt source does not contain enough unique prompts for this session.");
  }
  const round = (
    number: 1 | 2,
    prompts: Prompt[],
    multiplier: 1 | 2
  ): RoundDefinition => ({
    id: dependencies.ids.next(`round-${number}`),
    number,
    kind: "duels",
    multiplier,
    prompts,
    assignments: duelAssignments(shuffledPlayers, prompts)
  });
  return {
    sessionId: dependencies.ids.next("session"),
    rounds: [
      round(1, firstPrompts, 1),
      round(2, secondPrompts, 2),
      {
        id: dependencies.ids.next("round-3"),
        number: 3,
        kind: "finale",
        multiplier: 3,
        prompts: [finalePrompt],
        assignments: Object.fromEntries(playerIds.map((playerId) => [playerId, [finalePrompt.id]]))
      }
    ]
  };
}

