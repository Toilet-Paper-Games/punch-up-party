import type {
  PlayerDurableState,
  RuntimePort,
  RuntimeSnapshot,
  RuntimeWriteResult
} from "../ports";
import type { GameCommand, GameState, Player } from "../domain/types";

export class RuntimeMock implements RuntimePort {
  authority = true;
  participant = "player-1";
  roster: Array<Pick<Player, "id" | "name" | "connected">> = [];
  shared: RuntimeSnapshot<GameState> = { value: undefined, revision: 0 };
  playerState: PlayerDurableState | undefined;
  sharedWrites: Array<{ state: GameState; expectedRevision: number }> = [];
  playerWrites: Array<{ state: PlayerDurableState; expectedRevision?: number }> = [];
  messages: GameCommand[] = [];
  durableIntents: Array<Extract<GameCommand, { type: "submit" | "vote" }>> = [];
  rejections: RuntimeWriteResult[] = [];
  subscriptions: string[] = [];
  teardownCount = 0;

  isAuthority(): boolean {
    return this.authority;
  }

  participantId(): string | undefined {
    return this.participant;
  }

  players(): Array<Pick<Player, "id" | "name" | "connected">> {
    return this.roster.map((player) => ({ ...player }));
  }

  durablePlayerIntents(): Array<Extract<GameCommand, { type: "submit" | "vote" }>> {
    return this.durableIntents.map((intent) => ({ ...intent }));
  }

  sharedSnapshot(): RuntimeSnapshot<GameState> {
    return { value: this.shared.value, revision: this.shared.revision };
  }

  async writeSharedState(state: GameState, expectedRevision: number): Promise<RuntimeWriteResult> {
    this.sharedWrites.push({ state, expectedRevision });
    const rejection = this.rejections.shift();
    if (rejection) return rejection;
    if (expectedRevision !== this.shared.revision) {
      return { status: "rejected", revision: this.shared.revision, reason: "stale-revision", message: "Stale revision" };
    }
    this.shared = { value: state, revision: this.shared.revision + 1 };
    return { status: "applied", revision: this.shared.revision };
  }

  async writePlayerState(state: PlayerDurableState, expectedRevision?: number): Promise<RuntimeWriteResult> {
    this.playerWrites.push({ state, expectedRevision });
    this.playerState = state;
    return { status: "applied", revision: this.playerWrites.length };
  }

  async sendIntent(command: GameCommand): Promise<void> {
    this.messages.push(command);
  }

  teardown(): void {
    this.teardownCount += 1;
  }
}
