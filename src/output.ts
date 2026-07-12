import chalk from "chalk";

/** Options controlling how {@link printResult} and {@link printError} render. */
export interface OutputOptions {
  /** When true, print machine-readable JSON instead of the human-formatted/chalk output. */
  json: boolean;
}

/**
 * `JSON.stringify` replacer that stringifies `bigint` values. Several SDK
 * result types carry raw `bigint` amounts (e.g. `TransferRecord.amount`,
 * `EscrowTask.amount`) which have no native JSON representation and would
 * otherwise throw a `TypeError` from `JSON.stringify`.
 */
function jsonReplacer(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value;
}

/**
 * Prints a successful command result: in `--json` mode, prints
 * `JSON.stringify(result)` (bigint-safe, see {@link jsonReplacer}) so
 * output is scriptable/pipeable; otherwise delegates to `renderHuman`,
 * which prints exactly the same chalk/console-formatted output the CLI has
 * always produced. This is the one place output routing happens, so the
 * `--json` flag works uniformly across every command.
 */
export function printResult<T>(
  result: T,
  renderHuman: (result: T) => void,
  opts: OutputOptions,
): void {
  if (opts.json) {
    console.log(JSON.stringify(result, jsonReplacer));
    return;
  }
  renderHuman(result);
}

/** Prints a command failure: `{"error": message}` in `--json` mode, a red `Error: ...` line otherwise. */
export function printError(message: string, opts: OutputOptions): void {
  if (opts.json) {
    console.log(JSON.stringify({ error: message }));
    return;
  }
  console.error(chalk.red(`Error: ${message}`));
}
