import { expect, test } from "vitest";

import { transition } from "./engine";
import { createSessionFixture } from "../testing/fixtures";
import { createScenarioState, playerFixtures } from "../testing/stateFactories";

test("a full duel accepts assigned answers, blocks self-votes, then scores the winner", () => {
  const fixture = createSessionFixture({ playerCount: 3 });
  const initialized = transition(undefined, fixture.initialize);
  expect(initialized.ok).toBe(true);
  if (!initialized.ok) return;

  const writing = transition(initialized.state, {
    type: "tick",
    intentId: "tick-writing",
    now: initialized.state.deadlineAt
  });
  expect(writing.ok && writing.state.phase).toBe("writing");
  if (!writing.ok) return;

  let state = writing.state;
  for (const [index, playerId] of fixture.playerIds.entries()) {
    const promptIds = state.rounds[0].assignments[playerId];
    const submitted = transition(state, {
      type: "submit",
      intentId: `submit-${playerId}`,
      now: state.phaseStartedAt + index,
      playerId,
      answers: Object.fromEntries(promptIds.map((promptId) => [promptId, `${playerId} punchline for ${promptId}`]))
    });
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;
    state = submitted.state;
  }

  expect(state.phase).toBe("voting");
  const matchup = state.matchups[0];
  const authorId = matchup.options[0].playerId;
  const selfVote = transition(state, {
    type: "vote",
    intentId: "self-vote",
    now: state.phaseStartedAt,
    playerId: authorId,
    optionPlayerId: authorId
  });
  expect(selfVote).toMatchObject({ ok: false, code: "self-vote" });

  const voterId = fixture.playerIds.find((playerId) => !matchup.options.some((option) => option.playerId === playerId));
  expect(voterId).toBeDefined();
  if (!voterId) return;
  const voted = transition(state, {
    type: "vote",
    intentId: "valid-vote",
    now: state.phaseStartedAt + 1,
    playerId: voterId,
    optionPlayerId: matchup.options[1].playerId
  });
  expect(voted.ok && voted.state.phase).toBe("results");
  if (!voted.ok) return;
  expect(voted.state.lastResult?.winnerIds).toEqual([matchup.options[1].playerId]);
  expect(voted.state.lastResult?.nailedIt).toBe(false);
  expect(voted.state.players[matchup.options[1].playerId].score).toBeGreaterThan(0);

});

test("a player cannot submit a second answer for the same assigned prompt", () => {
  const fixture = createSessionFixture({ playerCount: 5 });
  const initialized = transition(undefined, fixture.initialize);
  expect(initialized.ok).toBe(true);
  if (!initialized.ok) return;
  const writing = transition(initialized.state, {
    type: "tick",
    intentId: "tick-writing",
    now: initialized.state.deadlineAt
  });
  expect(writing.ok).toBe(true);
  if (!writing.ok) return;

  const playerId = fixture.playerIds[0];
  const promptId = writing.state.rounds[0].assignments[playerId][0];
  const first = transition(writing.state, {
    type: "submit",
    intentId: "first-answer",
    now: writing.state.phaseStartedAt,
    playerId,
    answers: { [promptId]: "The first draft." }
  });
  expect(first.ok).toBe(true);
  if (!first.ok) return;

  expect(
    transition(first.state, {
      type: "submit",
      intentId: "second-answer",
      now: first.state.phaseStartedAt + 1,
      playerId,
      answers: { [promptId]: "A sneaky rewrite." }
    })
  ).toMatchObject({ ok: false, code: "duplicate-submission" });
});

