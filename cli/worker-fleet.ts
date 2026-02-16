#!/usr/bin/env tsx
import path from 'path'
import { config } from 'dotenv'

// Load environment from .env.local
config({ path: path.resolve(import.meta.dirname, '..', '.env.local') })

import { runWorkerFleet } from '@supaku/agentfactory-cli/worker-fleet'

const apiUrl = process.env.WORKER_API_URL
const apiKey = process.env.WORKER_API_KEY

if (!apiUrl || !apiKey) {
  console.error('Missing WORKER_API_URL or WORKER_API_KEY in .env.local')
  process.exit(1)
}

runWorkerFleet({
  apiUrl,
  apiKey,
}).catch((err) => {
  console.error('Worker fleet failed:', err)
  process.exit(1)
})
