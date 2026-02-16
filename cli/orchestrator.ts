#!/usr/bin/env tsx
import path from 'path'
import { config } from 'dotenv'

// Load environment from .env.local
config({ path: path.resolve(import.meta.dirname, '..', '.env.local') })

import { runOrchestrator } from '@supaku/agentfactory-cli/orchestrator'

const project = process.argv.find((_, i, a) => a[i - 1] === '--project') ?? undefined
const single = process.argv.find((_, i, a) => a[i - 1] === '--single') ?? undefined
const dryRun = process.argv.includes('--dry-run')
const max = Number(process.argv.find((_, i, a) => a[i - 1] === '--max')) || 3

runOrchestrator({
  project,
  single,
  dryRun,
  max,
}).catch((err) => {
  console.error('Orchestrator failed:', err)
  process.exit(1)
})
