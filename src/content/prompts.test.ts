import { expect, test } from "vitest";

import { defaultPromptSource } from "./prompts";

test("the production prompt pool supports high-player rematches without immediate exhaustion", () => {
  const duel = defaultPromptSource.duelPrompts();
  const finale = defaultPromptSource.finalePrompts();
  expect(duel).toHaveLength(64);
  expect(finale).toHaveLength(12);
  expect(new Set(duel.map((prompt) => prompt.id)).size).toBe(duel.length);
  expect(new Set(finale.map((prompt) => prompt.id)).size).toBe(finale.length);
  expect(duel.every((prompt) => prompt.text.length <= 110)).toBe(true);
  expect(finale.every((prompt) => prompt.text.length <= 110)).toBe(true);
});