test("a reconnecting partial writer may send unchanged confirmed text with one new answer", () => {
  const fixture = createSessionFixture({ playerCount: 5 });
  const initialized = transition(undefined, fixture.initialize);
  if (!initialized.ok) throw new Error(initialized.message);
  const writing = transition(initialized.state, {
    type: "tick",
    intentId: "tick-writing",
    now: initialized.state.deadlineAt
  });
  if (!writing.ok) throw new Error(writing.message);
  const playerId = fixture.playerIds[0];
  const [firstPromptId, secondPromptId] = writing.state.rounds[0].assignments[playerId];
  const partial = transition(writing.state, {
    type: "submit",
    intentId: "partial-answer",
    now: writing.state.phaseStartedAt,
    playerId,
    answers: { [firstPromptId]: "Already confirmed." }
  });
  if (!partial.ok) throw new Error(partial.message);

  const completed = transition(partial.state, {
    type: "submit",
    intentId: "complete-after-reconnect",
    now: partial.state.phaseStartedAt + 1,
    playerId,
    answers: {
      [firstPromptId]: "Already confirmed.",
      [secondPromptId]: "The recovered second line."
    }
  });

  expect(completed.ok).toBe(true);
  if (!completed.ok) return;
  expect(completed.state.submissions[secondPromptId][playerId]).toBe("The recovered second line.");
});

test("unknown and disconnected controllers cannot vote", () => {
  const voting = createScenarioState("voting");
  const matchup = voting.matchups[voting.currentMatchupIndex];
  const eligible = playerFixtures.typical.playerIds.find(
    (playerId) => !matchup.options.some((option) => option.playerId === playerId)
  );
  expect(eligible).toBeDefined();
  if (!eligible) return;

  expect(transition(voting, {
    type: "vote",
    intentId: "unknown-voter",
    now: voting.phaseStartedAt,
    playerId: "intruder",
    optionPlayerId: matchup.options[0].playerId
  })).toMatchObject({ ok: false, code: "not-in-session" });

  const disconnected = transition(voting, {
    type: "connection",
    intentId: "disconnect-voter",
    now: voting.phaseStartedAt,
    playerId: eligible,
    connected: false
  });
  if (!disconnected.ok) throw new Error(disconnected.message);
  expect(transition(disconnected.state, {
    type: "vote",
    intentId: "disconnected-voter",
    now: voting.phaseStartedAt,
    playerId: eligible,
    optionPlayerId: matchup.options[0].playerId
  })).toMatchObject({ ok: false, code: "not-connected" });
});

test("the finale awards Nailed It when a line receives every vote it is allowed to receive", () => {
  let state = createScenarioState("finale-voting");
  const matchup = state.matchups[0];
  const winnerId = matchup.options[0].playerId;
  for (const playerId of playerFixtures.typical.playerIds) {
    const choice = playerId === winnerId ? matchup.options[1].playerId : winnerId;
    const voted = transition(state, {
      type: "vote",
      intentId: `finale-unanimous-${playerId}`,
      now: state.phaseStartedAt,
      playerId,
      optionPlayerId: choice
    });
    expect(voted.ok).toBe(true);
    if (!voted.ok) return;
    state = voted.state;
  }

  expect(state.phase).toBe("finale-results");
  expect(state.lastResult).toMatchObject({ winnerIds: [winnerId], nailedIt: true });
});

