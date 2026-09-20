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
├── PROJECT.md       # durable vision, principles, and milestone horizon
├── PLAN.md          # concise rolling Now/Next/Later execution plan
├── project.json
├── branches/
├── decisions/
└── archive/
```

`PROJECT.md` preserves the long-term vision so fast-feedback experiments do not accidentally redefine the destination. `PLAN.md` is the concise rolling execution picture. Both are readable in any Markdown editor and integrated revision-safely. Explore branches reduce uncertainty through evidence; work branches produce verified increments. Multiple Pi sessions can work on independent branches, while revision checks prevent silent overwrites during integration.

The extension gives the agent two tools:

- `project_checkpoint` records material branch progress or evidence.
- `project_integrate` completes a branch and safely updates the latest project plan.

Version 0.3 replaces the former `/plan` living-plan extension with `/project`.

### Neovim-like TUI

[`extensions/nvim-tui`](extensions/nvim-tui/README.md) provides modal prompt editing and read-only transcript navigation.

**Transcript focus and navigation require Pi fullscreen mode.** In regular mode the terminal owns scrollback, so extensions cannot control or focus the transcript; only prompt editing works. See the extension README for setup, controls, restart behavior, and the current version-sensitive Pi API limitation.

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
pi install git:github.com/NhanChau2409/pi-workbench@v0.4.8
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
