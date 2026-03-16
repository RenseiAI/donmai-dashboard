/**
 * Agentfactory Configuration — Central Route Wiring
 *
 * Connects deployment-specific callbacks (prompt templates, work type detection,
 * Linear client resolution) to @renseiai/agentfactory-nextjs route factories.
 */

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
