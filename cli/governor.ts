#!/usr/bin/env tsx
/**
 * Governor CLI — Supaku-specific wrapper
 *
 * Assembles real dependencies from the exported packages and starts the
 * governor in event-driven or poll-only mode.
 *
 * Usage:
 *   pnpm governor [options]
 *
 * Options:
 *   --project <name>            Project to scan (can be repeated; defaults to GOVERNOR_PROJECTS env)
 *   --scan-interval <ms>        Scan interval in milliseconds (default: 60000)
 *   --max-dispatches <n>        Max concurrent dispatches per scan (default: 3)
 *   --mode <poll-only|event-driven>  Execution mode (default: event-driven)
 *   --once                      Run a single scan pass and exit
 *   --no-auto-research          Disable auto-research
 *   --no-auto-backlog-creation  Disable auto-backlog-creation
 *   --no-auto-development       Disable auto-development
 *   --no-auto-qa                Disable auto-QA
 *   --no-auto-acceptance        Disable auto-acceptance
 *
 * Environment:
 *   LINEAR_API_KEY              Required — Linear API key
 *   REDIS_URL                   Required — Redis connection URL
 *   GOVERNOR_PROJECTS           Default projects (comma-separated)
 *   GOVERNOR_POLL_INTERVAL_MS   Poll sweep interval (default: 300000 = 5 min)
 */

import path from 'path'
import { config } from 'dotenv'

config({ path: path.resolve(process.cwd(), '.env.local') })

import {
  EventDrivenGovernor,
  WorkflowGovernor,
  initTouchpointStorage,
  type GovernorDependencies,
  type GovernorIssue,
  type GovernorAction,
  type GovernorConfig,
  type ScanResult,
} from '@supaku/agentfactory'
import { createLinearAgentClient } from '@supaku/agentfactory-linear'
import {
  RedisOverrideStorage,
  RedisEventBus,
  RedisEventDeduplicator,
  getSessionStateByIssue,
  didJustFailQA,
  getWorkflowState,
  RedisProcessingStateStorage,
  queueWork,
  type QueuedWork,
} from '@supaku/agentfactory-server'

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

interface GovernorArgs {
  projects: string[]
  scanIntervalMs: number
  maxConcurrentDispatches: number
  enableAutoResearch: boolean
  enableAutoBacklogCreation: boolean
  enableAutoDevelopment: boolean
  enableAutoQA: boolean
  enableAutoAcceptance: boolean
  once: boolean
  mode: 'poll-only' | 'event-driven'
}

function parseArgs(): GovernorArgs {
  const argv = process.argv.slice(2)

  // Default projects from env
  const defaultProjects = process.env.GOVERNOR_PROJECTS
    ? process.env.GOVERNOR_PROJECTS.split(',').map(s => s.trim()).filter(Boolean)
    : []

  const result: GovernorArgs = {
    projects: [],
    scanIntervalMs: Number(process.env.GOVERNOR_POLL_INTERVAL_MS) || 300_000,
    maxConcurrentDispatches: 3,
    enableAutoResearch: true,
    enableAutoBacklogCreation: true,
    enableAutoDevelopment: true,
    enableAutoQA: true,
    enableAutoAcceptance: true,
    once: false,
    mode: 'event-driven',
  }

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--project': result.projects.push(argv[++i]!); break
      case '--scan-interval': result.scanIntervalMs = parseInt(argv[++i]!, 10); break
      case '--max-dispatches': result.maxConcurrentDispatches = parseInt(argv[++i]!, 10); break
      case '--mode': result.mode = argv[++i] as GovernorArgs['mode']; break
      case '--once': result.once = true; break
      case '--no-auto-research': result.enableAutoResearch = false; break
      case '--no-auto-backlog-creation': result.enableAutoBacklogCreation = false; break
      case '--no-auto-development': result.enableAutoDevelopment = false; break
      case '--no-auto-qa': result.enableAutoQA = false; break
      case '--no-auto-acceptance': result.enableAutoAcceptance = false; break
    }
  }

  if (result.projects.length === 0) {
    result.projects = defaultProjects
  }

  return result
}

// ---------------------------------------------------------------------------
// Action → work type
// ---------------------------------------------------------------------------

function actionToWorkType(action: GovernorAction): string {
  switch (action) {
    case 'trigger-research': return 'research'
    case 'trigger-backlog-creation': return 'backlog-creation'
    case 'trigger-development': return 'development'
    case 'trigger-qa': return 'qa'
    case 'trigger-acceptance': return 'acceptance'
    case 'trigger-refinement': return 'refinement'
    case 'decompose': return 'coordination'
    case 'escalate-human': return 'escalation'
    default: return 'development'
  }
}

// ---------------------------------------------------------------------------
// Real dependencies factory
// ---------------------------------------------------------------------------

