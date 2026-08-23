import type {
  GameCommand,
  GameErrorCode,
  GameState,
  Matchup,
  MatchupResult,
  PlayerId,
  PromptId,
  RoundDefinition,
  TransitionResult
} from "./types";

const MAX_ANSWER_LENGTH = 120;
const MAX_PROCESSED_INTENTS = 128;

function fail(code: GameErrorCode, message: string, state?: GameState): TransitionResult {
  return { ok: false, code, message, state };
}

function rememberIntent(state: GameState, intentId: string): GameState {
  return {
    ...state,
    processedIntentIds: [...state.processedIntentIds, intentId].slice(-MAX_PROCESSED_INTENTS)
  };
}

function currentRound(state: GameState): RoundDefinition {
  const round = state.rounds[state.roundIndex];
  if (!round) {
    throw new Error(`Missing round definition at index ${state.roundIndex}.`);
  }
  return round;
}

function startRound(state: GameState, now: number): GameState {
  const round = currentRound(state);
  const isFinale = round.kind === "finale";
  return {
    ...state,
    phase: isFinale ? "finale" : "writing",
    phaseStartedAt: now,
    deadlineAt: now + (isFinale ? state.durations.finaleWritingMs : state.durations.writingMs),
    submissions: {},
    matchups: [],
    currentMatchupIndex: 0,
    lastResult: undefined
  };
}

function buildMatchups(state: GameState): Matchup[] {
  const round = currentRound(state);
  return round.prompts.flatMap((prompt, promptIndex) => {
    const options = Object.entries(state.submissions[prompt.id] ?? {}).map(([playerId, text]) => ({
      playerId,
      text
    }));
    if (options.length < 2) {
      return [];
    }
    return [
      {
        id: `${round.id}-matchup-${promptIndex + 1}`,
        prompt,
        options,
        votes: {}
      }
    ];
  });
}

function allAssignedAnswersSubmitted(state: GameState): boolean {
  const round = currentRound(state);
  return Object.entries(round.assignments).every(([playerId, promptIds]) =>
    promptIds.every((promptId) => Boolean(state.submissions[promptId]?.[playerId]))
  );
}

function beginVoting(state: GameState, now: number): GameState {
  const matchups = buildMatchups(state);
  if (matchups.length === 0) {
    return finishRound(state, now);
  }
  const finale = currentRound(state).kind === "finale";
  const votingDuration = finale
    ? Math.max(state.durations.votingMs, Object.keys(state.players).length >= 6 ? 35_000 : 30_000)
    : state.durations.votingMs;
  return {
    ...state,
    phase: finale ? "finale-voting" : "voting",
    phaseStartedAt: now,
    deadlineAt: now + votingDuration,
    matchups,
    currentMatchupIndex: 0,
    lastResult: undefined
  };
}

function eligibleVoterIds(state: GameState, matchup: Matchup): PlayerId[] {
  const authorIds = new Set(matchup.options.map((option) => option.playerId));
  const finale = currentRound(state).kind === "finale";
  return Object.values(state.players)
    .filter((player) => player.connected && (finale || !authorIds.has(player.id)))
    .map((player) => player.id);
}

function scoreCurrentMatchup(state: GameState, now: number): GameState {
  const matchup = state.matchups[state.currentMatchupIndex];
  if (!matchup) {
    return finishRound(state, now);
  }
  const round = currentRound(state);
  const voteCounts = Object.values(matchup.votes).reduce<Record<PlayerId, number>>((counts, playerId) => {
    counts[playerId] = (counts[playerId] ?? 0) + 1;
    return counts;
  }, {});
  const highestVoteCount = Math.max(0, ...matchup.options.map((option) => voteCounts[option.playerId] ?? 0));
  const winnerIds = matchup.options
    .filter((option) => (voteCounts[option.playerId] ?? 0) === highestVoteCount && highestVoteCount > 0)
    .map((option) => option.playerId);
  const unanimousVoterCount = winnerIds.length === 1
    ? eligibleVoterIds(state, matchup).filter((playerId) => round.kind !== "finale" || playerId !== winnerIds[0]).length
    : 0;
  const nailedIt =
    winnerIds.length === 1 && unanimousVoterCount >= 2 && highestVoteCount === unanimousVoterCount;
  const players = { ...state.players };
  const resultOptions = matchup.options.map((option) => {
    const votes = voteCounts[option.playerId] ?? 0;
    const bonus = nailedIt && winnerIds[0] === option.playerId ? 250 * round.multiplier : 0;
    const points = votes * 100 * round.multiplier + bonus;
    players[option.playerId] = {
      ...players[option.playerId],
      score: players[option.playerId].score + points
    };
    return { ...option, votes, points };
  });
  const lastResult: MatchupResult = {
    matchupId: matchup.id,
    prompt: matchup.prompt,
    options: resultOptions,
    winnerIds,
    nailedIt
  };
  return {
    ...state,
    players,
    phase: round.kind === "finale" ? "finale-results" : "results",
    phaseStartedAt: now,
    deadlineAt: now + state.durations.resultsMs,
    lastResult
  };
}

