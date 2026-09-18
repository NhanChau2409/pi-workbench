---
name: local-plan-mode
description: Use for long-running work that needs a persistent desired state, architectural vision, iterative exploration, disposable POCs, implementation goals, checkpoints, and pause/resume rather than a one-shot plan-then-execute workflow.
---

# Local Living Plan

Use the local `/plan` extension as a persistent planning tree.

## Mental model

- **Trunk:** desired state, constraints, and architecture. Keep these stable and visible.
- **Branches:** open questions, research, alternatives, and disposable POCs.
- **Checkpoints:** decisions and discoveries saved with `plan_checkpoint`.
- **HEAD:** the current focus—one question, experiment, or meaningful goal.
- **Validated goals:** mark with `plan_goal_done`; this does not close the plan.

Do not attempt to plan everything once and then execute it all. Move between exploration, experiments, and implementation while retaining the same plan and vision.

## Commands

- `/plan <desired state>` — create a living plan and enter read-only exploration.
- `/plan explore [focus]` — inspect and reason; project edits and mutating bash are blocked.
- `/plan experiment [focus]` — run a disposable POC; built-in edit/write remain blocked. Use temporary directories, containers, or isolated worktrees only.
- `/plan work [goal]` — implement one meaningful goal while keeping the plan active.
- `/plan pause` — stop active guidance and restore normal tools, preserving all state.
- `/plan resume` — resume the saved plan in exploration mode.
- `/plan show` — show plan path, mode, and HEAD.
- `/plan close` — intentionally end the living plan.

## Working loop

1. Keep the desired state and architectural model current.
2. Choose one useful HEAD.
3. Explore, experiment, or work on that focus.
4. Validate cheaply.
5. Call `plan_checkpoint` when understanding, decisions, architecture, risks, or focus materially change.
6. Call `plan_goal_done` only with evidence.
7. Pick the next HEAD, pause, or close.

When an experiment or implementation contradicts the plan, update the plan openly. Preserve decision history instead of silently rewriting the past.
