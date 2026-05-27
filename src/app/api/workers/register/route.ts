/**
 * POST /api/workers/register
 *
 * Additive auth: accepts WORKER_API_KEY (existing) OR a valid dmk_* machine
 * token (Phase 3 anon-token auth). The library handler is called after auth
 * is resolved so all registration logic remains in one place.
 */
import { routes } from '@/lib/config'
import { withWorkerAuth } from '@/lib/auth/worker-auth'

export const POST = withWorkerAuth(routes.workers.register.POST as (req: Request, ctx?: unknown) => Promise<Response>)
