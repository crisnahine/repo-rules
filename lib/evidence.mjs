import { readFileSync, existsSync, realpathSync } from "node:fs";
import { resolve, sep } from "node:path";

// A changed blob is not death: any edit anywhere in the file changes it. The quote
// disappearing is what means the rule no longer describes the code.
export function resolveEvidence(rule, repoRoot) {
  const live = [];
  const dead = [];
  const root = resolve(repoRoot);
  let realRoot;
  try {
    realRoot = realpathSync(root);
  } catch {
    realRoot = null;
  }
  for (const item of rule.evidence ?? []) {
    const full = resolve(root, item.path);
    // Lexical containment first, cheap and without touching the filesystem: this is the code
    // that touches the filesystem, so it refuses to read outside the repository even when
    // handed a rules file nobody vetted.
    if (full !== root && !full.startsWith(root + sep)) {
      dead.push({ path: item.path, reason: "path escapes the repository" });
      continue;
    }
    if (!existsSync(full)) {
      dead.push({ path: item.path, reason: "file is missing" });
      continue;
    }
    // Lexical containment alone does not catch a committed symlink whose target lives
    // outside the repository: resolve() normalises ".." but never follows a symlink, and
    // readFileSync does. Resolve both sides for real before trusting the read.
    let realFull;
    try {
      realFull = realpathSync(full);
    } catch {
      dead.push({ path: item.path, reason: "path could not be resolved" });
      continue;
    }
    if (realRoot === null || (realFull !== realRoot && !realFull.startsWith(realRoot + sep))) {
      dead.push({ path: item.path, reason: "path escapes the repository" });
      continue;
    }
    let body;
    try {
      body = readFileSync(full, "utf8");
    } catch {
      dead.push({ path: item.path, reason: "file could not be read" });
      continue;
    }
    if (!body.includes(item.quote)) {
      dead.push({ path: item.path, reason: "quote no longer appears in the file" });
      continue;
    }
    live.push(item);
  }
  return { live, dead };
}

// Callers hand over a ruleset the store already validated, so the gate is not re-run here:
// expiry means one thing, that every citation is dead.
export function expire(rules, repoRoot) {
  const alive = [];
  const expired = [];
  for (const rule of rules) {
    const { live, dead } = resolveEvidence(rule, repoRoot);
    if (live.length === 0) {
      expired.push({ id: rule.id, reason: `every citation is dead (${dead.length} checked)` });
      continue;
    }
    alive.push({ ...rule, evidence: live });
  }
  return { live: alive, expired };
}
