/**
 * GET /api/auth/claim — route handler tests
 *
 * Tests:
 *   1. Valid token → 302 + Set-Cookie header pointing to /dashboard
 *   2. Missing/invalid token format → 400
 *   3. Syntactically valid but unknown token → 401
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { _resetTokenStore } from '@/lib/auth/token-store'

// We import the handler after setting up the mock store
async function importHandler() {
  // Re-import to pick up fresh module state
  return import('../route')
}

describe('GET /api/auth/claim', () => {
  let origRedisUrl: string | undefined
  let origStorePath: string | undefined
  let tmpDir: string

  beforeEach(async () => {
    // Use file backend pointing at a temp path so tests are isolated
    const os = await import('os')
    const path = await import('path')
    const fs = await import('fs')
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claim-test-'))

    origRedisUrl = process.env.REDIS_URL
    origStorePath = process.env.DONMAI_TOKEN_STORE_PATH
    delete process.env.REDIS_URL
    process.env.DONMAI_TOKEN_STORE_PATH = `${tmpDir}/tokens.json`
    _resetTokenStore()
  })

  afterEach(async () => {
    if (origRedisUrl !== undefined) process.env.REDIS_URL = origRedisUrl
    else delete process.env.REDIS_URL
    if (origStorePath !== undefined) process.env.DONMAI_TOKEN_STORE_PATH = origStorePath
    else delete process.env.DONMAI_TOKEN_STORE_PATH
    _resetTokenStore()

    const fs = await import('fs')
    fs.rmSync(tmpDir, { recursive: true, force: true })
    vi.resetModules()
  })

  it('returns 400 when no token is provided', async () => {
    const { GET } = await importHandler()
    const request = new Request('http://localhost/api/auth/claim')
    const response = await GET(request)
    expect(response.status).toBe(400)
    expect(await response.text()).toBe('invalid token')
  })

  it('returns 400 for token with invalid format', async () => {
    const { GET } = await importHandler()
    const request = new Request('http://localhost/api/auth/claim?token=not-a-token')
    const response = await GET(request)
    expect(response.status).toBe(400)
  })

  it('returns 400 for token that is too short', async () => {
    const { GET } = await importHandler()
    const request = new Request('http://localhost/api/auth/claim?token=dmk_abc123')
    const response = await GET(request)
    expect(response.status).toBe(400)
  })

  it('returns 401 for a syntactically valid but unknown token', async () => {
    const { GET } = await importHandler()
    const fakeToken = `dmk_${'d'.repeat(48)}`
    const request = new Request(`http://localhost/api/auth/claim?token=${fakeToken}`)
    const response = await GET(request)
    expect(response.status).toBe(401)
    expect(await response.text()).toBe('unknown token')
  })

  it('returns 302 with Set-Cookie for a valid minted token', async () => {
    const { getTokenStore } = await import('@/lib/auth/token-store')
    const store = getTokenStore()
    const { token } = await store.mintToken('test-machine')

    const { GET } = await importHandler()
    const request = new Request(`http://localhost/api/auth/claim?token=${token}`)
    const response = await GET(request)

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/dashboard')

    const cookie = response.headers.get('set-cookie') ?? ''
    expect(cookie).toMatch(/^donmai_session=sess_[0-9a-f]{64}/)
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('Secure')
    expect(cookie).toContain('SameSite=Lax')
    expect(cookie).toContain('Max-Age=2592000')
  })

  it('returns distinct sessions on repeated claims with same token', async () => {
    const { getTokenStore } = await import('@/lib/auth/token-store')
    const store = getTokenStore()
    const { token } = await store.mintToken('repeat-machine')

    const { GET } = await importHandler()

    const r1 = await GET(new Request(`http://localhost/api/auth/claim?token=${token}`))
    const r2 = await GET(new Request(`http://localhost/api/auth/claim?token=${token}`))

    const c1 = (r1.headers.get('set-cookie') ?? '').split(';')[0]
    const c2 = (r2.headers.get('set-cookie') ?? '').split(';')[0]
    expect(c1).not.toBe(c2)
  })
})
