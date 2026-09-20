# Build an adaptive and visible project harness

## Vision

Pi has a lightweight project harness for long-running agent work that keeps a durable desired state visible, lets agents adapt through evidence, and makes the current execution state obvious to the user at all times.

The harness should feel like a small operating layer for projects, not a heavyweight project-management app: readable Markdown is the source of truth, project-tool branches isolate exploration and verified work, and the TUI always answers “what are we trying to achieve, what is happening now, and what is the next concrete step?”

## Intended experience

- The user can start or resume a project and immediately see the project name, desired-state goal, current meaningful milestone, active EXP/WORK branch, phase, observable activity, evidence progress, blockers, and next action.
- The agent has enough structure to work flexibly: explore uncertainty, run disposable POCs, implement verified increments, record evidence, and integrate only when revision-safe.
- Switching branches starts from explicit project/branch context in a fresh Pi session so previous conversation does not contaminate the selected branch.
- When an exploration is adopted, the UI and plan make the recommended `/project work --from EXP-NNN ...` handoff obvious.

## System shape

- `PROJECT.md` is the durable long-term desired state: goals, principles, system shape, long-term success evidence, non-goals, and meaningful milestone horizon.
- `PLAN.md` is the rolling execution trunk: current meaningful milestone, success evidence, Now/Next/Later, blockers, decisions, and next action.
- EXP and WORK documents are project-tool branches, not Git branches. EXP reduces uncertainty and concludes as adopted, rejected, or inconclusive. WORK produces a verified increment supporting the current meaningful milestone.
- Branch metadata records branch type, status, related goal, related milestone, base project revision, and explicit source exploration/work lineage where applicable.
- Decisions are durable Markdown records created when a conclusion materially affects project direction.
- A compact persistent TUI display is derived from PROJECT.md, PLAN.md, branch metadata, tool/agent events, checkpoints, and decisions; no separate state Markdown file is introduced.
- Operational phases are limited to `SHAPING`, `EXPLORING`, `IMPLEMENTING`, `VERIFYING`, `BLOCKED`, and `WAITING`.

## Principles

- Durable vision beats local momentum: POCs inform decisions but must not redefine or shrink PROJECT.md by accident.
- A meaningful milestone is the bounded valuable outcome; do not add a separate “sub-goal” concept.
- Prefer normal readable Markdown plus small structured metadata over hidden databases or opaque state.
- Make status observable, not speculative: show reading/testing/deploying/checkpointing/waiting, never private model reasoning.
- When no operation is running, show `WAITING`; never imply the agent continues secretly after its response.
- Use the smallest useful verification method: test-first when behavior has a useful automated contract, smoke/plan checks for infrastructure, contract plus end-to-end tests for integrations, and consistency checks for documentation.
- Preserve existing projects through revision-safe updates and migrations.

## Long-term success

- [ ] A user can inspect PROJECT.md and PLAN.md in any Markdown editor and understand durable direction plus current execution state.
- [ ] The TUI dashboard/status makes project, milestone, active branch, phase, activity, evidence, blocker/next action visible without reading hidden files.
- [ ] EXP-to-WORK handoff records evidence, integrates direction safely, and recommends an exact lineage-bearing work command.
- [ ] WORK branches define completion evidence, verify it, and integrate only after verification.
- [ ] Existing v0.4-style projects migrate without losing branch history, decisions, or revision safety.
- [ ] The released package documents the workflow and passes migration, behavioral, typecheck, and packaging verification.

## Non-goals

- Do not become a general-purpose project-management suite, ticket tracker, or Git branch manager.
- Do not store canonical project state in a hidden database or extra state Markdown file.
- Do not expose model chain-of-thought or private reasoning as status.
- Do not enforce mechanical TDD for every change.
- Do not let a disposable POC define the final product direction by itself.

## Milestone horizon

1. Release and validate the verified adaptive visible project harness as pi-workbench `v0.4.9`.
2. Harden multi-session collaboration: clearer conflict recovery, richer decision/history views, and more resilient branch/session selection.
3. Expand project insight: trend/evidence summaries, richer milestone progress views, and optional integrations while keeping Markdown canonical.
