<!-- pi-project-branch {"schemaVersion":1,"id":"WORK-002","projectId":"build-an-adaptive-and-visible-project-harness","type":"work","title":"--from EXP-001 Implement adaptive visible project harness","status":"completed","baseRevision":1,"revision":2,"contentHash":"151a4be78a54339b190f573f1c8f84474792c2c8985f5957d7355e0368f6e41c","createdAt":"2026-09-20T13:41:15.029Z","updatedAt":"2026-09-20T13:54:29.099Z"} -->

# Implement adaptive visible project harness

## Context

Related goal: Keep durable project direction visible while agents adapt through evidence.
Related milestone: Implement the adaptive visible project harness.
Source exploration: EXP-001
Source decision: DEC-001

## Outcome

A verified pi-workbench `0.4.9` source increment that provides the adaptive, visible project harness and is ready for approved release operations.

## Why now

EXP-001 established that the existing Markdown/revision-safe store was sound and that the highest-risk gap was visible derived state plus contamination-safe branch switching. Implementing that increment unlocks real use and release validation.

## Scope

- Add related goal, meaningful milestone, source branch, and source decision lineage to branch metadata while accepting existing schema-v1 projects.
- Add a compact persistent status widget derived from PROJECT.md, PLAN.md, branch metadata, evidence checkboxes, and Pi lifecycle/tool events.
- Restrict operational phases to SHAPING, EXPLORING, IMPLEMENTING, VERIFYING, BLOCKED, and WAITING; report only observable operations and return to WAITING when settled.
- Add `/project status`, `overview`, `switch`, `exit`, dashboard selection, and lineage-aware `work --from EXP-NNN`.
- Use Pi session replacement for branch switching and dashboard branch selection.
- Carry adopted exploration and decision records into WORK kickoff context and emit an exact recommended work command after adoption.
- Update behavioral/migration tests, README, architecture context, and package version.

## Non-goals

- No separate sub-goal concept or extra state Markdown file.
- No general-purpose ticketing UI, private model reasoning display, or mechanical TDD requirement.
- No commit, push, tag, or installation without explicit approval.

## Done when

- [x] Existing and new project files remain readable Markdown with revision-safe updates.
- [x] New branches record related goal, milestone, base revision, and source lineage; existing schema-v1 branches remain readable.
- [x] Persistent status displays project, goal, milestone, branch, phase, action, evidence count, and blocker/next action.
- [x] Required `/project` dashboard, status, overview, switch, exit, explore, work, and work-from commands are implemented.
- [x] Branch switching continues in a fresh Pi session.
- [x] Adopted exploration integration emits an exact work command and WORK reads source exploration/decisions.
- [x] Behavioral and migration tests pass.
- [x] Documentation and package version are updated to 0.4.9.
- [x] Full local verification passes.

## Progress

- Extended the domain/dashboard model and branch templates.
- Extended the store with lineage metadata, decision lookup, and decision lineage propagation during integration.
- Reworked extension command/session/event wiring for the compact dashboard and observable operational status.
- Added end-to-end extension behavior covering lineage, decision handoff, fresh-session switching, status transitions, overview, and exit.
- Preserved a concurrent repository update at commit `bd26313`; unrelated active nvim-tui working-tree changes were not modified or included in this branch's scope.

## Verification

- `npm test` — 27/27 tests passed.
- `npm run typecheck` — passed.
- `npm pack --dry-run` — passed; package `pi-workbench@0.4.9`, 26 files.
- `git diff --check` — passed.
- Focused project tests cover existing-project migration, revision conflicts, metadata lineage, decision lineage, exact explore-to-work recommendation, derived VERIFYING/WAITING status, and fresh-session switching.

## Result

Verified source increment complete and ready for review. Commit, push, tag `v0.4.9`, install/update, and `/reload` remain intentionally pending explicit user approval.
