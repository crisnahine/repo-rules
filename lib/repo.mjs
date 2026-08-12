import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";

const SCP_LIKE = /^(?:([^@/]+)@)?([^:/]+):(.+)$/;

// Identity must survive the same repo being cloned over ssh and https, and must never
// let repository-controlled bytes reach a filesystem path. Hence: canonicalise, then hash.
export function canonicalRemoteUrl(url) {
  let rest = String(url).trim();
  let host = "";
  let path = "";

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.exec(rest);
  if (withScheme) {
    const stripped = rest.slice(withScheme[0].length);
    const slash = stripped.indexOf("/");
    const authority = slash === -1 ? stripped : stripped.slice(0, slash);
    path = slash === -1 ? "" : stripped.slice(slash + 1);
    host = authority.includes("@") ? authority.slice(authority.lastIndexOf("@") + 1) : authority;
  } else {
    const scp = SCP_LIKE.exec(rest);
    if (scp) {
      host = scp[2];
      path = scp[3];
    } else {
      host = "";
      path = rest;
    }
  }

  host = host.toLowerCase().replace(/:\d+$/, "");
  path = path.replace(/^\/+/, "").replace(/\/+$/, "").replace(/\.git$/, "");

  return host ? `https://${host}/${path}` : path;
}

export function repoIdFromUrl(url) {
  return createHash("sha256").update(canonicalRemoteUrl(url), "utf8").digest("hex").slice(0, 32);
}

function git(cwd, args) {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

// --git-common-dir, not --git-dir: inside a linked worktree the latter points at
// .git/worktrees/<name>, which has no info/exclude and is per-worktree.
// --path-format=absolute needs git 2.31+; older git only understands the plain
// flag, which prints an absolute path when the common dir lies outside cwd (e.g.
// from a linked worktree) and a path relative to cwd otherwise, so resolve it
// against the same cwd git was invoked with.
function gitCommonDir(cwd) {
  const absolute = git(cwd, ["rev-parse", "--path-format=absolute", "--git-common-dir"]);
  if (absolute) return absolute;
  const raw = git(cwd, ["rev-parse", "--git-common-dir"]);
  if (!raw) return null;
  return isAbsolute(raw) ? raw : resolve(cwd, raw);
}

export function repoFacts(cwd) {
  const repoRoot = git(cwd, ["rev-parse", "--show-toplevel"]);
  if (!repoRoot) {
    const root = resolve(cwd);
    return { isGitRepo: false, repoRoot: root, gitCommonDir: null, remoteUrl: null, repoId: repoIdFromUrl(root) };
  }
  const common = gitCommonDir(cwd);
  const remoteUrl = git(cwd, ["remote", "get-url", "origin"]);
  // repoRoot is deliberately not a fallback here: it differs between a repo's main
  // working tree and its linked worktrees, so using it would break worktree-stable ids.
  const identity = remoteUrl ?? common;
  return {
    isGitRepo: true,
    repoRoot,
    gitCommonDir: common,
    remoteUrl,
    repoId: repoIdFromUrl(identity),
  };
}

export function resolveRulesDir(facts, env) {
  const candidates = [];
  if (env.REPO_RULES_HOME) candidates.push([env.REPO_RULES_HOME, "env"]);
  candidates.push([join(facts.repoRoot, ".claude", "repo-rules"), "committed"]);
  if (env.HOME) candidates.push([join(env.HOME, ".claude", "repo-rules", facts.repoId), "home"]);
  for (const [dir, mode] of candidates) {
    if (existsSync(join(dir, "rules.json"))) return { dir, mode };
  }
  return null;
}
