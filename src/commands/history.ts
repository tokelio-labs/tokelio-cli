import { writeFile } from "node:fs/promises";
import type { TransferRecord } from "@tokelio/sdk";
import { exportHistoryToCsv, exportHistoryToJson } from "@tokelio/sdk";
import { getClient } from "../client.js";
import { toCleanError } from "../errors.js";

export type HistoryFormat = "json" | "csv";

const VALID_FORMATS: HistoryFormat[] = ["json", "csv"];

export interface HistoryShowOptions {
  agentId: string;
  format?: HistoryFormat;
  /** If given, write the formatted output to this file instead of just returning it. */
  output?: string;
}

export interface HistoryShowResult {
  agentId: string;
  format: HistoryFormat;
  records: TransferRecord[];
  /** The exported string, in `format` — either the raw JSON or CSV text. */
  formatted: string;
  /** Path the formatted output was written to, if `output` was given. */
  outputPath?: string;
}

/**
 * Shows `agentId`'s full transfer history, exported via the SDK's
 * `exportHistoryToJson`/`exportHistoryToCsv`. If `output` is given, the
 * formatted string is also written to that file.
 */
export async function historyShow(opts: HistoryShowOptions): Promise<HistoryShowResult> {
  const format = opts.format ?? "json";
  if (!VALID_FORMATS.includes(format)) {
    throw new Error(
      `Invalid history format "${String(format)}" — must be one of: ${VALID_FORMATS.join(", ")}`,
    );
  }

  try {
    const client = await getClient();
    const records = await client.wallet(opts.agentId).history();
    const formatted = format === "json" ? exportHistoryToJson(records) : exportHistoryToCsv(records);

    if (opts.output !== undefined) {
      await writeFile(opts.output, formatted, "utf8");
      return { agentId: opts.agentId, format, records, formatted, outputPath: opts.output };
    }

    return { agentId: opts.agentId, format, records, formatted };
  } catch (err) {
    throw toCleanError(err);
  }
}
