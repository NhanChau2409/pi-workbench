# pi-lab

**A Pi skill for isolated container development environments.**

`pi-lab` teaches Pi to create, operate, materialize, and delete ordinary Docker development containers. OrbStack is the primary macOS backend. There is no custom CLI: Pi and humans use standard Docker and Git commands.

## Mental model

```text
Pi on host
  ├── reads and edits a host workspace/worktree
  └── runs environment commands with docker exec
          ↓
       OrbStack Docker Engine
```

A lab has one lifecycle:

```text
create -> work -> materialize if useful -> delete
```

A short experiment is simply a lab deleted immediately after testing. There is no separate “try” abstraction.

## What the skill adds

- safe requirements gathering;
- predictable names and ownership labels;
- loopback-only port defaults;
- read-only mount defaults;
- Git worktrees for repository development;
- a standard Ubuntu toolbox with container-only sudo;
- exact cleanup previews;
- guidance for turning useful work into repository artifacts.

Routine operations remain standard:

```bash
docker ps --filter label=dev.pi-lab.managed=true
docker exec -it pi-lab-demo bash
docker logs -f pi-lab-demo
docker stop pi-lab-demo
docker start pi-lab-demo
```

## Install in Pi

From Git after the repository is published:

```bash
pi install git:github.com/NhanChau2409/pi-lab@v0.1.0
```

For local development:

```bash
pi install /absolute/path/to/pi-lab
```

Then use the skill command or natural language:

```text
/skill:container-lab create demo to evaluate <tool>
/skill:container-lab create feature-auth from the current repository with port 3000
/skill:container-lab show
/skill:container-lab update feature-auth to add port 9229
/skill:container-lab materialize feature-auth into the repository
/skill:container-lab delete feature-auth
```

## Requirements

- Pi
- Docker-compatible CLI and Engine
- OrbStack recommended on macOS
- Git for repository worktrees

The Docker CLI is a client; OrbStack remains the engine. This package has no runtime dependencies and installs no global executable.

## Safety

Containers reduce accidental host modification but are not a perfect boundary for hostile code. The skill does not mount host credentials, home, Pi state, or the Docker socket by default. Public ports, direct checkout writes, destructive cleanup, host application, and deployment require explicit approval.

See the skill references for lifecycle, safety, and materialization details.

## License

[MIT](LICENSE)
