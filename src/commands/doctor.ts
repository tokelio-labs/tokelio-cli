import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { getBudgetsPath, getLedgerPath, getPoliciesPath, getTokelioHome, getWalletsPath } from "../config.js";

export type CheckStatus = "ok" | "warning" | "error";

export interface DoctorCheck {
  name: string;
  status: CheckStatus;
  detail: string;
}

export interface DoctorResult {
  checks: DoctorCheck[];
}

const MIN_NODE_MAJOR = 18;

function isEnoent(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "ENOENT"
  );
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Checks that `TOKELIO_HOME` exists (creating it if missing, same as other commands do) and is writable. */
async function checkHomeDir(): Promise<DoctorCheck> {
  const home = getTokelioHome();

  try {
    await mkdir(home, { recursive: true });
  } catch (err) {
    return { name: "TOKELIO_HOME", status: "error", detail: `Could not create ${home}: ${errorMessage(err)}` };
  }

  const probePath = path.join(home, ".doctor-write-test");
  try {
    await writeFile(probePath, "ok", "utf8");
    await rm(probePath, { force: true });
  } catch (err) {
    return {
      name: "TOKELIO_HOME",
      status: "error",
      detail: `${home} exists but is not writable: ${errorMessage(err)}`,
    };
  }

  return { name: "TOKELIO_HOME", status: "ok", detail: `${home} exists and is writable.` };
}

/**
 * Checks one of the CLI's local state files for existence and
 * valid-JSON-parseability. A missing file is reported as `ok` (these files
 * are created lazily on first use, so a fresh install having none of them
 * is expected, not a problem) — only a file that exists but fails to parse
 * as JSON is reported as `error`, and never throws.
 */
async function checkJsonFile(name: string, filePath: string): Promise<DoctorCheck> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch (err) {
    if (isEnoent(err)) {
      return { name, status: "ok", detail: `${filePath} is missing (not created yet).` };
    }
    return { name, status: "error", detail: `Could not read ${filePath}: ${errorMessage(err)}` };
  }

  try {
    JSON.parse(raw);
  } catch {
    return { name, status: "error", detail: `${filePath} exists but is not valid JSON.` };
  }

  return { name, status: "ok", detail: `${filePath} exists and is valid JSON.` };
}

function checkNodeVersion(): DoctorCheck {
  const nodeVersion = process.versions.node;
  const major = Number(nodeVersion.split(".")[0]);

  if (Number.isNaN(major) || major < MIN_NODE_MAJOR) {
    return {
      name: "node version",
      status: "warning",
      detail: `Running Node ${nodeVersion}; @tokelio-labs/cli requires >= ${MIN_NODE_MAJOR}.`,
    };
  }
  return { name: "node version", status: "ok", detail: `Running Node ${nodeVersion}.` };
}

/**
 * Runs local diagnostics: `TOKELIO_HOME` existence/writability, each local
 * state file's existence and JSON validity, and the running Node version.
 * Never throws on a malformed state file — that's reported as an `error`
 * finding, not a crash.
 */
export async function doctor(): Promise<DoctorResult> {
  const checks: DoctorCheck[] = [
    await checkHomeDir(),
    await checkJsonFile("wallets.json", getWalletsPath()),
    await checkJsonFile("budgets.json", getBudgetsPath()),
    await checkJsonFile("policies.json", getPoliciesPath()),
    await checkJsonFile("ledger.json", getLedgerPath()),
    checkNodeVersion(),
  ];

  return { checks };
}
