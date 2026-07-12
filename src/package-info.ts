import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface PackageInfo {
  name: string;
  version: string;
}

interface PackageJsonShape {
  name?: string;
  version?: string;
}

/**
 * Walks upward from `startDir` looking for a `package.json` whose `name` is
 * `@tokelio-labs/cli` — this package's own manifest — rather than assuming a
 * fixed number of directory hops. That fixed-depth assumption would break
 * because this file's location relative to the repo root differs between
 * dev/test (`src/package-info.ts`, two levels down) and the bundled build
 * (`dist/index.js`, one level down), and would break again for an installed
 * npm package (`node_modules/@tokelio-labs/cli/dist/index.js`, where the nearest
 * `package.json` going up is already the right one).
 */
function findOwnPackageJson(startDir: string): PackageInfo {
  let dir = startDir;
  // A handful of levels is more than enough to cover src/, dist/, and an
  // installed node_modules layout; bail out rather than walking forever.
  for (let i = 0; i < 8; i += 1) {
    const candidate = path.join(dir, "package.json");
    try {
      const raw = readFileSync(candidate, "utf8");
      const parsed = JSON.parse(raw) as PackageJsonShape;
      if (parsed.name === "@tokelio-labs/cli" && parsed.version !== undefined) {
        return { name: parsed.name, version: parsed.version };
      }
    } catch {
      // Not found (or not readable/parseable) at this level — keep walking up.
    }

    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }

  throw new Error("Could not locate @tokelio-labs/cli's own package.json to read its version.");
}

/**
 * Reads this package's own `name`/`version` from its own `package.json` —
 * the single source of truth, so the version string is never hardcoded
 * separately in `cli.ts` (for commander's built-in `--version`) and the
 * `tokelio version` command.
 */
export function getPackageInfo(): PackageInfo {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return findOwnPackageJson(here);
}
