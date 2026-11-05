import { mkdir, writeFile } from "node:fs/promises";
import { z } from "zod";
import { format } from "prettier";
import { SessionPlanSchema } from "@mofied/contracts";
import { fixture } from "@mofied/fixtures";

await mkdir(new URL("../docs/", import.meta.url), { recursive: true });
const schema = z.toJSONSchema(SessionPlanSchema);
await writeFile(
  new URL("../docs/session.schema.json", import.meta.url),
  await format(JSON.stringify(schema), { parser: "json" }),
);
await writeFile(
  new URL("../docs/session.example.json", import.meta.url),
  await format(JSON.stringify(fixture()), { parser: "json" }),
);
