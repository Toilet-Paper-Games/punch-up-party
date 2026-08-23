# Developer experience journal

## 2026-08-23 — Contract recovery and scaffold

- Attempted: read the current author guide, SDK lifecycle contract, capability matrix, React example, and public npm versions before scaffolding.
- Worked well: the public docs agree on `@tpgames/game-kit` as the boundary, subscription echoes as canonical local state, and `tpgames register` as the delivery path.
- Worked well: `npm create @tpgames/game@latest` produced a detached repository with pinned current packages, validation scripts, CI, and standalone agent guidance.
- Confusing: the generated starter has no `.gitignore`, even though its README and instructions say generated build output and dependencies must not be committed.
- Ownership: platform authoring scaffold.
- Suggested fix: include a starter `.gitignore` covering `node_modules`, `build`, `dist`, coverage, test artifacts, logs, local environment files, and OS metadata.
- Acceptance criteria: a fresh scaffold can run `npm install && npm run check` and `git status --short` remains free of dependencies, archives, and build output.
- Workaround: added the missing `.gitignore` before installing dependencies.

## 2026-08-23 — Design workspace

- Attempted: started `bun run design:penpot:mcp` and requested a read-only overview before any design write.
- Blocker: no Penpot plugin instance was connected to an open design file, so the MCP server could not inspect or create an editable canvas.
- Ownership: local design-workspace setup, not game code.
- Suggested fix: expose connection state and the exact plugin-open action in the development command output.
- Acceptance criteria: starting the command reports whether a Penpot page is connected and gives a one-line recovery instruction when it is not.
- Workaround: continued from the seeded code design direction and retained a generated concept board plus implementation screenshots as evidence; no alternate design service was used.

## 2026-08-23 — Participant identity in the workbench

- Attempted: loaded a five-controller workbench using the generated surface hash participant IDs.
- Confusing: the surface context fallback did not initially identify each named controller; `api.me()` was the canonical live identity in the workbench.
- Ownership: game adapter documentation/example clarity.
- Suggested fix: make `api.me()` the primary participant-identity example and document when `context().participantId` is only a bootstrap fallback.
- Acceptance criteria: a generated five-controller workbench shows the correct name and private assignments on every controller without application-specific identity recovery.
- Workaround: the runtime adapter queries `api.me()?.id` first and exposes identity through the injected runtime port.

## 2026-08-23 — Full-game automation

- Attempted: drove five controller iframes through a complete realistic-timing game in the SDK workbench.
- Worked well: the inspector, deterministic participants, authority controls, reconnect controls, and seeded network profile make cross-surface failures reproducible.
- Confusing: the workbench reset clears canonical state without immediately remounting game surfaces, so a surface can continue rendering its last local snapshot until “Reload surfaces” is used.
- Ownership: SDK workbench reset semantics.
- Suggested fix: make reset remount surfaces or broadcast an explicit undefined-state revision to every surface.
- Acceptance criteria: after “Reset session,” all surfaces synchronously return to their initial waiting state and the authority can initialize a fresh session without a separate reload action.
- Workaround: automated journeys start from a new workbench page; manual reset testing uses “Reload surfaces” immediately afterward.

## 2026-08-23 — Finale rule validation

- Attempted: extended the pure-domain playthrough from one duel through all three rounds.
- Worked well: the pure transition API made the all-author finale voter deadlock fail in a focused deterministic test before publication.
- Ownership: game implementation.
- Resolution: finale eligibility now includes every connected player, controllers hide their own finale answer, and the domain rejects selecting one’s own answer.
- Acceptance criteria: five finale writers cast five valid non-self votes, score the matchup, and reach game over.

## 2026-08-23 — Independent playtest findings

