import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const SCRIPT = join(__dirname, "expect-vault-refusal.sh");
const OIDC_TOKEN = "header.claims.signature";
const SECRET = "s3cr3t-value";

// A stand-in for curl: GitHub's OIDC endpoint answers with a token, and the
// vault with the statuses and bodies queued in its folder, one per call. It
// records each call's arguments and header files so tests can check what was
// sent where.
const fake = mkdtempSync(join(tmpdir(), "expect-vault-refusal-"));
afterAll(() => rmSync(fake, { recursive: true, force: true }));
writeFileSync(
  join(fake, "curl"),
  `#!/usr/bin/env bash
dir="${fake}"
printf '%s\\n' "$*" >> "$dir/argv"
for arg in "$@"; do case $arg in @*) cat "\${arg#@}" >> "$dir/headers";; esac; done
for arg in "$@"; do
  case $arg in
    https://oidc.example/*) printf '{"value":"${OIDC_TOKEN}"}'; exit 0;;
    https://vault.ieasybooks.com/ci)
      n=$(($(cat "$dir/count" 2>/dev/null || echo 0) + 1)); echo "$n" > "$dir/count"
      [ -f "$dir/answer.$n" ] || exit 7
      cat "$dir/answer.$n"; exit 0;;
  esac
done
exit 3
`,
);
chmodSync(join(fake, "curl"), 0o755);

function run(name: string, ...answers: [status: number, body: unknown][]) {
  for (const file of [
    "argv",
    "headers",
    "count",
    ...Array.from({ length: 9 }, (_, i) => `answer.${i + 1}`),
  ]) {
    rmSync(join(fake, file), { force: true });
  }
  answers.forEach(([status, body], i) =>
    writeFileSync(
      join(fake, `answer.${i + 1}`),
      `${JSON.stringify(body)}\n${status}`,
    ),
  );
  const result = spawnSync("bash", [SCRIPT, name], {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${fake}:${process.env.PATH}`,
      ACTIONS_ID_TOKEN_REQUEST_URL:
        "https://oidc.example/token?api-version=2.0",
      ACTIONS_ID_TOKEN_REQUEST_TOKEN: "request-token",
      SLEEP_SECONDS: "0",
    },
  });
  const read = (file: string) => {
    try {
      return readFileSync(join(fake, file), "utf8");
    } catch {
      return "";
    }
  };
  return {
    code: result.status,
    out: result.stdout + result.stderr,
    argv: read("argv"),
    headers: read("headers"),
  };
}

const refused = (reason: string) =>
  [403, { error: "refused", refused: { MOFIED_WEB_DEPLOY_TOKEN: reason } }] as [
    number,
    unknown,
  ];
const NO_RULE =
  "no rule matches workflow_dispatch on refs/heads/main by AliOsm, running ieasybooks/mofied/.github/workflows/release-please.yml@refs/heads/main, which called ieasybooks/mofied/.github/workflows/release.yml@refs/heads/main";

describe("expect-vault-refusal.sh", () => {
  it("passes when the vault refuses the secret because no rule matches", () => {
    const result = run("MOFIED_WEB_DEPLOY_TOKEN", refused(NO_RULE));
    expect(result.code).toBe(0);
    expect(result.out).toContain(
      `The vault refuses MOFIED_WEB_DEPLOY_TOKEN here, as it should: ${NO_RULE}`,
    );
  });

  it("asks GitHub for a token for the vault, and sends it only in header files", () => {
    const result = run("MOFIED_WEB_DEPLOY_TOKEN", refused(NO_RULE));
    expect(result.argv).toContain(
      "https://oidc.example/token?api-version=2.0&audience=https://vault.ieasybooks.com",
    );
    expect(result.argv).toContain('{"secrets":["MOFIED_WEB_DEPLOY_TOKEN"]}');
    expect(result.headers).toContain("Authorization: bearer request-token");
    expect(result.headers).toContain(`Authorization: Bearer ${OIDC_TOKEN}`);
    expect(result.argv).not.toContain(OIDC_TOKEN);
    expect(result.argv).not.toContain("request-token");
    expect(result.out).not.toContain(OIDC_TOKEN);
  });

  it("fails without printing the value when the vault serves the secret", () => {
    const result = run("MOFIED_WEB_DEPLOY_TOKEN", [
      200,
      { secrets: { MOFIED_WEB_DEPLOY_TOKEN: SECRET } },
    ]);
    expect(result.code).toBe(1);
    expect(result.out).toContain(
      "The vault served MOFIED_WEB_DEPLOY_TOKEN to this job",
    );
    expect(result.out).not.toContain(SECRET);
  });

  it("fails on other refusals and errors, which don't show the rules at work", () => {
    expect(
      run(
        "MOFIED_WEB_DEPLOY_TOKEN",
        refused("has no value yet: mise run vault:set MOFIED_WEB_DEPLOY_TOKEN"),
      ).code,
    ).toBe(1);
    expect(
      run("MOFIED_WEB_DEPLOY_TOKEN", [401, { error: "token expired" }]).code,
    ).toBe(1);
    expect(
      run("MOFIED_WEB_DEPLOY_TOKEN", [500, { error: "internal error" }]).out,
    ).toContain('HTTP 500: {"error":"internal error"}');
  });

  it("retries the answers that mean the vault couldn't check the token yet", () => {
    const result = run(
      "MOFIED_WEB_DEPLOY_TOKEN",
      [503, { error: "retry" }],
      [502, { error: "retry" }],
      refused(NO_RULE),
    );
    expect(result.code).toBe(0);
    expect(result.out).toContain("retrying (2)");
  });

  it("refuses a name that isn't a secret name", () => {
    expect(run('X","Y').code).toBe(2);
  });
});
