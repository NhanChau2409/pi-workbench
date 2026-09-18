---
name: poc
description: Use when the user wants a disposable Docker proof-of-concept, lab, sandbox, install trial, repository worktree, service test, or agent experiment before changing the host or main checkout. Creates, operates, materializes, and deletes labeled POC environments with standard Docker/Git commands; OrbStack is the primary macOS backend.
compatibility: Requires a Docker-compatible CLI and Engine; OrbStack is recommended on macOS. Git is required for repository worktrees.
license: MIT
---

# POC

A POC is one or more ordinary Docker containers plus a host workspace for testing a thesis or approach before committing to it. Pi stays on the host: use host tools to read/edit workspace files and `docker exec` to run environment-dependent commands inside containers.

This is an agent workflow skill, not a sandbox product. Keep actions transparent, reversible, and reviewable. Do not hide Docker/Git behind a custom wrapper, do not promise containment for malicious code, and do not turn a short experiment into a second project architecture.

Interpret skill arguments as one of these lifecycle actions:

```text
create NAME [requirements]
show [NAME]
update NAME [changed requirements]
materialize NAME [target repository]
delete NAME [--delete-worktree]
delete --all
```

If no action is clear, ask what the user wants. Do not create a parallel CLI or wrapper around routine Docker commands.

## Start every operation

1. Run `command -v docker` and `docker version`.
2. On macOS with OrbStack, run `orbctl status` and check that `docker context show` is `orbstack`.
3. Read [lifecycle.md](references/lifecycle.md).
4. Before public ports, sensitive mounts, host installation, materialization, or deletion, read [safety.md](references/safety.md).

## Pi mindset

- Make the smallest useful environment for the thesis and success condition.
- Ask only for missing requirements; choose safe defaults and state them.
- Keep Pi as the editor/orchestrator on the host; use containers for runtime variance.
- Prefer visible standard commands over generated automation.
- Preserve user agency: preview destructive or exposure changes and wait for approval.
- Materialize outcomes as files, scripts, commits, or docs that can be reviewed outside the container.

## Core rules

- One lifecycle only: create, work/test, materialize if useful, delete.
- Pi reads and edits the host workspace directly.
- Run Linux/tool commands with `docker exec`.
- Use normal `docker ps`, `docker inspect`, `docker logs`, `docker port`, `docker stop`, and `docker start`.
- Label every owned resource with `dev.poc.managed=true`, `dev.poc.name=NAME`, and `dev.poc.kind=KIND`.
- Port forwards bind to `127.0.0.1` unless public/LAN exposure is explicitly approved.
- Repository work uses a Git worktree by default. Direct read-write mounting of the current checkout requires approval.
- Never mount the Docker socket, host home, SSH/cloud credential directories, or Pi state by default.
- Preview the exact matching resources before deletion, then ask for confirmation unless the user already explicitly requested deletion.
- Never remove resources based on name alone; require ownership labels.
- Report the container name, workspace path, ports, and exact follow-up Docker commands.

## Create

Gather only missing requirements: name, thesis/approach to test, scratch or repository workspace, base image or Docker setup, ports, mounts, environment files, architecture, and success condition. If the user asks for an "agent sandbox", clarify whether they want accidental-change isolation, dependency/runtime isolation, or hostile-code isolation; this skill handles the first two, not strong hostile-code containment. Follow [lifecycle.md](references/lifecycle.md#create).

## Work

Use host Pi tools for files and standard Docker commands for runtime operations:

```bash
docker exec poc-NAME COMMAND...
docker exec -it poc-NAME bash
docker logs -f poc-NAME
docker port poc-NAME
```

Record successful installation and tests in workspace files rather than relying on shell history.

## Update

Most container settings are immutable. Read the saved manifest, preview changes, remove only the labeled container, and recreate it while preserving the workspace and explicitly persistent volumes.

## Materialize

Read [materialize.md](references/materialize.md). Convert useful work into reviewed repository files or commits; do not copy an opaque mutable container into production.

## Delete

Follow [lifecycle.md](references/lifecycle.md#delete). Delete matching owned containers, per-POC images, owned volumes, and metadata. Preserve Git worktrees and branches unless explicit removal is requested and the worktree is clean. For `delete --all`, preview every resource carrying the managed label and ask for confirmation; never call unrestricted Docker system prune.
