# Architecture

## Authority and persistence

The room’s canonical `GameState` lives in TPG shared state. Whichever surface the shell designates as authority runs `GameCoordinator`; the coordinator applies pure domain commands and writes each new revision with optimistic concurrency. Authority is queried dynamically, so a controller can take over without changing the public game model or adding organizer controls.

Controllers first persist their latest submit or vote intent to durable player state, then broadcast it. The authority consumes durable-state echoes and transient messages through the same idempotent command path. Intent IDs prevent a dual delivery from mutating canonical state twice. Runtime rejections remain explicit coordinator issues.

## Dependency direction

```text
surfaces → presentation → application → domain
    │                         ↑
    └──── platform adapter ───┘
```

- Domain code is browser- and SDK-independent.
- Session creation receives prompt, random, ID, and clock dependencies through ports.
- `src/platform/tpgRuntime.ts` is the only runtime adapter.
- Renderers consume view models and return markup; they do not own room state.

## Surface roles

- Host display: passive 16:9 shared presentation and scoreboard.
- Controller: private writing, voting, confirmation, reconnect, and game-over states.
- Spectator: passive shared presentation with an audience-feed label.

The shell owns room creation, navigation, lifecycle, participant identity, connection state, and authority selection. Punch Up! only consumes those facts through `@tpgames/game-kit`.

## Determinism and verification

The pure engine accepts commands with explicit time and identity. Test clocks, predictable IDs, seeded random, prompt fixtures, and the runtime mock cover minimum/typical/maximum rooms and failure paths. The scenario gallery renders waiting, instructions, writing, submitted, voting, results, round break, reconnecting, finale, finale voting/results, and game over without a backend.

The Playwright journey drives the real TPG workbench through a complete five-player game, verifies reconnect persistence, hands authority to a controller, and asserts that the host iframe never exposes interactive or focusable elements.
