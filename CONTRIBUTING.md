# Contributing

Keep `pi-workbench` organized as a collection of small, isolated Pi capabilities.

- Put each extension in `extensions/<name>/index.ts` and its tests in `test/<name>/`.
- Put each skill in `skills/<name>/SKILL.md`, with detailed procedures in local `references/` files.
- Put reusable prompt templates in `prompts/<command>.md` with descriptions and argument hints.
- Give multi-operation commands subcommand autocomplete and `--help` output.
- Register extension entry points explicitly in `package.json`.
- Use standard tools and visible commands rather than hidden automation.
- Do not commit credentials, Pi session state, generated package archives, or local lab state.

Read [`context.md`](context.md) before changing repository architecture.

Validate changes before release:

```bash
npm test
npm run typecheck
npm pack --dry-run
```
