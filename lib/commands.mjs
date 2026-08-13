import { detectDeclared } from "./detect.mjs";
import { validateRuleSet } from "./validate.mjs";
import { expire } from "./evidence.mjs";
import { load, save } from "./rules-store.mjs";

// Every command is the same band: produce a ruleset, hand it to the store, return what
// happened. Only the middle step differs, and nothing here prints.
function run(command, facts, env, produce) {
  const produced = produce();
  if (produced === null) {
    return { command, found: false, rules: 0, dropped: [], expired: [], foreign: [], removed: [] };
  }
  const { rules, dropped, expired } = produced;
  const { foreign, removed } = save(facts, rules, env);
  return { command, found: true, rules: rules.length, dropped, expired, foreign, removed };
}

export function runScan(facts, env) {
  return run("scan", facts, env, () => {
    const { accepted, rejected } = validateRuleSet(detectDeclared(facts.repoRoot));
    return { rules: accepted, dropped: rejected, expired: [] };
  });
}

export function runCheck(facts, env) {
  return run("check", facts, env, () => {
    const { found, rules, dropped } = load(facts, env);
    if (!found) return null;
    const { live, expired } = expire(rules, facts.repoRoot);
    return { rules: live, dropped, expired };
  });
}

export function runRender(facts, env) {
  return run("render", facts, env, () => {
    const { found, rules, dropped } = load(facts, env);
    if (!found) return null;
    return { rules, dropped, expired: [] };
  });
}