test.each([3, 5, 8] as const)("a complete %i-player game reaches the finale and declares top billing", (playerCount) => {
  const fixture = createSessionFixture({ playerCount });
  const initialized = transition(undefined, fixture.initialize);
  expect(initialized.ok).toBe(true);
  if (!initialized.ok) return;

  let state = initialized.state;
  let sequence = 0;
  for (let guard = 0; guard < 100 && state.phase !== "game-over"; guard += 1) {
    if (state.phase === "instructions" || state.phase === "round-break" || state.phase === "results" || state.phase === "finale-results") {
      const advanced = transition(state, {
        type: "tick",
        intentId: `advance-${sequence++}`,
        now: state.deadlineAt
      });
      expect(advanced.ok).toBe(true);
      if (!advanced.ok) return;
      state = advanced.state;
      continue;
    }

    if (state.phase === "writing" || state.phase === "finale") {
      const round = state.rounds[state.roundIndex];
      for (const playerId of fixture.playerIds) {
        const submitted = transition(state, {
          type: "submit",
          intentId: `answer-${sequence++}`,
          now: state.phaseStartedAt + sequence,
          playerId,
          answers: Object.fromEntries(
            round.assignments[playerId].map((promptId) => [promptId, `${playerId} makes ${promptId} funny`])
          )
        });
        expect(submitted.ok).toBe(true);
        if (!submitted.ok) return;
        state = submitted.state;
      }
      continue;
    }

    if (state.phase === "voting" || state.phase === "finale-voting") {
      const matchup = state.matchups[state.currentMatchupIndex];
      const authorIds = new Set(matchup.options.map((option) => option.playerId));
      const eligibleVoters = fixture.playerIds.filter((playerId) => state.phase === "finale-voting" || !authorIds.has(playerId));
      for (const playerId of eligibleVoters) {
        const choice = matchup.options.find((option) => option.playerId !== playerId);
        expect(choice).toBeDefined();
        if (!choice) return;
        const voted = transition(state, {
          type: "vote",
          intentId: `vote-${sequence++}`,
          now: state.phaseStartedAt + sequence,
          playerId,
          optionPlayerId: choice.playerId
        });
        expect(voted.ok).toBe(true);
        if (!voted.ok) return;
        state = voted.state;
      }
    }
  }

  expect(state.phase).toBe("game-over");
  expect(state.winnerIds.length).toBeGreaterThan(0);
  expect(Math.max(...Object.values(state.players).map((player) => player.score))).toBeGreaterThan(0);
});

test("answers and votes arriving at or after the authority deadline are rejected", () => {
  const writing = createScenarioState("writing");
  const writerId = playerFixtures.typical.playerIds[0];
  const promptId = writing.rounds[writing.roundIndex].assignments[writerId][0];
  expect(transition(writing, {
    type: "submit",
    intentId: "late-answer",
    now: writing.deadlineAt,
    playerId: writerId,
    answers: { [promptId]: "Technically sent, practically late." }
  })).toMatchObject({ ok: false, code: "invalid-phase" });

  const voting = createScenarioState("voting");
  const matchup = voting.matchups[voting.currentMatchupIndex];
  const voterId = playerFixtures.typical.playerIds.find(
    (playerId) => !matchup.options.some((option) => option.playerId === playerId)
  );
  expect(voterId).toBeDefined();
  if (!voterId) return;
  expect(transition(voting, {
    type: "vote",
    intentId: "late-vote",
    now: voting.deadlineAt,
    playerId: voterId,
    optionPlayerId: matchup.options[0].playerId
  })).toMatchObject({ ok: false, code: "invalid-phase" });
});

test("stale duplicate intents, disconnected voters, and reconnects converge without replaying a mutation", () => {
  const fixture = createSessionFixture({ playerCount: 5 });
  const initialized = transition(undefined, fixture.initialize);
  expect(initialized.ok).toBe(true);
  if (!initialized.ok) return;

  const disconnected = transition(initialized.state, {
    type: "connection",
    intentId: "connection-1",
    now: 10,
    playerId: fixture.playerIds[4],
    connected: false
  });
  expect(disconnected.ok && disconnected.state.players[fixture.playerIds[4]].connected).toBe(false);
  if (!disconnected.ok) return;

  const duplicate = transition(disconnected.state, {
    type: "connection",
    intentId: "connection-1",
    now: 11,
    playerId: fixture.playerIds[4],
    connected: true
  });
  expect(duplicate).toMatchObject({ ok: false, code: "duplicate-intent" });

  const reconnected = transition(disconnected.state, {
    type: "connection",
    intentId: "connection-2",
    now: 12,
    playerId: fixture.playerIds[4],
    connected: true
  });
  expect(reconnected.ok && reconnected.state.players[fixture.playerIds[4]].connected).toBe(true);
});
