import { transition } from "../domain/engine";
import type { GamePhase, GameState } from "../domain/types";
import { createSessionFixture } from "./fixtures";

function requireState(result: ReturnType<typeof transition>): GameState {
  if (!result.ok) throw new Error(`${result.code}: ${result.message}`);
  return result.state;
}

export const playerFixtures = {
  minimum: createSessionFixture({ playerCount: 3 }),
  typical: createSessionFixture({ playerCount: 5 }),
  maximum: createSessionFixture({ playerCount: 8 })
};

function writingState(): GameState {
  const initialized = requireState(transition(undefined, playerFixtures.typical.initialize));
  return requireState(transition(initialized, {
    type: "tick",
    intentId: "scenario-writing",
    now: initialized.deadlineAt
  }));
}

function votingState(): GameState {
  let state = writingState();
  for (const playerId of playerFixtures.typical.playerIds) {
    const promptIds = state.rounds[state.roundIndex].assignments[playerId];
    state = requireState(transition(state, {
      type: "submit",
      intentId: `scenario-submit-${playerId}`,
      now: state.phaseStartedAt + 2_000,
      playerId,
      answers: Object.fromEntries(promptIds.map((promptId, index) => [promptId, [
        "I’ve replaced confidence with a subscription plan.",
        "Please clap before the warranty expires.",
        "Management says the moon is now bring-your-own.",
        "This meeting could have been a mysterious owl.",
        "My five-year plan is mostly snacks."
      ][(index + playerFixtures.typical.playerIds.indexOf(playerId)) % 5]]))
    }));
  }
  return state;
}

function resultsState(): GameState {
  let state = votingState();
  const matchup = state.matchups[state.currentMatchupIndex];
  const voters = playerFixtures.typical.playerIds.filter(
    (playerId) => !matchup.options.some((option) => option.playerId === playerId)
  );
  for (const voterId of voters) {
    state = requireState(transition(state, {
      type: "vote",
      intentId: `scenario-vote-${voterId}`,
      now: state.phaseStartedAt + 3_000,
      playerId: voterId,
      optionPlayerId: matchup.options[0].playerId
    }));
  }
  return state;
}

export function createScenarioState(phase: GamePhase): GameState {
  if (phase === "instructions") return requireState(transition(undefined, playerFixtures.typical.initialize));
  if (phase === "writing") return writingState();
  if (phase === "voting") return votingState();
  if (phase === "results") return resultsState();
  const base = resultsState();
  if (phase === "round-break") {
    return { ...base, phase, phaseStartedAt: 100_000, deadlineAt: 106_000 };
  }
  if (phase === "finale" || phase === "finale-voting" || phase === "finale-results") {
    const finaleBase: GameState = {
      ...base,
      phase: "finale",
      roundIndex: 2,
      submissions: {},
      matchups: [],
      currentMatchupIndex: 0,
      lastResult: undefined,
      phaseStartedAt: 120_000,
      deadlineAt: 175_000
    };
    if (phase === "finale") return finaleBase;
    const finalePrompt = finaleBase.rounds[2].prompts[0];
    const matchups = [{
      id: "finale-matchup",
      prompt: finalePrompt,
      options: playerFixtures.typical.playerIds.map((playerId, index) => ({
        playerId,
        text: ["We come in peace, but we did bring a group chat.", "Before we begin, who validates parking?", "Earth typing…", "Please ignore our previous planet.", "New phone, who dis?"][index]
      })),
      votes: {}
    }];
    const finaleVoting = { ...finaleBase, phase: "finale-voting" as const, matchups, deadlineAt: 142_000 };
    if (phase === "finale-voting") return finaleVoting;
    return {
      ...finaleVoting,
      phase: "finale-results",
      lastResult: {
        matchupId: "finale-matchup",
        prompt: finalePrompt,
        options: matchups[0].options.map((option, index) => ({ ...option, votes: index === 0 ? 4 : 0, points: index === 0 ? 1_450 : 0 })),
        winnerIds: [playerFixtures.typical.playerIds[0]],
        nailedIt: true
      },
      deadlineAt: 149_000
    };
  }
  const players = Object.fromEntries(Object.entries(base.players).map(([id, player], index) => [id, { ...player, score: 3_200 - index * 450 }]));
  return {
    ...base,
    phase: "game-over",
    players,
    winnerIds: [playerFixtures.typical.playerIds[0]],
    deadlineAt: Number.MAX_SAFE_INTEGER
  };
}

