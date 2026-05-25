# Donmai Dashboard — Rensei AI Deployment

Standalone private deployment of [Donmai](https://github.com/RenseiAI/donmai-libraries) for `agent.rensei.dev` (redirecting to `donmai.dev/dashboard` post-Wave 8).

This is a **deployment repo**, not a library. It consumes Donmai packages from npm and adds deployment-specific configuration.

## Architecture

```
donmai-dashboard/  (repo: agent-fleet, renaming to donmai-dashboard post-Wave 5)
├── src/lib/
│   ├── config.ts          # Route wiring (connects prompts → route factories)
│   ├── prompts.ts         # Work type keywords, prompt templates, auto-trigger config
│   ├── orchestrator.ts    # Webhook orchestrator with agent-worked marking
│   └── governor-setup.ts  # Governor event bus bridge (webhook → Redis Stream)
├── src/app/               # Next.js routes (route factories from @renseiai/agentfactory-nextjs)
└── .claude/agents/        # Agent definitions (developer.md)
```

All route handlers, dashboard UI, middleware, worker logic, and CLI tools come from Donmai packages. CLI commands (`donmai worker`, `donmai governor`, etc.) are available via the `donmai` binary. Only a few files in `src/lib/` contain custom deployment logic.

## Build & Dev

```bash
pnpm install
pnpm dev              # Start Next.js dev server (dashboard + webhook endpoint)
pnpm build            # Production build
pnpm typecheck        # Type-check
pnpm test             # Run tests
pnpm lint             # Lint
```

## Governor

The Workflow Governor is the central lifecycle manager for all projects across both worker pools. It decides what work to dispatch based on issue status, active sessions, cooldowns, and human overrides.

### How It Works

```
Webhooks (Vercel) ──► Redis Stream (governor:events)
                              │
                    Governor (local process)
                    ├── Event-driven: reacts to webhook events in real time
                    └── Poll sweep: scans all projects every 5 min (safety net)
                              │
                    Decision Engine (decideAction)
                              │
                    Redis Work Queue ◄── Workers pick up work via HTTP API
```

The governor communicates with workers indirectly through the Redis work queue. It writes work items; workers poll the HTTP API (`donmai.dev/dashboard`) which dequeues from Redis. The governor does not need to be co-located with workers.

### Running the Governor

```bash
donmai governor              # Start in event-driven mode (default)
donmai governor --once       # Single scan pass and exit
donmai governor --mode poll-only  # Poll-only mode (no event bus)
```

### Governor CLI Options

```
--project <name>            Project to scan (repeatable; defaults to GOVERNOR_PROJECTS env)
--scan-interval <ms>        Poll sweep interval (default: GOVERNOR_POLL_INTERVAL_MS or 300000)
--max-dispatches <n>        Max concurrent dispatches per scan (default: 3)
--mode <mode>               poll-only or event-driven (default: event-driven)
--once                      Single scan pass and exit
--no-auto-research          Disable Icebox → research
--no-auto-backlog-creation  Disable Icebox → backlog-creation
--no-auto-development       Disable Backlog → development
--no-auto-qa                Disable Finished → QA
--no-auto-acceptance        Disable Delivered → acceptance
```

### Governor Mode (`GOVERNOR_MODE`)

Controls how webhooks interact with the governor:

| Mode | Webhooks | Governor Events | Use Case |
|------|----------|----------------|----------|
| `direct` | Dispatch directly | Not published | Default, no governor needed |
| `event-bridge` | Dispatch directly AND publish events | Published to Redis Stream | Phase 1: dual-write for safe rollout |
| `governor-only` | Only publish events (no direct dispatch) | Published to Redis Stream | Phase 2: governor handles all lifecycle |

### Projects

The governor scans all projects across both worker pools:

- **agentfactory workers**: Agent, Agent Fleet
- **supaku workers**: Social, Family, Art, Account, Marketing

Set via `GOVERNOR_PROJECTS` env var (comma-separated).

### Human Override Commands

Add these as Linear comments on any issue to override the governor:

- `HOLD` — Pause all automated processing for this issue
- `RESUME` — Resume automated processing
- `PRIORITY HIGH` / `PRIORITY URGENT` — Override priority for the next dispatch

## Workers

```bash
donmai worker           # Start a single worker
donmai worker fleet     # Start worker fleet (uses WORKER_FLEET_SIZE)
donmai orchestrator     # Process backlog issues
```

## Route Sync

When Donmai packages are updated, new API routes or dashboard pages may be added. Use `donmai sync-routes` to detect and scaffold any missing route files in `src/app/`.

```bash
donmai sync-routes --dry-run   # Preview what would be created (no changes)
donmai sync-routes             # Create missing route files
donmai sync-routes --pages     # Also sync dashboard page.tsx files
```

Recommended after every package bump:

```bash
pnpm bump:donmai && donmai sync-routes --pages
```

## Admin Tools

```bash
donmai queue list          # List queued work
donmai queue sessions      # List sessions
donmai queue workers       # List workers
donmai queue clear         # Clear work queue
donmai queue reset         # Reset everything
donmai logs analyze        # Analyze session logs
donmai logs analyze --follow  # Watch for new sessions
donmai cleanup             # Clean up stale sessions
```

## Key Customization Points

- **`src/lib/prompts.ts`** — All prompt templates, work type keywords, and priority config. Edit this to change how agents are instructed.
- **`src/lib/config.ts`** — Route wiring and governor mode. Rarely needs changes unless adding new callbacks.
- **`src/lib/governor-setup.ts`** — Initializes `RedisEventBus` and wires it to the webhook bridge. Only activates when `GOVERNOR_MODE != direct`.
- **`src/lib/orchestrator.ts`** — `onAgentComplete` hook. Currently marks issues as agent-worked for auto-QA pickup.
## Environment

Copy `.env.example` to `.env.local` and fill in secrets. Key vars:

- `LINEAR_ACCESS_TOKEN` / `LINEAR_API_KEY` — Linear API key for SDK operations
- `LINEAR_WEBHOOK_SECRET` — Webhook signature verification
- `REDIS_URL` — Required for distributed workers, session storage, and governor
- `DONMAI_API_URL` — Donmai dashboard endpoint (canonical name; `WORKER_API_URL` is legacy fallback)
- `WORKER_API_URL` / `WORKER_API_KEY` — Worker connection to this server
- `ENABLE_AUTO_QA` / `ENABLE_AUTO_ACCEPTANCE` — Auto-trigger QA/acceptance workflows
- `GOVERNOR_MODE` — `direct` (default), `event-bridge`, or `governor-only`
- `GOVERNOR_PROJECTS` — Comma-separated projects for governor to scan
- `GOVERNOR_POLL_INTERVAL_MS` — Poll sweep interval in ms (default: 300000)

## Deployment

Deployed to Vercel. URL transitions:
- Current: `agent.rensei.dev` (Vercel project: `supaku-agent`)
- Post-Wave 8: `donmai.dev/dashboard` (repo renamed to `donmai-dashboard`)
- `agent.rensei.dev` will 301-redirect to `donmai.dev/dashboard`

Push to `main` to deploy.
