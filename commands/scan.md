---
description: Extract this repository's declared conventions into .claude/rules/
---

Run the scan and report the result to the user.

1. Run `node "${CLAUDE_PLUGIN_ROOT}/bin/repo-rules.mjs" scan` from the repository root.
2. Read `.claude/repo-rules/rules.json` and show the user each rule with the file it was
   drawn from.
3. Ask the user which rules to keep. Delete the rest from `rules.json`, then run
   `node "${CLAUDE_PLUGIN_ROOT}/bin/repo-rules.mjs" render` so `.claude/rules/` matches.

This pass reads only committed configuration files and quotes them. It infers nothing, so
every statement it produces is a quotation the user can check against the cited file.

Running this command again overwrites `rules.json` with the full detector output, restoring
every rule the detectors find, including ones the user already declined. There is no memory
of a prior "no": if the user curated the list last time, tell them to do it again.

Do not commit anything. Tell the user which files changed and let them decide.
