/**
 * GET /api/auth/claim?token=<dmk_*>
 *
 * Validates an anon machine token, creates a 30-day rolling session cookie,
 * and redirects the browser to /dashboard.
 *
 * Consumed by `donmai token claim <token>` CLI command and the browser link
 * that admins share with new machines.
 */

export const dynamic = 'force-dynamic'

import { getTokenStore } from '@/lib/auth/token-store'

const TOKEN_REGEX = /^dmk_[0-9a-f]{48}$/

export async function GET(request: Request) {
  const url = new URL(request.url)
  const token = url.searchParams.get('token')

  if (!token || !TOKEN_REGEX.test(token)) {
    return new Response('invalid token', { status: 400 })
  }

  const store = getTokenStore()
  const verified = await store.verifyToken(token)
  if (!verified) {
    return new Response('unknown token', { status: 401 })
  }

  const sessionId = await store.createSession(verified.tokenId)

  return new Response(null, {
    status: 302,
    headers: {
      Location: '/dashboard',
      'Set-Cookie': `donmai_session=${sessionId}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`,
    },
  })
}
