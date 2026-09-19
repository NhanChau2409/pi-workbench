# pi-workbench

A personal workbench of reusable [Pi](https://pi.dev) extensions, skills, and agent workflows.

This repository is the merged successor to `pi-lab` and `pi-web-tools`. It is one Pi package with isolated capability directories, one validation workflow, and one pinned installation.

## Included

### Extensions

- **Living plan** (`extensions/plan-mode`) — persistent project plans with explore, experiment, work, pause, list, and resume flows.
- **Web tools** (`extensions/web-tools`) — `web_search` through the active OpenAI Codex subscription session and SSRF-resistant `web_fetch` content extraction.

### Skills

- **local-plan-mode** — guidance for maintaining long-running living plans.
- **pi-package-workflow** — source, release, and installation conventions for Pi packages.
- **poc** — disposable Docker/OrbStack proof-of-concept environments.

See [`context.md`](context.md) for the architecture and maintenance conventions.

## Install

Install a pinned release:

```bash
pi install git:github.com/NhanChau2409/pi-workbench@v0.2.0
```

Use `/reload` in an existing Pi session after updating.

## Living-plan command

Type `/plan ` to see native subcommand suggestions, or use:

```text
/plan --help
/plan new <desired-state>
/plan list
/plan resume [plan-file]
/plan remove <plan-file>
/plan explore [focus]
/plan experiment [focus]
/plan work [goal]
/plan pause
/plan show
/plan close
```

Plans are stored under the active project's `.pi/plans/` directory.

## Web tools

- `web_search` uses OpenAI native web search through the selected `openai-codex-responses` model and Pi's existing OAuth credential.
- `web_fetch` reads public HTTP(S) pages, rejects credentials and private addresses, validates redirects, limits downloads, and marks fetched content as untrusted.

Requirements: Pi 0.85.1+, Node.js 22+, and `/login` for OpenAI Codex when using `web_search`.

## Development

```bash
npm install
npm test
npm run typecheck
npm pack --dry-run
```

Develop here rather than inside Pi's installed clone under `~/.pi/agent/git/`.

## License

MIT. See [`NOTICE.md`](NOTICE.md) for web-tool provenance.
