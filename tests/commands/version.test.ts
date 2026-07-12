import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { version } from "../../src/commands/version.js";

describe("version", () => {
  it("reads name/version from this package's own package.json, not a hardcoded string", async () => {
    const result = version();
    expect(result.name).toBe("@tokelio/cli");

    const pkgPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "package.json");
    const pkg = JSON.parse(await readFile(pkgPath, "utf8")) as { version: string };
    expect(result.version).toBe(pkg.version);
  });
});
