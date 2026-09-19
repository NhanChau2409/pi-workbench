# pi-workbench

A personal workbench of reusable [Pi](https://pi.dev) extensions, skills, and prompt templates.

## Included

### Project operating system

A small `/project` interface for long-running work:

```text
/project
/project new <outcome>
/project explore <question>
/project work <near-term outcome>
/project --help
```

Projects live in the current repository:

```text
.pi/projects/<project>/
├── PLAN.md
├── project.json
├── branches/
├── decisions/
└── archive/
```

`PLAN.md` is the concise project picture and is designed to be read or edited in any Markdown editor. Explore branches reduce uncertainty through evidence; work branches produce verified increments. Multiple Pi sessions can work on independent branches, while revision checks prevent silent overwrites during integration.

The extension gives the agent two tools:

- `project_checkpoint` records material branch progress or evidence.
- `project_integrate` completes a branch and safely updates the latest project plan.

Version 0.3 replaces the former `/plan` living-plan extension with `/project`.

### Universal TL;DR

`/tldr` is a prompt template for any material, not a project-specific feature:

```text
/tldr
/tldr README.md
/tldr src/auth
/tldr https://example.com/article
/tldr .pi/projects/passkeys/PLAN.md
/tldr this error log, focus on the likely cause
```

It adapts its output to conversations, documents, projects, code, research, URLs, and logs.

`/technical [idea or focus]` complements it by showing the concrete files, code shape, and execution flow behind an idea.

### Web tools

- `web_search` uses OpenAI native web search through the selected `openai-codex-responses` model and Pi's existing OAuth credential.
- `web_fetch` reads public HTTP(S) pages, rejects credentials and private addresses, validates redirects, limits downloads, and marks fetched content as untrusted.

### Skills

- **pi-package-workflow** — canonical package development and release workflow.
- **poc** — disposable Docker/OrbStack proof-of-concept environments.

See [`context.md`](context.md) for architecture and maintenance conventions.

## Install

```bash
pi install git:github.com/NhanChau2409/pi-workbench@v0.3.2
```

Use `/reload` in an existing Pi session after updating.

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
