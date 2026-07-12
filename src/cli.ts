import chalk from "chalk";
import { Command } from "commander";
import type { BudgetPeriod } from "@tokelio/sdk";
import { formatAmount } from "@tokelio/sdk";
import { walletCreate, walletList } from "./commands/wallet.js";
import { faucet } from "./commands/faucet.js";
import { balance } from "./commands/balance.js";
import { pay } from "./commands/pay.js";
import { budgetSet, budgetShow } from "./commands/budget.js";
import { escrowCreate, escrowRefund, escrowRelease, escrowStatus } from "./commands/escrow.js";
import type { AgentConnectResult, AgentConnectTarget } from "./commands/agent-connect.js";
import { agentConnect } from "./commands/agent-connect.js";

/** Runs `fn`, prints its result via `onSuccess`, and maps any thrown error to a red message + non-zero exit code. */
async function runAction<T>(fn: () => Promise<T>, onSuccess: (result: T) => void): Promise<void> {
  try {
    const result = await fn();
    onSuccess(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(chalk.red(`Error: ${message}`));
    process.exitCode = 1;
  }
}

function printTable(rows: string[][]): void {
  if (rows.length === 0) {
    return;
  }
  const columnCount = rows[0]?.length ?? 0;
  const widths: number[] = [];
  for (let col = 0; col < columnCount; col += 1) {
    widths.push(Math.max(...rows.map((row) => (row[col] ?? "").length)));
  }
  for (const row of rows) {
    console.log(row.map((cell, col) => cell.padEnd(widths[col] ?? 0)).join("  "));
  }
}

/** Builds the fully-wired `tokelio` commander program. Call `.parseAsync(argv)` on the result. */
export function buildProgram(): Command {
  const program = new Command();

  program
    .name("tokelio")
    .description("Command-line tool for Tokelio agent wallets, payments, budgets, and escrow.")
    .version("0.1.0");

  // ---- wallet ----------------------------------------------------------
  const walletCmd = program.command("wallet").description("Manage local agent wallets");

  walletCmd
    .command("create")
    .argument("<agentId>", "agent id to register a wallet for")
    .option("--name <name>", "friendly display name for this wallet")
    .description("Register a new local wallet for an agent")
    .action(async (agentId: string, options: { name?: string }) => {
      await runAction(
        () => walletCreate({ agentId, ...(options.name !== undefined ? { name: options.name } : {}) }),
        ({ wallet }) => {
          console.log(
            chalk.green(
              `Wallet created: ${wallet.agentId}${wallet.name ? ` (${wallet.name})` : ""}`,
            ),
          );
        },
      );
    });

  walletCmd
    .command("list")
    .description("List all locally registered wallets")
    .action(async () => {
      await runAction(
        () => walletList(),
        ({ wallets }) => {
          if (wallets.length === 0) {
            console.log('No wallets yet. Run "tokelio wallet create <agentId>" to create one.');
            return;
          }
          const rows = [
            ["AGENT ID", "NAME", "CREATED AT"],
            ...wallets.map((w) => [w.agentId, w.name ?? "-", new Date(w.createdAt).toISOString()]),
          ];
          printTable(rows);
        },
      );
    });

  // ---- faucet ------------------------------------------------------------
  program
    .command("faucet")
    .argument("<agentId>", "agent id to fund")
    .requiredOption("--amount <n>", "amount of TOKE to mint into the agent's balance")
    .description("Mint TOKE into an agent's balance (local dev faucet)")
    .action(async (agentId: string, options: { amount: string }) => {
      await runAction(
        () => faucet({ agentId, amount: options.amount }),
        (result) => {
          console.log(
            chalk.green(
              `Funded ${result.funded} TOKE into ${result.agentId}. New balance: ${result.balance} TOKE`,
            ),
          );
        },
      );
    });

  // ---- balance -------------------------------------------------------------
  program
    .command("balance")
    .argument("<agentId>", "agent id to check")
    .description("Show an agent's current TOKE balance")
    .action(async (agentId: string) => {
      await runAction(
        () => balance({ agentId }),
        (result) => {
          console.log(chalk.green(`${result.agentId} balance: ${result.balance} TOKE`));
        },
      );
    });

  // ---- pay -------------------------------------------------------------
  program
    .command("pay")
    .requiredOption("--from <agentId>", "paying agent id")
    .requiredOption("--to <agentId>", "receiving agent id")
    .requiredOption("--amount <n>", "amount of TOKE to send")
    .option("--memo <text>", "optional free-text memo")
    .description("Pay TOKE from one agent to another")
    .action(async (options: { from: string; to: string; amount: string; memo?: string }) => {
      await runAction(
        () =>
          pay({
            from: options.from,
            to: options.to,
            amount: options.amount,
            ...(options.memo !== undefined ? { memo: options.memo } : {}),
          }),
        (result) => {
          console.log(
            chalk.green(
              `Paid ${result.amount} TOKE from ${result.record.from} to ${result.record.to}` +
                (result.record.memo ? ` (memo: "${result.record.memo}")` : "") +
                `. Transfer id: ${result.record.id}`,
            ),
          );
        },
      );
    });

  // ---- budget ------------------------------------------------------------
  const budgetCmd = program.command("budget").description("Manage per-agent spending budgets");

  budgetCmd
    .command("set")
    .argument("<agentId>", "agent id to configure a budget for")
    .requiredOption("--limit <n>", "spending limit, in TOKE")
    .requiredOption("--period <period>", "budget period: session|hourly|daily|weekly")
    .description("Set (or replace) an agent's spending budget")
    .action(async (agentId: string, options: { limit: string; period: string }) => {
      await runAction(
        () => budgetSet({ agentId, limit: options.limit, period: options.period as BudgetPeriod }),
        (result) => {
          console.log(
            chalk.green(`Budget set for ${result.agentId}: ${result.limit} TOKE / ${result.period}`),
          );
        },
      );
    });

  budgetCmd
    .command("show")
    .argument("<agentId>", "agent id to inspect")
    .description("Show an agent's currently configured budget and remaining amount")
    .action(async (agentId: string) => {
      await runAction(
        () => budgetShow({ agentId }),
        (result) => {
          if (result.limit === null) {
            console.log(`No budget configured for ${result.agentId} (unlimited).`);
            return;
          }
          console.log(
            chalk.green(
              `${result.agentId} budget: ${result.limit} TOKE / ${result.period} (remaining: ${result.remaining} TOKE)`,
            ),
          );
        },
      );
    });

  // ---- escrow ------------------------------------------------------------
  const escrowCmd = program.command("escrow").description("Manage escrowed payments between agents");

  escrowCmd
    .command("create")
    .requiredOption("--from <agentId>", "payer agent id")
    .requiredOption("--to <agentId>", "payee agent id")
    .requiredOption("--amount <n>", "amount of TOKE to lock in escrow")
    .requiredOption("--description <text>", "human-readable description of the work being paid for")
    .description("Create an escrow task, locking funds until released or refunded")
    .action(
      async (options: { from: string; to: string; amount: string; description: string }) => {
        await runAction(
          () => escrowCreate(options),
          ({ task }) => {
            console.log(chalk.green(`Escrow task created: ${task.id}`));
            console.log(`  payer:       ${task.payer}`);
            console.log(`  payee:       ${task.payee}`);
            console.log(`  amount:      ${formatAmount(task.amount)} TOKE`);
            console.log(`  description: ${task.description}`);
            console.log(`  status:      ${task.status}`);
          },
        );
      },
    );

  escrowCmd
    .command("release")
    .argument("<taskId>", "escrow task id to release")
    .description("Release a pending escrow task's locked funds to its payee")
    .action(async (taskId: string) => {
      await runAction(
        () => escrowRelease({ taskId }),
        ({ task }) => {
          console.log(chalk.green(`Escrow task ${task.id} released to ${task.payee}.`));
        },
      );
    });

  escrowCmd
    .command("refund")
    .argument("<taskId>", "escrow task id to refund")
    .description("Refund a pending escrow task's locked funds back to its payer")
    .action(async (taskId: string) => {
      await runAction(
        () => escrowRefund({ taskId }),
        ({ task }) => {
          console.log(chalk.green(`Escrow task ${task.id} refunded to ${task.payer}.`));
        },
      );
    });

  escrowCmd
    .command("status")
    .argument("<taskId>", "escrow task id to inspect")
    .description("Show the current status of an escrow task")
    .action(async (taskId: string) => {
      await runAction(
        () => escrowStatus({ taskId }),
        ({ task }) => {
          console.log(chalk.green(`Escrow task ${task.id}: ${task.status}`));
          console.log(`  payer:       ${task.payer}`);
          console.log(`  payee:       ${task.payee}`);
          console.log(`  amount:      ${formatAmount(task.amount)} TOKE`);
          console.log(`  description: ${task.description}`);
        },
      );
    });

  // ---- agent -------------------------------------------------------------
  const agentCmd = program.command("agent").description("Connect Tokelio agent identities to MCP clients");

  agentCmd
    .command("connect")
    .option("--agent-id <agentId>", "agent id to wire up (auto-selected if omitted and exactly one wallet exists)")
    .option("--target <target>", "claude-code|claude-desktop", "claude-code")
    .option("--write", "for --target claude-desktop, actually write the per-OS config file", false)
    .description("Wire a Tokelio agent identity into Claude Code / Claude Desktop via MCP")
    .action(async (options: { agentId?: string; target: string; write: boolean }) => {
      await runAction(
        () =>
          agentConnect({
            ...(options.agentId !== undefined ? { agentId: options.agentId } : {}),
            target: options.target as AgentConnectTarget,
            write: options.write,
          }),
        (result: AgentConnectResult) => {
          if (result.printedOnly) {
            console.log(
              chalk.green(
                `Paste the following into your Claude Desktop config (mcpServers) for agent ${result.agentId}:`,
              ),
            );
            console.log(JSON.stringify(result.fullConfig, null, 2));
            console.log("");
            console.log("Typical config file locations:");
            if (result.referencePaths) {
              console.log(`  macOS:   ${result.referencePaths.macos}`);
              console.log(`  Linux:   ${result.referencePaths.linux}`);
              console.log(`  Windows: ${result.referencePaths.windows}`);
            }
            console.log("");
            console.log(
              "Tip: re-run with --write to have this CLI attempt to merge it into that file for you.",
            );
          } else {
            console.log(
              chalk.green(`Connected agent ${result.agentId} (${result.target}) -> ${result.configPath}`),
            );
          }
          console.log("");
          console.log("Next steps:");
          for (const step of result.nextSteps) {
            console.log(`  - ${step}`);
          }
        },
      );
    });

  return program;
}
