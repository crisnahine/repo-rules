export const OBSERVED_MIN_SITES = 10;
export const OBSERVED_MIN_RATIO = 0.9;
export const OBSERVED_MIN_AUTHORS = 2;
export const OBSERVED_MIN_DIRS = 2;
export const DECLARED_MIN_EVIDENCE = 1;
export const MAX_RULES = 30;
export const STATEMENT_MAX_CHARS = 200;

export const ID_PATTERN = /^[a-z0-9]+(?:\.[a-z0-9-]+)+$/;

// A statement that reads as an instruction to the model gets refused as prompt injection,
// so the mood is enforced, not merely preferred. The trailing (?!-) keeps a hyphenated word
// that merely starts with an opener, like "Write-behind caching...", from being read as one:
// \b alone matches at a word/hyphen boundary too, which "write" would otherwise satisfy.
export const IMPERATIVE_OPENERS =
  /^(always|never|do|don't|dont|make|ensure|use|add|avoid|remember|please|must|prefer|put|write|follow|keep)\b(?!-)/i;
export const SECOND_PERSON = /\byou(?:r(?:s|self|selves)?)?\b/i;
// Bare tool names are ordinary English: "Read replicas", "Task management", "Write-ahead log".
// Only tool-shaped phrasing and the names that exist nowhere else in prose are rejected.
export const TOOL_NAMES = /\b(?:bash|glob|grep|agent|task|read|write|edit)\s+tool\b|\bweb(?:fetch|search)\b/i;
// One short connective ("So,", "Note:") is stripped before re-testing for an imperative,
// so a single leading word cannot smuggle one through. Deliberately narrow: it must be one
// unbroken word, or "Unit tests live in spec/, never in test/" would strip down to "never".
export const LEADING_CLAUSE = /^[A-Za-z]{1,12}[,:]\s*/;
// Angle brackets are deliberately absent: they appear in ordinary prose such as
// `<module>_spec.js` and version ranges like `>=20`. Chaining and substitution are the risk.
// Statements are prose rendered into a file the model reads; nothing here is ever executed,
// so shell metacharacters in them are harmless and banning them wrongly kills real rules
// ("eslint . && vitest run" is an ordinary test command). A newline is the actual risk: it
// lets repository text close the rendered list item and open something shaped like a new
// instruction. So control characters are refused and metacharacters are not.
export const CONTROL_OR_NEWLINE = /[\r\n\u0000-\u001f\u007f]/;
export const URL_PATTERN = /https?:\/\//i;
export const CODE_FENCE = /```/;
