<!-- pi-project-branch {"schemaVersion":1,"id":"EXP-001","projectId":"build-an-adaptive-and-visible-project-harness","type":"explore","title":"Shape project direction","status":"adopted","baseRevision":0,"revision":3,"contentHash":"9a77f8e5374b603fc45e6f61f98d5489897bbeed9832c998baf12baae7be3acd","createdAt":"2026-09-19T14:05:26.882Z","updatedAt":"2026-09-19T14:08:45.610Z"} -->

# Shape project direction

## Question

What architecture should let the project harness stay flexible for the agent while making project direction and current execution state obvious to the user, without adding a separate sub-goal layer or hidden state file?

## Decision this unlocks

Adopt the project model and start a WORK branch to implement the adaptive/visible harness: Markdown-native PROJECT.md/PLAN.md, EXP/WORK project-tool branches with lineage metadata, revision-safe integration, compact TUI status, dashboard/switch commands, and migration/behavioral tests.

## Appetite and safety boundary

- This exploration is design-only: read repository and Pi docs, do not mutate implementation files.
- Implementation belongs in the canonical `pi-workbench` source repository under a WORK branch.
- POCs may be used later only as disposable fast-feedback loops under `.pi/runtime`, `/tmp`, containers, or isolated worktrees.
- Do not perform external release operations—commit, push, tag, install—without explicit user approval.

## Hypotheses or options

- The harness should remain Markdown-native: PROJECT.md is durable desired state; PLAN.md is current milestone and execution state; EXP/WORK documents are project-tool branches, not Git branches.
- No separate “sub-goal” concept is needed. A meaningful milestone is the bounded valuable outcome that PLAN.md tracks.
- The compact TUI should derive from existing sources—PROJECT.md, PLAN.md, branch metadata, tool/agent events, checkpoints, and decisions—not from another state Markdown file.
- Branch metadata should evolve compatibly to include related goal, related milestone, base project revision, and optional lineage such as `fromBranchId`/`fromDecisionIds`, while retaining migration support for existing schema-v1 projects.
- Operational phase should be ephemeral UI state derived from lifecycle events: `SHAPING`, `EXPLORING`, `IMPLEMENTING`, `VERIFYING`, `BLOCKED`, `WAITING`.
- Observable activity should be public execution activity such as reading, testing, deploying, checkpointing, integrating, or waiting for user input; it must never expose private model reasoning or imply hidden work after the agent responds.

## Method

Read the existing project extension/store/domain/tests and the Pi extension, SDK/session-replacement, and TUI documentation to identify the safest architecture and implementation seams.

## Evidence

- Existing `extensions/project` already provides the core v0.4-style primitives: PROJECT.md, PLAN.md, `project.json`, EXP/WORK branch documents, branch checkpointing, revision-safe integration, decisions, active state persisted in session custom entries, and exploration write protection.
- `ProjectStore` already has the durable filesystem boundary and migration precedent: it migrates legacy projects without PROJECT.md by materializing a durable vision file and metadata hash.
- Pi extension docs support the required UI and lifecycle design:
  - commands via `pi.registerCommand()`;
  - status/footer/widget display via `ctx.ui.setStatus`, `setWidget`, and custom components;
  - lifecycle events for activity/phase via `before_agent_start`, `agent_start`, `tool_execution_start`, `tool_execution_end`, `agent_settled`, `ui_prompt_start`, and `ui_prompt_end`;
  - session replacement from command handlers via `ctx.newSession()`/`ctx.switchSession()` and the documented `withSession` footgun rules.
- TUI docs support a compact persistent display with `setWidget`/`setStatus`, and dashboard/selector UI with `ctx.ui.custom()` plus `SelectList`. A full custom footer is possible but not necessary for the first visible harness.
- The SDK/session docs confirm that session replacement must use only the replacement-session context in `withSession`; `/project switch` should create or switch into a fresh Pi session and inject only serialized project/branch context.

## Conclusion

Adopt the architecture. The highest-risk uncertainty is not whether the store can persist Markdown safely—it already can—but whether derived UI state and session replacement can make the current project, branch, phase, action, evidence, blocker, and next action obvious without stale or hidden state. The implementation should therefore prioritize a compact derived status display, dashboard/status/switch/overview/exit commands, branch lineage metadata with migration, and behavioral tests around phase/activity transitions and explore-to-work handoff.

## Impact on project

- PROJECT.md should define the long-term harness vision as an adaptive, visible, Markdown-native operating layer for long-running Pi work.
- PLAN.md should set the current meaningful milestone as implementing and verifying the adaptive visible project harness.
- The next branch should be WORK and should start from this adopted exploration with:

```text
/project work --from EXP-001 Implement adaptive visible project harness
```

- Work should read PROJECT.md, PLAN.md, archived EXP-001, and any related decisions; implement in the canonical `pi-workbench` source repository; add migration and behavioral tests; run `npm test`, `npm run typecheck`, and package dry-run; update docs and package version; then ask before commit/push/tag/install.