function createDependencies(linearClient: ReturnType<typeof createLinearAgentClient>): GovernorDependencies {
  const processingState = new RedisProcessingStateStorage()
  const TERMINAL_STATUSES = ['Accepted', 'Canceled', 'Duplicate']

  return {
    listIssues: async (project: string): Promise<GovernorIssue[]> => {
      try {
        const sdk = linearClient.linearClient
        const conn = await sdk.issues({
          filter: {
            project: { name: { eq: project } },
            state: { name: { nin: TERMINAL_STATUSES } },
          },
        })
        const results: GovernorIssue[] = []
        for (const issue of conn.nodes) {
          const state = await issue.state
          const labels = await issue.labels()
          const parent = await issue.parent
          const proj = await issue.project
          results.push({
            id: issue.id,
            identifier: issue.identifier,
            title: issue.title,
            description: issue.description ?? undefined,
            status: state?.name ?? 'Backlog',
            labels: labels.nodes.map(l => l.name),
            createdAt: issue.createdAt.getTime(),
            parentId: parent?.id,
            project: proj?.name,
          })
        }
        return results
      } catch (err) {
        console.error('[governor] listIssues failed:', err)
        return []
      }
    },

    hasActiveSession: async (issueId) => {
      try {
        const session = await getSessionStateByIssue(issueId)
        if (!session) return false
        return ['running', 'claimed', 'pending'].includes(session.status)
      } catch { return false }
    },

    isWithinCooldown: async (issueId) => {
      try { return await didJustFailQA(issueId) }
      catch { return false }
    },

    isParentIssue: async (issueId) => {
      try { return await linearClient.isParentIssue(issueId) }
      catch { return false }
    },

    isHeld: async (issueId) => {
      try {
        const { isHeld } = await import('@supaku/agentfactory')
        return await isHeld(issueId)
      } catch { return false }
    },

    getOverridePriority: async (issueId) => {
      try {
        const { getOverridePriority } = await import('@supaku/agentfactory')
        return await getOverridePriority(issueId)
      } catch { return null }
    },

    getWorkflowStrategy: async (issueId) => {
      try {
        const state = await getWorkflowState(issueId)
        return state?.strategy
      } catch { return undefined }
    },

    isResearchCompleted: async (issueId) => {
      try { return await processingState.isPhaseCompleted(issueId, 'research') }
      catch { return false }
    },

    isBacklogCreationCompleted: async (issueId) => {
      try { return await processingState.isPhaseCompleted(issueId, 'backlog-creation') }
      catch { return false }
    },

    dispatchWork: async (issueId, action) => {
      const workType = actionToWorkType(action)
      console.log(`[governor] Dispatching: ${issueId} → ${action} (${workType})`)

      let issueIdentifier = issueId
      try {
        const issue = await linearClient.getIssue(issueId)
        issueIdentifier = issue.identifier
      } catch { /* use issueId as fallback */ }

      let sessionId: string | undefined
      try {
        const result = await linearClient.createAgentSessionOnIssue({ issueId })
        sessionId = result.sessionId
      } catch { /* queue without session */ }

      const work: QueuedWork = {
        sessionId: sessionId ?? `governor-${issueId}-${Date.now()}`,
        issueId,
        issueIdentifier,
        priority: 3,
        queuedAt: Date.now(),
        workType: workType as QueuedWork['workType'],
      }

      const queued = await queueWork(work)
      if (queued) {
        console.log(`[governor] Queued: ${issueIdentifier} → ${workType}`)
      } else {
        console.warn(`[governor] Failed to queue: ${issueIdentifier}`)
      }
    },
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs()

  if (args.projects.length === 0) {
    console.error('Error: at least one --project is required (or set GOVERNOR_PROJECTS env)')
    process.exit(1)
  }

  const linearApiKey = process.env.LINEAR_API_KEY
  if (!linearApiKey) {
    console.error('Error: LINEAR_API_KEY is required')
    process.exit(1)
  }

  if (!process.env.REDIS_URL) {
    console.error('Error: REDIS_URL is required')
    process.exit(1)
  }

  console.log('AgentFactory Governor')
  console.log('=====================')
  console.log(`Projects: ${args.projects.join(', ')}`)
  console.log(`Mode: ${args.mode}`)
  console.log(`Poll interval: ${args.scanIntervalMs}ms`)
  console.log(`Max dispatches: ${args.maxConcurrentDispatches}`)
  console.log('')

  // Wire real dependencies
  const linearClient = createLinearAgentClient({ apiKey: linearApiKey })
  initTouchpointStorage(new RedisOverrideStorage())
  const dependencies = createDependencies(linearClient)

  const governorConfig: GovernorConfig = {
    projects: args.projects,
    scanIntervalMs: args.scanIntervalMs,
    maxConcurrentDispatches: args.maxConcurrentDispatches,
    enableAutoResearch: args.enableAutoResearch,
    enableAutoBacklogCreation: args.enableAutoBacklogCreation,
    enableAutoDevelopment: args.enableAutoDevelopment,
    enableAutoQA: args.enableAutoQA,
    enableAutoAcceptance: args.enableAutoAcceptance,
    humanResponseTimeoutMs: 4 * 60 * 60 * 1000,
  }

  // -- Event-driven mode --
  if (args.mode === 'event-driven' && !args.once) {
    const eventBus = new RedisEventBus()
    const deduplicator = new RedisEventDeduplicator()

    const governor = new EventDrivenGovernor(
      {
        ...governorConfig,
        eventBus,
        deduplicator,
        pollIntervalMs: args.scanIntervalMs,
        enablePolling: true,
      },
      dependencies,
    )

    await governor.start()
    console.log('Governor running (event-driven). Press Ctrl+C to stop.')

    const shutdown = () => {
      console.log('\nShutting down governor...')
      governor.stop()
      process.exit(0)
    }
    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)
    return
  }

  // -- Poll-only mode --
  const governor = new WorkflowGovernor(governorConfig, dependencies)

  if (args.once) {
    const results = await governor.scanOnce()
    let totalDispatched = 0
    for (const r of results) {
      console.log(`[${r.project}] Scanned ${r.scannedIssues} issues, dispatched ${r.actionsDispatched}`)
      totalDispatched += r.actionsDispatched
    }
    console.log(`\nScan complete: ${totalDispatched} actions dispatched`)
    return
  }

  governor.start()
  console.log('Governor running (poll-only). Press Ctrl+C to stop.')

  const shutdown = () => {
    console.log('\nShutting down governor...')
    governor.stop()
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((err) => {
  console.error('Governor fatal error:', err)
  process.exit(1)
})
