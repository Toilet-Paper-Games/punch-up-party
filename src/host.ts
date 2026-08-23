import {
  bootIframeGame,
  defineSimpleGame,
  type RuntimeParticipant,
  type SimpleGameApi
} from "@tpgames/game-kit";

import {
  connectedControllers,
  createRoundState,
  isStarterPlayerState,
  type StarterPlayerState,
  type StarterSharedState
} from "./game";

type HostSnapshot = {
  lifecycle: string;
  participants: RuntimeParticipant[];
  sharedState: StarterSharedState | undefined;
  playerStates: Record<string, StarterPlayerState>;
};

const elements = {
  lifecycle: requireElement("lifecycle"),
  prompt: requireElement("prompt"),
  players: requireElement("players"),
  signals: requireElement("signals"),
  nextRound: requireButton("nextRound"),
  returnToLobby: requireButton("returnToLobby")
};

let runtimeApi: SimpleGameApi<StarterSharedState, StarterPlayerState> | undefined;
let runtimeConnected = false;
let snapshot: HostSnapshot = {
  lifecycle: "loading",
  participants: [],
  sharedState: undefined,
  playerStates: {}
};

function requireElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing #${id} element.`);
  }
  return element;
}

function requireButton(id: string): HTMLButtonElement {
  const element = requireElement(id);
  if (!(element instanceof HTMLButtonElement)) {
    throw new Error(`#${id} must be a button.`);
  }
  return element;
}

function playerLabel(participantId: string): string {
  return (
    snapshot.participants.find((participant) => participant.id === participantId)?.screenName ??
    participantId
  );
}

function updateSnapshot(updates: Partial<HostSnapshot>) {
  snapshot = {
    ...snapshot,
    ...updates
  };
  render();
}

function render() {
  const controllers = connectedControllers(snapshot.participants);
  const state = snapshot.sharedState;
  const signalEntries = Object.entries(snapshot.playerStates).sort(
    ([, left], [, right]) => right.sentAt - left.sentAt
  );

  elements.lifecycle.textContent = `Lifecycle: ${snapshot.lifecycle}`;
  elements.prompt.textContent = state
    ? `Round ${state.round}: ${state.prompt}`
    : "Waiting for the room to start.";
  elements.players.textContent = `${controllers.length} controller${controllers.length === 1 ? "" : "s"} connected`;
  elements.signals.replaceChildren(
    ...(signalEntries.length
      ? signalEntries.map(([participantId, playerState]) => {
          const item = document.createElement("li");
          item.textContent = `${playerLabel(participantId)} is ${playerState.signal}`;
          return item;
        })
      : [document.createElement("li")])
  );

  if (signalEntries.length === 0) {
    elements.signals.firstElementChild!.textContent = "Controller signals appear here.";
  }
}

function connectRuntime(api: SimpleGameApi<StarterSharedState, StarterPlayerState>) {
  runtimeApi = api;

  if (runtimeConnected) {
    return;
  }
  runtimeConnected = true;

  updateSnapshot({
    lifecycle: "boot",
    participants: api.participants(),
    sharedState: api.getSharedState()
  });

  api.subscribeLifecycle((lifecycle) => {
    updateSnapshot({ lifecycle });
  });
  api.subscribeParticipants((participants) => {
    updateSnapshot({ participants });
  });
  api.subscribeSharedState((sharedState) => {
    updateSnapshot({ sharedState });
  });
  api.subscribePlayerState((participantId, playerState) => {
    if (!isStarterPlayerState(playerState)) {
      return;
    }
    updateSnapshot({
      playerStates: {
        ...snapshot.playerStates,
        [participantId]: playerState
      }
    });
  });

  void api.reportLoading(true);
}

const game = defineSimpleGame<StarterSharedState, StarterPlayerState>({
  boot(api) {
    connectRuntime(api);
  },
  surfacesReady(api) {
    connectRuntime(api);
    if (!api.getSharedState()) {
      void api.setSharedState(createRoundState(1));
    }
  },
  started(api) {
    connectRuntime(api);
    if (!api.getSharedState()) {
      void api.setSharedState(createRoundState(1));
    }
  }
});

connectRuntime(
  bootIframeGame(game, {
    allowedOrigins: ["*"],
    context: {
      surfaceId: "host",
      surfaceKind: "host-display",
      isAuthority: true
    },
    initialSettings: { volume: 0.8 }
  })
);

elements.nextRound.addEventListener("click", () => {
  const nextRound = (runtimeApi?.getSharedState()?.round ?? 0) + 1;
  void runtimeApi?.setSharedState(createRoundState(nextRound));
});

elements.returnToLobby.addEventListener("click", () => {
  void runtimeApi?.returnToLobby();
});
