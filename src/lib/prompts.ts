/**
 * Supaku-Specific Prompt Templates & Work Type Detection
 *
 * Delegates prompt generation and work type detection to @supaku/agentfactory-linear
 * defaults, with Supaku-specific keyword extensions and helper functions.
 *
 * IMPORTANT: Do NOT fork prompt generation here. The canonical prompts live in
 * @supaku/agentfactory-linear's defaultGeneratePrompt. Bumping the package
 * version is all that's needed to pick up prompt changes.
 */

import {
  defaultGeneratePrompt,
  defaultDetectWorkTypeFromPrompt,
} from '@supaku/agentfactory-linear'
import type { AgentWorkType, SubIssueStatus, WorkflowContext } from '@supaku/agentfactory-linear'

/**
 * Generate the appropriate prompt for a work type.
 *
 * Delegates to the canonical defaultGeneratePrompt from @supaku/agentfactory-linear.
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
 * Delegates to the canonical defaultDetectWorkTypeFromPrompt from @supaku/agentfactory-linear.
 */
export function detectWorkTypeFromPrompt(
  prompt: string,
  validWorkTypes: AgentWorkType[]
): AgentWorkType | undefined {
  return defaultDetectWorkTypeFromPrompt(prompt, validWorkTypes)
}

/**
 * Get priority for work type (lower = higher priority).
 */
export function getPriorityForWorkType(workType: AgentWorkType): number {
  switch (workType) {
    case 'qa': return 2
    case 'acceptance': return 2
    case 'refinement': return 2
    case 'inflight': return 2
    case 'backlog-creation': return 3
    case 'development': return 3
    case 'research': return 4
    case 'coordination': return 2
    case 'qa-coordination': return 2
    case 'acceptance-coordination': return 2
    case 'refinement-coordination': return 2
    default: return 5
  }
}

/**
 * Build enriched QA prompt context for parent issues with sub-issues.
 */
export function buildParentQAContext(
  issueIdentifier: string,
  subIssueStatuses: SubIssueStatus[]
): string {
  const subIssueList = subIssueStatuses
    .map(s => `- ${s.identifier}: ${s.title} (Status: ${s.status})`)
    .join('\n')

  return `QA ${issueIdentifier} (parent issue with ${subIssueStatuses.length} sub-issues).

## Sub-Issues
${subIssueList}

## Holistic QA Instructions
This is a parent issue whose work was coordinated across multiple sub-issues.
You MUST perform holistic validation beyond individual sub-issue checks:

1. **Scope Coverage**: Read each sub-issue description via \`pnpm af-linear get-issue <identifier>\` and verify the PR includes implementation for ALL sub-issues.
2. **Integration Validation**: Check that shared types, API contracts, and data flow between sub-issue implementations are consistent and correct.
3. **Cross-Cutting Concerns**: Verify consistent error handling, auth patterns, naming conventions, and no orphaned/dead code across all sub-issue changes.
4. **Sub-Issue Status**: All sub-issues must be in Finished, Delivered, or Accepted status.

Validate the implementation against the parent issue's acceptance criteria as a whole, not just each sub-issue in isolation.`
}

/**
 * Build enriched acceptance prompt context for parent issues with sub-issues.
 */
export function buildParentAcceptanceContext(
  issueIdentifier: string,
  subIssueStatuses: SubIssueStatus[]
): string {
  const subIssueList = subIssueStatuses
    .map(s => `- ${s.identifier}: ${s.title} (Status: ${s.status})`)
    .join('\n')

  return `Process acceptance for ${issueIdentifier} (parent issue with ${subIssueStatuses.length} sub-issues).

## Sub-Issues
${subIssueList}

## Parent Issue Acceptance Requirements
This is a parent issue with coordinated sub-issues. Before merging:

1. **Sub-Issue Status**: ALL sub-issues must be in **Delivered** or **Accepted** status (not just Finished).
2. **PR Completeness**: The single PR should contain changes for all sub-issues.
3. **CI/Deployment**: Verify the combined PR passes CI and deploys successfully.

Validate development and QA work is complete, verify PR is ready to merge (CI passing, no conflicts), merge the PR.
After merge succeeds, delete the remote branch: git push origin --delete <BRANCH_NAME>`
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
