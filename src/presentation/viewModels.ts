import type { GameState, MatchupResult, Player, Prompt } from "../domain/types";
import type { PlayerDurableState } from "../ports";

export interface ScoreViewModel {
  id: string;
  name: string;
  score: number;
  connected: boolean;
  winner: boolean;
}

export interface AnswerViewModel {
  playerId: string;
  text: string;
  authorName?: string;
  votes?: number;
  points?: number;
  winner?: boolean;
}

export interface HostViewModel {
  scene: "waiting" | "instructions" | "writing" | "voting" | "results" | "break" | "finale" | "game-over";
  roundLabel: string;
  title: string;
  instruction: string;
  timerSeconds?: number;
  progress?: string;
  prompt?: Prompt;
  answers: AnswerViewModel[];
  result?: MatchupResult;
  scores: ScoreViewModel[];
  stamp?: string;
}

export interface ControllerViewModel {
  scene: "waiting" | "instructions" | "writing" | "submitted" | "voting" | "results" | "break" | "game-over";
  playerName: string;
  roundLabel: string;
  title: string;
  instruction: string;
  timerSeconds?: number;
  prompts: Prompt[];
  answers: AnswerViewModel[];
  submittedAnswers: Record<string, string>;
  scores: ScoreViewModel[];
  issue?: string;
  canVote: boolean;
  hasVoted: boolean;
}

function scores(state: GameState): ScoreViewModel[] {
  return Object.values(state.players)
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name))
    .map((player) => ({
      id: player.id,
      name: player.name,
      score: player.score,
      connected: player.connected,
      winner: state.winnerIds.includes(player.id)
    }));
}

function secondsLeft(deadlineAt: number, now: number): number {
  return Math.max(0, Math.ceil((deadlineAt - now) / 1000));
}

function roundLabel(state: GameState): string {
  const round = state.rounds[state.roundIndex];
  return round.kind === "finale" ? "The big punch" : `Round ${round.number} · ${round.number === 1 ? "First draft" : "Rewrite"}`;
}

function playerName(state: GameState, playerId: string): string {
  return state.players[playerId]?.name ?? "Writer";
}

function submittedCount(state: GameState): number {
  const round = state.rounds[state.roundIndex];
  return Object.entries(round.assignments).filter(([playerId, promptIds]) =>
    promptIds.every((promptId) => Boolean(state.submissions[promptId]?.[playerId]))
  ).length;
}

function currentAnswers(state: GameState, revealAuthors: boolean): AnswerViewModel[] {
  const matchup = state.matchups[state.currentMatchupIndex];
  if (!matchup) return [];
  const resultByPlayer = new Map(state.lastResult?.options.map((option) => [option.playerId, option]));
  return matchup.options.map((option) => {
    const result = resultByPlayer.get(option.playerId);
    return {
      playerId: option.playerId,
      text: option.text,
      authorName: revealAuthors ? playerName(state, option.playerId) : undefined,
      votes: result?.votes,
      points: result?.points,
      winner: state.lastResult?.winnerIds.includes(option.playerId)
    };
  });
}

export function createHostViewModel(state: GameState | undefined, now = Date.now()): HostViewModel {
  if (!state) {
    return {
      scene: "waiting",
      roundLabel: "Punch Up!",
      title: "Writers, take your places.",
      instruction: "The first page appears when 3–8 controllers are connected.",
      answers: [],
      scores: []
    };
  }
  const base = {
    roundLabel: roundLabel(state),
    timerSeconds: secondsLeft(state.deadlineAt, now),
    scores: scores(state)
  };
  if (state.phase === "instructions") {
    return {
      ...base,
      scene: "instructions",
      title: "Write the line. Win the room.",
      instruction: "Finish two comedy setups on your phone. Then vote for the punchline that stays in the script.",
      answers: []
    };
  }
  if (state.phase === "writing" || state.phase === "finale") {
    const complete = submittedCount(state);
    return {
      ...base,
      scene: state.phase === "finale" ? "finale" : "writing",
      title: state.phase === "finale" ? "One last line." : "The room is writing.",
      instruction: state.phase === "finale" ? "Everyone has the same setup. Make this one count." : "Your assignments are waiting on your controller.",
      progress: `${complete} of ${Object.keys(state.players).length} writers finished`,
      answers: []
    };
  }
  if (state.phase === "voting" || state.phase === "finale-voting") {
    const matchup = state.matchups[state.currentMatchupIndex];
    const finale = state.phase === "finale-voting";
    return {
      ...base,
      scene: "voting",
      title: "Which line stays?",
      instruction: finale
        ? "Every writer votes, but never for their own line."
        : "Vote on your controller. Writers sit out their own matchup.",
      progress: `Matchup ${state.currentMatchupIndex + 1} of ${state.matchups.length}`,
      prompt: matchup?.prompt,
      answers: currentAnswers(state, false)
    };
  }
  if (state.phase === "results" || state.phase === "finale-results") {
    return {
      ...base,
      scene: "results",
      title: state.lastResult?.winnerIds.length ? "That line stays." : "The room called it a tie.",
      instruction: "Points are in. The next page is already turning.",
      prompt: state.lastResult?.prompt,
      answers: currentAnswers(state, true),
      result: state.lastResult,
      stamp: state.lastResult?.nailedIt ? "NAILED IT" : "FINAL CUT"
    };
  }
  if (state.phase === "round-break") {
    return {
      ...base,
      scene: "break",
      title: "New page. Bigger points.",
      instruction: state.roundIndex === 1 ? "The big punch is next. Everyone gets the same final setup." : "Round two doubles every vote.",
      answers: []
    };
  }
  return {
    ...base,
    timerSeconds: undefined,
    scene: "game-over",
    title: state.winnerIds.length > 1 ? "Shared top billing." : `${playerName(state, state.winnerIds[0])} gets top billing.`,
    instruction: "That’s a wrap. The room can return to the TP Games lobby when ready.",
    answers: [],
    stamp: "THAT’S A WRAP"
  };
}

