#!/usr/bin/env tsx
/**
 * Queue Admin CLI — thin wrapper over @supaku/agentfactory-cli
 *
 * Usage:
 *   pnpm queue-admin <command> [session-id]
 *
 * Commands:
 *   list          List all queued work items
 *   sessions      List all sessions
 *   workers       List registered workers
 *   clear-claims  Clear work claims
 *   clear-queue   Clear the work queue
 *   clear-all     Clear queue and all sessions
 *   reset         Reset everything
 *   remove <id>   Remove a specific session
 */

import path from 'path'
import { config } from 'dotenv'

config({ path: path.resolve(import.meta.dirname, '..', '.env.local') })

import { runQueueAdmin, type QueueAdminCommand } from '@supaku/agentfactory-cli/queue-admin'

const command = process.argv[2] as QueueAdminCommand
const sessionId = process.argv[3]

if (!command) {
  console.error('Usage: pnpm queue-admin <command> [session-id]')
  console.error('Commands: list, sessions, workers, clear-claims, clear-queue, clear-all, reset, remove')
  process.exit(1)
}

runQueueAdmin({ command, sessionId }).catch((err) => {
  console.error('Queue admin failed:', err)
  process.exit(1)
})
