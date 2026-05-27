/**
 * Token Store — anon-token auth backend
 *
 * Two implementations:
 *   RedisTokenStore  — used when REDIS_URL is set
 *   FileTokenStore   — JSON file fallback at DONMAI_TOKEN_STORE_PATH (default: .donmai/tokens.json)
 *
 * Token format: dmk_<48 hex chars>  (prefix + 24 random bytes hex-encoded)
 * Session format: sess_<64 hex chars> (prefix + 32 random bytes hex-encoded)
 */

import { createHash, randomBytes, timingSafeEqual } from 'crypto'
import fs from 'fs'
import path from 'path'
import type { Redis } from 'ioredis'

// ============================================================
// Shared helpers
// ============================================================

/** Generate a new dmk_* token. Returns both raw token and tokenId (first 12 hex chars). */
function generateToken(): { token: string; tokenId: string } {
  const hex = randomBytes(24).toString('hex')
  const token = `dmk_${hex}`
  const tokenId = hex.slice(0, 12)
  return { token, tokenId }
}

/** Generate a new sess_* session id. */
function generateSessionId(): string {
  return `sess_${randomBytes(32).toString('hex')}`
}

/** SHA-256 hash of a string value. */
function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

const SESSION_TTL_SECONDS = 2592000 // 30 days

// ============================================================
// Interface
// ============================================================

export interface TokenRecord {
  id: string
  label: string
  createdAt: number
  lastUsed: number | null
}

export interface TokenStore {
  mintToken(label: string): Promise<{ token: string; tokenId: string }>
  verifyToken(token: string): Promise<{ tokenId: string; label: string } | null>
  createSession(tokenId: string): Promise<string>
  verifySession(sessionId: string): Promise<{ tokenId: string } | null>
  revokeToken(tokenId: string): Promise<void>
  listTokens(): Promise<TokenRecord[]>
}

// ============================================================
// Redis implementation
// ============================================================

class RedisTokenStore implements TokenStore {
  private client: Redis

  constructor(client: Redis) {
    this.client = client
  }

  async mintToken(label: string): Promise<{ token: string; tokenId: string }> {
    const { token, tokenId } = generateToken()
    const tokenHash = sha256(token)
    const now = Date.now()
    const record = JSON.stringify({ tokenHash, label, createdAt: now, lastUsed: null, claimedAt: null })
    await this.client.set(`donmai:token:${tokenId}`, record)
    return { token, tokenId }
  }

  async verifyToken(token: string): Promise<{ tokenId: string; label: string } | null> {
    if (!/^dmk_[0-9a-f]{48}$/.test(token)) return null
    const tokenId = token.slice(4, 16) // first 12 hex chars after prefix
    const raw = await this.client.get(`donmai:token:${tokenId}`)
    if (!raw) return null
    let record: { tokenHash: string; label: string; createdAt: number; lastUsed: number | null }
    try {
      record = JSON.parse(raw)
    } catch {
      return null
    }
    const incomingHash = sha256(token)
    const storedHashBuf = Buffer.from(record.tokenHash, 'hex')
    const incomingHashBuf = Buffer.from(incomingHash, 'hex')
    if (!timingSafeEqual(storedHashBuf, incomingHashBuf)) return null

    // Update lastUsed
    const updated = JSON.stringify({ ...record, lastUsed: Date.now() })
    await this.client.set(`donmai:token:${tokenId}`, updated)
    return { tokenId, label: record.label }
  }

  async createSession(tokenId: string): Promise<string> {
    const sessionId = generateSessionId()
    const now = Date.now()
    const record = JSON.stringify({ tokenId, createdAt: now, lastUsed: now })
    await this.client.set(`donmai:session:${sessionId}`, record, 'EX', SESSION_TTL_SECONDS)
    return sessionId
  }

  async verifySession(sessionId: string): Promise<{ tokenId: string } | null> {
    if (!/^sess_[0-9a-f]{64}$/.test(sessionId)) return null
    const raw = await this.client.get(`donmai:session:${sessionId}`)
    if (!raw) return null
    let record: { tokenId: string; createdAt: number; lastUsed: number }
    try {
      record = JSON.parse(raw)
    } catch {
      return null
    }
    // Rolling TTL — reset expiry on each verify
    const now = Date.now()
    const updated = JSON.stringify({ ...record, lastUsed: now })
    await this.client.set(`donmai:session:${sessionId}`, updated, 'EX', SESSION_TTL_SECONDS)
    return { tokenId: record.tokenId }
  }

  async revokeToken(tokenId: string): Promise<void> {
    await this.client.del(`donmai:token:${tokenId}`)
  }

  async listTokens(): Promise<TokenRecord[]> {
    const keys = await this.client.keys('donmai:token:*')
    const results: TokenRecord[] = []
    for (const key of keys) {
      const raw = await this.client.get(key)
      if (!raw) continue
      try {
        const record = JSON.parse(raw)
        const id = key.replace('donmai:token:', '')
        results.push({ id, label: record.label, createdAt: record.createdAt, lastUsed: record.lastUsed })
      } catch {
        // skip corrupt records
      }
    }
    return results
  }
}

