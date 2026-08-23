import type { GameState } from "./types";

const phases = new Set([
  "instructions",
  "writing",
  "voting",
  "results",
  "round-break",
  "finale",
  "finale-voting",
  "finale-results",
  "game-over"
]);

export function isGameState(value: unknown): value is GameState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<GameState>;
  return (
    candidate.schemaVersion === 1 &&
    typeof candidate.sessionId === "string" &&
    typeof candidate.phase === "string" &&
    phases.has(candidate.phase) &&
    typeof candidate.deadlineAt === "number" &&
    typeof candidate.phaseStartedAt === "number" &&
    typeof candidate.players === "object" &&
    candidate.players !== null &&
    Array.isArray(candidate.rounds) &&
    typeof candidate.roundIndex === "number" &&
    Array.isArray(candidate.matchups) &&
    Array.isArray(candidate.processedIntentIds)
  );
}

