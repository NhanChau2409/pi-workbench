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
context.md                durable architecture and maintenance rules
README.md                 user-facing overview and installation
package.json              single Pi package manifest
```

Current capabilities:

- `extensions/project`: long-running project state with explore and work branches.
- `extensions/web-tools`: owned `web_search` and `web_fetch` tools.
- `prompts/tldr.md`: universal summary prompt.
- `prompts/physical.md`: concise physical repo/code view for an idea or flow.
- `skills/pi-package-workflow`: canonical package development and release workflow.
- `skills/poc`: disposable Docker proof-of-concept environments.

## Project-system philosophy

The project extension is not a task manager. It maintains durable project direction while supporting two feedback loops:

```text
explore -> evidence -> decision -> update project
work    -> implementation -> verification -> update project
```

A project is the stable container. Its plan is a rolling view of Now, Next, and Later. Immediate work is detailed; distant work remains intentionally coarse. Exploration may be adopted, rejected, or inconclusive and never has to become implementation.

### Canonical project files

```text
.pi/projects/<project-id>/
├── PLAN.md               concise human project picture
├── project.json          identity, lifecycle status, and trunk revision
├── branches/             active EXP-* and WORK-* Markdown branches
├── decisions/            durable DEC-* records
└── archive/              completed branch records
```

Transient locks and disposable exploration files live under `.pi/runtime/` and should be ignored by Git. Repository files are canonical; Pi session entries only remember active project and branch pointers.

`PLAN.md` owns:

- desired outcome and success evidence;
- constraints and non-goals;
- concise current status;
- Now / Next / Later planning horizons;
- open questions and important decisions.

Branch files own detailed evidence, progress, and verification. Git owns historical versions; do not turn `PLAN.md` into an unbounded activity log.

### Concurrency model

Each Pi TUI works on an independent branch file. Branch checkpoints use optimistic revisions and content fingerprints. Shared PLAN integration uses a short filesystem lock, rereads current revisions and fingerprints, and rejects stale writes. Direct LazyVim edits are reconciled as new revisions rather than overwritten. A conflicting session must reconcile the latest branch or PLAN content before retrying.

Transient process state must never become project truth. Do not keep long-lived locks or duplicate the complete plan in session entries.

### User interface

Keep the command vocabulary small:

```text
/project
/project new <outcome>
/project explore <question>
/project work <near-term outcome>
/project --help
```

Bare `/project` provides a concise text brief and can resume an active branch through Pi's standard selector. Markdown editors remain the detailed interface; do not build a custom graphical dashboard unless plain files demonstrably fail.

## TL;DR boundary

`/tldr` is a universal prompt template, independent of project state. It may summarize a project as one example, but it must also work for conversations, files, directories, URLs, code, research, logs, or pasted text.

Do not couple the project extension to the TL;DR template. Clear project files naturally make generic summaries useful.

## Extension conventions

1. Give every extension its own directory under `extensions/`, with `index.ts` as its only package entry point.
2. Keep domain and storage modules beside the entry point; avoid shared utilities until two extensions need the same stable abstraction.
3. Mirror extension tests under `test/<extension>/`.
4. Register entry points explicitly in `package.json`; never load every TypeScript file through a broad extension glob.
5. Put runtime libraries in `dependencies`. Pi core libraries belong in `peerDependencies` with `"*"` and pinned versions in `devDependencies`.
6. Keep extensions independent even when distributed in one package.
7. Mutating file operations must use atomic replacement and explicit conflict handling.
8. Multi-operation commands need native argument completion and `--help`.

## Development workflow

1. Make changes in this source repository, never in Pi's installed clone under `~/.pi/agent/git/`.
2. Run `npm test`, `npm run typecheck`, and `npm pack --dry-run`.
3. Commit and push the source.
4. Tag a release and install the pinned tag with `pi install git:github.com/NhanChau2409/pi-workbench@<tag>`.
5. Use `/reload` after updating an already-running Pi session.