- Rules and resilience review found six consequential edge cases before release: untrusted client timestamps, unauthenticated or disconnected votes, reconnecting partial submissions, rapid connection changes, authority-transfer intent recovery, and compatibility writes advancing before their canonical echo.
- Resolution: authority time now stamps every incoming command; durable and broadcast senders are authenticated; confirmed partial answers may be repeated unchanged; connection reconciliation is serialized; a promoted authority replays the latest authenticated durable intent; and `accepted` shared-state writes wait for the subscribed revision before the queue advances.
- Fun and pacing review found that three-player duels could award a trivial unanimity bonus, the prompt pool was too repetitive, and a full finale needed more voting time.
- Resolution: “Nailed It” requires at least two eligible supporters, the pool now contains 64 duel prompts and 12 finales across varied joke shapes, finale voting scales to 30–35 seconds, and results hold for 9 seconds.
- Visual stress review found eight-answer and long-copy clipping, a below-the-fold reconnect notice, a frozen spectator timer, and finale type that was too small at room distance.
- Resolution: dense finales use a tested two-column layout, long content gets a dedicated modifier, status precedes the task title, every passive surface updates its live timer, ordinary finale answers retain a 15px minimum, and a maximum-density fixture covers eight legal 120-character answers.

## 2026-08-23 — Finish review and authoring feedback

- The independent finish reviewer initially blocked shipment on platform-dependent font metrics, controls re-enabling before canonical confirmation, and a controller timer that could scroll away.
- Resolution: Anton, Barlow Condensed, and Courier Prime are bundled; submit/vote controls remain disabled with `aria-busy` until confirmed room state changes; and the safe-area-aware controller header is sticky.
- Verification: typecheck and 22 deterministic tests passed; browser stress passed for 16:9 ordinary/maximum finales, legal long duel copy, reconnect status, sticky timer, a 44px-or-larger submit target, and zero horizontal overflow. The follow-up finish verdict was “Ship.”
- Filed platform feedback after deduplication: [#933 — generated scaffold should include a safe `.gitignore`](https://github.com/Toilet-Paper-Games/Toilet-Paper-Games/issues/933) and [#934 — author docs should make `api.me()` the primary controller identity source](https://github.com/Toilet-Paper-Games/Toilet-Paper-Games/issues/934).
- Existing issue [#918 — workbench reset should broadcast cleared state snapshots](https://github.com/Toilet-Paper-Games/Toilet-Paper-Games/issues/918) already captured the reset behavior, so no duplicate was opened.

## 2026-08-23 — Registry contract dry run

- Attempted: bundled a self-contained archive, ran strict local validation, and exercised the live registry’s publish dry run.
- Worked well: the 2.7 MB archive includes all runtime entries, optimized artwork, paper texture, and four local WOFF2 font files; the registry accepts the game ID, metadata, topology, capabilities, and assets.
- Contract drift: local validation accepted the documented `displayInteraction: "passive"` field, while the live registration schema rejected it as unknown.
- Resolution: removed only the not-yet-live field, retained the passive-host invariant in the implementation and browser assertion, and reran the registry dry run successfully.
- Existing issue [#930 — publish passive-display manifest support to the public author packages](https://github.com/Toilet-Paper-Games/Toilet-Paper-Games/issues/930) already described the exact mismatch, so the independent reproduction and workaround were added there instead of opening a duplicate.

## 2026-08-23 — Release-candidate verification

- `npm run typecheck`: passed.
- `npm test`: 24 tests passed across prompt content, 3/5/8-player full domain games, deadline and reconnection rules, authority coordination, runtime authentication, busy controls, and presentation state.
- `npm run test:e2e -- tests/e2e/visual-stress.spec.ts`: 3 browser stress checks passed.
- `npm run test:e2e -- tests/e2e/full-game.spec.ts`: passed a five-controller game through every phase, reconnect recovery, authority transfer, game over, passive-host DOM inspection, and zero page errors.
- `npm run validate`: boundaries, capability envelope, production build, 2.7 MB archive, and strict local bundle validation passed.
- `npm run publish:dry-run`: the live registry accepted `punch-up-party` version `0.1.0` in publish mode.
