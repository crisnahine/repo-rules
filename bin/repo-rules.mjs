#!/usr/bin/env node
import { readFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { repoFacts } from "../lib/repo.mjs";
import { detectDeclared } from "../lib/detect.mjs";
import { validateRuleSet } from "../lib/validate.mjs";
import { expire } from "../lib/evidence.mjs";
import { render } from "../lib/render.mjs";
import { writeAtomic } from "../lib/io.mjs";

const USAGE = "usage: repo-rules <scan|check|render>";

function rulesPath(root) {
  return join(root, ".claude", "repo-rules", "rules.json");
}

function loadRules(root) {
  const path = rulesPath(root);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

// Rewrite the whole directory each time so an expired topic leaves no orphan file behind.
function writeRuleset(root, rules) {
  writeAtomic(rulesPath(root), `${JSON.stringify(rules, null, 2)}\n`);
  const dir = join(root, ".claude", "rules");
  const files = render(rules);
  if (files.size === 0) {
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
    return;
  }
  mkdirSync(dir, { recursive: true });
  const keep = new Set(files.keys());
  for (const existing of readdirSync(dir)) {
    if (existing.endsWith(".md") && !keep.has(existing)) rmSync(join(dir, existing), { force: true });
  }
  for (const [name, body] of files) writeAtomic(join(dir, name), body);
}

function scan(root) {
  const { accepted, rejected } = validateRuleSet(detectDeclared(root));
  writeRuleset(root, accepted);
  for (const item of rejected) console.log(`dropped ${item.id}: ${item.reasons.join("; ")}`);
  console.log(`scan complete: ${accepted.length} rules, ${rejected.length} dropped`);
}

function check(root) {
  const rules = loadRules(root);
  if (rules === null) {
    console.log("no rules for this repo; run repo-rules scan");
    return;
  }
  const { live, expired } = expire(rules, root);
  writeRuleset(root, live);
  for (const item of expired) console.log(`expired ${item.id}: ${item.reason}`);
  console.log(`check complete: ${live.length} live, ${expired.length} expired`);
}

function renderOnly(root) {
  const rules = loadRules(root);
  if (rules === null) {
    console.log("no rules for this repo; run repo-rules scan");
    return;
  }
  writeRuleset(root, rules);
  console.log(`render complete: ${rules.length} rules`);
}

const command = process.argv[2];
const root = repoFacts(process.cwd()).repoRoot;

try {
  if (command === "scan") scan(root);
  else if (command === "check") check(root);
  else if (command === "render") renderOnly(root);
  else {
    console.error(USAGE);
    process.exit(1);
  }
} catch (error) {
  console.error(`repo-rules: ${error.message}`);
  process.exit(1);
}
