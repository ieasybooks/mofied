// ieasybooks/release (pinned in package.json) checks and numbers the apps'
// releases; its own tests cover how. These check Mofied's app against it, as
// the release workflow runs it: from node_modules/.bin.
import { execFileSync, spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const TOOL = "node_modules/.bin/ieasybooks-release";

describe("the apps' release", () => {
  it("apps/mobile/store/ is ready for apps/mobile/package.json's version", () => {
    const result = spawnSync(TOOL, ["store", "check", "--app", "apps/mobile"], {
      encoding: "utf8",
    });
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(
      /^Mofied \d+\.\d+\.\d+ \(build \d+ on iOS and Android\) is ready to release\.\n$/,
    );
  });

  it("numbers the builds as Expo's config does, through the same build numbers", () => {
    const printed = JSON.parse(
      execFileSync(TOOL, ["release-info", "--app", "apps/mobile"], {
        encoding: "utf8",
      }),
    );
    const expo = JSON.parse(
      execFileSync("bunx", ["expo", "config", "--type", "public", "--json"], {
        cwd: "apps/mobile",
        encoding: "utf8",
      }),
    );
    expect({
      version: expo.version,
      iosBuildNumber: expo.ios.buildNumber,
      androidVersionCode: expo.android.versionCode,
    }).toEqual(printed);
  }, 60_000);
});