// ============================================================
// File-based implementation
// ============================================================

interface FileStoreData {
  tokens: Array<{
    id: string
    tokenHash: string
    label: string
    createdAt: number
    lastUsed: number | null
    claimedAt: number | null
  }>
  sessions: Array<{
    id: string
    tokenId: string
    createdAt: number
    lastUsed: number
  }>
}

class FileTokenStore implements TokenStore {
  private filePath: string

  constructor(filePath: string) {
    this.filePath = filePath
  }

  private async read(): Promise<FileStoreData> {
    try {
      const raw = await fs.promises.readFile(this.filePath, 'utf8')
      return JSON.parse(raw) as FileStoreData
    } catch {
      return { tokens: [], sessions: [] }
    }
  }

  private async write(data: FileStoreData): Promise<void> {
    const dir = path.dirname(this.filePath)
    await fs.promises.mkdir(dir, { recursive: true })
    const tmp = `${this.filePath}.tmp.${process.pid}`
    await fs.promises.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8')
    await fs.promises.rename(tmp, this.filePath)
  }

  /** Prune expired sessions (older than SESSION_TTL_SECONDS) lazily. */
  private pruneExpiredSessions(data: FileStoreData): FileStoreData {
    const cutoff = Date.now() - SESSION_TTL_SECONDS * 1000
    return {
      ...data,
      sessions: data.sessions.filter(s => s.lastUsed > cutoff),
    }
  }

  async mintToken(label: string): Promise<{ token: string; tokenId: string }> {
    const { token, tokenId } = generateToken()
    const tokenHash = sha256(token)
    const now = Date.now()
    const data = await this.read()
    data.tokens.push({ id: tokenId, tokenHash, label, createdAt: now, lastUsed: null, claimedAt: null })
    await this.write(data)
    return { token, tokenId }
  }

  async verifyToken(token: string): Promise<{ tokenId: string; label: string } | null> {
    if (!/^dmk_[0-9a-f]{48}$/.test(token)) return null
    const incomingHash = sha256(token)
    const data = await this.read()
    const record = data.tokens.find(t => {
      const storedHashBuf = Buffer.from(t.tokenHash, 'hex')
      const incomingHashBuf = Buffer.from(incomingHash, 'hex')
      if (storedHashBuf.length !== incomingHashBuf.length) return false
      return timingSafeEqual(storedHashBuf, incomingHashBuf)
    })
    if (!record) return null
    // Update lastUsed
    record.lastUsed = Date.now()
    await this.write(data)
    return { tokenId: record.id, label: record.label }
  }

  async createSession(tokenId: string): Promise<string> {
    const sessionId = generateSessionId()
    const now = Date.now()
    const data = this.pruneExpiredSessions(await this.read())
    data.sessions.push({ id: sessionId, tokenId, createdAt: now, lastUsed: now })
    await this.write(data)
    return sessionId
  }

  async verifySession(sessionId: string): Promise<{ tokenId: string } | null> {
    if (!/^sess_[0-9a-f]{64}$/.test(sessionId)) return null
    const cutoff = Date.now() - SESSION_TTL_SECONDS * 1000
    const data = this.pruneExpiredSessions(await this.read())
    const record = data.sessions.find(s => s.id === sessionId)
    if (!record || record.lastUsed < cutoff) return null
    // Rolling TTL
    record.lastUsed = Date.now()
    await this.write(data)
    return { tokenId: record.tokenId }
  }

  async revokeToken(tokenId: string): Promise<void> {
    const data = await this.read()
    data.tokens = data.tokens.filter(t => t.id !== tokenId)
    await this.write(data)
  }

  async listTokens(): Promise<TokenRecord[]> {
    const data = await this.read()
    return data.tokens.map(t => ({ id: t.id, label: t.label, createdAt: t.createdAt, lastUsed: t.lastUsed }))
  }
}

// ============================================================
// Factory / singleton
// ============================================================

let _instance: TokenStore | null = null

export function getTokenStore(): TokenStore {
  if (_instance) return _instance

  const redisUrl = process.env.REDIS_URL
  if (redisUrl) {
    // Lazy-import ioredis to avoid Edge Runtime issues (token-store is Node-only)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { default: Redis } = require('ioredis') as { default: new (url: string) => Redis }
    _instance = new RedisTokenStore(new Redis(redisUrl))
  } else {
    const filePath = process.env.DONMAI_TOKEN_STORE_PATH ?? '.donmai/tokens.json'
    _instance = new FileTokenStore(filePath)
  }
  return _instance
}

/** Reset the singleton — used in tests only. */
export function _resetTokenStore(): void {
  _instance = null
}
