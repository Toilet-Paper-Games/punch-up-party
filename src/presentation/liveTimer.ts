import type { GameState } from "../domain/types";

export function updateRenderedTimer(root: HTMLElement, state: GameState | undefined, now = Date.now()): void {
  const timer = root.querySelector<HTMLElement>(".timer");
  if (!state || !timer) return;
  const seconds = Math.max(0, Math.ceil((state.deadlineAt - now) / 1_000));
  timer.textContent = String(seconds);
  timer.setAttribute("aria-label", `${seconds} seconds remaining`);
}
