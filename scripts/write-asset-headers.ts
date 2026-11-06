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

// Cloudflare supports 100 header rules; the shared headers already use one.
if (files.length === 0 || files.length > 99) {
  throw new Error(`Expected 1–99 fingerprinted assets, found ${files.length}`);
}

const common = readFileSync("apps/web/public/_headers", "utf8").trimEnd();
const immutable = files.map(
  (file) => `/${file}\n  Cache-Control: public, max-age=31536000, immutable`,
);
writeFileSync(
  join(output, "_headers"),
  `${common}\n\n${immutable.join("\n\n")}\n`,
);
console.log(`Generated immutable cache rules for ${files.length} assets.`);
