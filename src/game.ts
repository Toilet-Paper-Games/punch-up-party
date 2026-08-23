import type { RuntimeParticipant } from "@tpgames/game-kit";

export type StarterSharedState = {
  round: number;
  prompt: string;
  updatedAt: number;
};

export type StarterSignal = "ready" | "wild" | "stuck";

export type StarterPlayerState = {
  signal: StarterSignal;
  sentAt: number;
};

export const promptList = [
  "Name a game rule that gets louder every round.",
  "Pitch a party game in five words.",
  "Invent a power-up for toilet paper.",
  "Choose the next chaos mode."
] as const;

export function createRoundState(round: number, now: () => number = Date.now): StarterSharedState {
  return {
    round,
    prompt: promptList[(round - 1) % promptList.length],
    updatedAt: now()
  };
}

export function connectedControllers(participants: RuntimeParticipant[]): RuntimeParticipant[] {
  return participants.filter(
    (participant) => participant.role === "controller" && participant.connected
  );
}

export function isStarterPlayerState(value: unknown): value is StarterPlayerState {
  return (
    typeof value === "object" &&
    value !== null &&
    "sentAt" in value &&
    typeof value.sentAt === "number" &&
    "signal" in value &&
    (value.signal === "ready" || value.signal === "wild" || value.signal === "stuck")
  );
}
