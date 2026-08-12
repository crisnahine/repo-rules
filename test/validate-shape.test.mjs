import test from "node:test";
import assert from "node:assert/strict";
import { validateShape } from "../lib/validate.mjs";

const good = {
  id: "testing.location.spec-dir",
  paths: ["src/", "spec/"],
  statement: "Unit tests live in spec/, named <module>_spec.js.",
  source: "observed",
  support: { followed: 14, candidates: 14, authors: 4, dirs: 3 },
  evidence: [{ path: "spec/parse_spec.js", lines: "1-3", quote: "import { suite }" }],
};

test("a well formed rule produces no reasons", () => {
  assert.deepEqual(validateShape(good), []);
});

test("rejects a malformed id", () => {
  assert.ok(validateShape({ ...good, id: "Testing Location" }).some((r) => r.includes("id")));
});

test("rejects an imperative statement", () => {
  const reasons = validateShape({ ...good, statement: "Always put tests in spec/." });
  assert.ok(reasons.some((r) => r.includes("imperative")));
});

test("rejects second person", () => {
  const reasons = validateShape({ ...good, statement: "Tests live in spec/ in your project." });
  assert.ok(reasons.some((r) => r.includes("second person")));
});

test("rejects a statement naming a tool", () => {
  const reasons = validateShape({ ...good, statement: "Tests are run with the Bash tool." });
  assert.ok(reasons.some((r) => r.includes("tool name")));
});

test("rejects shell metacharacters, URLs and code fences", () => {
  assert.ok(validateShape({ ...good, statement: "Tests live in spec/ && run." }).length > 0);
  assert.ok(validateShape({ ...good, statement: "Tests live at https://x.test/docs." }).length > 0);
  assert.ok(validateShape({ ...good, statement: "Tests live in ```spec```." }).length > 0);
});

test("rejects an over-long statement", () => {
  const reasons = validateShape({ ...good, statement: "Tests live in spec/. ".repeat(20) });
  assert.ok(reasons.some((r) => r.includes("200")));
});

test("rejects paths that are not directory prefixes", () => {
  const reasons = validateShape({ ...good, paths: ["src/**/*.ts"] });
  assert.ok(reasons.some((r) => r.includes("directory prefix")));
});

test("rejects an unknown source", () => {
  assert.ok(validateShape({ ...good, source: "guessed" }).some((r) => r.includes("source")));
});

test("rejects empty evidence", () => {
  assert.ok(validateShape({ ...good, evidence: [] }).some((r) => r.includes("evidence")));
});

test("rejects evidence missing a quote", () => {
  const reasons = validateShape({ ...good, evidence: [{ path: "a.js", lines: "1-2" }] });
  assert.ok(reasons.some((r) => r.includes("quote")));
});
