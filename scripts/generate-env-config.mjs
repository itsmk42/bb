import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const envPath = path.join(root, ".env");
const fallbackPath = path.join(root, ".env.example");
const outputPath = path.join(root, "assets", "env-config.js");

function parseEnv(text) {
  const out = {};
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index <= 0) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    out[key] = value;
  }

  return out;
}

const sourcePath = fs.existsSync(envPath) ? envPath : fallbackPath;
if (!fs.existsSync(sourcePath)) {
  throw new Error("Missing .env and .env.example. Create one before generating runtime config.");
}

const env = parseEnv(fs.readFileSync(sourcePath, "utf8"));

const config = {
  SUPABASE_URL: env.SUPABASE_URL || "",
  SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY || "",
  SUPABASE_STORAGE_BUCKET: env.SUPABASE_STORAGE_BUCKET || "documents"
};

const content = `window.BUILDERBALLERY_CONFIG = Object.freeze(${JSON.stringify(config, null, 2)});\n`;
fs.writeFileSync(outputPath, content, "utf8");
console.log(`Generated ${path.relative(root, outputPath)} from ${path.basename(sourcePath)}`);
