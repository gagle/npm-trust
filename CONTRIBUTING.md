# Contributing to npm-trust-cli

This project is developed and maintained entirely through AI-assisted development using [Claude Code](https://docs.anthropic.com/en/docs/claude-code). All code changes -- features, bug fixes, refactoring, tests, and documentation -- are generated, reviewed, and verified by Claude.

**Pull requests are disabled.** Contributors cannot submit code directly. To request a change, [open an issue](https://github.com/gagle/npm-trust-cli/issues) or start a [discussion](https://github.com/gagle/npm-trust-cli/discussions); the maintainer picks it up and implements it through Claude Code following the conventions in `CLAUDE.md` and `.claude/`.

## Why

This is an intentional design decision, not a gimmick. AI-generated code with strict conventions, full test coverage, and automated review produces more consistent, maintainable output than ad-hoc human contributions. Every change follows the same process, every time.

## How to request a change

1. **[Open an issue](https://github.com/gagle/npm-trust-cli/issues)** for bugs, concrete features, or specific improvements -- include expected behavior and reproduction steps where relevant.
2. **[Open a discussion](https://github.com/gagle/npm-trust-cli/discussions)** for open-ended requests, design input, or trade-off questions.
3. The maintainer triages the request and, when accepted, implements it via Claude Code. The resulting commits are linked back to your issue or discussion.

## What Claude enforces automatically

- **Full test coverage** on every code path (unit + e2e)
- **Zero lint warnings** (ESLint flat config with strict rules)
- **Conventional commits** (`feat:`, `fix:`, `chore:`, etc.)
- **TypeScript strict mode** (no `any`, `readonly` everywhere, explicit return types)
- **Semantic naming** (no `data`, `result`, `item` -- domain-specific names only)
- **ESM-only** with `.js` extensions in relative imports
- **Zero runtime dependencies**

## Questions

Open a [GitHub Discussion](https://github.com/gagle/npm-trust-cli/discussions) for questions about the project, its architecture, or this contribution model.
