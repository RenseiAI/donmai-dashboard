/**
 * Next.js Middleware — Edge Runtime Compatible
 *
 * Uses the /middleware subpath export which only loads Edge-compatible
 * modules. Do NOT import from the main barrel ('@renseiai/agentfactory-nextjs')
 * — it pulls in Node.js-only dependencies via re-exports.
 *
 * TODO(donmai-rebrand): @renseiai/agentfactory-nextjs is deprecated (no @donmai/* successor).
 * Route-handler logic should move into @donmai/server in a future wave.
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- deprecated package retained pending route-handler migration to @donmai/server
import { createAgentFactoryMiddleware } from '@renseiai/agentfactory-nextjs/middleware'

const { middleware } = createAgentFactoryMiddleware()

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
