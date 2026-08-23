import type {
  RuntimeMessage,
  RuntimeParticipant,
  SimpleGameApi,
  StateMutationResult
} from "@tpgames/game-kit";

import { GameCoordinator, type CoordinatorIssue } from "../application/coordinator";
import { isGameState } from "../domain/guards";
import type { GameCommand, GameState } from "../domain/types";
import type { PlayerDurableState, RuntimePort, RuntimeWriteResult } from "../ports";
import { defaultPromptSource } from "../content/prompts";
import {
  SystemClock,
  SystemIdGenerator,
  SystemRandom
} from "../testing/fakes";

export const INTENT_MESSAGE = "punch-up:intent";

function mapWrite(result: StateMutationResult): RuntimeWriteResult {
  if (result.status === "rejected") {
    return {
      status: "rejected",
      revision: result.revision,
      reason: result.reason,
      message: result.message
    };
  }
  return { status: result.status, revision: result.revision };
}

function isPlayerIntent(value: unknown): value is Extract<GameCommand, { type: "submit" | "vote" }> {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<GameCommand>;
  const common =
    typeof candidate.intentId === "string" &&
    typeof candidate.now === "number" &&
    "playerId" in candidate &&
    typeof candidate.playerId === "string";
  if (!common) return false;
  if (candidate.type === "vote") {
    return "optionPlayerId" in candidate && typeof candidate.optionPlayerId === "string";
  }
  if (candidate.type !== "submit" || !("answers" in candidate) || !candidate.answers || typeof candidate.answers !== "object") {
    return false;
  }
  return Object.values(candidate.answers).every((answer) => typeof answer === "string");
}

export function playerIntentBelongsToParticipant(participantId: string, value: unknown): value is Extract<GameCommand, { type: "submit" | "vote" }> {
  return isPlayerIntent(value) && value.playerId === participantId;
}

export function isPlayerDurableState(value: unknown): value is PlayerDurableState {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    (value as Partial<PlayerDurableState>).schemaVersion === 1 &&
    isPlayerIntent((value as Partial<PlayerDurableState>).lastIntent)
  );
}

class TpgRuntimePort implements RuntimePort {
  constructor(private readonly api: SimpleGameApi<GameState, PlayerDurableState>) {}

  isAuthority(): boolean {
    return this.api.context().isAuthority;
  }

  participantId(): string | undefined {
    return this.api.me()?.id ?? this.api.context().participantId;
  }

  players() {
    return this.api
      .participants()
      .filter((participant) => participant.role === "controller")
      .map((participant) => ({
        id: participant.id,
        name: participant.screenName ?? "Player",
        connected: participant.connected
      }));
  }

  durablePlayerIntents() {
    return this.players().flatMap((player) => {
      const state = this.api.getPlayerState(player.id);
      return isPlayerDurableState(state) && playerIntentBelongsToParticipant(player.id, state.lastIntent)
        ? [state.lastIntent]
        : [];
    });
  }

  sharedSnapshot() {
    const snapshot = this.api.getSharedStateSnapshot();
    return { value: isGameState(snapshot.value) ? snapshot.value : undefined, revision: snapshot.revision };
  }

  async writeSharedState(state: GameState, expectedRevision: number) {
    return mapWrite(await this.api.setSharedState(state, { expectedRevision }));
  }

  async writePlayerState(state: PlayerDurableState, expectedRevision?: number) {
    const options = expectedRevision === undefined ? undefined : { expectedRevision };
    return mapWrite(await this.api.setPlayerState(state, undefined, options));
  }

  async sendIntent(command: GameCommand): Promise<void> {
    await this.api.broadcast(INTENT_MESSAGE, command);
  }
}

export interface SurfaceSnapshot {
  lifecycle: string;
  participants: RuntimeParticipant[];
  sharedState: GameState | undefined;
  playerState: PlayerDurableState | undefined;
  issue?: CoordinatorIssue;
}

