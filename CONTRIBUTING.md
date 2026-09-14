# Contributing

`pi-lab` is a skill-only Pi package. Keep it transparent and small.

- Use standard Docker and Git commands instead of building a parallel CLI.
- Put decision guidance in `SKILL.md` and detailed procedures in references.
- Keep executable behavior visible in commands Pi reports to the user.
- Require ownership labels for deletion.
- Document any new lifecycle behavior.
- Do not commit credentials or local lab state.

Validate package contents before release:

```bash
npm pack --dry-run
```

`plan.md` is development-only and must remain excluded from the package.
