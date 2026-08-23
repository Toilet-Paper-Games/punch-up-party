import { expect, test } from "vitest";

import { defaultPromptSource } from "../content/prompts";
import { transition } from "../domain/engine";
import { FakeClock, PredictableIdGenerator, SeededRandom } from "../testing/fakes";
import { createSessionFixture } from "../testing/fixtures";
import { RuntimeMock } from "../testing/runtimeMock";
import { GameCoordinator, type CoordinatorIssue } from "./coordinator";

function setup(authority = true) {
  const runtime = new RuntimeMock();
  runtime.authority = authority;
  runtime.roster = Array.from({ length: 5 }, (_, index) => ({ id: `player-${index + 1}`, name: `Player ${index + 1}`, connected: true }));
  const clock = new FakeClock(1_000);
  const issues: CoordinatorIssue[] = [];
  const coordinator = new GameCoordinator(
    runtime,
    clock,
    { ids: new PredictableIdGenerator(), prompts: defaultPromptSource, random: new SeededRandom(42) },
    (issue) => issues.push(issue)
  );
  return { clock, coordinator, issues, runtime };
}

test("authority initializes exactly one deterministic session and advances it from the fake clock", async () => {
  const { clock, coordinator, runtime } = setup();
  coordinator.start();
  await coordinator.whenIdle();
  expect(runtime.sharedWrites).toHaveLength(1);
  expect(runtime.shared.value?.phase).toBe("instructions");

  coordinator.maybeInitialize();
  await coordinator.whenIdle();
  expect(runtime.sharedWrites).toHaveLength(1);

  clock.advanceBy(8_000);
  await coordinator.whenIdle();
  expect(runtime.shared.value?.phase).toBe("writing");
  coordinator.stop();
});

test("stale runtime revisions are recorded as explicit issues and do not overwrite canonical state", async () => {
  const { coordinator, issues, runtime } = setup();
  coordinator.start();
  await coordinator.whenIdle();
  const canonical = runtime.shared.value;
  runtime.rejections.push({ status: "rejected", revision: runtime.shared.revision, reason: "stale-revision", message: "Revision moved" });
  coordinator.receive({ type: "connection", intentId: "disconnect", now: 2_000, playerId: "player-5", connected: false });
  await coordinator.whenIdle();
  expect(runtime.shared.value).toBe(canonical);
  expect(issues).toContainEqual({ kind: "runtime-rejection", code: "stale-revision", message: "Revision moved" });
  coordinator.stop();
});

test("a non-authority controller durably records its own intent before broadcasting it", async () => {
  const { coordinator, runtime } = setup(false);
  const sent = await coordinator.sendPlayerIntent({
    type: "submit",
    intentId: "submission-1",
    now: 2_000,
    playerId: "player-1",
    answers: { "duel-01": "A very specific punchline." }
  });
  expect(sent).toBe(true);
  expect(runtime.playerWrites[0].state.lastIntent.intentId).toBe("submission-1");
  expect(runtime.messages[0]).toMatchObject({ type: "submit", playerId: "player-1" });
});

test("a controller that becomes authority resumes the confirmed room clock without reinitializing", async () => {
  const { clock, coordinator, runtime } = setup(false);
  const fixture = createSessionFixture({ playerCount: 5 });
  const initialized = transition(undefined, fixture.initialize);
  expect(initialized.ok).toBe(true);
  if (!initialized.ok) return;
  runtime.shared = { value: initialized.state, revision: 4 };
  coordinator.observeConfirmedState(initialized.state, 4);
  coordinator.start();

  runtime.authority = true;
  clock.advanceBy(initialized.state.durations.instructionsMs);
  await coordinator.whenIdle();

  expect(runtime.sharedWrites).toHaveLength(1);
  expect(runtime.sharedWrites[0].expectedRevision).toBe(4);
  expect(runtime.shared.value?.phase).toBe("writing");
  coordinator.stop();
});

