# pi-lab local development plan

> Development-only. Excluded from the published package.

## Goal

Deliver a skill-only Pi package for one transparent container development-environment lifecycle:

```text
create -> work -> materialize if useful -> delete
```

No standalone CLI, runtime dependency, Docker façade, separate try mode, agent sandbox claim, automatic merge, or deployment command.

## Materialization

```text
skills/container-lab/SKILL.md
skills/container-lab/assets/Dockerfile
skills/container-lab/references/lifecycle.md
skills/container-lab/references/safety.md
skills/container-lab/references/materialize.md
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
