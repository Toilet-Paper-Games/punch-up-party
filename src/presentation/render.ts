import type { ControllerViewModel, HostViewModel, ScoreViewModel } from "./viewModels";

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  })[character]!);
}

function timer(seconds: number | undefined): string {
  if (seconds === undefined) return "";
  return `<span class="timer" aria-label="${seconds} seconds remaining">${seconds}</span>`;
}

function scoreboard(scores: ScoreViewModel[], compact = false): string {
  if (scores.length === 0) return "";
  return `<ol class="scoreboard${compact ? " scoreboard--compact" : ""}" aria-label="Scoreboard">${scores
    .map(
      (score, index) => `<li class="score-row${score.winner ? " score-row--winner" : ""}${score.connected ? "" : " score-row--offline"}">
        <span class="score-rank">${index + 1}</span>
        <span class="score-name">${escapeHtml(score.name)}</span>
        <strong class="score-points">${score.score.toLocaleString()}</strong>
      </li>`
    )
    .join("")}</ol>`;
}

export function renderHost(view: HostViewModel, spectator = false): string {
  const manyAnswers = view.answers.length > 2;
  const longContent = (view.prompt?.text.length ?? 0) > 52 || view.answers.some((answer) => answer.text.length > 84);
  const answers = view.answers.length
    ? `<div class="answer-stage${manyAnswers ? " answer-stage--many" : ""}${longContent ? " answer-stage--long" : ""}">${view.answers
        .map(
          (answer, index) => `<article class="answer-slip${answer.winner ? " answer-slip--winner" : ""}">
            <span class="answer-letter">${String.fromCharCode(65 + index)}</span>
            <p>${escapeHtml(answer.text)}</p>
            ${answer.authorName ? `<footer><span>${escapeHtml(answer.authorName)}</span><strong>${answer.points ?? 0} pts</strong></footer>` : ""}
          </article>`
        )
        .join(manyAnswers ? "" : '<span class="versus" aria-hidden="true">VS</span>')}</div>`
    : "";
  return `<main class="host-scene host-scene--${view.scene}${manyAnswers ? " host-scene--many" : ""}${longContent ? " host-scene--long" : ""}">
    <section class="script-page">
      <header class="page-header">
        <span class="round-label">${escapeHtml(view.roundLabel)}</span>
        ${timer(view.timerSeconds)}
      </header>
      <div class="page-body">
        <h1>${escapeHtml(view.title)}</h1>
        <p class="direction">${escapeHtml(view.instruction)}</p>
        ${view.prompt ? `<p class="scene-heading">${escapeHtml(view.prompt.text)}</p>` : ""}
        ${answers}
        ${view.progress ? `<p class="progress-copy">${escapeHtml(view.progress)}</p>` : ""}
      </div>
      ${view.stamp ? `<span class="result-stamp">${escapeHtml(view.stamp)}</span>` : ""}
      <footer class="billing-line"><span>PUNCH UP! · ORIGINAL ROOM PRODUCTION</span><span>${spectator ? "AUDIENCE FEED" : "LIVE DRAFT"}</span></footer>
    </section>
    <aside class="score-panel">
      <h2>Top billing</h2>
      ${scoreboard(view.scores)}
    </aside>
  </main>`;
}

function writingForm(view: ControllerViewModel, busy: boolean): string {
  const disabled = busy ? " disabled" : "";
  return `<form class="writing-form" data-writing-form${busy ? ' aria-busy="true"' : ""}>
    ${view.prompts
      .map(
        (prompt, index) => `<label class="prompt-field">
          <span class="prompt-number">Line ${index + 1}</span>
          <strong>${escapeHtml(prompt.text)}</strong>
          <textarea name="${escapeHtml(prompt.id)}" maxlength="120" rows="3" required${disabled} placeholder="Write the missing line…">${escapeHtml(view.submittedAnswers[prompt.id] ?? "")}</textarea>
          <span class="field-note">120 characters max</span>
        </label>`
      )
      .join("")}
    <button class="primary-action" type="button" data-submit${disabled}>${busy ? "Sending punchlines…" : "Submit punchlines"}</button>
  </form>`;
}

function votingControls(view: ControllerViewModel, busy: boolean): string {
  const disabled = busy ? " disabled" : "";
  return `<div class="vote-list" role="group" aria-label="Punchlines">
    ${view.answers
      .map(
        (answer, index) => `<button class="vote-option" type="button" data-vote="${escapeHtml(answer.playerId)}"${disabled}>
          <span>${String.fromCharCode(65 + index)}</span>
          <strong>${escapeHtml(answer.text)}</strong>
        </button>`
      )
      .join("")}
  </div>`;
}

export function renderController(view: ControllerViewModel, options: { busy?: boolean } = {}): string {
  const busy = options.busy ?? false;
  const body =
    view.scene === "writing"
      ? writingForm(view, busy)
      : view.scene === "voting" && view.canVote
        ? votingControls(view, busy)
        : view.scene === "results" || view.scene === "break" || view.scene === "game-over"
          ? scoreboard(view.scores, true)
          : `<div class="waiting-mark" aria-hidden="true">✓</div>`;
  return `<main class="controller-scene controller-scene--${view.scene}">
    <header class="controller-header">
      <div><span class="round-label">${escapeHtml(view.roundLabel)}</span><strong>${escapeHtml(view.playerName)}</strong></div>
      ${timer(view.timerSeconds)}
    </header>
    <section class="controller-page"${busy ? ' aria-busy="true"' : ""}>
      ${view.issue ? `<p class="status-line" role="status">${escapeHtml(view.issue)}</p>` : ""}
      <h1>${escapeHtml(view.title)}</h1>
      <p class="direction">${escapeHtml(view.instruction)}</p>
      ${body}
    </section>
    <button class="settings-action" type="button" data-settings>Sound settings</button>
  </main>`;
}
