import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Playwright's normal contexts force focus/visibility. Attach without its default
 * emulation for the one test that requires real browser tab lifecycle behavior. */
export async function realBrowser() {
  const profile = await mkdtemp(join(tmpdir(), "mofied-browser-"));
  const processHandle = spawn(
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? chromium.executablePath(),
    [
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--no-sandbox",
      ...(process.env.HEADED === "1" ? [] : ["--headless=new"]),
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  try {
    let port = "";
    const deadline = Date.now() + 10_000;
    while (!port && Date.now() < deadline) {
      try {
        port = (
          await readFile(join(profile, "DevToolsActivePort"), "utf8")
        ).split("\n")[0]!;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }
    if (!port) throw new Error("Chrome did not start");
    const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, {
      noDefaults: true,
    });
    const context = browser.contexts()[0]!;
    return {
      context,
      close: async () => {
        await browser.close();
        processHandle.kill();
        await new Promise((resolve) => {
          processHandle.once("exit", resolve);
          setTimeout(resolve, 1500);
        });
        await rm(profile, {
          recursive: true,
          force: true,
          maxRetries: 5,
          retryDelay: 200,
        });
      },
    };
  } catch (error) {
    processHandle.kill();
    await rm(profile, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 200,
    });
    throw error;
  }
}
