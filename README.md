# @tokelio-labs/cli

Command-line tool for Tokelio agent wallets, payments, budgets, and escrow —
built on top of [`@tokelio-labs/sdk`](../tokelio-sdk). It also wires your
CLI-managed agent identity directly into Claude Code / Claude Desktop via
[MCP](https://modelcontextprotocol.io), so an AI agent can transact using the
same local wallet you just funded from the terminal.

Tokelio ($TOKE) is the payment and settlement layer for AI agents: wallets,
budgets, and escrow for machine-to-machine payments.

## Install

```bash
pnpm add -g @tokelio-labs/cli
```

Or run without installing:

```bash
npx @tokelio-labs/cli <command>
```

## Local state

Everything the CLI tracks lives under `~/.tokelio` by default (wallets,
ledger balances/transfers, budget config, spending policy config). Override
the location with the `TOKELIO_HOME` environment variable — handy for
sandboxing, CI, or running multiple isolated "profiles" side by side:

```bash
TOKELIO_HOME=/path/to/profile tokelio wallet create my-agent
```

## Scripting with `--json`

Pass `--json` (before the subcommand) on any command to get machine-readable
JSON on stdout instead of the formatted/colored text — handy for piping into
`jq` or driving the CLI from another script:

```bash
$ tokelio --json balance my-agent
{"agentId":"my-agent","balance":"100"}
```

On failure, `--json` mode prints `{"error": "..."}` instead of a red
`Error: ...` line; the exit code is still non-zero either way.

## Quickstart

```bash
tokelio wallet create my-agent
tokelio faucet my-agent --amount 100
tokelio balance my-agent
tokelio pay --from my-agent --to some-service --amount 5
```

```
$ tokelio wallet create my-agent
Wallet created: my-agent

$ tokelio faucet my-agent --amount 100
Funded 100 TOKE into my-agent. New balance: 100 TOKE

$ tokelio balance my-agent
my-agent balance: 100 TOKE

$ tokelio pay --from my-agent --to some-service --amount 5
Paid 5 TOKE from my-agent to some-service. Transfer id: xfer_...
```

## Command reference

| Command | Description | Example |
|---|---|---|
| `tokelio wallet create <agentId> [--name <name>]` | Register a new local wallet for an agent | `tokelio wallet create my-agent --name "My Agent"` |
| `tokelio wallet list` | List all locally registered wallets | `tokelio wallet list` |
| `tokelio faucet <agentId> --amount <n>` | Mint TOKE into an agent's balance (local dev faucet) | `tokelio faucet my-agent --amount 100` |
| `tokelio balance <agentId>` | Show an agent's current TOKE balance | `tokelio balance my-agent` |
| `tokelio pay --from <a> --to <b> --amount <n> [--memo <text>]` | Pay TOKE from one agent to another | `tokelio pay --from my-agent --to some-service --amount 5 --memo "API usage"` |
| `tokelio budget set <agentId> --limit <n> --period <session\|hourly\|daily\|weekly>` | Set (or replace) an agent's spending budget | `tokelio budget set my-agent --limit 50 --period daily` |
| `tokelio budget show <agentId>` | Show an agent's configured budget and remaining amount | `tokelio budget show my-agent` |
| `tokelio escrow create --from <a> --to <b> --amount <n> --description <text>` | Lock funds in escrow for a task | `tokelio escrow create --from my-agent --to some-service --amount 10 --description "audit"` |
| `tokelio escrow release <taskId>` | Release a pending escrow task's funds to its payee | `tokelio escrow release <taskId>` |
| `tokelio escrow refund <taskId>` | Refund a pending escrow task's funds to its payer | `tokelio escrow refund <taskId>` |
| `tokelio escrow status <taskId>` | Show an escrow task's current status | `tokelio escrow status <taskId>` |
| `tokelio agent connect [--agent-id <id>] [--target claude-code\|claude-desktop] [--write]` | Wire an agent identity into an MCP-capable client | `tokelio agent connect --agent-id my-agent` |
| `tokelio agent disconnect [--target claude-code]` | Remove the Tokelio MCP server entry from `./.mcp.json` | `tokelio agent disconnect` |
| `tokelio history <agentId> [--format json\|csv] [--output <file>]` | Show an agent's transfer history, exported as JSON or CSV | `tokelio history my-agent --format csv --output history.csv` |
| `tokelio batch-pay --from <agentId> --file <path.csv\|path.json>` | Pay multiple recipients from a CSV or JSON file | `tokelio batch-pay --from my-agent --file payouts.csv` |
| `tokelio policy set-max-transaction --limit <n>` | Set (or replace) the max-transaction-amount spending policy | `tokelio policy set-max-transaction --limit 50` |
| `tokelio policy allow <agentId...>` | Set (or replace) the payee allowlist | `tokelio policy allow service-a service-b` |
| `tokelio policy deny <agentId...>` | Set (or replace) the payee denylist | `tokelio policy deny sketchy-agent` |
| `tokelio policy show` | Show currently configured spending policies | `tokelio policy show` |
| `tokelio policy clear` | Clear all configured spending policies | `tokelio policy clear` |
| `tokelio doctor` | Run diagnostics on the local Tokelio CLI state | `tokelio doctor` |
| `tokelio version` | Print this package's own version | `tokelio version` |

Every command exits non-zero and prints a red `Error: ...` message on
failure (or `{"error": ...}` in `--json` mode), so it's safe to use in
scripts (`tokelio pay ... || handle_failure`).

## Batch payments

`tokelio batch-pay` reads a list of `{to, amount, memo?}` payments from a
file and pays each one from a single agent, via the same budget/policy/event
pipeline as `tokelio pay`. One payment failing (insufficient balance, budget
exceeded, a spending policy violation, ...) never aborts the rest of the
batch — every failure is collected and reported alongside the successes,
never thrown.

JSON input is an array of objects:

```json
[
  { "to": "service-a", "amount": "10", "memo": "invoice #1" },
  { "to": "service-b", "amount": "25" }
]
```

CSV input has a `to,amount,memo` header row (memo is optional and may be
quoted if it contains a comma):

```csv
to,amount,memo
service-a,10,"invoice #1, monthly"
service-b,25
```

```bash
$ tokelio batch-pay --from my-agent --file payouts.csv
Batch pay from my-agent: 2 succeeded, 0 failed.
```

## Spending policies

`tokelio policy` configures the SDK's `PolicyEngine`, enforced ahead of
budget checks on every `pay`/`batch-pay`. Like budgets, the *configured*
policy is persisted to `~/.tokelio/policies.json` and re-applied to a fresh
`PolicyEngine` on every CLI invocation, since the SDK's own `PolicyEngine`
only lives in memory for the lifetime of one `TokelioClient`. Unlike
budgets, policy config is process-wide, not per-agent — there's one
max-transaction-amount cap and one allowlist/denylist active at a time.

```bash
$ tokelio policy set-max-transaction --limit 50
Max transaction amount policy set: 50 TOKE

$ tokelio pay --from my-agent --to some-service --amount 100
Error: Policy violation (maxTransactionAmount): amount 100000000000000000000 exceeds the maximum transaction amount of 50000000000000000000
```

## Diagnostics

`tokelio doctor` checks the local CLI environment without touching the SDK:
it ensures `TOKELIO_HOME` exists and is writable (creating it if missing,
same as every other command), checks each local state file
(`wallets.json`, `budgets.json`, `policies.json`, `ledger.json`) for
existence and JSON validity — a malformed file is reported as a finding,
never a crash — and checks the running Node version against the minimum
supported version. Exits non-zero only if a check comes back `error`.

```bash
$ tokelio doctor
[OK] TOKELIO_HOME: /home/you/.tokelio exists and is writable.
[OK] wallets.json: /home/you/.tokelio/wallets.json exists and is valid JSON.
[OK] budgets.json: /home/you/.tokelio/budgets.json is missing (not created yet).
[OK] policies.json: /home/you/.tokelio/policies.json is missing (not created yet).
[OK] ledger.json: /home/you/.tokelio/ledger.json exists and is valid JSON.
[OK] node version: Running Node 22.23.1.
```

## Connect your agent to Claude Code / Claude Desktop

`tokelio agent connect` is the CLI's headline feature: it wires the wallet
and ledger you've been managing from the command line directly into an
MCP-capable AI client, via `@tokelio-labs/mcp-server`. Once connected, the client
can check balances, make payments, and manage escrow **using the exact same
local state** — fund an agent with `tokelio faucet`, then let the agent spend
it, all backed by the same `~/.tokelio/ledger.json`.

### Resolving which agent to connect

- Pass `--agent-id <id>` explicitly. If that agent doesn't have a local
  wallet yet, one is created automatically — `agent connect` works
  standalone, without a prior `wallet create`.
- Omit `--agent-id` and the CLI looks at your existing wallets: if there's
  exactly one, it's used automatically; if there are zero, you'll be told to
  run `wallet create` or pass `--agent-id`; if there's more than one, you'll
  be asked to disambiguate with `--agent-id`.

### `--target claude-code` (default)

Merges an MCP server entry into `./.mcp.json` in your current project
directory, preserving any other servers already configured there. This
always writes — it's scoped to the current project, so the risk is low.

```bash
$ tokelio agent connect --agent-id my-agent
Connected agent my-agent (claude-code) -> /path/to/project/.mcp.json

Next steps:
  - Restart Claude Code (or reload its MCP servers) in this project so it picks up the new .mcp.json entry.
  - Then try asking it: "What's the Tokelio balance for agent my-agent?" — it should be able to call the tokelio MCP server using the wallet/ledger you've been managing with this CLI.
```

Resulting `.mcp.json`:

```json
{
  "mcpServers": {
    "tokelio": {
      "command": "npx",
      "args": ["-y", "@tokelio-labs/mcp-server"],
      "env": {
        "TOKELIO_LEDGER_PATH": "/home/you/.tokelio/ledger.json",
        "TOKELIO_AGENT_ID": "my-agent"
      }
    }
  }
}
```

### `--target claude-desktop`

Touches a file outside your project directory, so by default nothing is
written — the CLI prints the config fragment for you to paste in yourself,
along with the typical config file path for your OS:

```bash
$ tokelio agent connect --agent-id my-agent --target claude-desktop
Paste the following into your Claude Desktop config (mcpServers) for agent my-agent:
{
  "mcpServers": {
    "tokelio": {
      "command": "npx",
      "args": ["-y", "@tokelio-labs/mcp-server"],
      "env": {
        "TOKELIO_LEDGER_PATH": "/home/you/.tokelio/ledger.json",
        "TOKELIO_AGENT_ID": "my-agent"
      }
    }
  }
}

Typical config file locations:
  macOS:   ~/Library/Application Support/Claude/claude_desktop_config.json
  Linux:   ~/.config/Claude/claude_desktop_config.json
  Windows: %APPDATA%\Claude\claude_desktop_config.json

Tip: re-run with --write to have this CLI attempt to merge it into that file for you.
```

Pass `--write` to have the CLI locate and merge into the real per-OS config
file itself (detected via `process.platform`). If the config directory
doesn't exist (e.g. Claude Desktop isn't installed), it errors out rather
than silently creating arbitrary system paths.

