import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { mint, isUsableQuote } from "./citation.mjs";

const LOCKFILES = [
  ["pnpm-lock.yaml", "pnpm"],
  ["yarn.lock", "yarn"],
  ["bun.lockb", "bun"],
  ["package-lock.json", "npm"],
];

function read(root, rel) {
  const full = join(root, rel);
  if (!existsSync(full)) return null;
  try {
    return readFileSync(full, "utf8");
  } catch {
    return null;
  }
}

// A citation has to resolve against the file and clear the tripwire floor, or the rule cannot
// be checked and cannot expire.
function rule(id, statement, path, body, quote) {
  const citation = mint({ path, body, quote });
  if (!citation) return null;
  return {
    id,
    paths: [],
    statement,
    source: "declared",
    support: { followed: 1, candidates: 1, authors: 1, dirs: 1 },
    evidence: [citation],
  };
}

// The first printable line long enough to be a tripwire. The printable test matters: a binary
// lockfile read as UTF-8 yields long runs of replacement characters that clear a length check
// but are nonsense as evidence.
function firstUsableLine(body) {
  return (
    body.split("\n").find((line) => isUsableQuote(line) && /^[\x20-\x7e\t]+$/.test(line.trim())) ?? null
  );
}

// Find the quote in the source text rather than re-serialising the parsed value, so a config
// written without a space after the colon still yields a citation that resolves.
//
// The value is part of the pattern, not just the key. Matching the key alone cites the first
// occurrence anywhere in the file, so a "test" dependency pin gets cited instead of the "test"
// script. Requiring the value also gives the citation its tripwire meaning: when the value the
// statement asserts changes, the quote dies and the rule expires.
function quoteFromSource(body, key, value) {
  const escape = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`"${escape(key)}"\\s*:\\s*"${escape(value)}"`).exec(body);
  return match ? match[0] : null;
}

// Cites up to and including the manager's name, not the pinned version after the "@". A
// patch bump does not change which package manager is in use, so it must not expire this
// rule; a change of manager still falsifies this quote.
function packageManagerQuote(body, name) {
  const escape = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`"packageManager"\\s*:\\s*"${escape(name)}`).exec(body);
  return match ? match[0] : null;
}

// Statements are capped so an unusually long command cannot silently breach STATEMENT_MAX_CHARS
// and get the whole rule rejected downstream.
function sentence(text) {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= 197 ? flat : `${flat.slice(0, 197)}...`;
}

function packageJson(root) {
  const body = read(root, "package.json");
  if (!body) return { body: null, json: null };
  try {
    return { body, json: JSON.parse(body) };
  } catch {
    return { body, json: null };
  }
}

function detectPackageManager(root, pkg) {
  if (pkg.json?.packageManager) {
    const name = String(pkg.json.packageManager).split("@")[0];
    return rule(
      "tooling.package-manager",
      sentence(`The package manager is ${name}, pinned in package.json.`),
      "package.json",
      pkg.body,
      packageManagerQuote(pkg.body, name),
    );
  }
  for (const [file, name] of LOCKFILES) {
    const body = read(root, file);
    if (body === null) continue;
    const found = rule(
      "tooling.package-manager",
      sentence(`The package manager is ${name}, evidenced by the committed ${file}.`),
      file,
      body,
      firstUsableLine(body),
    );
    if (found) return found;
  }
  return null;
}

function detectRuntimeVersion(pkg) {
  if (!pkg.json?.engines?.node) return null;
  return rule(
    "tooling.runtime-version",
    sentence(`The Node version floor is ${pkg.json.engines.node}, declared in package.json engines.`),
    "package.json",
    pkg.body,
    quoteFromSource(pkg.body, "node", pkg.json.engines.node),
  );
}

function detectTestCommand(pkg) {
  const command = pkg.json?.scripts?.test;
  if (typeof command !== "string" || command === "") return null;
  return rule(
    "tooling.test-command",
    sentence(`The test suite runs with ${command}, declared in package.json scripts.`),
    "package.json",
    pkg.body,
    quoteFromSource(pkg.body, "test", command),
  );
}

function detectCiGate(root) {
  const dir = join(root, ".github", "workflows");
  if (!existsSync(dir)) return null;
  let entries;
  try {
    entries = readdirSync(dir).filter((f) => f.endsWith(".yml") || f.endsWith(".yaml")).sort();
  } catch {
    return null;
  }
  for (const entry of entries) {
    const rel = join(".github", "workflows", entry);
    const body = read(root, rel);
    if (!body) continue;
    const matches = [...body.matchAll(/^[ \t]*-[ \t]*run:[ \t]*(.+)$/gm)];
    if (matches.length === 0) continue;
    // The statement names only the one command it cites, so the two can never drift apart:
    // deleting the cited line is what expires the rule. Quote the whole matched line, not the
    // bare command: "pnpm lint" alone is too short to survive the tripwire floor. Try each
    // match in turn, because a block scalar step writes "- run: |" as its first line, which is
    // too short and must not veto the whole file.
    for (const match of matches) {
      const command = match[1].trim();
      const found = rule(
        "tooling.ci-gate",
        sentence(`Continuous integration runs ${command}, declared in ${rel}.`),
        rel,
        body,
        match[0].trim(),
      );
      if (found) return found;
    }
  }
  return null;
}

export function detectDeclared(repoRoot) {
  const pkg = packageJson(repoRoot);
  return [
    detectPackageManager(repoRoot, pkg),
    detectRuntimeVersion(pkg),
    detectTestCommand(pkg),
    detectCiGate(repoRoot),
  ].filter(Boolean);
}
