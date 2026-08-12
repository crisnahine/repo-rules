import { writeFileSync, renameSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, basename } from "node:path";

// Temp file plus rename, so a reader never sees a half-written rules file.
export function writeAtomic(path, body) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = join(dirname(path), `.${basename(path)}.tmp-${process.pid}`);
  writeFileSync(tmp, body);
  try {
    renameSync(tmp, path);
  } catch (error) {
    rmSync(tmp, { force: true });
    throw error;
  }
}
