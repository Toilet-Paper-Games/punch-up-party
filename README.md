# Punch Up!

This is a copyable starter for a browser game that uploads to Toilet Paper Games.
It keeps rendering simple and dependency-free so you can add React, Phaser,
Three.js, Pixi, Kaplay, p5, or another renderer only when your game needs it.

The TPG runtime boundary is `@tpgames/game-kit`:

- host and controller source files import only `@tpgames/game-kit`
- iframe bootstrap, surface context, allowed-origin handling, and runtime bridge setup stay inside the TPG package
- the bundle step creates a registry-ready zip with `manifest.json`, HTML surfaces, and Vite-built JavaScript
- the register step can upload, submit, and publish with a browser-approved session

Each mounted surface runs its own copy of the game definition. The starter host
uses the repeatable `surfacesReady` hook and checks existing shared state before
initializing a round. Keep lifecycle/readiness hooks idempotent, and remember
that `setSharedState`/`setPlayerState` become visible through the later shell
echo and subscriptions rather than an immediate getter update. See the
[room and authority guide](https://tp.games/docs/room-model).

## Scaffold A New Game

Create a customized copy from any directory with the public package:

```bash
npm create @tpgames/game@latest -- signal-rally \
  --game-id signal-rally \
  --title "Signal Rally"
```

If `@tpgames/sdk-dev-kit` is already installed, the equivalent CLI command is:

```bash
tpgames init signal-rally
```

Add `--version` or `--package-name` when needed. Both commands use this exact
starter and require a target path that does not already exist.
The generated `package.json` pins the tested `@tpgames/game-kit`
version, while `bundle/manifest.template.json` declares the runtime contract
through `sdkVersion`. Update those together when adopting a newer SDK contract.

## Layout

```text
bundle/
  manifest.template.json
surfaces/
  host.html
  controller.html
src/
  game.ts
  game.test.ts
  host.ts
  controller.ts
vite.config.mjs
tsconfig.json
tpgames.json
.github/workflows/
  register-game.yml
```

## Local Development

Install dependencies:

```bash
npm install
```

Run the complete local contract:

```bash
npm run check
```

`npm run check:capabilities` compares reserved `tpg:*` capability requests,
denied clipboard permissions, and declared participant counts with the
[published capability matrix](https://tp.games/docs/capabilities). Experimental, planned, and
unsupported requests print actionable warnings and tracking links before the
bundle is built. See https://tp.games/docs/capabilities for the current matrix.

Start Vite for renderer and surface development:

```bash
npm run dev
```

Vite opens the multi-surface workbench at `/__tpg/workbench`. It runs the host
display and two controllers together and lets you drive lifecycle, readiness,
authority, reconnects, settings, state, messages, and deterministic network
faults without starting the full TPG shell. Edit `tpgWorkbench(...)` in
`vite.config.mjs` to change controller names/count, add a spectator, or choose a
different initial network profile.
Each surface also has its own zoom control and can open in a live, synchronized
window when the embedded viewport is too small for the game UI.

The workbench is the fast author loop, not a substitute for a packaged
real-room check. Test the current source on real devices without uploading:

```bash
npm run dev:devices
```

This starts Vite plus a temporary Cloudflare Quick Tunnel and opens a room on
`https://play.tp.games`. Scan the host QR with multiple phones to join the same
host-authoritative room. Install `cloudflared` first, or run
`npm run dev:devices -- --public-url https://your-tunnel.example.com` when you
manage the tunnel yourself. Treat the generated host link as private because it
contains the temporary development-manifest descriptor. The tunnel exposes the
local Vite server and source modules publicly; share only the room QR or
controller invite, keep `.env` files, credentials, and private assets outside
Vite's served root, and stop the command and tunnel when finished.

For a tunnel you manage, keep the local ports aligned:

```bash
cloudflared tunnel --url http://127.0.0.1:5173
npm run dev:devices -- --port 5173 --public-url https://random-name.trycloudflare.com
```

For a named tunnel, configure its hostname to forward to
`http://127.0.0.1:5173`, run `cloudflared tunnel run <name>`, and use the same
command with that HTTPS hostname. The CLI leaves user-managed tunnels running.
It opens the host first; the QR and controller invite appear once the host has
connected and created the room. Use `--no-open` when you need the host link
printed instead.

This path needs no registry upload or API key. Run the bundle validation below
and test the uploaded archive through the shell before publishing.

The contract command typechecks, tests, verifies the TPG runtime boundary,
builds the registry archive, and runs the same strict manifest/bundle preflight
used by registry ingestion. Individual scripts remain available:

```bash
npm run typecheck
npm run test
npm run check:tpg-boundaries
npm run validate
```

`npm run validate` invokes `tpg validate ./dist`. It reports file- and
manifest-path-specific errors for unknown fields, unavailable capabilities or
permissions, contradictory topology, missing surfaces/artwork, unsafe paths,
missing entry scripts, and broken bundle-relative HTML URLs. You can also
validate a specific archive directly:

```bash
npx tpg validate ./dist/punch-up-party-0.1.0.zip
```

For manifest editor completion, use the versioned schema installed at
`node_modules/@tpgames/core-manifest/schema/game-manifest.v1.schema.json`.

Render a bundle:

```bash
npm run bundle
```

That writes:

```text
dist/
  manifest.json
  host.html
  host.js
  controller.html
  controller.js
  punch-up-party-0.1.0.zip
```

## Sign In And Publish

For interactive development, sign in through the browser. The CLI opens a TP
Games approval page, shows the exact account and permissions that will receive
access, and saves the approved session only for this registry origin:

```bash
npm exec -- tpgames login
npm exec -- tpgames whoami
npm run register
```

The production registry is the default. For a loopback registry, use the same
origin for sign-in and registration. First start the registry and browser
approval shell from a TPG repository checkout in two terminals:

```bash
cd /path/to/tpg
TPG_WEB_SHELL_URL=http://127.0.0.1:3000 bun run dev:registry:demo
```

```bash
cd /path/to/tpg
VITE_REGISTRY_URL=http://127.0.0.1:4020 bun run dev:web:demo-auth
```

Then run these commands from this game repository:

```bash
npm exec -- tpgames login --registry-url http://127.0.0.1:4020
npm run register -- --registry-url http://127.0.0.1:4020
```

Registration means uploading a built game version, not creating a developer
account. Plain `npm run register` uses the safe `upload` mode; pass `--mode
submit` to submit for review or `--mode publish --yes` for the full publish
flow. Game id, game version, output, archive, mode, and registry URL all have
CLI flags.

Use an API key only for CI and other unattended environments. Create one with
these scopes:

- `games:read`
- `games:write`
- `games:submit`
- `games:publish`

Then run the same registration command in CI, where the secret is injected by
the CI secret store:

```bash
npm run register -- --mode publish --yes
```

The CLI does not accept `TPG_API_KEY` as an argument or project configuration.
Inject it only through the CI secret store, avoid logging it, and remember that
it overrides a saved browser session when present.

Preview the exact archive and registry operation without credentials or network
mutation:

```bash
npm run publish:dry-run
```

Build and publish through the registry with the CI-provided API key:

```bash
npm run publish:game
```

## CI

The generated `.github/workflows/register-game.yml` uses the same package scripts:

```bash
npm install
npm run check
npm run publish:game
```

Store `TPG_API_KEY` as a CI secret. The generated workflow uses the production
registry default. Demo creator/reviewer tokens are only for local compatibility;
external CI should use `TPG_API_KEY`.
Pull requests to `main` run install, typecheck, package-local tests when present,
boundary, build, and bundle checks without registry secrets. Merges to `main`
and manual dispatches publish only when the creator API key is configured.
Pull request and configured publish runs upload the generated `dist/*.zip`
bundle as a `registry-bundle` Actions artifact so reviewers can inspect the
exact registry upload candidate.

## AI-assisted development

The generated project includes `AGENTS.md` and a self-contained
`.agents/skills/tpg-game-development` skill. Compatible coding agents can use it
for TP Games architecture, local testing, physical-device tunnels, packaging,
and publishing guidance without needing a checkout of the platform monorepo.

## Next Steps

- Replace the starter HTML with your game UI.
- Keep TPG iframe/runtime code behind `@tpgames/game-kit`.
- Add your renderer as a normal dependency when needed.
- Update `bundle/manifest.template.json` with real title, metadata, surfaces,
  player counts, and artwork before publishing.
