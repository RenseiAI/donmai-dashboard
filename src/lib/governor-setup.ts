/**
 * Governor Setup — Wire RedisEventBus to Webhook Bridge
 *
 * Creates a RedisEventBus and registers it with the governor bridge so
 * that webhook handlers publish events to the governor's Redis Stream.
 *
 * This module is imported by config.ts and executed once at server startup.
 * The governor CLI process (cli/governor.ts) consumes from the same stream.
 */

import { RedisEventBus } from '@donmai/server'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- @renseiai/agentfactory-nextjs deprecated; retained pending route-handler migration to @donmai/server
import { setGovernorEventBus } from '@renseiai/agentfactory-nextjs'

/**
 * Initialize the governor event bus bridge.
 *
 * Only activates when GOVERNOR_MODE is 'event-bridge' or 'governor-only'.
 * In 'direct' mode (default), webhooks dispatch work directly without
 * publishing to the governor stream.
 */
export function initGovernorBridge(): void {
  const mode = process.env.GOVERNOR_MODE ?? 'direct'

  if (mode === 'direct') return

  const eventBus = new RedisEventBus()
  setGovernorEventBus(eventBus)

  console.log(`[governor-setup] Event bus initialized (mode: ${mode})`)
}
