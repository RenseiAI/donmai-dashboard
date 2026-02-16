#!/usr/bin/env tsx
/**
 * Log Analyzer CLI — thin wrapper over @supaku/agentfactory-cli
 *
 * Usage:
 *   pnpm analyze-logs [options]
 *
 * Options:
 *   --session <id>    Analyze a specific session
 *   --follow, -f      Watch for new sessions continuously
 *   --interval <ms>   Poll interval in ms (default: 5000)
 *   --dry-run         Preview without creating issues
 *   --cleanup         Remove old logs
 *   --verbose         Detailed output
 */

import path from 'path'
import { config } from 'dotenv'

config({ path: path.resolve(import.meta.dirname, '..', '.env.local') })

import { runLogAnalyzer } from '@supaku/agentfactory-cli/analyze-logs'

function parseArgs() {
  const args = process.argv.slice(2)
  const opts: Record<string, string | boolean> = {}
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--session' && args[i + 1]) opts.sessionId = args[++i]
    else if (arg === '--follow' || arg === '-f') opts.follow = true
    else if (arg === '--interval' && args[i + 1]) opts.interval = args[++i]
    else if (arg === '--dry-run') opts.dryRun = true
    else if (arg === '--cleanup') opts.cleanup = true
    else if (arg === '--verbose') opts.verbose = true
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: pnpm analyze-logs [--session <id>] [--follow] [--interval <ms>] [--dry-run] [--cleanup] [--verbose]')
      process.exit(0)
    }
  }
  return opts
}

const args = parseArgs()

const controller = new AbortController()
process.on('SIGINT', () => controller.abort())
process.on('SIGTERM', () => controller.abort())

runLogAnalyzer(
  {
    sessionId: args.sessionId as string | undefined,
    follow: !!args.follow,
    interval: args.interval ? Number(args.interval) : undefined,
    dryRun: !!args.dryRun,
    cleanup: !!args.cleanup,
    verbose: !!args.verbose,
  },
  controller.signal,
).catch((err) => {
  if (err?.name !== 'AbortError') {
    console.error('Analyzer failed:', err)
    process.exit(1)
  }
})
