# Build an adaptive and visible project harness

> **Status:** Active  
> **Vision:** See PROJECT.md  
> **Now:** Release and validate pi-workbench v0.4.9  
> **Next:** Obtain approval for external release operations  
> **Blockers:** Commit, push, tag, and install require explicit user approval  
> **Last decision:** Verified adaptive visible harness source is ready for release  
> **Next action:** Approve or decline commit, push, tag v0.4.9, and installation

## Outcome

The verified adaptive visible project harness is released from the canonical repository and validated in an installed Pi session.

## Success evidence

- [x] PROJECT.md, PLAN.md, branches, and decisions remain readable Markdown with revision-safe updates.
- [x] Branch metadata records related goal, current meaningful milestone, base project revision, and explicit lineage where applicable.
- [x] Compact persistent TUI status shows project, desired-state goal, milestone, branch ID/type, phase, observable action, evidence count when available, and blocker or next action.
- [x] `/project`, `/project status`, `/project overview`, `/project switch`, `/project exit`, `/project explore`, `/project work`, and `/project work --from EXP-NNN` behave as specified in behavioral tests.
- [x] Explore-to-work workflow integrates an adopted exploration, carries related decisions, and recommends the exact lineage-bearing work command.
- [x] Migration and behavioral tests cover existing v0.4-style projects and new adaptive visibility behavior.
- [x] Full local verification passes: `npm test`, `npm run typecheck`, `npm pack --dry-run`, and `git diff --check`.
- [x] Documentation and package version are updated to `0.4.9`.
- [ ] Approved source files are committed and pushed, tag `v0.4.9` is published, and the pinned package is installed.
- [ ] Installed TUI smoke validation confirms dashboard visibility, idle `WAITING`, and fresh-session branch switching.

## Constraints and non-goals

- Do not add a separate sub-goal concept; the meaningful milestone is the bounded valuable outcome.
- Do not add another state Markdown file; derive dashboard state from existing project files, branch metadata, tool events, and checkpoints.
- Do not expose private model reasoning or imply hidden work after a response; show `WAITING` when idle.
- Do not enforce mechanical TDD; choose verification appropriate to the change.
- Do not commit, push, tag, or install a release without explicit user approval.
- Keep unrelated concurrent nvim-tui working-tree changes out of the harness release commit unless separately reviewed.

## Now

Await explicit approval for the external `v0.4.9` release operations.

## Next

- Commit only the adaptive project harness source, tests, docs, and package-version files.
- Push the commit and tag `v0.4.9`.
- Install the pinned package with `pi install git:github.com/NhanChau2409/pi-workbench@v0.4.9` and use `/reload`.
- Smoke-test the persistent status, `WAITING` idle state, dashboard, and fresh-session switch.

## Later

- Improve conflict recovery and multi-session branch visibility.
- Add richer decision/history and evidence-progress views.
- Consider optional integrations only if Markdown remains canonical.

## Open questions

- Does the compact five-line widget remain low-noise during normal installed use, or should a later preference support a one-line mode?

## Decisions

- Adopted EXP-001: use a Markdown-native adaptive/visible harness with derived TUI status, explicit EXP/WORK lineage, revision-safe integration, and no separate sub-goal layer.
- Completed WORK-002: adaptive visible harness source is implemented and locally verified as package version `0.4.9`; release awaits approval.
