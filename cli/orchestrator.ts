#!/usr/bin/env tsx
/**
 * Agent Orchestrator CLI — thin wrapper over @supaku/agentfactory-cli
 *
 * Usage:
 *   pnpm orchestrator [options]
 *
 * Options:
 *   --project <name>    Filter issues by project name
 *   --max <number>      Maximum concurrent agents (default: 3)
 *   --single <id>       Process a single issue by ID
 *   --no-wait           Don't wait for agents to complete
 *   --dry-run           Show what would be done without executing
 */

import path from 'path'
import { config } from 'dotenv'

config({ path: path.resolve(import.meta.dirname, '..', '.env.local') })

import { runOrchestrator } from '@supaku/agentfactory-cli/orchestrator'

function parseArgs() {
  const args = process.argv.slice(2)
  const opts: Record<string, string | boolean> = {}
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--project' && args[i + 1]) opts.project = args[++i]
    else if (arg === '--max' && args[i + 1]) opts.max = args[++i]
    else if (arg === '--single' && args[i + 1]) opts.single = args[++i]
    else if (arg === '--no-wait') opts.wait = false
    else if (arg === '--dry-run') opts.dryRun = true
  }
  return opts
}

const args = parseArgs()

const linearApiKey = process.env.LINEAR_API_KEY
if (!linearApiKey) {
  console.error('Error: LINEAR_API_KEY not set')
  process.exit(1)
}

runOrchestrator({
  linearApiKey,
  project: args.project as string | undefined,
  max: args.max ? Number(args.max) : undefined,
  single: args.single as string | undefined,
  wait: args.wait !== false,
  dryRun: !!args.dryRun,
}).then((result) => {
  if (result.errors.length > 0) process.exit(1)
}).catch((err) => {
  console.error('Orchestrator failed:', err)
  process.exit(1)
})
