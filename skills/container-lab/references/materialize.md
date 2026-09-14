# Materialization

A lab is disposable; useful results must live in a repository or explicit export.

## Existing repository

The default workspace is a host Git worktree. Changes are already outside the container.

1. Run the project's tests inside the container.
2. Inspect `git status` and the diff from the host.
3. Remove generated or secret files.
4. Commit on branch `pi-lab/NAME` only when requested.
5. Use the repository's normal review and merge workflow.

Do not copy the mutable container filesystem into the repository.

## New tool or service

Convert successful shell exploration into the smallest appropriate artifacts:

```text
Dockerfile                 reproducible runtime/build
scripts/install.sh         pinned, target-specific installation
scripts/test.sh            deterministic acceptance checks
.devcontainer/             optional Development Containers configuration
README documentation       ports, configuration, secrets, data
```

Pin versions and verify checksums/signatures when the publisher provides them. Rebuild from a clean base and rerun tests before calling the result materialized.

## Existing host

Do not replay container commands automatically. Identify the target OS and package manager, produce a reviewed script or configuration-management change, show a dry run where possible, and ask before applying it.

## Remote VM

Promote a tested immutable image or versioned provisioning recipe. Keep credentials on the target or in a secret manager. Configure firewall, TLS, health checks, persistent data, backups, and rollback through the infrastructure repository.