export function createControllerViewModel(input: {
  state: GameState | undefined;
  playerId: string | undefined;
  playerName: string;
  durableState?: PlayerDurableState;
  issue?: string;
  now?: number;
}): ControllerViewModel {
  const { state, playerId, playerName: name, durableState, issue } = input;
  const now = input.now ?? Date.now();
  const empty: ControllerViewModel = {
    scene: "waiting",
    playerName: name,
    roundLabel: "Punch Up!",
    title: "Waiting for the writers’ room",
    instruction: "Keep this controller open. Your first assignments will appear here.",
    prompts: [],
    answers: [],
    submittedAnswers: {},
    scores: [],
    issue,
    canVote: false,
    hasVoted: false
  };
  if (!state || !playerId || !state.players[playerId]) return empty;
  const base = {
    ...empty,
    roundLabel: roundLabel(state),
    timerSeconds: secondsLeft(state.deadlineAt, now),
    scores: scores(state)
  };
  if (state.phase === "instructions") {
    return {
      ...base,
      scene: "instructions",
      title: "Write two lines. Vote on the rest.",
      instruction: "You never vote on your own line. Authors are revealed after every result."
    };
  }
  if (state.phase === "writing" || state.phase === "finale") {
    const round = state.rounds[state.roundIndex];
    const promptIds = round.assignments[playerId] ?? [];
    const prompts = promptIds.map((promptId) => round.prompts.find((prompt) => prompt.id === promptId)).filter((prompt): prompt is Prompt => Boolean(prompt));
    const submittedAnswers = Object.fromEntries(
      promptIds.flatMap((promptId) => {
        const answer = state.submissions[promptId]?.[playerId];
        return answer ? [[promptId, answer]] : [];
      })
    );
    const submitted = promptIds.length > 0 && promptIds.every((promptId) => Boolean(submittedAnswers[promptId]));
    return {
      ...base,
      scene: submitted ? "submitted" : "writing",
      title: submitted ? "Your pages are in." : state.phase === "finale" ? "Write the big punch." : "Punch up these lines.",
      instruction: submitted ? "Waiting for the rest of the writers’ room." : "Specific beats random. Short usually beats long.",
      prompts,
      submittedAnswers
    };
  }
  if (state.phase === "voting" || state.phase === "finale-voting") {
    const matchup = state.matchups[state.currentMatchupIndex];
    const finale = state.phase === "finale-voting";
    const isAuthor = matchup?.options.some((option) => option.playerId === playerId) ?? false;
    const hasVoted = Boolean(matchup?.votes[playerId]);
    const canVote = !hasVoted && (finale || !isAuthor);
    return {
      ...base,
      scene: canVote ? "voting" : "submitted",
      title: hasVoted ? "Vote recorded." : !finale && isAuthor ? "Your line is on screen." : "Pick the line that stays.",
      instruction: hasVoted
        ? "Watch the shared display for the final cut."
        : !finale && isAuthor
          ? "Sit this one out. The room is voting now."
          : matchup?.prompt.text ?? "Choose your favorite punchline.",
      answers: currentAnswers(state, false).filter((answer) => !finale || answer.playerId !== playerId),
      canVote,
      hasVoted,
      prompts: matchup ? [matchup.prompt] : []
    };
  }
  if (state.phase === "results" || state.phase === "finale-results") {
    return {
      ...base,
      scene: "results",
      title: state.lastResult?.winnerIds.includes(playerId) ? "Your line made the cut." : "Final cut.",
      instruction: state.lastResult?.options.find((option) => option.playerId === playerId)?.points
        ? `You earned ${state.lastResult.options.find((option) => option.playerId === playerId)?.points} points.`
        : "The next matchup starts in a moment.",
      answers: currentAnswers(state, true)
    };
  }
  if (state.phase === "round-break") {
    return { ...base, scene: "break", title: "Turn the page.", instruction: "New prompts are next. Every vote is worth more." };
  }
  return {
    ...base,
    timerSeconds: undefined,
    scene: "game-over",
    title: state.winnerIds.includes(playerId) ? "You get top billing." : "That’s a wrap.",
    instruction: "Check the shared display for the final scoreboard."
  };
}
