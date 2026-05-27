/**
 * POST /api/workers/[id]/heartbeat
 *
 * Additive auth: accepts WORKER_API_KEY (existing) OR a valid dmk_* machine
 * token (Phase 3 anon-token auth).
 */
import { routes } from '@/lib/config'
import { withWorkerAuth } from '@/lib/auth/worker-auth'

export const POST = withWorkerAuth(routes.workers.heartbeat.POST as (req: Request, ctx?: unknown) => Promise<Response>)
