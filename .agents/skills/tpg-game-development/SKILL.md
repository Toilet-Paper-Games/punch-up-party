---
name: tpg-game-development
description: Use when creating, extending, debugging, testing, packaging, or publishing this Toilet Paper Games project, including host/controller gameplay, manifests, workbench testing, physical-device tunnels, and registry delivery.
---

# TP Games Development

Build this game against the public author contract while preserving the
host-authoritative room model. Start by reading `README.md`, `tpgames.json`, the
manifest template, and the existing source and tests.

## Preserve the runtime boundary

- Keep `logic`, `host-display`, `controller`, and `spectator` roles distinct.
- The TP Games shell owns rooms, navigation, lifecycle, identity, and authority.
- Use `@tpgames/game-kit` from browser surfaces. Do not call `postMessage` or
  low-level runtime packages directly.
- Let the authority accept player intents and commit canonical shared state.
- Let a controller mutate only its own player state.
- Synchronize compact serializable facts, not DOM nodes, scenes, renderer
  objects, animation frames, or other process-local state.
- Make readiness and initialization idempotent because `surfacesReady` repeats.
- Render subscription echoes instead of assuming state setters immediately
  change local getters.
- Use durable shared/player state for reconnectable facts and messages only for
  effects that are safe to miss.

## Implement one complete loop

1. Define the smallest shared-state and player-state types.
2. Keep separate host and controller entries booted with `bootIframeGame`.
3. Render one prompt or target on the host.
4. Send one controller intent.
5. Commit it through the authority and render the confirmed snapshot.
6. Add teardown for subscriptions, render loops, observers, and engine objects.
7. Update the manifest only after roles, state, and required capabilities are
   explicit.

Add a renderer such as React, Phaser, Pixi, Three.js, p5, or Kaplay only behind
this boundary. For engine integrations, use the matching public TP Games bridge.

## Test in widening loops

1. Run focused tests for lifecycle, intents, authority, and state.
2. Run `npm run dev` and exercise host plus controllers in the workbench.
3. Run `npm run dev:devices` for a real room on phones, tablets, or TVs. This
   starts or reuses a Cloudflare tunnel and requires no upload or account.
4. Run `npm run check` before delivery. It typechecks, tests, checks boundaries,
   bundles, and validates the archive.

For a managed tunnel, pass `--public-url` and keep its local origin aligned with
`--port`. Use `--no-open` when needed. Treat the printed host URL as private:
it contains a temporary development descriptor. Share the room QR or controller
invite, keep secrets and private assets outside Vite's served root, and stop the
tunnel after testing.

## Sign in and deliver deliberately

- `tpgames login` opens browser approval and stores an origin-scoped session.
- `tpgames whoami` verifies the current account and scopes.
- `tpgames logout` revokes and removes the session.
- `tpgames register` uploads a built game version; it does not create an
  account. Its default `upload` mode is the safe preview path.
- Use `--mode submit` for review and `--mode publish --yes` only deliberately.
- Keep `TPG_API_KEY` environment-only and only for CI or unattended systems.
  Never place credentials in CLI arguments, source, config, or committed files.

Public packages use the `@tpgames/*` scope on npm and require no package token.
Use `tpgames --help` for current CLI options and https://tp.games/docs for the
published platform contract.
