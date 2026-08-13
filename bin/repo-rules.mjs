#!/usr/bin/env node
import { repoFacts } from "../lib/repo.mjs";
import { runScan, runCheck, runRender } from "../lib/commands.mjs";
import { report } from "../lib/report.mjs";

const USAGE = "usage: repo-rules <scan|check|render>";
const COMMANDS = { scan: runScan, check: runCheck, render: runRender };

const command = COMMANDS[process.argv[2]];
if (!command) {
  console.error(USAGE);
  process.exit(1);
}

const facts = repoFacts(process.cwd());

// Outside a repository, repoRoot falls back to cwd itself. Without this guard scan would
// write .claude/repo-rules/ and reconcile .claude/rules/ in whatever directory it was run
// from, including a home directory Claude Code loads rules from for every project.
if (!facts.isGitRepo) {
  console.error("repo-rules: not a git repository");
  process.exit(1);
}

try {
  for (const line of report(command(facts, process.env))) console.log(line);
} catch (error) {
  console.error(`repo-rules: ${error.message}`);
  process.exit(1);
}
