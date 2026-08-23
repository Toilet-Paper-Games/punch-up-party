import { transition } from "../domain/engine";
import type { GameCommand, GameState, TransitionResult } from "../domain/types";
import type {
  Clock,
  PlayerDurableState,
  RuntimePort,
  SessionPlanDependencies
} from "../ports";
import { createSessionPlan } from "./sessionPlan";

export interface CoordinatorIssue {
  kind: "domain-rejection" | "runtime-rejection";
  message: string;
  code?: string;
}

const durations = {
  instructionsMs: 8_000,
  writingMs: 70_000,
  finaleWritingMs: 55_000,
  votingMs: 22_000,
  resultsMs: 9_000,
  roundBreakMs: 6_000
} as const;

export class GameCoordinator {
  private authorityState: GameState | undefined;
  private authorityRevision = 0;
  private pendingCanonicalWrite: {
    minimumRevision: number;
    completion: Promise<void>;
    resolve: () => void;
  } | undefined;
  private queue = Promise.resolve();
  private stopClock: (() => void) | undefined;
  private wasAuthority: boolean;

  constructor(
    private readonly runtime: RuntimePort,
    private readonly clock: Clock,
    private readonly planDependencies: SessionPlanDependencies,
    private readonly onIssue: (issue: CoordinatorIssue) => void
  ) {
    const snapshot = runtime.sharedSnapshot();
    this.authorityState = snapshot.value;
    this.authorityRevision = snapshot.revision;
    this.wasAuthority = runtime.isAuthority();
  }

  start(): void {
    this.maybeInitialize();
    if (this.wasAuthority && this.authorityState) this.replayDurableIntents();
    this.stopClock = this.clock.every(500, () => {
      const isAuthority = this.runtime.isAuthority();
      if (isAuthority && !this.wasAuthority) {
        const snapshot = this.runtime.sharedSnapshot();
        this.observeConfirmedState(snapshot.value, snapshot.revision);
        this.replayDurableIntents();
      }
      this.wasAuthority = isAuthority;
      const state = this.authorityState ?? this.runtime.sharedSnapshot().value;
      if (!isAuthority || !state || this.clock.now() < state.deadlineAt) return;
      this.receive({ type: "tick", intentId: this.planDependencies.ids.next("tick"), now: this.clock.now() });
    });
  }

  stop(): void {
    this.stopClock?.();
    this.stopClock = undefined;
  }

  observeConfirmedState(state: GameState | undefined, revision: number): void {
    if (revision >= this.authorityRevision) {
      this.authorityState = state;
      this.authorityRevision = revision;
    }
    const pending = this.pendingCanonicalWrite;
    if (pending && revision >= pending.minimumRevision) {
      this.pendingCanonicalWrite = undefined;
      pending.resolve();
    }
    this.maybeInitialize();
  }

  maybeInitialize(): void {
    if (!this.runtime.isAuthority() || this.authorityState) return;
    const players = this.runtime.players().filter((player) => player.connected);
    if (players.length < 3 || players.length > 8) return;
    const plan = createSessionPlan(
      players.map((player) => player.id),
      this.planDependencies
    );
    this.receive({
      type: "initialize",
      intentId: this.planDependencies.ids.next("initialize"),
      now: this.clock.now(),
      sessionId: plan.sessionId,
      players,
      rounds: plan.rounds,
      durations
    });
  }

  syncConnections(): void {
    if (!this.runtime.isAuthority() || !this.authorityState) {
      this.maybeInitialize();
      return;
    }
    const reconcile = async () => {
      const state = this.authorityState;
      if (!this.runtime.isAuthority() || !state) return;
      const connectedIds = new Set(this.runtime.players().filter((player) => player.connected).map((player) => player.id));
      for (const player of Object.values(state.players)) {
        const connected = connectedIds.has(player.id);
        if (connected !== this.authorityState?.players[player.id]?.connected) {
          await this.apply({
            type: "connection",
            intentId: this.planDependencies.ids.next("connection"),
            now: this.clock.now(),
            playerId: player.id,
            connected
          });
        }
      }
    };
    this.queue = this.queue.then(reconcile, reconcile);
  }

  receive(command: GameCommand): void {
    this.queue = this.queue.then(() => this.apply(command), () => this.apply(command));
  }

  whenIdle(): Promise<void> {
    return this.queue;
  }

  private replayDurableIntents(): void {
    for (const intent of this.runtime.durablePlayerIntents()) this.receive(intent);
  }

  async sendPlayerIntent(command: Extract<GameCommand, { type: "submit" | "vote" }>): Promise<boolean> {
    const durable: PlayerDurableState = { schemaVersion: 1, lastIntent: command };
    const result = await this.runtime.writePlayerState(durable);
    if (result.status === "rejected") {
      this.onIssue({
        kind: "runtime-rejection",
        code: result.reason,
        message: result.message ?? "Unable to save this controller action."
      });
      return false;
    }
    await this.runtime.sendIntent(command);
    return true;
  }

  private async apply(command: GameCommand): Promise<void> {
    if (!this.runtime.isAuthority()) return;
    const base = this.authorityState ?? this.runtime.sharedSnapshot().value;
    const authoritativeCommand = command.type === "initialize"
      ? command
      : { ...command, now: this.clock.now() };
    const result: TransitionResult = transition(base, authoritativeCommand);
    if (!result.ok) {
      // Player intents deliberately travel over durable state and broadcast; the
      // second arrival is an acknowledged delivery, not a user-facing failure.
      if (result.code === "duplicate-intent") return;
      this.onIssue({ kind: "domain-rejection", code: result.code, message: result.message });
      return;
    }
    const minimumRevision = this.authorityRevision + 1;
    let resolveConfirmation = () => {};
    const completion = new Promise<void>((resolve) => {
      resolveConfirmation = resolve;
    });
    const pending = { minimumRevision, completion, resolve: resolveConfirmation };
    this.pendingCanonicalWrite = pending;
    const write = await this.runtime.writeSharedState(result.state, this.authorityRevision);
    if (write.status === "rejected") {
      if (this.pendingCanonicalWrite === pending) this.pendingCanonicalWrite = undefined;
      const snapshot = this.runtime.sharedSnapshot();
      this.authorityState = snapshot.value;
      this.authorityRevision = snapshot.revision;
      this.onIssue({
        kind: "runtime-rejection",
        code: write.reason,
        message: write.message ?? "The room state changed before this action could be applied."
      });
      return;
    }
    if (write.status === "accepted") {
      const snapshot = this.runtime.sharedSnapshot();
      if (snapshot.revision >= minimumRevision) {
        this.observeConfirmedState(snapshot.value, snapshot.revision);
      }
      await completion;
      return;
    }
    if (this.pendingCanonicalWrite === pending) this.pendingCanonicalWrite = undefined;
    this.authorityState = result.state;
    if (write.revision !== undefined) this.authorityRevision = write.revision;
  }
}