export function createSubmittedScenario(): GameState {
  const state = writingState();
  const playerId = playerFixtures.typical.playerIds[0];
  const promptIds = state.rounds[0].assignments[playerId];
  return requireState(transition(state, {
    type: "submit",
    intentId: "scenario-submitted-player",
    now: state.phaseStartedAt + 5_000,
    playerId,
    answers: Object.fromEntries(promptIds.map((promptId) => [promptId, "Please clap before the warranty expires."]))
  }));
}

export function createEightPlayerFinaleScenario(): GameState {
  const fixture = playerFixtures.maximum;
  const initialized = requireState(transition(undefined, fixture.initialize));
  const prompt = initialized.rounds[2].prompts[0];
  return {
    ...initialized,
    phase: "finale-voting",
    roundIndex: 2,
    phaseStartedAt: 200_000,
    deadlineAt: 222_000,
    submissions: {
      [prompt.id]: Object.fromEntries(fixture.playerIds.map((playerId, index) => [
        playerId,
        [
          "We come in peace, but we did bring a group chat.",
          "Before we begin, who validates parking?",
          "Earth typing… please hold.",
          "Please ignore our previous planet.",
          "New phone, who dis?",
          "Our atmosphere is business casual.",
          "We have snacks and several follow-up questions.",
          "Take us to your least awkward leader."
        ][index]
      ]))
    },
    matchups: [{
      id: "eight-player-finale",
      prompt,
      options: fixture.playerIds.map((playerId, index) => ({
        playerId,
        text: [
          "We come in peace, but we did bring a group chat.",
          "Before we begin, who validates parking?",
          "Earth typing… please hold.",
          "Please ignore our previous planet.",
          "New phone, who dis?",
          "Our atmosphere is business casual.",
          "We have snacks and several follow-up questions.",
          "Take us to your least awkward leader."
        ][index]
      })),
      votes: {}
    }],
    currentMatchupIndex: 0,
    lastResult: undefined
  };
}

export function createEightPlayerFinaleResultsScenario(): GameState {
  const state = createEightPlayerFinaleScenario();
  const matchup = state.matchups[0];
  const winnerId = matchup.options[0].playerId;
  return {
    ...state,
    phase: "finale-results",
    deadlineAt: 229_000,
    lastResult: {
      matchupId: matchup.id,
      prompt: matchup.prompt,
      options: matchup.options.map((option, index) => ({
        ...option,
        votes: index === 0 ? 7 : index === 1 ? 1 : 0,
        points: index === 0 ? 2_350 : index === 1 ? 300 : 0
      })),
      winnerIds: [winnerId],
      nailedIt: true
    }
  };
}

export function createEightPlayerLongFinaleScenario(): GameState {
  const state = createEightPlayerFinaleScenario();
  const answers = state.matchups[0].options.map((_, index) =>
    `${index + 1}. ${"A legal maximum-length punchline with notes in the margin, red ink, and one last extremely specific rewrite. ".repeat(2)}`.slice(0, 120)
  );
  const promptId = state.matchups[0].prompt.id;
  return {
    ...state,
    submissions: {
      [promptId]: Object.fromEntries(state.matchups[0].options.map((option, index) => [option.playerId, answers[index]]))
    },
    matchups: [{
      ...state.matchups[0],
      options: state.matchups[0].options.map((option, index) => ({ ...option, text: answers[index] }))
    }]
  };
}

export function createLongContentVotingScenario(): GameState {
  const state = createScenarioState("voting");
  const matchup = state.matchups[state.currentMatchupIndex];
  const prompt = {
    ...matchup.prompt,
    text: "The least reassuring announcement during a luxury submarine’s mandatory emergency orientation:"
  };
  const answers = [
    "Good news: the mysterious tapping is now keeping a steady rhythm, and management has upgraded it to live entertainment.",
    "Please remain calm while we decide whether the ocean is technically supposed to be entering through that particular door."
  ];
  return {
    ...state,
    matchups: state.matchups.map((candidate, index) => index === state.currentMatchupIndex
      ? { ...candidate, prompt, options: candidate.options.map((option, optionIndex) => ({ ...option, text: answers[optionIndex] })) }
      : candidate)
  };
}
