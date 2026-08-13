import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const created = [];

export function makeRepo({ remote = null, files = {} } = {}) {
  // realpathSync: on macOS, os.tmpdir() lives under /var, a symlink to /private/var.
  // `git rev-parse --show-toplevel` resolves that symlink, so callers who compare
  // a fixture path against a git-derived path need both sides canonicalised the same way.
  const root = realpathSync(mkdtempSync(join(tmpdir(), "repo-rules-test-")));
  created.push(root);
  const git = (...args) => execFileSync("git", args, { cwd: root, stdio: "pipe" });
  git("init", "-q", "-b", "main");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "Test");
  for (const [rel, body] of Object.entries(files)) {
    const full = join(root, rel);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, body);
  }
  writeFileSync(join(root, "README.md"), "# fixture\n");
  git("add", "-A");
  git("commit", "-qm", "init");
  if (remote) git("remote", "add", "origin", remote);
  return root;
}

// The store touches only the filesystem, so its tests need a directory, not a repository.
export function makeDir() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "repo-rules-dir-")));
  created.push(root);
  return root;
}

export function addWorktree(root, name) {
  const path = join(root, "..", `${name}-wt`);
  execFileSync("git", ["worktree", "add", "-q", "-b", name, path], { cwd: root, stdio: "pipe" });
  created.push(path);
  return path;
}

export function cleanupRepos() {
  while (created.length) rmSync(created.pop(), { recursive: true, force: true });
}
