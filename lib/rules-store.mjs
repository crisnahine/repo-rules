import { readFileSync, existsSync, readdirSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { validateRuleSet } from "./validate.mjs";
import { render, GENERATOR_FRONTMATTER } from "./render.mjs";
import { writeAtomic } from "./io.mjs";

// The marker is a frontmatter key, so it always sits in the first few lines. Bounding the
// search keeps a hand-written file that quotes it in prose from reading as plugin-owned.
const MARKER_SCAN_LINES = 10;

export function storeDir(facts, env) {
  if (env.REPO_RULES_HOME) return env.REPO_RULES_HOME;
  return join(facts.repoRoot, ".claude", "repo-rules");
}

function isGenerated(path) {
  try {
    return readFileSync(path, "utf8").split("\n", MARKER_SCAN_LINES).includes(GENERATOR_FRONTMATTER);
  } catch {
    return false;
  }
}

// rules.json is committed and hand-edited (scan.md tells a human to prune it), so nothing
// downstream may trust it. Every rule that enters this process comes through here validated,
// or comes back as a dropped id with its reasons.
export function load(facts, env) {
  const path = join(storeDir(facts, env), "rules.json");
  if (!existsSync(path)) return { found: false, rules: [], dropped: [] };
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(parsed)) {
    throw new Error("rules.json must contain an array of rules");
  }
  const { accepted, rejected } = validateRuleSet(parsed);
  return { found: true, rules: accepted, dropped: rejected };
}

// Rewrites this plugin's own files each time so an expired topic leaves no orphan behind.
//
// Only files carrying the generator marker are ever removed or replaced. `.claude/rules/` is a
// directory Claude Code shares with whatever the team writes by hand, and deleting someone
// else's rules would be both destructive and invisible. Returns the names left alone and the
// names removed so the caller can say so out loud; a deletion must never be silent.
export function save(facts, rules, env) {
  writeAtomic(join(storeDir(facts, env), "rules.json"), `${JSON.stringify(rules, null, 2)}\n`);
  const dir = join(facts.repoRoot, ".claude", "rules");
  const files = render(rules);
  const existing = existsSync(dir) ? readdirSync(dir).filter((name) => name.endsWith(".md")) : [];

  const foreign = new Set(existing.filter((name) => !isGenerated(join(dir, name))));
  const removed = [];
  for (const name of existing) {
    if (!foreign.has(name) && !files.has(name)) {
      rmSync(join(dir, name), { force: true });
      removed.push(name);
    }
  }

  if (files.size > 0) mkdirSync(dir, { recursive: true });
  for (const [name, body] of files) {
    if (foreign.has(name)) continue;
    writeAtomic(join(dir, name), body);
  }

  // Remove the directory only once this plugin has emptied it and nothing else lives there.
  if (files.size === 0 && existsSync(dir) && readdirSync(dir).length === 0) {
    rmSync(dir, { recursive: true, force: true });
  }

  return { count: rules.length, foreign: [...foreign].sort(), removed: removed.sort() };
}
