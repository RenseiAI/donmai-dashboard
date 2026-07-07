# donmai-dashboard — fleet-dashboard deployment for agent.rensei.dev (private deployment)

Standalone PRIVATE deployment of the donmai fleet dashboard, serving
`agent.rensei.dev` (301 → `donmai.dev/dashboard`). Next.js. This is a
deployment, not a library: route handlers, dashboard UI, middleware, worker
logic, and CLI tools come from published Donmai npm packages; only `src/lib/`
holds custom deployment logic.

## Operating context

- The custom deployment logic, all of it: `src/lib/config.ts` (route wiring —
  connects prompts to route factories), `src/lib/prompts.ts` (work-type
  keywords, prompt templates, auto-trigger config), `src/lib/orchestrator.ts`
  (`onAgentComplete` hook — marks issues agent-worked for auto-QA pickup),
  `src/lib/governor-setup.ts` (`RedisEventBus` webhook → Redis Stream bridge;
  active only when `GOVERNOR_MODE != direct`). Agent definitions live in
  `.claude/agents/developer.md`.
- **The `@renseiai/agentfactory-nextjs` dependency is DELIBERATE, not an
  oversight.** It supplies the Next.js route factories and middleware and has
  no `@donmai/*` successor until the route handlers migrate to
  `@donmai/server`. Its import sites carry `TODO(donmai-rebrand)` markers
  (`src/middleware.ts`, `src/lib/config.ts`, `src/lib/orchestrator.ts`). Do
  not "fix", rename, or swap these imports.
- Dev server: `pnpm dev` (port 3009). Env setup: copy `.env.example` →
  `.env.local` and fill in secrets.
- Shared agent playbook: `../donmai-architecture/agents/PROTOCOL.md` (missing?
  `gh repo clone RenseiAI/donmai-architecture ../donmai-architecture`).

## Before you start — read in this order

| The moment you... | Read |
|---|---|
| start ANY task in this repo | this file, top to bottom (it is short) |
| touch governor behavior, dispatch modes, overrides, workers, or admin ops | `docs/agents/GOVERNOR.md` |
| bump `@donmai/*` packages | the route-sync rule in Iron rules below |
| change agent prompting or auto-triggers | `src/lib/prompts.ts` + the auto-trigger vars in `.env.example` |
| are about to write "done"/"fixed" or push | Gates below + `../donmai-architecture/agents/PROTOCOL.md` §V |
| hit a failing test/build you did not predict | `../donmai-architecture/agents/PROTOCOL.md` §D |

When a row matches, read that doc before your next edit and follow it literally.

## Gates — "done" means these passed

```bash
pnpm typecheck   # tsc --noEmit — the type gate
pnpm test        # vitest run
pnpm lint        # eslint .
pnpm build       # next build
```

**There is no CI.** No `.github/workflows/` exists; a push to `main` deploys
straight to production via Vercel. These four local commands are the ONLY
gates — run all four and quote each result line before any push. The
pre-commit hook (`prepare`: `dotenvx ext precommit --install`) blocks
committing `.env*` files; keep it installed.

## Iron rules

- Governor runs: `donmai governor [--once] [--mode poll-only]`;
  `GOVERNOR_MODE` is `direct` | `event-bridge` | `governor-only`; humans
  override via Linear comments `HOLD` / `RESUME` / `PRIORITY HIGH` /
  `PRIORITY URGENT`. Full modes, CLI options, worker and admin commands:
  `docs/agents/GOVERNOR.md`.
- After every package bump, sync routes: `pnpm bump:donmai && donmai
  sync-routes --pages`. Preview first with `donmai sync-routes --dry-run`;
  sync never overwrites existing files, pages are opt-in via `--pages`.
- Key env vars (`.env.example` is the reference): `LINEAR_ACCESS_TOKEN` /
  `LINEAR_API_KEY`, `LINEAR_WEBHOOK_SECRET`, `REDIS_URL` (dedicated OSS Redis
  instance — never point it at another deployment's Redis), `DONMAI_API_URL`
  (canonical; `WORKER_API_URL` is the legacy fallback), `WORKER_API_KEY`,
  `ENABLE_AUTO_QA` / `ENABLE_AUTO_ACCEPTANCE`, `GOVERNOR_MODE`,
  `GOVERNOR_PROJECTS`, `GOVERNOR_POLL_INTERVAL_MS` (default 300000).
- Deployment logic that outgrows `src/lib/` belongs upstream in the Donmai
  packages, not accreted here.

## Boundary

- Private repo: secrets stay in `.env.local` and Vercel env, never in tracked
  files (the dotenvx pre-commit hook enforces this — do not bypass it).
- Content pushed upstream to public Donmai repos must pass THAT repo's leak
  guard; nothing from this deployment (URLs, tokens, project names) goes with it.

## Hard stops

- NEVER push to `main` without all four Gates green in THIS session ->
  instead: run them and paste the result lines (push to `main` IS the
  production deploy).
- NEVER commit `.env.local` or credentials -> instead: `.env.example` carries
  key names only; leave the dotenvx pre-commit hook installed.
- NEVER replace `@renseiai/agentfactory-nextjs` with a guessed `@donmai/*`
  equivalent -> instead: leave the `TODO(donmai-rebrand)` imports in place;
  the successor does not exist yet.
