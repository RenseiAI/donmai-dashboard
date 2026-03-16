/**
 * Webhook Orchestrator — Thin wrapper over @renseiai/agentfactory-nextjs
 *
 * Adds deployment-specific behavior: marking issues as "agent-worked"
 * when agents complete, enabling automated QA pickup.
 */

import { createWebhookOrchestrator } from '@renseiai/agentfactory-nextjs'
import { markAgentWorked, createLogger } from '@renseiai/agentfactory-server'

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
