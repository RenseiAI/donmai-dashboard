/**
 * Next.js Middleware — Edge Runtime Compatible
 *
 * Uses the /middleware subpath export which only loads Edge-compatible
 * modules. Do NOT import from the main barrel ('@renseiai/agentfactory-nextjs')
 * — it pulls in Node.js-only dependencies via re-exports.
 *
 * Auth routes (/api/auth/*) are declared as passthrough so the library
 * middleware does not apply WORKER_API_KEY checks to them. The claim
 * endpoint handles its own token validation in the route handler.
 *
 * TODO(donmai-rebrand): @renseiai/agentfactory-nextjs is deprecated (no @donmai/* successor).
 * Route-handler logic should move into @donmai/server in a future wave.
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- deprecated package retained pending route-handler migration to @donmai/server
import { createAgentFactoryMiddleware } from '@renseiai/agentfactory-nextjs/middleware'

const { middleware } = createAgentFactoryMiddleware({
  routes: {
    // /api/auth/* has its own auth logic in the route handlers; exempt from
    // WORKER_API_KEY check. Also exempt /api/workers/* so our local override
    // routes can apply additive dmk_* token auth on top of WORKER_API_KEY.
    passthrough: ['/api/cleanup', '/api/auth/', '/api/workers/'],
  },
})

export { middleware }

// Must be a static object literal for Next.js build analysis
export const config = {
  matcher: [
    '/api/:path*',
    '/webhook',
    '/pipeline',
    '/settings',
    '/sessions/:path*',
    '/',
  ],
}
