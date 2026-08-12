export const OBSERVED_MIN_SITES = 10;
export const OBSERVED_MIN_RATIO = 0.9;
export const OBSERVED_MIN_AUTHORS = 2;
export const OBSERVED_MIN_DIRS = 2;
export const DECLARED_MIN_EVIDENCE = 1;
export const MAX_RULES = 30;
export const STATEMENT_MAX_CHARS = 200;

export const ID_PATTERN = /^[a-z0-9]+(?:\.[a-z0-9-]+)+$/;

// A statement that reads as an instruction to the model gets refused as prompt injection,
// so the mood is enforced, not merely preferred.
export const IMPERATIVE_OPENERS =
  /^(always|never|do|don't|dont|make|ensure|use|add|avoid|remember|please|must|prefer|put|write|follow|keep)\b/i;
export const SECOND_PERSON = /\byour?\b/i;
export const TOOL_NAMES = /\b(Bash|WebFetch|WebSearch|Write|Edit|Read|Agent|Task|Glob|Grep)\b/;
// Angle brackets are deliberately absent: they appear in ordinary prose such as
// `<module>_spec.js` and version ranges like `>=20`. Chaining and substitution are the risk.
export const SHELL_METACHARACTERS = /[;&|`$]/;
export const URL_PATTERN = /https?:\/\//i;
export const CODE_FENCE = /```/;
