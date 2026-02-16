import { createAgentFactoryMiddleware } from '@supaku/agentfactory-nextjs'

const { middleware } = createAgentFactoryMiddleware()

export { middleware }

// Must be a static object literal for Next.js build analysis
export const config = {
  matcher: [
    '/api/:path*',
    '/webhook',
    '/dashboard',
    '/pipeline',
    '/settings',
    '/sessions/:path*',
    '/',
  ],
}
