/**
 * Webhook Orchestrator — Thin wrapper over route factory
 *
 * Adds deployment-specific behavior: marking issues as "agent-worked"
 * when agents complete, enabling automated QA pickup.
 *
 * TODO(donmai-rebrand): @renseiai/agentfactory-nextjs is deprecated (no @donmai/* successor).
 * Route-handler logic should move into @donmai/server in a future wave.
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- deprecated package retained pending route-handler migration to @donmai/server
import { createWebhookOrchestrator } from '@renseiai/agentfactory-nextjs'
import { markAgentWorked, createLogger } from '@donmai/server'

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
