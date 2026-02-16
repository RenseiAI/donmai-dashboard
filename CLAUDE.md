# Agent Fleet — Supaku Deployment

Standalone private deployment of [AgentFactory](https://github.com/supaku/agentfactory) for `agent.supaku.dev`.

This is a **deployment repo**, not a library. It consumes AgentFactory packages from npm and adds Supaku-specific configuration.

## Architecture

```
agent-fleet/
├── src/lib/
│   ├── config.ts        # Route wiring (connects prompts → route factories)
│   ├── prompts.ts       # Work type keywords, prompt templates, auto-trigger config
│   └── orchestrator.ts  # Webhook orchestrator with agent-worked marking
├── src/app/             # Next.js routes (re-exports from @supaku/agentfactory-nextjs)
├── cli/                 # Worker, orchestrator, queue-admin, log analyzer
└── .claude/agents/      # Agent definitions (developer.md)
```

All route handlers, dashboard UI, middleware, and worker logic come from AgentFactory packages. Only 3 files contain custom Supaku logic.

## Build & Dev

```bash
pnpm install
pnpm dev              # Start Next.js dev server (dashboard + webhook endpoint)
pnpm build            # Production build
pnpm typecheck        # Type-check
pnpm test             # Run tests
pnpm lint             # Lint
```

## Workers

```bash
pnpm worker           # Start a single worker
pnpm worker-fleet     # Start worker fleet (uses WORKER_FLEET_SIZE)
pnpm orchestrator     # Process backlog issues
```

## Admin Tools

```bash
pnpm queue-admin list          # List queued work
pnpm queue-admin sessions      # List sessions
pnpm queue-admin workers       # List workers
pnpm queue-admin clear-queue   # Clear work queue
pnpm queue-admin reset         # Reset everything
pnpm analyze-logs              # Analyze session logs
pnpm analyze-logs --follow     # Watch for new sessions
pnpm cleanup                   # Clean up stale sessions
```

## Key Customization Points

- **`src/lib/prompts.ts`** — All prompt templates, work type keywords, and priority config. Edit this to change how agents are instructed.
- **`src/lib/config.ts`** — Route wiring. Rarely needs changes unless adding new callbacks.
- **`src/lib/orchestrator.ts`** — `onAgentComplete` hook. Currently marks issues as agent-worked for auto-QA pickup.

## Environment

Copy `.env.example` to `.env.local` and fill in secrets. Key vars:

- `LINEAR_ACCESS_TOKEN` — Linear API key for SDK operations
- `LINEAR_WEBHOOK_SECRET` — Webhook signature verification
- `REDIS_URL` — Required for distributed workers and session storage
- `WORKER_API_URL` / `WORKER_API_KEY` — Worker connection to this server
- `ENABLE_AUTO_QA` / `ENABLE_AUTO_ACCEPTANCE` — Auto-trigger QA/acceptance workflows

## Deployment

Deployed to Vercel as `agent.supaku.dev`. Push to `main` to deploy.
