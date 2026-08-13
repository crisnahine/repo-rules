import { checkStatement } from "./statement.mjs";
import {
  OBSERVED_MIN_SITES,
  OBSERVED_MIN_RATIO,
  OBSERVED_MIN_AUTHORS,
  OBSERVED_MIN_DIRS,
  DECLARED_MIN_EVIDENCE,
  MAX_RULES,
} from "./constants.mjs";
import { checkCitation } from "./citation.mjs";

const ID_PATTERN = /^[a-z0-9]+(?:\.[a-z0-9-]+)+$/;

export function validateShape(rule) {
  const reasons = [];

  if (typeof rule?.id !== "string" || !ID_PATTERN.test(rule.id)) {
    reasons.push("id must be dotted lowercase, for example testing.location.spec-dir");
  }

  reasons.push(...checkStatement(rule?.statement));

  if (!Array.isArray(rule?.paths)) {
    reasons.push("paths must be an array");
  } else {
    for (const p of rule.paths) {
      if (typeof p !== "string" || !p.endsWith("/") || p.includes("*")) {
        reasons.push(`paths entry ${JSON.stringify(p)} must be a directory prefix ending in /`);
      }
    }
  }

  if (rule?.source !== "declared" && rule?.source !== "observed") {
    reasons.push("source must be declared or observed");
  }

  if (!Array.isArray(rule?.evidence) || rule.evidence.length === 0) {
    reasons.push("evidence must be a non-empty array");
  } else {
    for (const citation of rule.evidence) reasons.push(...checkCitation(citation));
  }

  return reasons;
}

// Majority support is not enough: replicated studies put majority-rule convention
// detectors at 0 to 11.4% precision. The thresholds below are deliberately near-unanimous.
export function checkGate(rule) {
  const reasons = [];
  const s = rule?.support ?? {};

  if (rule?.source === "declared") {
    if (!Array.isArray(rule.evidence) || rule.evidence.length < DECLARED_MIN_EVIDENCE) {
      reasons.push(`declared rules need at least ${DECLARED_MIN_EVIDENCE} citation`);
    }
    return reasons;
  }

  if (!(s.followed >= OBSERVED_MIN_SITES)) {
    reasons.push(`observed rules need at least ${OBSERVED_MIN_SITES} supporting sites, got ${s.followed ?? 0}`);
  }
  // More sites following a rule than could have followed it is malformed, not strong.
  // Left unguarded it yields a ratio above 1 and sails through the check below.
  if (s.followed > s.candidates) {
    reasons.push(`support is malformed: ${s.followed} of ${s.candidates} sites`);
  }
  const ratio = s.candidates > 0 ? s.followed / s.candidates : 0;
  if (!(ratio >= OBSERVED_MIN_RATIO)) {
    reasons.push(`support ratio ${ratio.toFixed(2)} is below the required ${OBSERVED_MIN_RATIO}`);
  }
  if (!(s.authors >= OBSERVED_MIN_AUTHORS)) {
    reasons.push(`observed rules need at least ${OBSERVED_MIN_AUTHORS} distinct authors`);
  }
  if (!(s.dirs >= OBSERVED_MIN_DIRS)) {
    reasons.push(`observed rules need at least ${OBSERVED_MIN_DIRS} distinct directories`);
  }
  return reasons;
}

export function validateRuleSet(rules) {
  const accepted = [];
  const rejected = [];
  const seen = new Set();

  for (const rule of rules) {
    const reasons = [...validateShape(rule), ...checkGate(rule)];
    if (seen.has(rule?.id)) reasons.push(`duplicate id ${rule.id}`);
    if (reasons.length > 0) {
      rejected.push({ id: rule?.id ?? "(no id)", reasons });
      continue;
    }
    if (accepted.length >= MAX_RULES) {
      rejected.push({ id: rule.id, reasons: [`exceeds the ${MAX_RULES} rule cap`] });
      continue;
    }
    seen.add(rule.id);
    accepted.push(rule);
  }

  return { accepted, rejected };
}
