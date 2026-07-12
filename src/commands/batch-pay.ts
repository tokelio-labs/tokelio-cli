import { readFile } from "node:fs/promises";
import path from "node:path";
import type { BatchPaymentItem, TransferRecord } from "@tokelio/sdk";
import { getClient } from "../client.js";
import { toCleanError } from "../errors.js";
import { ensureBudgetHydrated } from "./budget.js";

function isEnoent(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "ENOENT"
  );
}

/**
 * Parses simple CSV text into rows of fields, per RFC 4180: fields are
 * comma-separated, a field wrapped in double quotes may contain commas and
 * newlines, and an embedded quote is escaped as `""`. This is a small,
 * hand-rolled parser (no external CSV dependency) since batch-pay files are
 * expected to be simple and controlled — but it's still a full state
 * machine over the whole text (not a naive line-split) so it round-trips
 * correctly with the SDK's own `exportHistoryToCsv` escaping, including
 * quoted memos containing commas.
 */
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (char === ",") {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") {
        i += 1;
      }
      row.push(field);
      rows.push(row);
      field = "";
      row = [];
      i += 1;
      continue;
    }

    field += char;
    i += 1;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Drop trailing blank rows produced by a trailing newline.
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

function parseJsonBatch(raw: string, filePath: string): BatchPaymentItem[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Batch file ${filePath} is not valid JSON.`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`Batch file ${filePath} must contain a JSON array of {to, amount, memo?} items.`);
  }

  return parsed.map((entry, index) => {
    if (typeof entry !== "object" || entry === null) {
      throw new Error(`Batch file ${filePath}: item ${index} is not an object.`);
    }
    const { to, amount, memo } = entry as Record<string, unknown>;
    if (typeof to !== "string" || to.length === 0) {
      throw new Error(`Batch file ${filePath}: item ${index} is missing a "to" string.`);
    }
    if (typeof amount !== "string" && typeof amount !== "number") {
      throw new Error(`Batch file ${filePath}: item ${index} is missing an "amount" (string or number).`);
    }
    if (memo !== undefined && typeof memo !== "string") {
      throw new Error(`Batch file ${filePath}: item ${index} has a non-string "memo".`);
    }
    return { to, amount, ...(memo !== undefined ? { memo } : {}) };
  });
}

function parseCsvBatch(raw: string, filePath: string): BatchPaymentItem[] {
  const rows = parseCsvRows(raw);
  if (rows.length === 0) {
    return [];
  }

  const [header, ...dataRows] = rows;
  const normalizedHeader = (header ?? []).map((h) => h.trim().toLowerCase());
  const toIdx = normalizedHeader.indexOf("to");
  const amountIdx = normalizedHeader.indexOf("amount");
  const memoIdx = normalizedHeader.indexOf("memo");

  if (toIdx === -1 || amountIdx === -1) {
    throw new Error(`Batch file ${filePath}: CSV header must include "to" and "amount" columns.`);
  }

  return dataRows.map((row, index) => {
    const to = row[toIdx];
    const amount = row[amountIdx];
    if (!to) {
      throw new Error(`Batch file ${filePath}: row ${index + 1} is missing "to".`);
    }
    if (!amount) {
      throw new Error(`Batch file ${filePath}: row ${index + 1} is missing "amount".`);
    }
    const memo = memoIdx !== -1 ? row[memoIdx] : undefined;
    return { to, amount, ...(memo !== undefined && memo !== "" ? { memo } : {}) };
  });
}

async function readBatchItems(filePath: string): Promise<BatchPaymentItem[]> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch (err) {
    if (isEnoent(err)) {
      throw new Error(`Batch file not found: ${filePath}`);
    }
    throw err;
  }

  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".json") {
    return parseJsonBatch(raw, filePath);
  }
  if (ext === ".csv") {
    return parseCsvBatch(raw, filePath);
  }
  throw new Error(`Unsupported batch file extension "${ext}" for ${filePath} — expected .json or .csv.`);
}

export interface BatchPayOptions {
  from: string;
  file: string;
}

export interface BatchPayFailure {
  item: BatchPaymentItem;
  reason: string;
}

export interface BatchPayResult {
  from: string;
  succeeded: TransferRecord[];
  failed: BatchPayFailure[];
}

/**
 * Pays every `{to, amount, memo?}` item in `file` (`.json` array or `.csv`
 * with a `to,amount,memo` header) from `from`, via the SDK's
 * `AgentWallet.batchPay`. One item failing (insufficient balance, budget
 * exceeded, policy violation, ...) never aborts the rest of the batch —
 * failures are collected and reported alongside the successes.
 */
export async function batchPay(opts: BatchPayOptions): Promise<BatchPayResult> {
  const items = await readBatchItems(opts.file);

  try {
    const client = await getClient();
    await ensureBudgetHydrated(opts.from, client);
    const wallet = client.wallet(opts.from);
    const { succeeded, failed } = await wallet.batchPay(items);

    return {
      from: opts.from,
      succeeded,
      failed: failed.map(({ item, error }) => ({ item, reason: toCleanError(error).message })),
    };
  } catch (err) {
    throw toCleanError(err);
  }
}
