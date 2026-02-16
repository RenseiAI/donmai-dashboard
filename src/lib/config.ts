/**
 * Agentfactory Configuration — Central Route Wiring
 *
 * Connects Supaku-specific callbacks (prompt templates, work type detection,
 * Linear client resolution) to @supaku/agentfactory-nextjs route factories.
 */

import { createAllRoutes, createDefaultLinearClientResolver } from '@supaku/agentfactory-nextjs'
import {
  generatePromptForWorkType,
  detectWorkTypeFromPrompt,
  getPriorityForWorkType,
  parseAutoTriggerConfig,
  buildParentQAContext,
  buildParentAcceptanceContext,
} from './prompts'

export const routes = createAllRoutes({
  linearClient: createDefaultLinearClientResolver(),
  generatePrompt: generatePromptForWorkType,
  detectWorkTypeFromPrompt,
  getPriority: getPriorityForWorkType,
  autoTrigger: parseAutoTriggerConfig(),
  buildParentQAContext,
  buildParentAcceptanceContext,
})
