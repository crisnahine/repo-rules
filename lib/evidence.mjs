import { resolveCitation } from "./citation.mjs";

export function resolveEvidence(rule, repoRoot) {
  const live = [];
  const dead = [];
  for (const item of rule.evidence ?? []) {
    const outcome = resolveCitation(item, repoRoot);
    if (outcome.live) live.push(item);
    else dead.push({ path: item.path, reason: outcome.reason });
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
