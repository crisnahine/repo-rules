import test, { after } from "node:test";
import assert from "node:assert/strict";
import { detectDeclared } from "../lib/detect.mjs";
import { makeRepo, cleanupRepos } from "./fixtures/make-repo.mjs";

after(cleanupRepos);

test("detects the package manager from the packageManager field", () => {
  const root = makeRepo({ files: { "package.json": JSON.stringify({ packageManager: "pnpm@9.1.0" }, null, 2) } });
  const rules = detectDeclared(root);
  const rule = rules.find((r) => r.id === "tooling.package-manager");
  assert.ok(rule, "expected a package manager rule");
  assert.ok(rule.statement.includes("pnpm"));
  assert.equal(rule.source, "declared");
  assert.equal(rule.evidence[0].path, "package.json");
});

test("detects the package manager from a lockfile when the field is absent", () => {
  const root = makeRepo({ files: { "package.json": "{}", "pnpm-lock.yaml": "lockfileVersion: 9\n" } });
  const rule = detectDeclared(root).find((r) => r.id === "tooling.package-manager");
  assert.ok(rule.statement.includes("pnpm"));
  assert.equal(rule.evidence[0].path, "pnpm-lock.yaml");
});

test("detects the node version floor from engines", () => {
  const root = makeRepo({ files: { "package.json": JSON.stringify({ engines: { node: ">=20" } }, null, 2) } });
  const rule = detectDeclared(root).find((r) => r.id === "tooling.runtime-version");
  assert.ok(rule.statement.includes(">=20"));
});

test("detects the test command from scripts", () => {
  const root = makeRepo({ files: { "package.json": JSON.stringify({ scripts: { test: "vitest run" } }, null, 2) } });
  const rule = detectDeclared(root).find((r) => r.id === "tooling.test-command");
  assert.ok(rule.statement.includes("vitest run"));
});

test("detects the CI gate commands from a GitHub workflow", () => {
  const workflow = "jobs:\n  ci:\n    steps:\n      - run: pnpm lint\n      - run: pnpm typecheck\n";
  const root = makeRepo({ files: { ".github/workflows/ci.yml": workflow } });
  const rule = detectDeclared(root).find((r) => r.id === "tooling.ci-gate");
  assert.ok(rule.statement.includes("pnpm lint"));
  assert.equal(rule.evidence[0].path, ".github/workflows/ci.yml");
});

test("emits nothing for a repo that declares nothing", () => {
  const root = makeRepo();
  assert.deepEqual(detectDeclared(root), []);
});

test("every emitted rule passes the shape validator and the gate", async () => {
  const { validateRuleSet } = await import("../lib/validate.mjs");
  const root = makeRepo({
    files: {
      "package.json": JSON.stringify({ packageManager: "pnpm@9.1.0", engines: { node: ">=20" }, scripts: { test: "vitest run" } }, null, 2),
      ".github/workflows/ci.yml": "jobs:\n  ci:\n    steps:\n      - run: pnpm lint\n",
    },
  });
  const result = validateRuleSet(detectDeclared(root));
  assert.deepEqual(result.rejected, []);
  assert.equal(result.accepted.length, 4);
});

test("every emitted citation resolves against the tree", async () => {
  const { resolveEvidence } = await import("../lib/evidence.mjs");
  const root = makeRepo({ files: { "package.json": JSON.stringify({ packageManager: "pnpm@9.1.0" }, null, 2) } });
  for (const rule of detectDeclared(root)) {
    assert.equal(resolveEvidence(rule, root).dead.length, 0, `dead citation in ${rule.id}`);
  }
});
