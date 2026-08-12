import test from "node:test";
import assert from "node:assert/strict";
import { SECOND_PERSON, IMPERATIVE_OPENERS } from "../lib/constants.mjs";

test("SECOND_PERSON matches yours and yourself", () => {
  assert.ok(SECOND_PERSON.test("Tests live in spec/, which is yours to maintain."));
  assert.ok(SECOND_PERSON.test("This module manages state for yourself."));
});

test("SECOND_PERSON still matches you and your, and does not match an unrelated word", () => {
  assert.ok(SECOND_PERSON.test("This is your call."));
  assert.ok(SECOND_PERSON.test("This affects you directly."));
  assert.ok(!SECOND_PERSON.test("Young modules live in legacy/."));
});

test("IMPERATIVE_OPENERS does not match a hyphenated word sharing an opener prefix", () => {
  assert.equal(IMPERATIVE_OPENERS.test("Write-behind caching is used in cache/."), false);
  assert.equal(IMPERATIVE_OPENERS.test("Use-after-free bugs are tracked in memory.md."), false);
});

test("IMPERATIVE_OPENERS still matches a genuine imperative", () => {
  assert.equal(IMPERATIVE_OPENERS.test("Write tests before implementation."), true);
  assert.equal(IMPERATIVE_OPENERS.test("Use tabs for indentation."), true);
});
