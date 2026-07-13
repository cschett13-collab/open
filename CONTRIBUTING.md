# Contributing

Thanks for helping improve `open`.

## Audience and goals

- Keep the package easy to use for end users.
- Keep repository workflows manageable for contributors and maintainers.
- Prefer clear docs and focused, minimal changes.

## Development setup

1. Install Node.js 20+.
2. Install dependencies:
   ```sh
   npm install
   ```
3. Run checks:
   ```sh
   npm test
   ```

## Pull request expectations

- Keep PRs scoped to one main change.
- Add or update documentation when behavior or workflow changes.
- Use the PR template and complete all sections.
- Keep CI passing before requesting review.

## Issue triage labels

This repository uses these labels for fast triage:

- `type:bug`
- `type:feature`
- `type:docs`
- `type:support`
- `status:needs-info`
- `status:ready`

## Release notes expectations

- User-facing changes should include a concise release note summary in the PR description.
- Breaking changes must clearly call out migration impact.
- Docs-only changes can be grouped in a short docs summary.
