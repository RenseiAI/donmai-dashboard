/**
 * Token Store — happy-path unit tests
 *
 * Tests both backends:
 *   - FileTokenStore (no external deps, always runs)
 *   - RedisTokenStore (uses ioredis-mock)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import os from 'os'
import path from 'path'
import fs from 'fs'

// We test the internals by importing the module with env manipulation.
// The singleton is reset between tests via _resetTokenStore.
import { getTokenStore, _resetTokenStore } from '../token-store'

// ============================================================
// File backend tests
// ============================================================

describe('FileTokenStore', () => {
  let tmpDir: string
  let origRedisUrl: string | undefined
  let origStorePath: string | undefined

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'donmai-test-'))
    origRedisUrl = process.env.REDIS_URL
    origStorePath = process.env.DONMAI_TOKEN_STORE_PATH
    // Force file backend
    delete process.env.REDIS_URL
    process.env.DONMAI_TOKEN_STORE_PATH = path.join(tmpDir, 'tokens.json')
    _resetTokenStore()
  })

  afterEach(() => {
    if (origRedisUrl !== undefined) process.env.REDIS_URL = origRedisUrl
    else delete process.env.REDIS_URL
    if (origStorePath !== undefined) process.env.DONMAI_TOKEN_STORE_PATH = origStorePath
    else delete process.env.DONMAI_TOKEN_STORE_PATH
    _resetTokenStore()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('mints a token with correct format', async () => {
    const store = getTokenStore()
    const { token, tokenId } = await store.mintToken('test-machine')
    expect(token).toMatch(/^dmk_[0-9a-f]{48}$/)
    expect(tokenId).toHaveLength(12)
    expect(tokenId).toMatch(/^[0-9a-f]{12}$/)
  })

  it('verifies a valid token', async () => {
    const store = getTokenStore()
    const { token } = await store.mintToken('my-worker')
    const result = await store.verifyToken(token)
    expect(result).not.toBeNull()
    expect(result?.label).toBe('my-worker')
  })

  it('rejects an unknown token', async () => {
    const store = getTokenStore()
    await store.mintToken('foo')
    // Manufacture a syntactically valid but unknown token
    const fake = `dmk_${'a'.repeat(48)}`
    const result = await store.verifyToken(fake)
    expect(result).toBeNull()
  })

  it('rejects a token with wrong format', async () => {
    const store = getTokenStore()
    expect(await store.verifyToken('not-a-token')).toBeNull()
    expect(await store.verifyToken('dmk_short')).toBeNull()
    expect(await store.verifyToken(`dmk_${'z'.repeat(48)}`)).toBeNull() // non-hex
  })

  it('creates a session and verifies it', async () => {
    const store = getTokenStore()
    const { tokenId } = await store.mintToken('worker-1')
    const sessionId = await store.createSession(tokenId)
    expect(sessionId).toMatch(/^sess_[0-9a-f]{64}$/)
    const sess = await store.verifySession(sessionId)
    expect(sess).not.toBeNull()
    expect(sess?.tokenId).toBe(tokenId)
  })

  it('rejects an unknown session', async () => {
    const store = getTokenStore()
    const fake = `sess_${'b'.repeat(64)}`
    expect(await store.verifySession(fake)).toBeNull()
  })

  it('revokes a token', async () => {
    const store = getTokenStore()
    const { token, tokenId } = await store.mintToken('revoke-me')
    expect(await store.verifyToken(token)).not.toBeNull()
    await store.revokeToken(tokenId)
    expect(await store.verifyToken(token)).toBeNull()
  })

  it('lists minted tokens', async () => {
    const store = getTokenStore()
    await store.mintToken('alpha')
    await store.mintToken('beta')
    const list = await store.listTokens()
    expect(list).toHaveLength(2)
    const labels = list.map(t => t.label).sort()
    expect(labels).toEqual(['alpha', 'beta'])
  })

  it('full lifecycle: mint → verify → session → verify session', async () => {
    const store = getTokenStore()
    const { token, tokenId } = await store.mintToken('lifecycle-test')
    const verified = await store.verifyToken(token)
    expect(verified?.tokenId).toBe(tokenId)
    const sessionId = await store.createSession(tokenId)
    const sess = await store.verifySession(sessionId)
    expect(sess?.tokenId).toBe(tokenId)
  })
})

// ============================================================
// Redis backend tests (using ioredis-mock)
// ============================================================

describe('RedisTokenStore', () => {
  let origRedisUrl: string | undefined

  beforeEach(() => {
    origRedisUrl = process.env.REDIS_URL
    // ioredis-mock intercepts when IORedisMock is used; we use require() in the
    // token-store factory. Mock ioredis via module override in this test file.
    process.env.REDIS_URL = 'redis://localhost:6379'
    _resetTokenStore()
  })

  afterEach(() => {
    if (origRedisUrl !== undefined) process.env.REDIS_URL = origRedisUrl
    else delete process.env.REDIS_URL
    _resetTokenStore()
  })

  // Swap the ioredis require() with ioredis-mock before the store is created.
  // vitest supports vi.mock() but we need dynamic interception; use Module
  // registration trick via require cache.
  function buildRedisStore() {
    // Inject ioredis-mock into require cache so getTokenStore() picks it up
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const IORedisMock = require('ioredis-mock')
    // ioredis-mock default export is the constructor
    const MockClass = IORedisMock.default ?? IORedisMock
    // Temporarily override require('ioredis')
    const Module = require('module')
    const originalLoad = Module._load
    Module._load = function (id: string, ...args: unknown[]) {
      if (id === 'ioredis') return { default: MockClass }
      return originalLoad.call(this, id, ...args)
    }
    const store = getTokenStore()
    Module._load = originalLoad
    return store
  }

  it('mints and verifies a token via Redis mock', async () => {
    const store = buildRedisStore()
    const { token } = await store.mintToken('redis-worker')
    const result = await store.verifyToken(token)
    expect(result).not.toBeNull()
    expect(result?.label).toBe('redis-worker')
  })

  it('creates and verifies a session via Redis mock', async () => {
    const store = buildRedisStore()
    const { tokenId } = await store.mintToken('redis-sess')
    const sessionId = await store.createSession(tokenId)
    expect(sessionId).toMatch(/^sess_[0-9a-f]{64}$/)
    const sess = await store.verifySession(sessionId)
    expect(sess?.tokenId).toBe(tokenId)
  })

  it('rejects an unknown token via Redis mock', async () => {
    const store = buildRedisStore()
    const fake = `dmk_${'c'.repeat(48)}`
    expect(await store.verifyToken(fake)).toBeNull()
  })
})