After connecting, restart/reload MCP servers in your client and ask it to
check the connected agent's Tokelio balance — that's the fastest way to
confirm the wiring worked end to end.

## Known limitations

- **Budget and escrow state only live in memory inside `@tokelio-labs/sdk`**
  (see the SDK's own docs — persistent budget/escrow storage is on its
  roadmap). Every `tokelio` command is its own OS process, so:
  - `tokelio budget set` persists the *configured limit and period* to
    `~/.tokelio/budgets.json` and re-applies it on every later command
    against that agent, so `budget show` and `pay` correctly enforce the
    configured cap across separate CLI invocations. What does **not**
    persist is spend already recorded *within* a single process — e.g. two
    payments run as two separate `tokelio pay` invocations each see the full
    limit fresh, rather than a running tally. Budget enforcement is
    therefore closest to "per-invocation cap," not a durable rolling ledger
    of spend.
  - Escrow task *metadata* (status, description, payer/payee) is **not**
    persisted at all — it lives only in the SDK's in-memory `EscrowClient`.
    `tokelio escrow create` followed by `tokelio escrow release <taskId>` as
    two separate terminal commands will currently fail with "Escrow task not
    found," because the second process's `EscrowClient` never saw the first
    process's task. The underlying *funds* are safely locked either way (the
    ledger genuinely moves TOKE into a `escrow:<taskId>` holding balance),
    but resolving that task requires driving `create`/`release`/`refund`
    within the same process — e.g. by importing the command functions from
    `src/commands/escrow.ts` programmatically rather than via the CLI
    across separate invocations. This will be resolved once the SDK ships
    persistent escrow storage.

## Development

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Tests always point `TOKELIO_HOME` at a fresh temp directory per test and
clean up afterward — they never touch your real `~/.tokelio`.


## Links

- Website: https://tokelio.com
- Docs: https://docs.tokelio.com
- dApp: https://dapp.tokelio.com
- GitHub: https://github.com/tokelio-labs
- X: https://x.com/tokeliocom
- Telegram: https://t.me/tokeliocom

## License

MIT © Tokelio Labs
