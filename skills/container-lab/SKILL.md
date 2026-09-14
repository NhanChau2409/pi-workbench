---
name: container-lab
description: Creates, inspects, updates, materializes, and deletes isolated container development environments using standard Docker Engine commands. Use for testing installers or tools, developing in a Git worktree, forwarding local ports, mounting files, or cleaning the environment afterward; OrbStack is the primary macOS backend.
compatibility: Requires a Docker-compatible CLI and Engine; OrbStack is recommended on macOS. Git is required for repository worktrees.
---

# Container Lab

A lab is an ordinary Docker container plus a host workspace. Pi stays on the host: use host tools to read/edit workspace files and `docker exec` to run environment-dependent commands inside the container.

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

## Core rules

- One lifecycle only: create, work, materialize if useful, delete.
- Pi reads and edits the host workspace directly.
- Run Linux/tool commands with `docker exec`.
- Use normal `docker ps`, `docker inspect`, `docker logs`, `docker port`, `docker stop`, and `docker start`.
- Label every owned resource with `dev.pi-lab.managed=true`, `dev.pi-lab.name=NAME`, and `dev.pi-lab.kind=KIND`.
- Port forwards bind to `127.0.0.1` unless public/LAN exposure is explicitly approved.
- Repository work uses a Git worktree by default. Direct read-write mounting of the current checkout requires approval.
- Never mount the Docker socket, host home, SSH/cloud credential directories, or Pi state by default.
- Preview the exact matching resources before deletion, then ask for confirmation unless the user already explicitly requested deletion.
- Never remove resources based on name alone; require ownership labels.
- Report the container name, workspace path, ports, and exact follow-up Docker commands.

## Create

Gather only missing requirements: name, scratch or repository workspace, base image, ports, mounts, environment files, architecture, and success condition. Follow [lifecycle.md](references/lifecycle.md#create).

## Work

Use host Pi tools for files and standard Docker commands for runtime operations:

```bash
docker exec pi-lab-NAME COMMAND...
docker exec -it pi-lab-NAME bash
docker logs -f pi-lab-NAME
docker port pi-lab-NAME
```

Record successful installation and tests in workspace files rather than relying on shell history.

## Update

Most container settings are immutable. Read the saved manifest, preview changes, remove only the labeled container, and recreate it while preserving the workspace and explicitly persistent volumes.

## Materialize

Read [materialize.md](references/materialize.md). Convert useful work into reviewed repository files or commits; do not copy an opaque mutable container into production.

## Delete

Follow [lifecycle.md](references/lifecycle.md#delete). Delete matching owned containers, per-lab images, owned volumes, and metadata. Preserve Git worktrees and branches unless explicit removal is requested and the worktree is clean. For `delete --all`, preview every resource carrying the managed label and ask for confirmation; never call unrestricted Docker system prune.