test("dual durable and broadcast delivery is acknowledged without surfacing a player error", async () => {
  const { coordinator, issues, runtime } = setup(true);
  coordinator.start();
  await coordinator.whenIdle();
  const command = {
    type: "connection" as const,
    intentId: "same-delivery",
    now: 2_000,
    playerId: "player-5",
    connected: false
  };

  coordinator.receive(command);
  coordinator.receive(command);
  await coordinator.whenIdle();

  expect(runtime.sharedWrites).toHaveLength(2);
  expect(runtime.shared.value?.players["player-5"].connected).toBe(false);
  expect(issues).toEqual([]);
  coordinator.stop();
});

test("the authority replaces client timestamps before they can extend a phase deadline", async () => {
  const { clock, coordinator, runtime } = setup(true);
  coordinator.start();
  await coordinator.whenIdle();
  clock.advanceBy(8_000);
  await coordinator.whenIdle();
  const writing = runtime.shared.value;
  expect(writing?.phase).toBe("writing");
  if (!writing) return;

  for (const playerId of Object.keys(writing.players)) {
    const promptIds = writing.rounds[0].assignments[playerId];
    coordinator.receive({
      type: "submit",
      intentId: `hostile-time-${playerId}`,
      now: Number.MAX_SAFE_INTEGER,
      playerId,
      answers: Object.fromEntries(promptIds.map((promptId) => [promptId, `${playerId} answer`]))
    });
  }
  await coordinator.whenIdle();

  expect(runtime.shared.value?.phase).toBe("voting");
  expect(runtime.shared.value?.deadlineAt).toBe(clock.now() + 22_000);
  coordinator.stop();
});

test("rapid disconnect and reconnect converges to the latest roster", async () => {
  const { coordinator, runtime } = setup(true);
  coordinator.start();
  await coordinator.whenIdle();

  runtime.roster[4].connected = false;
  coordinator.syncConnections();
  runtime.roster[4].connected = true;
  coordinator.syncConnections();
  await coordinator.whenIdle();

  expect(runtime.shared.value?.players["player-5"].connected).toBe(true);
  coordinator.stop();
});

test("new authority replays the latest authenticated durable player intents", async () => {
  const { clock, coordinator, runtime } = setup(false);
  const fixture = createSessionFixture({ playerCount: 5 });
  const initialized = transition(undefined, fixture.initialize);
  if (!initialized.ok) throw new Error(initialized.message);
  const writing = transition(initialized.state, {
    type: "tick",
    intentId: "enter-writing",
    now: initialized.state.deadlineAt
  });
  if (!writing.ok) throw new Error(writing.message);
  runtime.shared = { value: writing.state, revision: 4 };
  coordinator.observeConfirmedState(writing.state, 4);
  const playerId = fixture.playerIds[0];
  runtime.durableIntents = [{
    type: "submit",
    intentId: "intent-observed-before-transfer",
    now: 123,
    playerId,
    answers: Object.fromEntries(
      writing.state.rounds[0].assignments[playerId].map((promptId) => [promptId, "Recovered after transfer"])
    )
  }];
  coordinator.start();

  runtime.authority = true;
  clock.advanceBy(500);
  await coordinator.whenIdle();

  expect(Object.values(runtime.shared.value?.submissions ?? {}).every((answers) => answers[playerId])).toBe(true);
  coordinator.stop();
});

test("accepted compatibility writes wait for their canonical subscription echo", async () => {
  const { coordinator, runtime } = setup(true);
  runtime.rejections.push({ status: "accepted" });
  coordinator.start();
  let settled = false;
  const pending = coordinator.whenIdle().then(() => {
    settled = true;
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(settled).toBe(false);
  const acceptedState = runtime.sharedWrites[0].state;
  runtime.shared = { value: acceptedState, revision: 1 };
  coordinator.observeConfirmedState(acceptedState, 1);
  await pending;
  expect(settled).toBe(true);
  coordinator.stop();
});
