# Governor, workers, and admin operations

Detail file routed from `AGENTS.md`. The Workflow Governor is the central
lifecycle manager for all projects across both worker pools: it decides what
work to dispatch based on issue status, active sessions, cooldowns, and human
overrides.

## How it works

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

The governor communicates with workers indirectly through the Redis work
queue: it writes work items; workers poll the HTTP API
(`donmai.dev/dashboard`) which dequeues from Redis. The governor does not
need to be co-located with workers.

## Running the governor

```bash
donmai governor                    # event-driven mode (default)
donmai governor --once             # single scan pass and exit
donmai governor --mode poll-only   # poll-only mode (no event bus)
```

### CLI options

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

## `GOVERNOR_MODE` — how webhooks interact with the governor

| Mode | Webhooks | Governor events | Use case |
|------|----------|-----------------|----------|
| `direct` | Dispatch directly | Not published | Default, no governor needed |
| `event-bridge` | Dispatch directly AND publish events | Published to Redis Stream | Phase 1: dual-write for safe rollout |
| `governor-only` | Only publish events (no direct dispatch) | Published to Redis Stream | Phase 2: governor handles all lifecycle |

## Projects

The governor scans all projects across both worker pools — donmai workers:
Agent, Agent Fleet; supaku workers: Social, Family, Art, Account, Marketing.
Set the list via `GOVERNOR_PROJECTS` (comma-separated).

## Human override commands

Add these as Linear comments on any issue to override the governor:

- `HOLD` — pause all automated processing for the issue
- `RESUME` — resume automated processing
- `PRIORITY HIGH` / `PRIORITY URGENT` — override priority for the next dispatch

## Workers

```bash
donmai worker           # start a single worker
donmai worker fleet     # start a worker fleet (uses WORKER_FLEET_SIZE)
donmai orchestrator     # process backlog issues
```

## Route sync

When Donmai packages are updated, new API routes or dashboard pages may be
added. `donmai sync-routes` detects and scaffolds missing route files in
`src/app/` — it never overwrites existing files.

```bash
donmai sync-routes --dry-run   # preview what would be created (no changes)
donmai sync-routes             # create missing API route files
donmai sync-routes --pages     # also sync dashboard page.tsx files
```

After every package bump: `pnpm bump:donmai && donmai sync-routes --pages`.

## Admin tools

```bash
donmai queue list             # list queued work
donmai queue sessions         # list sessions
donmai queue workers          # list workers
donmai queue clear            # clear the work queue
donmai queue reset            # reset everything
donmai logs analyze           # analyze session logs
donmai logs analyze --follow  # watch for new sessions
donmai cleanup                # clean up stale sessions
```
