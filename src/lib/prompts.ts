/**
 * Deployment-Specific Prompt Templates & Work Type Detection
 *
 * Delegates prompt generation and work type detection to @renseiai/agentfactory-linear
 * defaults, with deployment-specific keyword extensions and helper functions.
 *
 * IMPORTANT: Do NOT fork prompt generation here. The canonical prompts live in
 * @renseiai/agentfactory-linear's defaultGeneratePrompt. Bumping the package
 * version is all that's needed to pick up prompt changes.
 */

import {
  defaultGeneratePrompt,
  defaultDetectWorkTypeFromPrompt,
  defaultGetPriority,
  defaultBuildParentQAContext,
  defaultBuildParentAcceptanceContext,
} from '@renseiai/agentfactory-linear'
import type { AgentWorkType, SubIssueStatus, WorkflowContext } from '@renseiai/agentfactory-linear'

/**
 * Generate the appropriate prompt for a work type.
 *
 * Delegates to the canonical defaultGeneratePrompt from @renseiai/agentfactory-linear.
 */
export function generatePromptForWorkType(
  identifier: string,
  workType: AgentWorkType,
  mentionContext?: string,
  workflowContext?: WorkflowContext
): string {
  return defaultGeneratePrompt(identifier, workType, mentionContext, workflowContext)
}

/**
 * Detect work type from prompt, constrained to valid options for the current status.
 *
 * Delegates to the canonical defaultDetectWorkTypeFromPrompt from @renseiai/agentfactory-linear.
 */
export function detectWorkTypeFromPrompt(
  prompt: string,
  validWorkTypes: AgentWorkType[]
): AgentWorkType | undefined {
  return defaultDetectWorkTypeFromPrompt(prompt, validWorkTypes)
}

/**
 * Get priority for work type (lower = higher priority).
 *
 * Delegates to the canonical defaultGetPriority from @renseiai/agentfactory-linear.
 */
export function getPriorityForWorkType(workType: AgentWorkType): number {
  return defaultGetPriority(workType)
}

/**
 * Build enriched QA prompt context for parent issues with sub-issues.
 *
 * Delegates to the canonical defaultBuildParentQAContext from @renseiai/agentfactory-linear.
 */
export function buildParentQAContext(
  issueIdentifier: string,
  subIssueStatuses: SubIssueStatus[]
): string {
  return defaultBuildParentQAContext(issueIdentifier, subIssueStatuses)
}

/**
 * Build enriched acceptance prompt context for parent issues with sub-issues.
 *
 * Delegates to the canonical defaultBuildParentAcceptanceContext from @renseiai/agentfactory-linear.
 */
export function buildParentAcceptanceContext(
  issueIdentifier: string,
  subIssueStatuses: SubIssueStatus[]
): string {
  return defaultBuildParentAcceptanceContext(issueIdentifier, subIssueStatuses)
}

/**
 * Parse auto-trigger configuration from environment variables.
 */
export function parseAutoTriggerConfig() {
  return {
    enableAutoQA: process.env.ENABLE_AUTO_QA === 'true',
    enableAutoAcceptance: process.env.ENABLE_AUTO_ACCEPTANCE === 'true',
    autoQARequireAgentWorked: process.env.AUTO_QA_REQUIRE_AGENT_WORKED !== 'false',
    autoAcceptanceRequireAgentWorked: process.env.AUTO_ACCEPTANCE_REQUIRE_AGENT_WORKED !== 'false',
    autoQAProjects: process.env.AUTO_QA_PROJECTS
      ? process.env.AUTO_QA_PROJECTS.split(',').map(p => p.trim()).filter(Boolean)
      : [],
    autoAcceptanceProjects: process.env.AUTO_ACCEPTANCE_PROJECTS
      ? process.env.AUTO_ACCEPTANCE_PROJECTS.split(',').map(p => p.trim()).filter(Boolean)
      : [],
    autoQAExcludeLabels: process.env.AUTO_QA_EXCLUDE_LABELS
      ? process.env.AUTO_QA_EXCLUDE_LABELS.split(',').map(l => l.trim()).filter(Boolean)
      : [],
    autoAcceptanceExcludeLabels: process.env.AUTO_ACCEPTANCE_EXCLUDE_LABELS
      ? process.env.AUTO_ACCEPTANCE_EXCLUDE_LABELS.split(',').map(l => l.trim()).filter(Boolean)
      : [],
  }
}
