/**
 * GET /api/workers/[id]/poll
 *
 * Additive auth: accepts WORKER_API_KEY (existing) OR a valid dmk_* machine
 * token (Phase 3 anon-token auth).
 */
import { routes } from '@/lib/config'
import { withWorkerAuth } from '@/lib/auth/worker-auth'

export const GET = withWorkerAuth(routes.workers.poll.GET as (req: Request, ctx?: unknown) => Promise<Response>)