export interface SurfaceSession {
  snapshot(): SurfaceSnapshot;
  participantId(): string | undefined;
  subscribe(listener: (snapshot: SurfaceSnapshot) => void): () => void;
  submit(answers: Record<string, string>): Promise<boolean>;
  vote(optionPlayerId: string): Promise<boolean>;
  openSettings(): Promise<void>;
  dispose(): void;
}

export function createSurfaceSession(
  api: SimpleGameApi<GameState, PlayerDurableState>
): SurfaceSession {
  const port = new TpgRuntimePort(api);
  const ids = new SystemIdGenerator();
  const clock = new SystemClock();
  const initialSharedSnapshot = api.getSharedStateSnapshot();
  let confirmedSharedRevision = initialSharedSnapshot.revision;
  let current: SurfaceSnapshot = {
    lifecycle: "boot",
    participants: api.participants(),
    sharedState: isGameState(initialSharedSnapshot.value) ? initialSharedSnapshot.value : undefined,
    playerState: isPlayerDurableState(api.getPlayerState()) ? api.getPlayerState() : undefined
  };
  const listeners = new Set<(snapshot: SurfaceSnapshot) => void>();
  const update = (updates: Partial<SurfaceSnapshot>) => {
    current = { ...current, ...updates };
    for (const listener of listeners) listener(current);
  };
  const coordinator = new GameCoordinator(
    port,
    clock,
    { ids, prompts: defaultPromptSource, random: new SystemRandom() },
    (issue) => update({ issue })
  );
  const unsubs = [
    api.subscribeLifecycle((lifecycle) => update({ lifecycle })),
    api.subscribeParticipants((participants) => {
      update({ participants });
      coordinator.syncConnections();
    }),
    api.subscribeSharedState(() => {
      const snapshot = api.getSharedStateSnapshot();
      if (snapshot.revision < confirmedSharedRevision) return;
      confirmedSharedRevision = snapshot.revision;
      const confirmed = isGameState(snapshot.value) ? snapshot.value : undefined;
      update({ sharedState: confirmed });
      coordinator.observeConfirmedState(confirmed, snapshot.revision);
    }),
    api.subscribePlayerState((participantId, playerState) => {
      if (!isPlayerDurableState(playerState)) return;
      if (!playerIntentBelongsToParticipant(participantId, playerState.lastIntent)) {
        update({
          issue: {
            kind: "domain-rejection",
            code: "participant-mismatch",
            message: "A durable controller intent did not match its authenticated participant."
          }
        });
        return;
      }
      if (participantId === (api.me()?.id ?? api.context().participantId)) update({ playerState });
      if (port.isAuthority()) coordinator.receive(playerState.lastIntent);
    }),
    api.subscribeMessages((message: RuntimeMessage) => {
      if (message.type !== INTENT_MESSAGE || !isPlayerIntent(message.payload)) return;
      if (message.fromParticipantId !== message.payload.playerId) {
        update({
          issue: {
            kind: "domain-rejection",
            code: "participant-mismatch",
            message: "A controller intent did not match its authenticated participant."
          }
        });
        return;
      }
      coordinator.receive(message.payload);
    })
  ];
  coordinator.start();
  void api.reportLoading(true);

  return {
    snapshot: () => current,
    participantId: () => port.participantId(),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async submit(answers) {
      const playerId = port.participantId();
      if (!playerId) return false;
      return coordinator.sendPlayerIntent({
        type: "submit",
        intentId: ids.next("submit"),
        now: clock.now(),
        playerId,
        answers
      });
    },
    async vote(optionPlayerId) {
      const playerId = port.participantId();
      if (!playerId) return false;
      return coordinator.sendPlayerIntent({
        type: "vote",
        intentId: ids.next("vote"),
        now: clock.now(),
        playerId,
        optionPlayerId
      });
    },
    openSettings: () => api.openSettings(),
    dispose() {
      coordinator.stop();
      for (const unsubscribe of unsubs) unsubscribe();
      listeners.clear();
    }
  };
}
