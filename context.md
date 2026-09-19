# pi-workbench context

## Purpose

`pi-workbench` is the canonical source repository for Nhan Chau's reusable Pi extensions, skills, and agent workflows. It combines the former `pi-lab` and `pi-web-tools` packages into one installable Pi package.

The repository should remain a coherent workbench rather than a collection of unrelated root-level files: each capability owns a clearly named directory, documentation, and tests where behavior is executable.

## Repository structure

```text
extensions/
  <extension>/
    index.ts              Pi extension entry point
    *.ts                  extension-local implementation modules
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

- `extensions/plan-mode`: persistent living plans and plan-mode controls.
- `extensions/web-tools`: owned `web_search` and `web_fetch` tools.
- `skills/local-plan-mode`: agent guidance for living-plan workflows.
- `skills/pi-package-workflow`: canonical package development and release workflow.
- `skills/poc`: disposable Docker proof-of-concept environments.

## Extension conventions

1. Give every extension its own directory under `extensions/`, with `index.ts` as its only package entry point.
2. Keep implementation modules beside their entry point; do not create a shared utility layer until at least two extensions genuinely need the same stable abstraction.
3. Mirror extension tests under `test/<extension>/`.
4. Register extension entry points explicitly in `package.json`; never load every TypeScript file through a broad glob.
5. Put runtime libraries in `dependencies`. Pi core libraries belong in `peerDependencies` with `"*"` and pinned versions in `devDependencies`.
6. Preserve package boundaries: extensions may coexist in one package but should not depend on each other's internal state.

## Command UX standard

Every extension command with multiple operations must behave like a small discoverable CLI:

- use one top-level slash command and named subcommands;
- provide native argument suggestions with `getArgumentCompletions`;
- support `help`, `--help`, and `-h`;
- include usage, subcommands, and important examples in help output;
- keep existing shorthand forms when they are useful and unambiguous;
- return a clear warning for missing state or invalid targets;
- make non-interactive behavior deterministic and only open selectors when interaction adds value.

Example shape:

```text
/plan --help
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

Autocomplete should suggest subcommands after `/plan ` and context-specific values, such as saved plan files after `/plan resume `.

## Development workflow

1. Make changes in this source repository, never in Pi's installed clone under `~/.pi/agent/git/`.
2. Run `npm test`, `npm run typecheck`, and `npm pack --dry-run`.
3. Commit and push the source.
4. Tag a release and install the pinned tag with `pi install git:github.com/NhanChau2409/pi-workbench@<tag>`.
5. Use `/reload` after updating an already-running Pi session.

## Design direction

Prefer small, composable capabilities with polished command discovery over adding more top-level commands. New extensions should first establish their mental model and lifecycle here, then expose the minimum commands and tools needed to support it.
