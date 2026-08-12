import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { MIN_QUOTE_CHARS } from "./constants.mjs";

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

function lineOf(body, needle) {
  const index = body.indexOf(needle);
  if (index === -1) return "1-1";
  const line = body.slice(0, index).split("\n").length;
  return `${line}-${line}`;
}

// A citation has to resolve against the file and clear the tripwire floor, or the rule cannot
// be checked and cannot expire. Emitting nothing beats emitting a rule nobody can falsify.
function rule(id, statement, path, body, quote) {
  if (typeof quote !== "string" || quote.trim().length < MIN_QUOTE_CHARS || !body.includes(quote)) {
    return null;
  }
  return {
    id,
    paths: [],
    statement,
    source: "declared",
    support: { followed: 1, candidates: 1, authors: 1, dirs: 1 },
    evidence: [{ path, lines: lineOf(body, quote), quote }],
  };
}

// The first line long enough to be a tripwire. Binary lockfiles yield nothing usable here,
// which is the wanted outcome: no citation, no rule.
function firstUsableLine(body) {
  return body.split("\n").find((line) => line.trim().length >= MIN_QUOTE_CHARS) ?? null;
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
    const quote = `"packageManager": ${JSON.stringify(pkg.json.packageManager)}`;
    const name = String(pkg.json.packageManager).split("@")[0];
    return rule(
      "tooling.package-manager",
      `The package manager is ${name}, pinned in package.json.`,
      "package.json",
      pkg.body,
      pkg.body.includes(quote) ? quote : "packageManager",
    );
  }
  for (const [file, name] of LOCKFILES) {
    const body = read(root, file);
    if (body === null) continue;
    const found = rule(
      "tooling.package-manager",
      `The package manager is ${name}, evidenced by the committed ${file}.`,
      file,
      body,
      firstUsableLine(body),
    );
    if (found) return found;
  }
  return null;
}

function detectRuntimeVersion(root, pkg) {
  if (pkg.json?.engines?.node) {
    const quote = `"node": ${JSON.stringify(pkg.json.engines.node)}`;
    return rule(
      "tooling.runtime-version",
      `The Node version floor is ${pkg.json.engines.node}, declared in package.json engines.`,
      "package.json",
      pkg.body,
      pkg.body.includes(quote) ? quote : "engines",
    );
  }
  // A bare .node-version holds only a version number, too short to be a tripwire, so no
  // citation can be built from it. package.json engines is the only usable source here.
  return null;
}

function detectTestCommand(pkg) {
  const command = pkg.json?.scripts?.test;
  if (!command) return null;
  const quote = `"test": ${JSON.stringify(command)}`;
  return rule(
    "tooling.test-command",
    `The test suite runs with ${command}, declared in package.json scripts.`,
    "package.json",
    pkg.body,
    pkg.body.includes(quote) ? quote : command,
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
    const commands = matches.map((m) => m[1].trim());
    const shown = commands.slice(0, 3).join(", ");
    // Quote the whole matched line, not the bare command: "pnpm lint" alone is too short
    // to survive the tripwire floor, and the line is what actually sits in the file.
    const found = rule(
      "tooling.ci-gate",
      `Continuous integration runs ${shown}, declared in ${rel}.`.slice(0, 200),
      rel,
      body,
      matches[0][0].trim(),
    );
    if (found) return found;
  }
  return null;
}

export function detectDeclared(repoRoot) {
  const pkg = packageJson(repoRoot);
  return [
    detectPackageManager(repoRoot, pkg),
    detectRuntimeVersion(repoRoot, pkg),
    detectTestCommand(pkg),
    detectCiGate(repoRoot),
  ].filter(Boolean);
}
