import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { resetClientCache } from "../src/client.js";
import { resetBudgetHydrationCache } from "../src/commands/budget.js";

const originalTokelioHome = process.env["TOKELIO_HOME"];

let currentDir: string | undefined;

/**
 * Points `TOKELIO_HOME` at a fresh `mkdtemp` directory for the duration of a
 * test, so tests never read/write the real `~/.tokelio`. Also resets the
 * process-wide client/budget-hydration caches so state from a previous test
 * (which may have used the same agent ids against a different ledger) can
 * never leak in.
 */
export async function setupTokelioHome(): Promise<string> {
  currentDir = await mkdtemp(path.join(tmpdir(), "tokelio-cli-test-"));
  process.env["TOKELIO_HOME"] = currentDir;
  resetClientCache();
  resetBudgetHydrationCache();
  return currentDir;
}

/** Cleans up the temp directory created by {@link setupTokelioHome} and restores `TOKELIO_HOME`. */
export async function teardownTokelioHome(): Promise<void> {
  resetClientCache();
  resetBudgetHydrationCache();

  if (currentDir) {
    await rm(currentDir, { recursive: true, force: true });
    currentDir = undefined;
  }

  if (originalTokelioHome === undefined) {
    delete process.env["TOKELIO_HOME"];
  } else {
    process.env["TOKELIO_HOME"] = originalTokelioHome;
  }
}
