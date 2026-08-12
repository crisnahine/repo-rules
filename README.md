# repo-rules

Extracts a repository's own conventions into `.claude/rules/`, with citations that resolve,
and expires each rule when its evidence disappears.

## Why

Claude follows a convention it can see in the files it is already reading. It cannot follow
one that lives nowhere in the tree it opened. This plugin writes down the second kind, in the
place Claude Code already loads from, so that code review is left with logic rather than
placement.

## Commands

- `/repo-rules:scan` reads committed configuration files, quotes the facts they declare, and
  asks which to keep.
- `/repo-rules:check` re-verifies every citation and drops the rules whose evidence is gone.

## What it does not do

- It never runs a command that came from the repository.
- It ships no blocking hooks. Nothing it does can stop an edit.
- It does not review code, and it does not write your `CLAUDE.md`.

## Development

```bash
npm test
```

Zero runtime dependencies. Node 20 or newer.
