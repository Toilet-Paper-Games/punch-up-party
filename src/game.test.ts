import { describe, expect, it } from "vitest";

import { connectedControllers, createRoundState, isStarterPlayerState } from "./game";

describe("starter game helpers", () => {
  it("creates deterministic round state from the prompt rotation", () => {
    expect(createRoundState(1, () => 1000)).toEqual({
      round: 1,
      prompt: "Name a game rule that gets louder every round.",
      updatedAt: 1000
    });
    expect(createRoundState(5, () => 2000)).toEqual({
      round: 5,
      prompt: "Name a game rule that gets louder every round.",
      updatedAt: 2000
    });
  });

  it("filters the connected controller roster", () => {
    expect(
      connectedControllers([
        { id: "display-1", role: "host-display", connected: true, ready: true, screenName: "Display" },
        { id: "controller-1", role: "controller", connected: true, ready: true, screenName: "Avery" },
        { id: "controller-2", role: "controller", connected: false, ready: false, screenName: "Blake" },
        { id: "spectator-1", role: "spectator", connected: true, ready: true, screenName: "Casey" }
      ])
    ).toEqual([{ id: "controller-1", role: "controller", connected: true, ready: true, screenName: "Avery" }]);
  });

  it("accepts only starter player signal payloads", () => {
    expect(isStarterPlayerState({ signal: "ready", sentAt: 1000 })).toBe(true);
    expect(isStarterPlayerState({ signal: "wild", sentAt: 1000 })).toBe(true);
    expect(isStarterPlayerState({ signal: "stuck", sentAt: 1000 })).toBe(true);
    expect(isStarterPlayerState({ signal: "done", sentAt: 1000 })).toBe(false);
    expect(isStarterPlayerState({ signal: "ready", sentAt: "soon" })).toBe(false);
  });
});
