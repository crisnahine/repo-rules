import test, { after } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, rmSync, mkdtempSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mint, checkCitation, resolveCitation, isUsableQuote } from "../lib/citation.mjs";
import { makeRepo, cleanupRepos } from "./fixtures/make-repo.mjs";

after(cleanupRepos);

test("a quote shorter than the tripwire floor is not usable", () => {
  assert.equal(isUsableQuote("short"), false);
  assert.equal(isUsableQuote("alpha bravo charlie"), true);
  assert.equal(isUsableQuote(null), false);
});

test("mint records the line the quote starts on", () => {
  const body = "first line here\nsecond line here\nthird line here\n";
  assert.deepEqual(mint({ path: "a.js", body, quote: "second line here" }), {
    path: "a.js",
    lines: "2-2",
    quote: "second line here",
  });
});

test("mint refuses a quote that is not in the file", () => {
  assert.equal(mint({ path: "a.js", body: "alpha bravo charlie\n", quote: "delta echo foxtrot" }), null);
});

test("mint refuses a quote too short to be a tripwire", () => {
  assert.equal(mint({ path: "a.js", body: "short\n", quote: "short" }), null);
});

test("checkCitation accepts a well formed citation", () => {
  assert.deepEqual(checkCitation({ path: "spec/a_spec.js", lines: "1-1", quote: "import { suite }" }), []);
});

test("checkCitation rejects a path that escapes the repository", () => {
  assert.ok(checkCitation({ path: "../../etc/passwd", quote: "root:x:0:0:root" }).some((r) => r.includes("inside the repository")));
  assert.ok(checkCitation({ path: "/etc/passwd", quote: "root:x:0:0:root" }).some((r) => r.includes("inside the repository")));
});

test("checkCitation rejects a missing path and a missing quote", () => {
  const reasons = checkCitation({});
  assert.ok(reasons.some((r) => r.includes("missing path")));
  assert.ok(reasons.some((r) => r.includes("missing quote")));
});

test("checkCitation rejects a quote below the tripwire floor with the floor named", () => {
  const reasons = checkCitation({ path: "a.js", quote: "short" });
  assert.ok(reasons.some((r) => r.includes("12 characters")));
});

test("resolveCitation is live when the quote is still in the file", () => {
  const root = makeRepo({ files: { "a.js": "alpha bravo charlie\n" } });
  assert.deepEqual(resolveCitation({ path: "a.js", quote: "alpha bravo charlie" }, root), { live: true });
});

test("resolveCitation is dead when the file is gone, the quote is gone, or the path escapes", () => {
  const root = makeRepo({ files: { "a.js": "alpha bravo charlie\n" } });
  assert.match(resolveCitation({ path: "gone.js", quote: "alpha bravo charlie" }, root).reason, /missing/);
  assert.match(resolveCitation({ path: "a.js", quote: "delta echo foxtrot" }, root).reason, /quote/);
  assert.match(resolveCitation({ path: "../../etc/passwd", quote: "root:x:0:0:root" }, root).reason, /escapes/);
});

test("resolveCitation refuses to read through a symlink pointing outside the repository", () => {
  const outsideDir = mkdtempSync(join(tmpdir(), "repo-rules-outside-"));
  writeFileSync(join(outsideDir, "creds.txt"), "super-secret-token-value\n");
  const root = makeRepo({ files: { "placeholder.txt": "x\n" } });
  symlinkSync(join(outsideDir, "creds.txt"), join(root, "outside.txt"));
  try {
    const outcome = resolveCitation({ path: "outside.txt", quote: "super-secret-token-value" }, root);
    assert.equal(outcome.live, false);
    assert.match(outcome.reason, /escapes|resolved/);
  } finally {
    rmSync(outsideDir, { recursive: true, force: true });
  }
});
