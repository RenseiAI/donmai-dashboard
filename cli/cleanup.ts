#!/usr/bin/env tsx
import path from 'path'
import { config } from 'dotenv'

// Load environment from .env.local
config({ path: path.resolve(import.meta.dirname, '..', '.env.local') })

import { runCleanup } from '@supaku/agentfactory-cli/cleanup'

const dryRun = process.argv.includes('--dry-run')

runCleanup({ dryRun }).catch((err) => {
  console.error('Cleanup failed:', err)
  process.exit(1)
})
