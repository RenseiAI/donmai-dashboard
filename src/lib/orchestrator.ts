/**
 * Webhook Orchestrator — Thin wrapper over @supaku/agentfactory-nextjs
 *
 * Adds Supaku-specific behavior: marking issues as "agent-worked"
 * when agents complete, enabling automated QA pickup.
 */

import { createWebhookOrchestrator } from '@supaku/agentfactory-nextjs'
import { markAgentWorked, createLogger } from '@supaku/agentfactory-server'

const log = createLogger('orchestrator')

export const orchestrator = createWebhookOrchestrator(undefined, {
  onAgentComplete: async (agent) => {
    try {
      await markAgentWorked(agent.issueId, {
        issueIdentifier: agent.identifier,
        sessionId: agent.sessionId ?? 'unknown',
      })
      log.info('Issue marked as agent-worked', {
        issueId: agent.issueId,
        issueIdentifier: agent.identifier,
      })
    } catch (err) {
      log.error('Failed to mark agent-worked', { error: err })
    }
  },
})

// Re-export instance methods for backward compatibility
export const {
  spawnAgentAsync,
  stopAgentBySession,
  getAgentBySession,
  isAgentRunningForIssue,
  forwardPromptAsync,
} = orchestrator
