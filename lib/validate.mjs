import {
  ID_PATTERN,
  IMPERATIVE_OPENERS,
  SECOND_PERSON,
  TOOL_NAMES,
  SHELL_METACHARACTERS,
  URL_PATTERN,
  CODE_FENCE,
  LEADING_CLAUSE,
  STATEMENT_MAX_CHARS,
} from "./constants.mjs";

export function validateShape(rule) {
  const reasons = [];

  if (typeof rule?.id !== "string" || !ID_PATTERN.test(rule.id)) {
    reasons.push("id must be dotted lowercase, for example testing.location.spec-dir");
  }

  const statement = rule?.statement;
  if (typeof statement !== "string" || statement.trim() === "") {
    reasons.push("statement is required");
  } else {
    if (statement.length > STATEMENT_MAX_CHARS) reasons.push(`statement exceeds ${STATEMENT_MAX_CHARS} characters`);
    const trimmed = statement.trim();
    const withoutLeadingClause = trimmed.replace(LEADING_CLAUSE, "");
    if (IMPERATIVE_OPENERS.test(trimmed) || IMPERATIVE_OPENERS.test(withoutLeadingClause)) {
      reasons.push("statement is imperative; state a fact about the codebase instead");
    }
    if (SECOND_PERSON.test(statement)) reasons.push("statement addresses the reader in the second person");
    if (TOOL_NAMES.test(statement)) reasons.push("statement contains a tool name");
    if (SHELL_METACHARACTERS.test(statement)) reasons.push("statement contains shell metacharacters");
    if (URL_PATTERN.test(statement)) reasons.push("statement contains a URL");
    if (CODE_FENCE.test(statement)) reasons.push("statement contains a code fence");
  }

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
    for (const e of rule.evidence) {
      if (typeof e?.path !== "string" || e.path === "") reasons.push("evidence entry is missing path");
      if (typeof e?.quote !== "string" || e.quote.trim() === "") reasons.push("evidence entry is missing quote");
    }
  }

  return reasons;
}
