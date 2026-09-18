# pi-poc

**A Pi skill named `poc` for disposable Docker proof-of-concept environments.**

`poc` teaches Pi and other Agent Skills-compatible coding agents to launch, operate, materialize, and delete Docker environments for testing a thesis or approach first. OrbStack is the primary macOS backend. There is no custom CLI: Pi and humans use standard Docker and Git commands.

## Mental model

```text
Pi on host
  ├── reads and edits a host workspace/worktree
  └── runs environment commands with docker exec
          ↓
       OrbStack Docker Engine
```

A POC has one lifecycle:

```text
create -> work -> materialize if useful -> delete
```

A short experiment is simply a POC deleted immediately after testing. There is no separate “try” abstraction.

## Pi mindset

The skill is deliberately small and transparent:

- Pi remains the editor/orchestrator on the host;
- containers provide runtime/dependency isolation, not a promise of hostile-code containment;
- standard Docker and Git commands stay visible;
- destructive actions, public exposure, and host application are previewed and require approval;
- useful results are materialized as reviewable files, scripts, commits, or docs.

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
docker ps --filter label=dev.poc.managed=true
docker exec -it poc-demo bash
docker logs -f poc-demo
docker stop poc-demo
docker start poc-demo
```

## Install in Pi

From Git after the repository is published:

```bash
pi install git:github.com/NhanChau2409/pi-poc@v0.1.0
```

For local development:

```bash
pi install /absolute/path/to/pi-poc
```

Then use the skill command or natural language:

```text
/skill:poc create demo to test this thesis with <tool>
/skill:poc create feature-auth from the current repository with port 3000
/skill:poc show
/skill:poc update feature-auth to add port 9229
/skill:poc materialize feature-auth into the repository
/skill:poc delete feature-auth
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
