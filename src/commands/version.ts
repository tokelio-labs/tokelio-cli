import type { PackageInfo } from "../package-info.js";
import { getPackageInfo } from "../package-info.js";

export type VersionResult = PackageInfo;

/** Returns this package's own `name`/`version`, read from its own `package.json` (the single source of truth). */
export function version(): VersionResult {
  return getPackageInfo();
}
