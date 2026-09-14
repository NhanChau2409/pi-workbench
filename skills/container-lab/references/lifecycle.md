# Lab lifecycle

Use standard Docker commands. Resolve this skill's directory first so `assets/Dockerfile` can be referenced by absolute path.

## Labels and paths

For lab `NAME`:

```text
container: pi-lab-NAME
image:     pi-lab/NAME:dev
metadata:  ~/.local/share/pi-lab/NAME/lab.json
workspace: ~/.local/share/pi-lab/NAME/workspace       # scratch
worktree:  ~/.local/share/pi-lab/NAME/workspace       # repository
branch:    pi-lab/NAME                                 # repository
```

Required labels:

```text
dev.pi-lab.managed=true
dev.pi-lab.name=NAME
dev.pi-lab.kind=container|image|volume
dev.pi-lab.version=1
```

Validate `NAME` with `^[a-z0-9][a-z0-9-]{0,62}$`.

## Create

### Workspace

For scratch work:

```bash
mkdir -p "$HOME/.local/share/pi-lab/NAME/workspace"
```

For a repository, resolve its root and create a worktree:

```bash
repo="$(git -C REPO rev-parse --show-toplevel)"
mkdir -p "$HOME/.local/share/pi-lab/NAME"
git -C "$repo" worktree add \
  -b pi-lab/NAME \
  "$HOME/.local/share/pi-lab/NAME/workspace" \
  HEAD
```

Refuse to overwrite an existing path or branch. If the user explicitly approves a direct checkout mount, use the repository root as the workspace instead and record that fact.

### Metadata

Write `lab.json` before creation with:

- name and creation timestamp;
- repository root, branch, and workspace path when applicable;
- image/base image and platform;
- exact ports, mounts, volumes, and env-file paths;
- success condition;
- resource names and labels.

Never store secret values in metadata.

### Image

Build the standard lab image:

```bash
docker build \
  --file SKILL_DIR/assets/Dockerfile \
  --tag pi-lab/NAME:dev \
  --label dev.pi-lab.managed=true \
  --label dev.pi-lab.name=NAME \
  --label dev.pi-lab.kind=image \
  --label dev.pi-lab.version=1 \
  SKILL_DIR/assets
```

If a custom base is needed, create a per-lab Dockerfile in the metadata directory. Do not modify the bundled asset.

### Container

Translate requirements to explicit Docker arguments. Example:

```bash
docker run --detach \
  --name pi-lab-NAME \
  --label dev.pi-lab.managed=true \
  --label dev.pi-lab.name=NAME \
  --label dev.pi-lab.kind=container \
  --label dev.pi-lab.version=1 \
  --mount type=bind,source=WORKSPACE,target=/workspace \
  --publish 127.0.0.1:HOST_PORT:CONTAINER_PORT \
  --cpus 2 \
  --memory 2g \
  --pids-limit 512 \
  --workdir /workspace \
  pi-lab/NAME:dev
```

For read-only analysis, append `,readonly` to the workspace mount. Add only requested environment files and mounts. Existing named volumes are dependencies, not owned resources. Create and label a new volume explicitly before use when the lab should own it.

Verify:

```bash
docker ps --filter label=dev.pi-lab.managed=true \
  --filter label=dev.pi-lab.name=NAME
docker inspect pi-lab-NAME
docker port pi-lab-NAME
```

## Show

List all labs:

```bash
docker ps --all \
  --filter label=dev.pi-lab.managed=true \
  --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
```

For one lab, read its `lab.json` and inspect resources with both ownership and name labels. Redact environment values.

## Update

1. Read `lab.json`.
2. Compute and show the proposed effective configuration.
3. Preserve workspace and owned volumes.
4. Remove only the container matching both labels.
5. Rebuild the per-lab image only if image requirements changed.
6. Recreate the container with the full effective configuration.
7. Update metadata and verify ports/mounts.

Do not mutate port or mount configuration implicitly; Docker requires container recreation.

## Delete

Preview first:

```bash
docker ps -aq \
  --filter label=dev.pi-lab.managed=true \
  --filter label=dev.pi-lab.name=NAME

docker images -q \
  --filter label=dev.pi-lab.managed=true \
  --filter label=dev.pi-lab.name=NAME

docker volume ls -q \
  --filter label=dev.pi-lab.managed=true \
  --filter label=dev.pi-lab.name=NAME
```

After confirmation, remove in order: matching containers, matching per-lab images, matching owned volumes, then metadata. Re-query after deletion and report anything remaining.

Do not remove the worktree or branch by default. If explicitly requested, first run `git status --short` in the worktree. Refuse removal when it contains uncommitted or untracked work. Remove a clean worktree with `git -C REPO worktree remove WORKTREE`; leave branch deletion as a separate explicit decision.

## Delete all / prune owned resources

For global cleanup, query containers, images, and volumes using only:

```text
label=dev.pi-lab.managed=true
```

Show the complete result and ask for confirmation. Remove containers before images and volumes. Preserve all metadata/workspaces/worktrees unless each is reviewed separately. Never run `docker system prune`, because it is not scoped to Pi Lab ownership.
