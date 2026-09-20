---
name: pi-package-workflow
description: "Use when creating or changing Pi custom resources such as extensions, skills, prompt templates, themes, model/provider settings, or package manifests. Enforces a central GitHub Pi package workflow: build in the source repository, commit/push/tag there, then install or update with pi install/update instead of wiring local paths into Pi settings."
compatibility: Requires git and pi. GitHub push requires repository access. Optional TypeScript/npm only when building extensions.
license: MIT
---

# Pi Package Workflow

Use this skill to create or modify Pi things without creating a messy local setup. The source of truth is a normal GitHub repository that is also a Pi package. Local `~/.pi/agent/...` files are runtime install output, not the canonical place to develop.

## Principle

Create custom Pi resources in a central package repository, push them to GitHub, and install them back into Pi from that repository:

```bash
pi install git:github.com/<owner>/<repo>@<tag-or-commit>
pi update --extensions
```

Avoid long-lived local-path installs such as:

```json
{ "packages": ["/Users/me/some/local/folder"] }
```

Use local paths or `pi -e ./path.ts` only for short tests, then remove them and return to the GitHub package.

## Resource types

A Pi package can expose these conventional directories:

```text
extensions/ or src/     TypeScript/JavaScript extensions
skills/                 Agent skills, each folder has SKILL.md
prompts/                Prompt templates, one .md file per command
themes/                 Theme JSON files
package.json            Pi package manifest
```

Prefer an explicit `package.json` manifest:

```json
{
  "name": "pi-workbench",
  "version": "0.1.0",
  "keywords": ["pi-package"],
  "pi": {
    "extensions": ["./src/index.ts"],
    "skills": ["./skills"],
    "prompts": ["./prompts"],
    "themes": ["./themes"]
  }
}
```

Only include keys that the package actually provides.

## Workflow

1. Identify the canonical GitHub package repository.
   - Check `git remote -v`.
   - Do not edit Pi's installed clone under `~/.pi/agent/git/...` unless it is only a temporary inspection.
   - If the user has no central repo yet, create or recommend one, for example `github.com/<owner>/pi-workbench`.

2. Add or change the resource in the repo.
   - Extension: create/update `extensions/<name>/index.ts`, keep its modules beside it, and register tools/commands/events there.
   - Skill: create `skills/<skill-name>/SKILL.md` with valid frontmatter.
   - Prompt template: create `prompts/<command>.md` with optional frontmatter.
   - Theme: create `themes/<name>.json`.
   - Package manifest: update `package.json` `pi` entries so Pi loads the resource.

3. Validate locally without installing a permanent local path.
   - For package structure: `npm pkg get pi` if package.json exists.
   - For extensions: run typecheck/tests when available, or temporarily use `pi -e ./extensions/<name>/index.ts`.
   - For skills/prompts/themes: inspect paths and frontmatter; run Pi with the package only if needed.
   - Record runtime prerequisites such as `tuiMode`, terminal protocol, environment variables, or external binaries. Inspect the effective user/project settings rather than assuming defaults satisfy them.
   - Make unmet prerequisites visible at runtime with a clear warning instead of silently disabling the feature.

4. Commit and push to GitHub.

```bash
git status --short
git add <changed-files>
git commit -m "Add <thing>"
git push
```

5. Pin an install ref.
   - Best: create a tag such as `v0.1.1` and install that.
   - Acceptable for personal fast iteration: install a specific commit SHA.
   - Avoid unpinned moving branches for repeatable setups.

```bash
git tag v0.1.1
git push origin v0.1.1
pi install git:github.com/<owner>/<repo>@v0.1.1
```

6. Install/update Pi from the pinned central package and verify the rollout.

```bash
pi install git:github.com/<owner>/<repo>@<tag>
pi update --extensions
pi list
```

Do not report rollout complete from a successful push alone. Verify all three states:

```bash
# Source tag resolves to the intended commit
git rev-list -n 1 <tag>

# Pi settings select the new pinned ref
pi list

# Pi's installed checkout is actually at that commit
git -C ~/.pi/agent/git/github.com/<owner>/<repo> rev-parse HEAD
```

The tag commit, selected ref shown by `pi list`, and installed checkout commit must agree. If the package version is meaningful, also inspect the installed `package.json`.

7. Activate the installed code in the running TUI.

Run `/reload` after install/update. A shell command cannot reload a separate already-running Pi TUI, so report the runtime as **installed, reload pending** until the user runs `/reload`. After reload, ask for one direct behavior check before calling the feature manually verified.

## Decision rules

- If the user asks for a reusable Pi customization, put it in the central package repo.
- If the user asks for a one-off experiment, use `pi -e` or a temporary project-local file, then promote it to the central repo if it works.
- If a local path is already installed, propose replacing it with a GitHub package install.
- If modifying an installed clone under `~/.pi/agent/git/...`, stop and locate the source repo instead.
- If the package includes runtime dependencies, put them in `dependencies`; Pi core packages belong in `peerDependencies` with `"*"`.

## Common templates

### Skill

```markdown
---
name: my-skill
description: Specific trigger for when Pi should use this skill.
license: MIT
---

# My Skill

Instructions go here. Use relative paths for references and scripts.
```

### Prompt template

```markdown
---
description: Short autocomplete description
argument-hint: "[optional args]"
---
Prompt body. Use $1 or $ARGUMENTS for user arguments.
```

### Extension entry point

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function extension(pi: ExtensionAPI) {
  pi.registerCommand("hello", {
    description: "Say hello",
    handler: async (_args, ctx) => {
      ctx.ui.notify("hello", "info");
    },
  });
}
```

## Report back

When done, report:

- repository path and GitHub remote
- files changed and validation run
- commit and pushed tag
- `pi list` selected package ref
- installed checkout commit/version and whether it matches the tag
- runtime prerequisites and whether the effective Pi settings satisfy them
- runtime state: `reload pending` or `reloaded and behavior checked`

Never say “installed and loaded” merely because `pi install` or `pi update` succeeded. A package can be selected at the right commit but still appear broken because its required TUI mode or other runtime configuration is inactive.
