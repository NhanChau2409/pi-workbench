# pi-workbench context

## Purpose

`pi-workbench` is the canonical source repository for Nhan Chau's reusable Pi extensions, skills, and prompt templates. It favors small, transparent capabilities backed by normal files and standard tools.

## Repository structure

```text
extensions/
  <extension>/
    index.ts              Pi registration and lifecycle wiring
    *.ts                  extension-local domain and storage modules
prompts/
  <name>.md               reusable slash-command prompt templates
skills/
  <skill>/
    SKILL.md              skill entry point
    references/           optional detailed guidance
    assets/               optional templates and static files
test/
  <extension>/            tests mirroring extension ownership
```

Current capabilities:

- `extensions/project`: a simple project document with exploration and work records.
- `extensions/web-tools`: owned `web_search` and `web_fetch` tools.
- `prompts/tldr.md`: universal summary prompt.
- `prompts/technical.md`: concise technical repo/code view for an idea or flow.
- `skills/pi-package-workflow`: canonical package development and release workflow.
- `skills/poc`: disposable Docker proof-of-concept environments.

## Project system

The project extension is deliberately file-only. It has no branch metadata, revision counters, archive, decisions, checkpoints, or integration tools. Pi session state remembers only the currently open project and active record; Markdown files are the project truth.

```text
.pi/projects/<project-id>/
├── PROJECT.md            vision, direction, and one-sentence current status
├── explore/              one Markdown note for each investigation
└── work/                 one Markdown record for each implementation effort
```

`PROJECT.md` is short and durable. Its only sections are **Vision**, **Direction**, and **Current status**. Detailed research belongs in `explore/`; implementation plan, results, and verification belong in `work/`.

```text
/project new <title>
/project open [project-id]
/project status
/project explore <topic>
/project work <outcome>
/project exit
```

The persistent status is a single muted sentence derived from `PROJECT.md`'s **Current status** section. `/project explore` and `/project work` create a dated Markdown file, make it active for the session, and instruct the agent to update it with ordinary file tools. Old project directories are left untouched and are not parsed by this implementation.

## TL;DR boundary

`/tldr` is a universal prompt template, independent of project state. It may summarize a project as one example, but it must also work for conversations, files, directories, URLs, code, research, logs, or pasted text.

## Extension conventions

1. Give every extension its own directory under `extensions/`, with `index.ts` as its only package entry point.
2. Keep domain and storage modules beside the entry point; avoid shared utilities until two extensions need the same stable abstraction.
3. Mirror extension tests under `test/<extension>/`.
4. Register entry points explicitly in `package.json`; never load every TypeScript file through a broad extension glob.
5. Put runtime libraries in `dependencies`. Pi core libraries belong in `peerDependencies` with `"*"` and pinned versions in `devDependencies`.
6. Keep extensions independent even when distributed in one package.
7. Multi-operation commands need native argument completion and `--help`.

## Development workflow

1. Make changes in this source repository, never in Pi's installed clone under `~/.pi/agent/git/`.
2. Run `npm test`, `npm run typecheck`, and `npm pack --dry-run`.
3. Commit and push the source.
4. Tag a release and install the pinned tag with `pi install git:github.com/NhanChau2409/pi-workbench@<tag>`.
5. Use `/reload` after updating an already-running Pi session.