function finishRound(state: GameState, now: number): GameState {
  if (state.roundIndex >= state.rounds.length - 1) {
    const topScore = Math.max(...Object.values(state.players).map((player) => player.score));
    return {
      ...state,
      phase: "game-over",
      phaseStartedAt: now,
      deadlineAt: Number.MAX_SAFE_INTEGER,
      winnerIds: Object.values(state.players)
        .filter((player) => player.score === topScore)
        .map((player) => player.id)
    };
  }
  return {
    ...state,
    phase: "round-break",
    phaseStartedAt: now,
    deadlineAt: now + state.durations.roundBreakMs
  };
}

function initialize(command: Extract<GameCommand, { type: "initialize" }>): TransitionResult {
  if (command.players.length < 3 || command.players.length > 8) {
    return fail("invalid-player-count", "Punch Up! requires 3–8 controller players.");
  }
  const players = Object.fromEntries(
    command.players.map((player) => [player.id, { ...player, score: 0 }])
  );
  return {
    ok: true,
    state: {
      schemaVersion: 1,
      sessionId: command.sessionId,
      phase: "instructions",
      phaseStartedAt: command.now,
      deadlineAt: command.now + command.durations.instructionsMs,
      players,
      rounds: command.rounds,
      roundIndex: 0,
      submissions: {},
      matchups: [],
      currentMatchupIndex: 0,
      processedIntentIds: [command.intentId],
      durations: command.durations,
      winnerIds: []
    }
  };
}

function submit(state: GameState, command: Extract<GameCommand, { type: "submit" }>): TransitionResult {
  if (state.phase !== "writing" && state.phase !== "finale") {
    return fail("invalid-phase", "Answers can only be submitted during writing.", state);
  }
  if (command.now >= state.deadlineAt) {
    return fail("invalid-phase", "Writing time is over.", state);
  }
  if (!state.players[command.playerId]) {
    return fail("not-in-session", "This controller is not part of the active session.", state);
  }
  const assignedPromptIds = currentRound(state).assignments[command.playerId] ?? [];
  const entries = Object.entries(command.answers);
  if (entries.length === 0) {
    return fail("invalid-answer", "Submit at least one punchline.", state);
  }
  const newEntries: Array<[PromptId, string]> = [];
  for (const [promptId, answer] of entries) {
    if (!assignedPromptIds.includes(promptId)) {
      return fail("not-assigned", "This prompt is not assigned to this player.", state);
    }
    const normalized = answer.trim();
    if (!normalized || normalized.length > MAX_ANSWER_LENGTH) {
      return fail("invalid-answer", `Punchlines must be 1–${MAX_ANSWER_LENGTH} characters.`, state);
    }
    const existing = state.submissions[promptId]?.[command.playerId];
    if (existing) {
      if (existing !== normalized) {
        return fail("duplicate-submission", "That punchline was already submitted.", state);
      }
      continue;
    }
    newEntries.push([promptId, normalized]);
  }
  if (newEntries.length === 0) {
    return fail("duplicate-submission", "Those punchlines were already submitted.", state);
  }

  const submissions = { ...state.submissions };
  for (const [promptId, answer] of newEntries) {
    submissions[promptId] = {
      ...(submissions[promptId] ?? {}),
      [command.playerId]: answer
    };
  }
  let next = rememberIntent({ ...state, submissions }, command.intentId);
  if (allAssignedAnswersSubmitted(next)) {
    next = beginVoting(next, command.now);
  }
  return { ok: true, state: next };
}

