import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { repoFacts, resolveRulesDir } from "../lib/repo.mjs";
import { makeRepo, addWorktree, cleanupRepos } from "./fixtures/make-repo.mjs";

after(cleanupRepos);

test("reads the remote and derives a hex id", () => {
  const root = makeRepo({ remote: "git@github.com:acme/web.git" });
  const facts = repoFacts(root);
  assert.equal(facts.isGitRepo, true);
  assert.equal(facts.remoteUrl, "git@github.com:acme/web.git");
  assert.match(facts.repoId, /^[0-9a-f]{32}$/);
});

test("a linked worktree keeps the same repo id as its main clone", () => {
  const root = makeRepo({ remote: "git@github.com:acme/web.git" });
  const wt = addWorktree(root, "feature");
  assert.equal(repoFacts(wt).repoId, repoFacts(root).repoId);
});

test("gitCommonDir points at the shared dir, not the worktree dir", () => {
  const root = makeRepo({ remote: "git@github.com:acme/web.git" });
  const wt = addWorktree(root, "other");
  assert.equal(repoFacts(wt).gitCommonDir, repoFacts(root).gitCommonDir);
});

test("a repo with no remote still gets a stable id", () => {
  const root = makeRepo();
  assert.match(repoFacts(root).repoId, /^[0-9a-f]{32}$/);
});

test("resolves the committed directory when it exists", () => {
  const root = makeRepo({ remote: "git@github.com:acme/web.git" });
  mkdirSync(join(root, ".claude", "repo-rules"), { recursive: true });
  writeFileSync(join(root, ".claude", "repo-rules", "rules.json"), "[]");
  const resolved = resolveRulesDir(repoFacts(root), {});
  assert.equal(resolved.mode, "committed");
  assert.equal(resolved.dir, join(root, ".claude", "repo-rules"));
});

test("returns null when the repo was never scanned", () => {
  const root = makeRepo({ remote: "git@github.com:acme/web.git" });
  assert.equal(resolveRulesDir(repoFacts(root), { HOME: root }), null);
});

test("REPO_RULES_HOME wins when it holds a rules file", () => {
  const root = makeRepo({ remote: "git@github.com:acme/web.git" });
  const override = join(root, "override");
  mkdirSync(override, { recursive: true });
  writeFileSync(join(override, "rules.json"), "[]");
  const resolved = resolveRulesDir(repoFacts(root), { REPO_RULES_HOME: override });
  assert.equal(resolved.mode, "env");
  assert.equal(resolved.dir, override);
});

// Identity must not fall back to repoRoot: with no remote, the id has to come
// from gitCommonDir alone, and that is the one path the brief's own tests never
// exercised through a worktree (the no-remote test never adds one, and the
// worktree test always sets a remote, so it proves stability via remoteUrl only).
test("a linked worktree keeps the same repo id as its main clone even with no remote", () => {
  const root = makeRepo();
  const wt = addWorktree(root, "no-remote-feature");
  assert.equal(repoFacts(wt).repoId, repoFacts(root).repoId);
});

test("resolves the home directory when nothing else does", () => {
  const root = makeRepo({ remote: "git@github.com:acme/web.git" });
  const facts = repoFacts(root);
  const home = join(root, "home");
  const homeDir = join(home, ".claude", "repo-rules", facts.repoId);
  mkdirSync(homeDir, { recursive: true });
  writeFileSync(join(homeDir, "rules.json"), "[]");
  const resolved = resolveRulesDir(facts, { HOME: home });
  assert.equal(resolved.mode, "home");
  assert.equal(resolved.dir, homeDir);
});
