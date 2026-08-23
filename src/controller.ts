import {
  bootIframeGame,
  defineSimpleGame,
  type RuntimeParticipant,
  type SimpleGameApi
} from "@tpgames/game-kit";

import type { StarterPlayerState, StarterSignal, StarterSharedState } from "./game";

const elements = {
  player: requireElement("player"),
  lifecycle: requireElement("lifecycle"),
  prompt: requireElement("prompt"),
  status: requireElement("status"),
  ready: requireButton("ready"),
  wild: requireButton("wild"),
  stuck: requireButton("stuck"),
  settings: requireButton("settings")
};

let runtimeApi: SimpleGameApi<StarterSharedState, StarterPlayerState> | undefined;
let runtimeConnected = false;
let participant: RuntimeParticipant | undefined;

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

function renderPlayer() {
  elements.player.textContent = participant?.screenName ?? "Controller";
}

function renderSharedState(sharedState: StarterSharedState | undefined) {
  elements.prompt.textContent = sharedState
    ? `Round ${sharedState.round}: ${sharedState.prompt}`
    : "Waiting for the host to start.";
}

function connectRuntime(api: SimpleGameApi<StarterSharedState, StarterPlayerState>) {
  runtimeApi = api;
  participant = api.me();
  renderPlayer();
  renderSharedState(api.getSharedState());
  elements.lifecycle.textContent = `Lifecycle: boot`;

  if (runtimeConnected) {
    return;
  }
  runtimeConnected = true;

  api.subscribeLifecycle((lifecycle) => {
    elements.lifecycle.textContent = `Lifecycle: ${lifecycle}`;
  });
  api.subscribeParticipants(() => {
    participant = api.me();
    renderPlayer();
  });
  api.subscribeSharedState((sharedState) => {
    renderSharedState(sharedState);
  });

  void api.reportLoading(true);
}

async function sendSignal(signal: StarterSignal) {
  if (!runtimeApi) {
    return;
  }

  await runtimeApi.setPlayerState({
    signal,
    sentAt: Date.now()
  });
  await runtimeApi.reportAnalytics({
    type: "milestone.reached",
    name: "game.milestone",
    dimensions: {
      milestone: "starter-signal",
      signal
    },
    metrics: {
      count: 1
    }
  });
  elements.status.textContent = `Sent: ${signal}`;
}

const game = defineSimpleGame<StarterSharedState, StarterPlayerState>({
  boot(api) {
    connectRuntime(api);
  },
  ready(api) {
    connectRuntime(api);
  }
});

connectRuntime(
  bootIframeGame(game, {
    allowedOrigins: ["*"],
    context: {
      surfaceId: "controller",
      surfaceKind: "controller",
      participantId: "starter-controller",
      isAuthority: false
    },
    initialSettings: { volume: 0.8 }
  })
);

elements.ready.addEventListener("click", () => {
  void sendSignal("ready");
});
elements.wild.addEventListener("click", () => {
  void sendSignal("wild");
});
elements.stuck.addEventListener("click", () => {
  void sendSignal("stuck");
});
elements.settings.addEventListener("click", () => {
  void runtimeApi?.openSettings();
});
