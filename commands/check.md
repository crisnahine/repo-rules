---
description: Re-verify every rule's citations and expire the ones whose evidence is gone
---

1. Run `node "${CLAUDE_PLUGIN_ROOT}/bin/repo-rules.mjs" check` from the repository root.
2. Report to the user which rules expired and why.
3. If any expired, tell the user that `.claude/rules/` has been rewritten and that the change
   is theirs to review and commit.

A rule expires when the files it cites are gone, or when the text it quoted is no longer in
them. That is deliberate: an unmaintained ruleset empties itself rather than describing code
that no longer exists.

Do not commit anything.
