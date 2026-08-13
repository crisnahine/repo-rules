import { readFileSync, existsSync, realpathSync } from "node:fs";
import { isAbsolute, resolve, sep } from "node:path";

// A quote is a tripwire: its disappearance is what expires the rule. Too short or too common
// and it survives every edit, so expiry looks healthy while never firing.
const MIN_QUOTE_CHARS = 12;

export function isUsableQuote(text) {
  return typeof text === "string" && text.trim().length >= MIN_QUOTE_CHARS;
}

// A citation that does not resolve against the file cannot be checked and cannot expire.
// Emitting nothing beats emitting a rule nobody can falsify.
export function mint({ path, body, quote }) {
  if (!isUsableQuote(quote) || !body.includes(quote)) return null;
  const line = body.slice(0, body.indexOf(quote)).split("\n").length;
  return { path, lines: `${line}-${line}`, quote };
}

// Citation paths come from a committed file anyone with commit access can edit. Reading
// outside the repository is never legitimate here.
function staysInside(path) {
  return !isAbsolute(path) && !path.split(/[\\/]/).includes("..");
}

export function checkCitation(citation) {
  const reasons = [];

  if (typeof citation?.path !== "string" || citation.path === "") {
    reasons.push("evidence entry is missing path");
  } else if (!staysInside(citation.path)) {
    reasons.push(`evidence path ${JSON.stringify(citation.path)} must stay inside the repository`);
  }

  if (typeof citation?.quote !== "string" || citation.quote.trim() === "") {
    reasons.push("evidence entry is missing quote");
  } else if (!isUsableQuote(citation.quote)) {
    reasons.push(`evidence quote must be at least ${MIN_QUOTE_CHARS} characters to be a useful tripwire`);
  }

  return reasons;
}

// A changed blob is not death: any edit anywhere in the file changes it. The quote
// disappearing is what means the rule no longer describes the code.
export function resolveCitation(citation, repoRoot) {
  const root = resolve(repoRoot);
  const full = resolve(root, citation.path);

  // Lexical containment first, cheap and without touching the filesystem: this is the code
  // that reads files, so it refuses to read outside the repository even when handed a rules
  // file nobody vetted.
  if (full !== root && !full.startsWith(root + sep)) {
    return { live: false, reason: "path escapes the repository" };
  }
  if (!existsSync(full)) return { live: false, reason: "file is missing" };

  // Lexical containment alone does not catch a committed symlink whose target lives outside
  // the repository: resolve() normalises ".." but never follows a symlink, and readFileSync
  // does. Resolve both sides for real before trusting the read.
  let realRoot;
  let realFull;
  try {
    realRoot = realpathSync(root);
    realFull = realpathSync(full);
  } catch {
    return { live: false, reason: "path could not be resolved" };
  }
  if (realFull !== realRoot && !realFull.startsWith(realRoot + sep)) {
    return { live: false, reason: "path escapes the repository" };
  }

  let body;
  try {
    body = readFileSync(full, "utf8");
  } catch {
    return { live: false, reason: "file could not be read" };
  }
  if (!body.includes(citation.quote)) {
    return { live: false, reason: "quote no longer appears in the file" };
  }
  return { live: true };
}
