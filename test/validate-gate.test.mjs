import test from "node:test";
import assert from "node:assert/strict";
import { checkGate, validateRuleSet } from "../lib/validate.mjs";

const observed = {
  id: "testing.location.spec-dir",
  paths: ["src/"],
  statement: "Unit tests live in spec/, named <module>_spec.js.",
  source: "observed",
  support: { followed: 14, candidates: 14, authors: 4, dirs: 3 },
  evidence: [{ path: "spec/parse_spec.js", lines: "1-3", quote: "import { suite }" }],
};

const declared = {
  id: "tooling.package-manager.pnpm",
  paths: [],
  statement: "The package manager is pnpm, pinned in package.json.",
  source: "declared",
  support: { followed: 1, candidates: 1, authors: 1, dirs: 1 },
  evidence: [{ path: "package.json", lines: "4-4", quote: "\"packageManager\": \"pnpm@9.0.0\"" }],
};

test("an observed rule meeting every threshold passes", () => {
  assert.deepEqual(checkGate(observed), []);
});

test("a declared rule needs only one citation and no ratio", () => {
  assert.deepEqual(checkGate(declared), []);
});

test("rejects an observed rule with too few sites", () => {
  const rule = { ...observed, support: { followed: 4, candidates: 4, authors: 4, dirs: 3 } };
  assert.ok(checkGate(rule).some((r) => r.includes("10")));
});

test("rejects an observed rule below the ratio", () => {
  const rule = { ...observed, support: { followed: 12, candidates: 20, authors: 4, dirs: 3 } };
  assert.ok(checkGate(rule).some((r) => r.includes("ratio")));
});

test("rejects an observed rule from a single author", () => {
  const rule = { ...observed, support: { followed: 14, candidates: 14, authors: 1, dirs: 3 } };
  assert.ok(checkGate(rule).some((r) => r.includes("author")));
});

test("rejects an observed rule confined to one directory", () => {
  const rule = { ...observed, support: { followed: 14, candidates: 14, authors: 4, dirs: 1 } };
  assert.ok(checkGate(rule).some((r) => r.includes("director")));
});

test("validateRuleSet splits accepted from rejected and reports why", () => {
  const bad = { ...observed, id: "no-dots", support: { followed: 1, candidates: 9, authors: 1, dirs: 1 } };
  const result = validateRuleSet([observed, declared, bad]);
  assert.equal(result.accepted.length, 2);
  assert.equal(result.rejected.length, 1);
  assert.ok(result.rejected[0].reasons.length >= 2);
});

test("validateRuleSet rejects duplicate ids", () => {
  const result = validateRuleSet([observed, { ...observed }]);
  assert.equal(result.accepted.length, 1);
  assert.ok(result.rejected[0].reasons.some((r) => r.includes("duplicate")));
});

test("validateRuleSet caps the set at MAX_RULES", () => {
  const many = Array.from({ length: 35 }, (_, i) => ({ ...declared, id: `tooling.k.n${i}` }));
  const result = validateRuleSet(many);
  assert.equal(result.accepted.length, 30);
  assert.equal(result.rejected.length, 5);
  assert.ok(result.rejected[0].reasons.some((r) => r.includes("cap")));
});
