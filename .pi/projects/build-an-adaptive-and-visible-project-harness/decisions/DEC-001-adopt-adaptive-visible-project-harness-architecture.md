# DEC-001: Adopt adaptive visible project harness architecture

## Context

The existing v0.4-style project extension already provides PROJECT.md, PLAN.md, EXP/WORK branch documents, checkpoints, revision-safe integration, decisions, and migration precedent. The missing product capability is visibility and session-safe adaptivity: users need to see direction and execution state while agents keep flexibility to explore and verify.

## Decision

Use a Markdown-native harness architecture: PROJECT.md for durable desired state, PLAN.md for the current meaningful milestone and rolling execution, EXP/WORK as project-tool branches with lineage metadata, decisions as Markdown records, and a compact TUI status/dashboard derived from existing files and lifecycle events. Do not introduce a separate sub-goal concept or another state Markdown file.

## Consequences

Implementation should prioritize migration compatibility, derived status accuracy, branch lineage, `/project` dashboard/status/overview/switch/exit commands, explore-to-work handoff, and behavioral tests. POCs remain disposable feedback loops and cannot redefine the durable vision by themselves.