function vote(state: GameState, command: Extract<GameCommand, { type: "vote" }>): TransitionResult {
  if (state.phase !== "voting" && state.phase !== "finale-voting") {
    return fail("invalid-phase", "Votes can only be cast during voting.", state);
  }
  if (command.now >= state.deadlineAt) {
    return fail("invalid-phase", "Voting time is over.", state);
  }
  const player = state.players[command.playerId];
  if (!player) {
    return fail("not-in-session", "This controller is not part of the active session.", state);
  }
  if (!player.connected) {
    return fail("not-connected", "Reconnect before voting.", state);
  }
  const matchup = state.matchups[state.currentMatchupIndex];
  if (!matchup?.options.some((option) => option.playerId === command.optionPlayerId)) {
    return fail("unknown-option", "Choose one of the visible punchlines.", state);
  }
  const finale = currentRound(state).kind === "finale";
  const isSelfVote = finale
    ? command.optionPlayerId === command.playerId
    : matchup.options.some((option) => option.playerId === command.playerId);
  if (isSelfVote) {
    return fail("self-vote", "Writers cannot vote in their own matchup.", state);
  }
  if (matchup.votes[command.playerId]) {
    return fail("duplicate-vote", "Your vote is already recorded.", state);
  }
  const matchups = state.matchups.map((candidate, index) =>
    index === state.currentMatchupIndex
      ? { ...candidate, votes: { ...candidate.votes, [command.playerId]: command.optionPlayerId } }
      : candidate
  );
  let next = rememberIntent({ ...state, matchups }, command.intentId);
  const updatedMatchup = next.matchups[next.currentMatchupIndex];
  if (eligibleVoterIds(next, updatedMatchup).every((playerId) => Boolean(updatedMatchup.votes[playerId]))) {
    next = scoreCurrentMatchup(next, command.now);
  }
  return { ok: true, state: next };
}

function tick(state: GameState, command: Extract<GameCommand, { type: "tick" }>): TransitionResult {
  let next = rememberIntent(state, command.intentId);
  if (command.now < state.deadlineAt || state.phase === "game-over") {
    return { ok: true, state: next };
  }
  if (state.phase === "instructions") {
    next = startRound(next, command.now);
  } else if (state.phase === "writing" || state.phase === "finale") {
    next = beginVoting(next, command.now);
  } else if (state.phase === "voting" || state.phase === "finale-voting") {
    next = scoreCurrentMatchup(next, command.now);
  } else if (state.phase === "results" || state.phase === "finale-results") {
    if (state.currentMatchupIndex < state.matchups.length - 1) {
      next = {
        ...next,
        phase: currentRound(next).kind === "finale" ? "finale-voting" : "voting",
        phaseStartedAt: command.now,
        deadlineAt: command.now + state.durations.votingMs,
        currentMatchupIndex: state.currentMatchupIndex + 1,
        lastResult: undefined
      };
    } else {
      next = finishRound(next, command.now);
    }
  } else if (state.phase === "round-break") {
    next = startRound({ ...next, roundIndex: next.roundIndex + 1 }, command.now);
  }
  return { ok: true, state: next };
}

function connection(
  state: GameState,
  command: Extract<GameCommand, { type: "connection" }>
): TransitionResult {
  const player = state.players[command.playerId];
  if (!player) {
    return fail("not-in-session", "This controller is not part of the active session.", state);
  }
  return {
    ok: true,
    state: rememberIntent(
      {
        ...state,
        players: {
          ...state.players,
          [command.playerId]: { ...player, connected: command.connected }
        }
      },
      command.intentId
    )
  };
}

export function transition(state: GameState | undefined, command: GameCommand): TransitionResult {
  if (command.type === "initialize") {
    return state ? fail("already-initialized", "The session is already initialized.", state) : initialize(command);
  }
  if (!state) {
    return fail("not-in-session", "Initialize the session before applying gameplay commands.");
  }
  if (state.processedIntentIds.includes(command.intentId)) {
    return fail("duplicate-intent", "This intent was already applied.", state);
  }
  if (command.type === "submit") return submit(state, command);
  if (command.type === "vote") return vote(state, command);
  if (command.type === "tick") return tick(state, command);
  return connection(state, command);
}

export function promptIdsForPlayer(state: GameState, playerId: PlayerId): PromptId[] {
  return currentRound(state).assignments[playerId] ?? [];
}
