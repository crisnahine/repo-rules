import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { checkGate } from "./validate.mjs";

// A changed blob is not death: any edit anywhere in the file changes it. The quote
// disappearing is what means the rule no longer describes the code.
export function resolveEvidence(rule, repoRoot) {
  const live = [];
  const dead = [];
  for (const item of rule.evidence ?? []) {
    const full = join(repoRoot, item.path);
    if (!existsSync(full)) {
      dead.push({ path: item.path, reason: "file is missing" });
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

export function expire(rules, repoRoot) {
  const alive = [];
  const expired = [];
  for (const rule of rules) {
    const { live, dead } = resolveEvidence(rule, repoRoot);
    if (live.length === 0) {
      expired.push({ id: rule.id, reason: `every citation is dead (${dead.length} checked)` });
      continue;
    }
    const candidate = { ...rule, evidence: live };
    const reasons = checkGate(candidate);
    if (reasons.length > 0) {
      expired.push({ id: rule.id, reason: reasons.join("; ") });
      continue;
    }
    alive.push(candidate);
  }
  return { live: alive, expired };
}
