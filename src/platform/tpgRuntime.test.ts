import { expect, test } from "vitest";

import { playerIntentBelongsToParticipant } from "./tpgRuntime";

const intent = {
  type: "vote" as const,
  intentId: "vote-1",
  now: 1_000,
  playerId: "avery",
  optionPlayerId: "blake"
};

test("runtime intents must belong to the authenticated durable-state or message sender", () => {
  expect(playerIntentBelongsToParticipant("avery", intent)).toBe(true);
  expect(playerIntentBelongsToParticipant("mallory", intent)).toBe(false);
  expect(playerIntentBelongsToParticipant("avery", { ...intent, playerId: 42 })).toBe(false);
});
