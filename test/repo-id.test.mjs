import test from "node:test";
import assert from "node:assert/strict";
import { canonicalRemoteUrl, repoIdFromUrl } from "../lib/repo.mjs";

test("ssh and https forms of the same repo canonicalise identically", () => {
  const a = canonicalRemoteUrl("git@github.com:empire-flippers/api.git");
  const b = canonicalRemoteUrl("https://github.com/empire-flippers/api");
  assert.equal(a, "https://github.com/empire-flippers/api");
  assert.equal(a, b);
});

test("userinfo, trailing slash and .git suffix are stripped", () => {
  assert.equal(
    canonicalRemoteUrl("https://token@github.com/acme/web.git/"),
    "https://github.com/acme/web",
  );
});

test("host case is normalised but path case is not", () => {
  assert.equal(
    canonicalRemoteUrl("https://GitHub.COM/Acme/Web"),
    "https://github.com/Acme/Web",
  );
});

test("repo id is 32 lowercase hex characters", () => {
  const id = repoIdFromUrl("https://github.com/acme/web");
  assert.match(id, /^[0-9a-f]{32}$/);
});

test("repo id is stable and differs between repos", () => {
  const a = repoIdFromUrl("https://github.com/acme/web");
  assert.equal(a, repoIdFromUrl("https://github.com/acme/web"));
  assert.notEqual(a, repoIdFromUrl("https://github.com/acme/api"));
});

test("a traversal-shaped remote cannot produce path separators or dots", () => {
  const id = repoIdFromUrl("../../../../.claude/plugins");
  assert.match(id, /^[0-9a-f]{32}$/);
});
