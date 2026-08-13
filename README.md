# repo-rules

Extracts a repository's own conventions into `.claude/rules/`, with citations that resolve,
and expires each rule when its evidence disappears.

## Why

Claude follows a convention it can see in the files it is already reading. It cannot follow
one that lives nowhere in the tree it opened. This plugin writes down the second kind, in the
place Claude Code already loads from, so that code review is left with logic rather than
placement.

## Install

From Claude Code:

```
/plugin marketplace add crisnahine/repo-rules
/plugin install repo-rules@crisnahine
```

Restart Claude Code, then run `/repo-rules:scan` in a repository.

To work on the plugin itself, clone it and add the checkout as a local marketplace instead:

```bash
git clone https://github.com/crisnahine/repo-rules.git
```

```
/plugin marketplace add /path/to/repo-rules
```

## Commands

- `/repo-rules:scan` reads committed configuration files, quotes the facts they declare, and
  writes them to `.claude/repo-rules/rules.json` and `.claude/rules/`. Only after that does it
  show the user each rule and ask which to keep.
- `/repo-rules:check` re-verifies every citation and drops the rules whose evidence is gone.

Re-running `scan` restores every rule the detectors find, including ones already declined:
nothing here remembers a prior "no", so a curated list has to be curated again each time.

## What it does not do

- It never runs a command that came from the repository.
- It ships no blocking hooks. Nothing it does can stop an edit.
- It does not review code, and it does not write your `CLAUDE.md`.
- Its detectors currently recognize Node signals only (`package.json`, JS lockfiles, GitHub
  Actions workflows). A repository built on a different stack yields zero rules, not an error.

## Development

```bash
npm test
```

Zero runtime dependencies. The CLI itself runs on Node 20 or newer. The test script's quoted
glob (`node --test 'test/**/*.test.mjs'`) needs Node 22 or newer to run `npm test`.
