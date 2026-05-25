/**
 * Donmai Configuration — Central Route Wiring
 *
 * Connects deployment-specific callbacks (prompt templates, work type detection,
 * Linear client resolution) to route factories.
 *
 * TODO(donmai-rebrand): @renseiai/agentfactory-nextjs is deprecated (no @donmai/* successor).
 * Route-handler logic should move into @donmai/server in a future wave.
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- deprecated package retained pending route-handler migration to @donmai/server
import { createAllRoutes, createDefaultLinearClientResolver } from '@renseiai/agentfactory-nextjs'
import {
  generatePromptForWorkType,
  detectWorkTypeFromPrompt,
  getPriorityForWorkType,
  parseAutoTriggerConfig,
  buildParentQAContext,
  buildParentAcceptanceContext,
} from './prompts'
import { initGovernorBridge } from './governor-setup'

// Wire governor event bus for webhook → governor event bridging
initGovernorBridge()

const governorMode = (process.env.GOVERNOR_MODE ?? 'direct') as 'direct' | 'event-bridge' | 'governor-only'

export const routes = createAllRoutes({
  linearClient: createDefaultLinearClientResolver(),
  generatePrompt: generatePromptForWorkType,
  detectWorkTypeFromPrompt,
  getPriority: getPriorityForWorkType,
  autoTrigger: parseAutoTriggerConfig(),
  buildParentQAContext,
  buildParentAcceptanceContext,
  governorMode,
})
