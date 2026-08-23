import { bootIframeGame, defineSimpleGame, type SimpleGameApi } from "@tpgames/game-kit";

import type { GameState } from "./domain/types";
import type { PlayerDurableState } from "./ports";
import { createSurfaceSession, type SurfaceSession } from "./platform/tpgRuntime";
import { renderController } from "./presentation/render";
import { createControllerViewModel } from "./presentation/viewModels";
import { updateRenderedTimer } from "./presentation/liveTimer";

const root = document.getElementById("app");
if (!root) throw new Error("Missing #app controller root.");
const controllerRoot: HTMLElement = root;

let session: SurfaceSession | undefined;
let localStatus = "";
let pendingAction: "submit" | "vote" | undefined;
let stopListening: (() => void) | undefined;

function playerName(): string {
  const participant = session?.snapshot().participants.find((candidate) => candidate.id === session?.participantId());
  return participant?.screenName ?? "Writer";
}

function paint(): void {
  const snapshot = session?.snapshot();
  const view = createControllerViewModel({
    state: snapshot?.sharedState,
    playerId: session?.participantId(),
    playerName: playerName(),
    durableState: snapshot?.playerState,
    issue: snapshot?.issue?.message ?? localStatus
  });
  if (
    (pendingAction === "submit" && view.scene !== "writing") ||
    (pendingAction === "vote" && view.scene !== "voting")
  ) {
    pendingAction = undefined;
  }
  if (view.scene === "submitted" || view.scene === "results") localStatus = "";
  controllerRoot.innerHTML = renderController(view, { busy: Boolean(pendingAction) });
}

function updateTimer(): void {
  updateRenderedTimer(controllerRoot, session?.snapshot().sharedState);
}

function connect(api: SimpleGameApi<GameState, PlayerDurableState>): void {
  if (session) return;
  session = createSurfaceSession(api);
  stopListening = session.subscribe(paint);
  paint();
}

controllerRoot.addEventListener("submit", async (event) => {
  if (!(event.target instanceof HTMLFormElement) || !event.target.matches("[data-writing-form]")) return;
  event.preventDefault();
  const form = event.target;
  if (pendingAction) return;
  pendingAction = "submit";
  localStatus = "Sending your punchlines…";
  paint();
  const answers = Object.fromEntries(
    [...new FormData(form).entries()].map(([promptId, answer]) => [promptId, String(answer).trim()])
  );
  const sent = await session?.submit(answers);
  if (!sent) pendingAction = undefined;
  localStatus = sent ? "Waiting for room confirmation…" : "Unable to send. Check your connection and try again.";
  paint();
});

controllerRoot.addEventListener("click", async (event) => {
  const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-vote], [data-settings]") : null;
  if (!target || !session) return;
  if (target.hasAttribute("data-settings")) {
    await session.openSettings();
    return;
  }
  const optionPlayerId = target.dataset.vote;
  if (!optionPlayerId || pendingAction) return;
  pendingAction = "vote";
  localStatus = "Sending your vote…";
  paint();
  const sent = await session.vote(optionPlayerId);
  if (!sent) pendingAction = undefined;
  localStatus = sent ? "Waiting for room confirmation…" : "Unable to vote. Check your connection and try again.";
  paint();
});

const game = defineSimpleGame<GameState, PlayerDurableState>({
  boot: connect,
  ready: connect,
  surfacesReady: connect,
  started: connect
});

connect(
  bootIframeGame(game, {
    context: {
      surfaceId: "controller",
      surfaceKind: "controller",
      participantId: "punch-up-controller",
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
