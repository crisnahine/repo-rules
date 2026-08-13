const MAX_CHARS = 200;

// A statement that reads as an instruction to the model gets refused as prompt injection,
// so the mood is enforced, not merely preferred. The trailing (?!-) keeps a hyphenated word
// that merely starts with an opener, like "Write-behind caching...", from being read as one:
// \b alone matches at a word/hyphen boundary too, which "write" would otherwise satisfy.
const IMPERATIVE_OPENERS =
  /^(always|never|do|don't|dont|make|ensure|use|add|avoid|remember|please|must|prefer|put|write|follow|keep)\b(?!-)/i;
const SECOND_PERSON = /\byou(?:r(?:s|self|selves)?)?\b/i;
// Bare tool names are ordinary English: "Read replicas", "Task management", "Write-ahead log".
// Only tool-shaped phrasing and the names that exist nowhere else in prose are rejected.
const TOOL_NAMES = /\b(?:bash|glob|grep|agent|task|read|write|edit)\s+tool\b|\bweb(?:fetch|search)\b/i;
// One short connective ("So,", "Note:") is stripped before re-testing for an imperative,
// so a single leading word cannot smuggle one through. Deliberately narrow: it must be one
// unbroken word, or "Unit tests live in spec/, never in test/" would strip down to "never".
const LEADING_CLAUSE = /^[A-Za-z]{1,12}[,:]\s*/;
// Angle brackets are deliberately absent: they appear in ordinary prose such as
// `<module>_spec.js` and version ranges like `>=20`. Chaining and substitution are the risk.
// Statements are prose rendered into a file the model reads; nothing here is ever executed,
// so shell metacharacters in them are harmless and banning them wrongly kills real rules
// ("eslint . && vitest run" is an ordinary test command). A newline is the actual risk: it
// lets repository text close the rendered list item and open something shaped like a new
// instruction. So control characters are refused and metacharacters are not.
const CONTROL_OR_NEWLINE = /[\r\n\u0000-\u001f\u007f]/;
const URL_PATTERN = /https?:\/\//i;
const CODE_FENCE = /```/;

export function checkStatement(text) {
  if (typeof text !== "string" || text.trim() === "") return ["statement is required"];

  const reasons = [];
  if (text.length > MAX_CHARS) reasons.push(`statement exceeds ${MAX_CHARS} characters`);

  const trimmed = text.trim();
  const withoutLeadingClause = trimmed.replace(LEADING_CLAUSE, "");
  if (IMPERATIVE_OPENERS.test(trimmed) || IMPERATIVE_OPENERS.test(withoutLeadingClause)) {
    reasons.push("statement is imperative; state a fact about the codebase instead");
  }
  if (SECOND_PERSON.test(text)) reasons.push("statement addresses the reader in the second person");
  if (TOOL_NAMES.test(text)) reasons.push("statement contains a tool name");
  if (CONTROL_OR_NEWLINE.test(text)) reasons.push("statement contains a newline or control character");
  if (URL_PATTERN.test(text)) reasons.push("statement contains a URL");
  if (CODE_FENCE.test(text)) reasons.push("statement contains a code fence");

  return reasons;
}
