import type { GameCommand, GameState, Player, Prompt, RoundDefinition } from "./domain/types";

export interface Clock {
  now(): number;
  every(intervalMs: number, callback: () => void): () => void;
}

export interface RandomSource {
  shuffle<T>(values: readonly T[]): T[];
}

export interface IdGenerator {
  next(prefix: string): string;
}

export interface PromptSource {
  duelPrompts(): Prompt[];
  finalePrompts(): Prompt[];
}

export interface SessionPlanDependencies {
  ids: IdGenerator;
  prompts: PromptSource;
  random: RandomSource;
}

export interface RuntimeWriteResult {
  status: "applied" | "accepted" | "rejected";
  revision?: number;
  reason?: string;
  message?: string;
}

export interface RuntimeSnapshot<T> {
  value: T | undefined;
  revision: number;
}

export interface RuntimePort {
  isAuthority(): boolean;
  participantId(): string | undefined;
  players(): Array<Pick<Player, "id" | "name" | "connected">>;
  durablePlayerIntents(): Array<Extract<GameCommand, { type: "submit" | "vote" }>>;
  sharedSnapshot(): RuntimeSnapshot<GameState>;
  writeSharedState(state: GameState, expectedRevision: number): Promise<RuntimeWriteResult>;
  writePlayerState(state: PlayerDurableState, expectedRevision?: number): Promise<RuntimeWriteResult>;
  sendIntent(command: GameCommand): Promise<void>;
}

export interface PlayerDurableState {
  schemaVersion: 1;
  lastIntent: Extract<GameCommand, { type: "submit" | "vote" }>;
}

export interface SessionPlan {
  sessionId: string;
  rounds: RoundDefinition[];
}
