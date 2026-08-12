import { createHash } from "node:crypto";

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
