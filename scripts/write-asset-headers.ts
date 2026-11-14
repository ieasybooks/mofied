import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const output = "apps/web/dist";
const files = readdirSync(join(output, "assets"), {
  withFileTypes: true,
  recursive: true,
})
  .filter((file) => file.isFile() && /-[\w-]{8,}\.[\w.]+$/.test(file.name))
  .map((file) =>
    relative(output, join(file.parentPath, file.name))
      .split(sep)
      .map(encodeURIComponent)
      .join("/"),
  )
  .sort();

const common = readFileSync("apps/web/public/_headers", "utf8").trimEnd();
// Cloudflare supports 100 header rules, including the shared ones.
const limit =
  100 - common.split("\n").filter((line) => /^\//.test(line)).length;
if (files.length === 0 || files.length > limit) {
  throw new Error(
    `Expected 1–${limit} fingerprinted assets, found ${files.length}`,
  );
}

const immutable = files.map(
  (file) => `/${file}\n  Cache-Control: public, max-age=31536000, immutable`,
);
writeFileSync(
  join(output, "_headers"),
  `${common}\n\n${immutable.join("\n\n")}\n`,
);
console.log(`Generated immutable cache rules for ${files.length} assets.`);
