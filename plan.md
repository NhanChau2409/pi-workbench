# pi-poc local development plan

> Development-only. Excluded from the published package.

## Goal

Deliver a skill-only Pi package with a short `poc` skill for one transparent Docker proof-of-concept lifecycle:

```text
create -> work -> materialize if useful -> delete
```

No standalone CLI, runtime dependency, Docker façade, separate try mode, agent sandbox claim, automatic merge, or deployment command.

## Materialization

```text
skills/poc/SKILL.md
skills/poc/assets/Dockerfile
skills/poc/references/lifecycle.md
skills/poc/references/safety.md
skills/poc/references/materialize.md
README.md
package.json
```

## Release checklist

- [x] Remove previous local pi-sbx installation and managed resources
- [x] Replace CLI architecture with skill-only package
- [x] Define create/show/update/materialize/delete actions
- [x] Define standard Docker/Git interaction
- [x] Define ownership-label cleanup rules
- [x] Define host/worktree materialization workflows
- [x] Review skill and package contents
- [x] Replace GitHub repository with clean `pi-lab` history; archive `pi-sbx`
- [x] Publish v0.1.0
- [x] Install pinned package and validate Pi discovery
- [x] Validate documented Docker lifecycle against OrbStack and clean all smoke resources
- [x] Add central Pi package workflow skill for future customizations
