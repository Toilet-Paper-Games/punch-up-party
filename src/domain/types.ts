export type PlayerId = string;
export type PromptId = string;
export type MatchupId = string;

export type GamePhase =
  | "instructions"
  | "writing"
  | "voting"
  | "results"
  | "round-break"
  | "finale"
  | "finale-voting"
  | "finale-results"
  | "game-over";

export interface Player {
  id: PlayerId;
  name: string;
  score: number;
  connected: boolean;
}

export interface Prompt {
  id: PromptId;
  text: string;
}

export interface RoundDefinition {
  id: string;
  number: 1 | 2 | 3;
  kind: "duels" | "finale";
  multiplier: 1 | 2 | 3;
  prompts: Prompt[];
  assignments: Record<PlayerId, PromptId[]>;
}

export interface AnswerOption {
  playerId: PlayerId;
  text: string;
}

export interface Matchup {
  id: MatchupId;
  prompt: Prompt;
  options: AnswerOption[];
  votes: Record<PlayerId, PlayerId>;
}

export interface MatchupResult {
  matchupId: MatchupId;
  prompt: Prompt;
  options: Array<AnswerOption & { votes: number; points: number }>;
  winnerIds: PlayerId[];
  nailedIt: boolean;
}

export interface GameDurations {
  instructionsMs: number;
  writingMs: number;
  finaleWritingMs: number;
  votingMs: number;
  resultsMs: number;
  roundBreakMs: number;
}

export interface GameState {
  schemaVersion: 1;
  sessionId: string;
  phase: GamePhase;
  phaseStartedAt: number;
  deadlineAt: number;
  players: Record<PlayerId, Player>;
  rounds: RoundDefinition[];
  roundIndex: number;
  submissions: Record<PromptId, Record<PlayerId, string>>;
  matchups: Matchup[];
  currentMatchupIndex: number;
  lastResult?: MatchupResult;
  processedIntentIds: string[];
  durations: GameDurations;
  winnerIds: PlayerId[];
}

export type GameCommand =
  | {
      type: "initialize";
      intentId: string;
      now: number;
      sessionId: string;
      players: Array<Pick<Player, "id" | "name" | "connected">>;
      rounds: RoundDefinition[];
      durations: GameDurations;
    }
  | {
      type: "submit";
      intentId: string;
      now: number;
      playerId: PlayerId;
      answers: Record<PromptId, string>;
    }
  | {
      type: "vote";
      intentId: string;
      now: number;
      playerId: PlayerId;
      optionPlayerId: PlayerId;
    }
  | {
      type: "tick";
      intentId: string;
      now: number;
    }
  | {
      type: "connection";
      intentId: string;
      now: number;
      playerId: PlayerId;
      connected: boolean;
    };

export type GameErrorCode =
  | "already-initialized"
  | "duplicate-intent"
  | "duplicate-submission"
  | "duplicate-vote"
  | "invalid-answer"
  | "invalid-phase"
  | "invalid-player-count"
  | "not-assigned"
  | "not-connected"
  | "not-in-session"
  | "self-vote"
  | "unknown-option";

export type TransitionResult =
  | { ok: true; state: GameState }
  | { ok: false; code: GameErrorCode; message: string; state?: GameState };
