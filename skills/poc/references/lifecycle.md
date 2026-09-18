# POC lifecycle

Use standard Docker commands. A POC may use the bundled toolbox image, a requested base image, or a small Docker/Compose-style setup when that is the quickest way to test the thesis. Resolve this skill's directory first so `assets/Dockerfile` can be referenced by absolute path.

## Labels and paths

For POC `NAME`:

```text
container: poc-NAME
image:     poc/NAME:dev
metadata:  ~/.local/share/poc/NAME/poc.json
workspace: ~/.local/share/poc/NAME/workspace       # scratch
worktree:  ~/.local/share/poc/NAME/workspace       # repository
branch:    poc/NAME                                 # repository
```

Required labels:

```text
dev.poc.managed=true
dev.poc.name=NAME
dev.poc.kind=container|image|volume
dev.poc.version=1
```

Validate `NAME` with `^[a-z0-9][a-z0-9-]{0,62}$`.

## Create

### Workspace

For scratch work:

```bash
mkdir -p "$HOME/.local/share/poc/NAME/workspace"
```

For a repository, resolve its root and create a worktree:

```bash
repo="$(git -C REPO rev-parse --show-toplevel)"
mkdir -p "$HOME/.local/share/poc/NAME"
git -C "$repo" worktree add \
  -b poc/NAME \
  "$HOME/.local/share/poc/NAME/workspace" \
  HEAD
```

Refuse to overwrite an existing path or branch. If the user explicitly approves a direct checkout mount, use the repository root as the workspace instead and record that fact.

### Metadata

Write `poc.json` before creation with:

- name, creation timestamp, and thesis/approach being tested;
- repository root, branch, and workspace path when applicable;
- image/base image and platform;
- exact ports, mounts, volumes, and env-file paths;
- success condition;
- resource names and labels.

Never store secret values in metadata.

### Image

Build the standard POC image:

```bash
docker build \
  --file SKILL_DIR/assets/Dockerfile \
  --tag poc/NAME:dev \
  --label dev.poc.managed=true \
  --label dev.poc.name=NAME \
  --label dev.poc.kind=image \
  --label dev.poc.version=1 \
  SKILL_DIR/assets
```

If a custom base or multi-container setup is needed, create per-POC Dockerfile/Compose-style files in the metadata directory. Do not modify the bundled asset.

### Container

Translate requirements to explicit Docker arguments. Example:

```bash
docker run --detach \
  --name poc-NAME \
  --label dev.poc.managed=true \
  --label dev.poc.name=NAME \
  --label dev.poc.kind=container \
  --label dev.poc.version=1 \
  --mount type=bind,source=WORKSPACE,target=/workspace \
  --publish 127.0.0.1:HOST_PORT:CONTAINER_PORT \
  --cpus 2 \
  --memory 2g \
  --pids-limit 512 \
  --workdir /workspace \
  poc/NAME:dev
```

For read-only analysis, append `,readonly` to the workspace mount. Add only requested environment files, service containers, networks, volumes, and mounts. Existing named volumes are dependencies, not owned resources. Create and label a new volume explicitly before use when the POC should own it.

Verify:

```bash
docker ps --filter label=dev.poc.managed=true \
  --filter label=dev.poc.name=NAME
docker inspect poc-NAME
docker port poc-NAME
```

## Show

List all POCs:

```bash
docker ps --all \
  --filter label=dev.poc.managed=true \
  --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
```

For one POC, read its `poc.json` and inspect resources with both ownership and name labels. Redact environment values.

## Update

1. Read `poc.json`.
2. Compute and show the proposed effective configuration.
3. Preserve workspace and owned volumes.
4. Remove only the container matching both labels.
5. Rebuild the per-POC image only if image requirements changed.
6. Recreate the container with the full effective configuration.
7. Update metadata and verify ports/mounts.

Do not mutate port or mount configuration implicitly; Docker requires container recreation.

## Delete

Preview first:

```bash
docker ps -aq \
  --filter label=dev.poc.managed=true \
  --filter label=dev.poc.name=NAME

docker images -q \
  --filter label=dev.poc.managed=true \
  --filter label=dev.poc.name=NAME

docker volume ls -q \
  --filter label=dev.poc.managed=true \
  --filter label=dev.poc.name=NAME
```

After confirmation, remove in order: matching containers, matching per-POC images, matching owned volumes/networks, then metadata. Re-query after deletion and report anything remaining.

Do not remove the worktree or branch by default. If explicitly requested, first run `git status --short` in the worktree. Refuse removal when it contains uncommitted or untracked work. Remove a clean worktree with `git -C REPO worktree remove WORKTREE`; leave branch deletion as a separate explicit decision.

## Delete all / prune owned resources

For global cleanup, query containers, images, and volumes using only:

```text
label=dev.poc.managed=true
```

Show the complete result and ask for confirmation. Remove containers before images and volumes. Preserve all metadata/workspaces/worktrees unless each is reviewed separately. Never run `docker system prune`, because it is not scoped to POC ownership.
