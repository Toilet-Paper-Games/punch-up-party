import type { GameCommand, GameDurations, RoundDefinition } from "../domain/types";

const durations: GameDurations = {
  instructionsMs: 8_000,
  writingMs: 70_000,
  finaleWritingMs: 55_000,
  votingMs: 22_000,
  resultsMs: 7_000,
  roundBreakMs: 6_000
};

export function createSessionFixture({ playerCount }: { playerCount: 3 | 5 | 8 }) {
  const playerIds = Array.from({ length: playerCount }, (_, index) => `player-${index + 1}`);
  const prompts = playerIds.map((_, index) => ({ id: `round-1-prompt-${index + 1}`, text: `Prompt ${index + 1}` }));
  const assignments = Object.fromEntries(
    playerIds.map((playerId, index) => [
      playerId,
      [prompts[index].id, prompts[(index - 1 + playerCount) % playerCount].id]
    ])
  );
  const rounds: RoundDefinition[] = [
    { id: "round-1", number: 1, kind: "duels", multiplier: 1, prompts, assignments },
    { id: "round-2", number: 2, kind: "duels", multiplier: 2, prompts, assignments },
    {
      id: "round-3",
      number: 3,
      kind: "finale",
      multiplier: 3,
      prompts: [{ id: "finale-prompt", text: "The big punch" }],
      assignments: Object.fromEntries(playerIds.map((playerId) => [playerId, ["finale-prompt"]]))
    }
  ];
  const initialize: Extract<GameCommand, { type: "initialize" }> = {
    type: "initialize",
    intentId: "initialize-session",
    now: 0,
    sessionId: "session-1",
    players: playerIds.map((id, index) => ({ id, name: `Player ${index + 1}`, connected: true })),
    rounds,
    durations
  };
  return { initialize, playerIds, rounds };
}

