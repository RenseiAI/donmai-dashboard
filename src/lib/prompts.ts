/**
 * Supaku-Specific Prompt Templates & Work Type Detection
 *
 * These are the Supaku-specific callbacks passed to @supaku/agentfactory-nextjs.
 * They define how prompts are generated for each work type and how keywords
 * map to work type routing.
 */

import type { AgentWorkType, SubIssueStatus } from '@supaku/agentfactory-linear'

/**
 * Keywords that map to each work type.
 * Used for keyword-based routing from promptContext.
 */
const WORK_TYPE_KEYWORDS: Record<AgentWorkType, string[]> = {
  'backlog-creation': [
    'create backlog', 'write stories', 'create stories', 'create issues',
    'generate issues', 'make issues', 'turn into issues', 'break down',
    'break this down', 'split into issues', 'backlog writer', 'backlog-writer',
    'write backlog', 'populate backlog', 'write issues', 'write stories',
  ],
  'research': [
    'research', 'flesh out', 'write story', 'story details',
    'analyze requirements', 'acceptance criteria',
  ],
  'qa': [
    'qa ', 'test this', 'verify', 'validate', 'review the pr', 'check the pr',
  ],
  'inflight': [
    'continue', 'resume', 'pick up where', 'keep going',
  ],
  'acceptance': [
    'acceptance', 'final test', 'preview deploy', 'merge pr', 'merge the pr',
    'complete acceptance', 'finalize', 'cleanup',
  ],
  'refinement': [
    'refine', 'rejection', 'feedback', 'rework',
  ],
  'development': [
    'implement', 'develop', 'build', 'code', 'work',
  ],
  'coordination': [
    'coordinate', 'orchestrate', 'run sub-issues', 'run children',
    'run all sub-issues', 'execute sub-issues', 'work on this', 'cordinator'
  ],
  'qa-coordination': [
    'qa coordination', 'qa sub-issues', 'qa all sub-issues', 'qa this', 'qa issue'
  ],
  'acceptance-coordination': [
    'acceptance coordination', 'accept sub-issues', 'accept all sub-issues', 'perform acceptance', 'complete acceptance'
  ],
}

/**
 * Priority order for work type detection.
 * More specific work types come first to ensure correct matching.
 */
const WORK_TYPE_PRIORITY_ORDER: AgentWorkType[] = [
  'coordination', 'backlog-creation', 'research', 'qa', 'inflight', 'acceptance', 'refinement', 'development'
]

/**
 * Detect work type from prompt, constrained to valid options for the current status.
 *
 * This ensures that keywords from historical content don't incorrectly route
 * issues that have moved to a different status.
 */
export function detectWorkTypeFromPrompt(
  prompt: string,
  validWorkTypes: AgentWorkType[]
): AgentWorkType | undefined {
  if (!prompt || validWorkTypes.length === 0) return undefined

  const lowerPrompt = prompt.toLowerCase()

  for (const workType of WORK_TYPE_PRIORITY_ORDER) {
    if (!validWorkTypes.includes(workType)) continue

    const keywords = WORK_TYPE_KEYWORDS[workType]
    if (keywords?.some(keyword => lowerPrompt.includes(keyword))) {
      return workType
    }
  }

  return undefined
}

/**
 * Generate the appropriate prompt for a work type.
 */
export function generatePromptForWorkType(
  identifier: string,
  workType: AgentWorkType,
  mentionContext?: string
): string {
  let basePrompt: string
  switch (workType) {
    case 'research':
      basePrompt = `Research and flesh out story ${identifier}. Analyze requirements, identify technical approach, estimate complexity, and update the story description with detailed acceptance criteria. Do NOT implement code.`
      break
    case 'backlog-creation':
      basePrompt = `Create backlog issues from the researched story ${identifier}.
Read the issue description, identify distinct work items, classify each as bug/feature/chore,
and create appropriately scoped Linear issues in Backlog status.
Choose the correct issue structure based on the work:
- Sub-issues (--parentId): When work is a single concern with sequential/parallel phases sharing context and dependencies. Move source to Backlog as parent. Add blocking relations (--type blocks) between sub-issues to define execution order for the coordinator.
- Independent issues (--type related): When items are unrelated work in different codebase areas with no shared context. Source stays in Icebox.
- Single issue rewrite: When scope is atomic (single concern, ≤3 files, no phases). Rewrite source in-place and move to Backlog.
IMPORTANT: When creating multiple issues (sub-issues or independent), always add "related" links between them AND blocking relations where one step depends on another. This informs sub-agents and the coordinator of execution order.
Do NOT wait for user approval - create issues automatically.`
      break
    case 'development':
      basePrompt = `Start work on ${identifier}. Implement the feature/fix as specified.`
      break
    case 'inflight':
      basePrompt = `Continue work on ${identifier}. Resume where you left off.`
      break
    case 'qa':
      basePrompt = `QA ${identifier}. Validate the implementation against acceptance criteria.`
      break
    case 'acceptance':
      basePrompt = `Process acceptance for ${identifier}. Validate development and QA work is complete, verify PR is ready to merge (CI passing, no conflicts), merge the PR, and clean up local resources.`
      break
    case 'refinement':
      basePrompt = `Refine ${identifier} based on rejection feedback. Read comments, update requirements, then return to Backlog.`
      break
    case 'coordination':
      basePrompt = `Coordinate sub-issue execution for parent issue ${identifier}. Fetch sub-issues with dependency graph, create Claude Code Tasks mapping to each sub-issue, spawn sub-agents for unblocked sub-issues in parallel, monitor completion, and create a single PR with all changes when done.

SUB-ISSUE STATUS MANAGEMENT:
You MUST update sub-issue statuses in Linear as work progresses:
- When starting work on a sub-issue: pnpm linear update-sub-issue <id> --state Started
- When a sub-agent completes a sub-issue: pnpm linear update-sub-issue <id> --state Finished --comment "Completed by coordinator agent"
- If a sub-agent fails on a sub-issue: pnpm linear create-comment <sub-issue-id> --body "Sub-agent failed: <reason>"

COMPLETION VERIFICATION:
Before marking the parent issue as complete, verify ALL sub-issues are in Finished status:
  pnpm linear list-sub-issue-statuses ${identifier}
If any sub-issue is not Finished, report the failure and do not mark the parent as complete.`
      break
    case 'qa-coordination':
      basePrompt = `Coordinate QA across sub-issues for parent issue ${identifier}. Fetch sub-issues, spawn QA sub-agents in parallel for each sub-issue, collect pass/fail results, and roll up to parent. ALL sub-issues must pass QA for the parent to pass.`
      break
    case 'acceptance-coordination':
      basePrompt = `Coordinate acceptance across sub-issues for parent issue ${identifier}. Verify all sub-issues are Delivered, validate the PR (CI passing, no conflicts), merge the PR, and bulk-update sub-issues to Accepted.`
      break
  }

  if (mentionContext) {
    return `${basePrompt}\n\nAdditional context from the user's mention:\n${mentionContext}`
  }
  return basePrompt
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

1. **Scope Coverage**: Read each sub-issue description via \`pnpm linear get-issue <identifier>\` and verify the PR includes implementation for ALL sub-issues.
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
