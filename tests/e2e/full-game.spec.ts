import { expect, test, type Frame, type Page } from "@playwright/test";

interface InspectorState {
  phase: string;
  roundIndex: number;
  submissions: Record<string, Record<string, string>>;
  matchups: Array<{
    id: string;
    options: Array<{ playerId: string }>;
    votes: Record<string, string>;
  }>;
  currentMatchupIndex: number;
  players: Record<string, { score: number }>;
  winnerIds: string[];
}

async function readInspectorState(page: Page): Promise<InspectorState | undefined> {
  const text = await page.getByRole("tabpanel", { name: "Shared state" }).textContent();
  if (!text) return undefined;
  const parsed = JSON.parse(text) as { value?: InspectorState };
  return parsed.value;
}

async function waitForState(page: Page): Promise<InspectorState> {
  let state: InspectorState | undefined;
  await expect.poll(async () => {
    state = await readInspectorState(page);
    return state?.phase;
  }).not.toBeUndefined();
  if (!state) throw new Error("The workbench never exposed confirmed shared state.");
  return state;
}

function controllerFrames(page: Page): Frame[] {
  return page.frames().filter((frame) => frame.url().includes("/surfaces/controller.html"));
}

function hostFrame(page: Page): Frame {
  const frame = page.frames().find((candidate) => candidate.url().includes("/surfaces/host.html"));
  if (!frame) throw new Error("The host surface did not mount.");
  return frame;
}

test("five named controllers complete the game through reconnect and authority transfer", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/__tpg/workbench");
  await expect(page.getByRole("heading", { name: "Punch Up!" })).toBeVisible();
  const scenarioControls = page.getByRole("complementary", { name: "Scenario controls" });
  await scenarioControls.getByRole("combobox", { name: "Preset" }).selectOption({ label: "Local — instant" });
  await scenarioControls.getByRole("button", { name: "Apply network profile" }).click();
  await expect.poll(() => controllerFrames(page).length).toBe(5);
  await expect(hostFrame(page).locator("button, input, textarea, select, a[href], [tabindex]:not([tabindex='-1'])")).toHaveCount(0);

  const visited = new Set<string>();
  let exercisedReconnect = false;
  let transferredAuthority = false;
  const startedAt = Date.now();

  while (Date.now() - startedAt < 440_000) {
    const state = await waitForState(page);
    visited.add(state.phase);
    if (state.phase === "game-over") {
      expect(state.winnerIds.length).toBeGreaterThan(0);
      expect(Math.max(...Object.values(state.players).map((player) => player.score))).toBeGreaterThan(0);
      break;
    }

    if (state.phase === "writing" || state.phase === "finale") {
      const frames = controllerFrames(page);
      for (const [playerIndex, frame] of frames.entries()) {
        const textboxes = frame.locator("textarea");
        const count = await textboxes.count();
        for (let answerIndex = 0; answerIndex < count; answerIndex += 1) {
          await textboxes.nth(answerIndex).fill(
            [
              "The Wi-Fi password is also a cry for help.",
              "Please return the moon by Tuesday.",
              "Trash panda, rich mindset.",
              "Believe in yourself, but quietly.",
              "This plane is mostly vibes."
            ][playerIndex] + ` Draft ${state.roundIndex + 1}.${answerIndex + 1}`
          );
        }
        const submit = frame.getByRole("button", { name: "Submit punchlines" });
        if (await submit.count()) {
          await submit.click();
          await page.waitForTimeout(120);
        }

        if (!exercisedReconnect && playerIndex === 0) {
          const controls = page.getByRole("complementary", { name: "Scenario controls" });
          const avery = controls.getByRole("article").filter({ hasText: "Avery" });
          await avery.getByRole("button", { name: "Disconnect" }).click();
          await page.waitForTimeout(250);
          const reconnect = avery.getByRole("button", { name: "Reconnect" });
          if (await reconnect.isVisible()) await reconnect.click();
          await expect.poll(async () => (await readInspectorState(page))?.players.avery.connected).toBe(true);
          await expect(frame.getByRole("heading", { name: "Your pages are in." })).toBeVisible();
          exercisedReconnect = true;
        }
      }
      continue;
    }

    if (state.phase === "voting" || state.phase === "finale-voting") {
      const matchup = state.matchups[state.currentMatchupIndex];
      if (matchup) {
        const authorIds = new Set(matchup.options.map((option) => option.playerId));
        for (const frame of controllerFrames(page)) {
          const playerId = new URL(frame.url()).hash.match(/participantId=([^&]+)/)?.[1];
          if (!playerId || matchup.votes[playerId]) continue;
          const eligible = state.phase === "finale-voting" || !authorIds.has(playerId);
          if (!eligible) continue;
          const options = frame.locator("button.vote-option");
          if (await options.count()) await options.first().click();
        }
      }
    }

    if (!transferredAuthority && state.phase === "results") {
      const controls = page.getByRole("complementary", { name: "Scenario controls" });
      const avery = controls.getByRole("article").filter({ hasText: "Avery" });
      await avery.getByRole("button", { name: "Make authority" }).click();
      transferredAuthority = true;
    }

    await page.waitForTimeout(200);
  }

  const finalState = await waitForState(page);
  expect(finalState.phase).toBe("game-over");
  expect(exercisedReconnect).toBe(true);
  expect(transferredAuthority).toBe(true);
  expect([...visited]).toEqual(expect.arrayContaining([
    "instructions",
    "writing",
    "voting",
    "results",
    "round-break",
    "finale",
    "finale-voting",
    "finale-results",
    "game-over"
  ]));
  await expect(hostFrame(page).locator("button, input, textarea, select, a[href], [tabindex]:not([tabindex='-1'])")).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});
