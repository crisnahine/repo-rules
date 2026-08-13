import test, { after } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, rmSync, mkdtempSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveEvidence, expire } from "../lib/evidence.mjs";
import { makeRepo, cleanupRepos } from "./fixtures/make-repo.mjs";

after(cleanupRepos);

function ruleWith(evidence, extra = {}) {
  return {
    id: "testing.location.spec-dir",
    paths: ["src/"],
    statement: "Unit tests live in spec/.",
    source: "declared",
    support: { followed: 1, candidates: 1, authors: 1, dirs: 1 },
    evidence,
    ...extra,
  };
}

test("a citation whose quote is present is live", () => {
  const root = makeRepo({ files: { "spec/parse_spec.js": 'import { suite } from "../harness.js";\n' } });
  const rule = ruleWith([{ path: "spec/parse_spec.js", lines: "1-1", quote: "import { suite }" }]);
  const { live, dead } = resolveEvidence(rule, root);
  assert.equal(live.length, 1);
  assert.equal(dead.length, 0);
});

test("a citation whose file is gone is dead", () => {
  const root = makeRepo({ files: { "spec/parse_spec.js": "x\n" } });
  rmSync(join(root, "spec/parse_spec.js"));
  const rule = ruleWith([{ path: "spec/parse_spec.js", lines: "1-1", quote: "x" }]);
  const { dead } = resolveEvidence(rule, root);
  assert.equal(dead.length, 1);
  assert.match(dead[0].reason, /missing/);
});

test("a citation whose quote no longer appears is dead", () => {
  const root = makeRepo({ files: { "spec/parse_spec.js": 'import { suite } from "../harness.js";\n' } });
  writeFileSync(join(root, "spec/parse_spec.js"), 'import test from "node:test";\n');
  const rule = ruleWith([{ path: "spec/parse_spec.js", lines: "1-1", quote: "import { suite }" }]);
  const { dead } = resolveEvidence(rule, root);
  assert.equal(dead.length, 1);
  assert.match(dead[0].reason, /quote/);
});

test("an edit elsewhere in the file does not kill the citation", () => {
  const root = makeRepo({ files: { "spec/parse_spec.js": 'import { suite } from "../harness.js";\n' } });
  writeFileSync(join(root, "spec/parse_spec.js"), 'import { suite } from "../harness.js";\n\n// added later\n');
  const rule = ruleWith([{ path: "spec/parse_spec.js", lines: "1-1", quote: "import { suite }" }]);
  assert.equal(resolveEvidence(rule, root).dead.length, 0);
});

test("a rule whose citations are all dead expires", () => {
  const root = makeRepo({ files: { "a.js": "alpha\n" } });
  const rule = ruleWith([{ path: "gone.js", lines: "1-1", quote: "alpha" }]);
  const { live, expired } = expire([rule], root);
  assert.equal(live.length, 0);
  assert.equal(expired.length, 1);
  assert.equal(expired[0].reason, "every citation is dead (1 checked)");
});

test("a citation whose path escapes the repository is dead", () => {
  const root = makeRepo({ files: { "a.js": "alpha\n" } });
  const rule = ruleWith([{ path: "../../etc/passwd", lines: "1-1", quote: "root:x" }]);
  const { dead } = resolveEvidence(rule, root);
  assert.equal(dead.length, 1);
  assert.match(dead[0].reason, /escapes/);
});

test("a citation through a symlink pointing outside the repository is dead", () => {
  const outsideDir = mkdtempSync(join(tmpdir(), "repo-rules-outside-"));
  const outsideFile = join(outsideDir, "creds.txt");
  writeFileSync(outsideFile, "super-secret-token-value\n");
  const root = makeRepo({ files: { "placeholder.txt": "x\n" } });
  symlinkSync(outsideFile, join(root, "outside.txt"));
  try {
    const rule = ruleWith([{ path: "outside.txt", lines: "1-1", quote: "super-secret-token-value" }]);
    const { live, dead } = resolveEvidence(rule, root);
    assert.equal(live.length, 0);
    assert.equal(dead.length, 1);
    assert.match(dead[0].reason, /escapes|resolved/);
  } finally {
    rmSync(outsideDir, { recursive: true, force: true });
  }
});

test("a rule with living evidence survives, carrying only its live citations", () => {
  const root = makeRepo({ files: { "a.js": "alpha\n" } });
  const rule = ruleWith([
    { path: "a.js", lines: "1-1", quote: "alpha" },
    { path: "gone.js", lines: "1-1", quote: "beta" },
  ]);
  const { live, expired } = expire([rule], root);
  assert.equal(expired.length, 0);
  assert.equal(live[0].evidence.length, 1);
  assert.equal(live[0].evidence[0].path, "a.js");
});
