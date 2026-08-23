import { bootIframeGame, defineSimpleGame, type SimpleGameApi } from "@tpgames/game-kit";

import type { GameState } from "./domain/types";
import type { PlayerDurableState } from "./ports";
import { createSurfaceSession, type SurfaceSession } from "./platform/tpgRuntime";
import { renderHost } from "./presentation/render";
import { createHostViewModel } from "./presentation/viewModels";
import { updateRenderedTimer } from "./presentation/liveTimer";

const root = document.getElementById("app");
if (!root) throw new Error("Missing #app spectator root.");
const spectatorRoot: HTMLElement = root;

let session: SurfaceSession | undefined;
let stopListening: (() => void) | undefined;

function paint(): void {
  spectatorRoot.innerHTML = renderHost(createHostViewModel(session?.snapshot().sharedState), true);
}

function updateTimer(): void {
  updateRenderedTimer(spectatorRoot, session?.snapshot().sharedState);
}

function connect(api: SimpleGameApi<GameState, PlayerDurableState>): void {
  if (session) return;
  session = createSurfaceSession(api);
  stopListening = session.subscribe(paint);
  paint();
}

const game = defineSimpleGame<GameState, PlayerDurableState>({
  boot: connect,
  ready: connect,
  surfacesReady: connect,
  started: connect
});

connect(
  bootIframeGame(game, {
    context: {
      surfaceId: "spectator",
      surfaceKind: "spectator",
      participantId: "punch-up-spectator",
      isAuthority: false
    },
    initialSettings: { volume: 0.8 }
  })
);

const timerHandle = window.setInterval(updateTimer, 1_000);
window.addEventListener("pagehide", () => {
  window.clearInterval(timerHandle);
  stopListening?.();
  session?.dispose();
}, { once: true });
