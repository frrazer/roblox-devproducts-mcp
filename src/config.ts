import envPaths from "env-paths";
import { join } from "node:path";
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  existsSync,
} from "node:fs";

// Standard per-OS config directory, e.g. %APPDATA%\roblox-devproducts on Windows.
const paths = envPaths("roblox-devproducts", { suffix: "" });
const CONFIG_DIR = paths.config;
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

export type ApiKeySource = "env" | "config";

export interface ResolvedKey {
  key: string;
  source: ApiKeySource;
}

/**
 * Resolve the API key. A key saved via `setup` is an explicit choice, so it
 * wins over any ambient ROBLOX_API_KEY that may be lying around in the
 * environment (a stray env var silently overriding the configured key is a
 * footgun). The env var is a fallback for setups that never run `setup`, e.g. CI.
 */
export function resolveApiKey(): ResolvedKey | undefined {
  if (existsSync(CONFIG_FILE)) {
    try {
      const parsed = JSON.parse(readFileSync(CONFIG_FILE, "utf8"));
      if (typeof parsed.apiKey === "string" && parsed.apiKey.trim()) {
        return { key: parsed.apiKey.trim(), source: "config" };
      }
    } catch {
      // Corrupt config file — fall through to the env var.
    }
  }

  const fromEnv = process.env.ROBLOX_API_KEY?.trim();
  if (fromEnv) return { key: fromEnv, source: "env" };

  return undefined;
}

/** Write the key to the config file with owner-only permissions. */
export function saveApiKey(key: string): string {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify({ apiKey: key.trim() }, null, 2), {
    mode: 0o600,
  });
  return CONFIG_FILE;
}

/** Delete the stored key. Returns true if a file was actually removed. */
export function clearApiKey(): boolean {
  if (existsSync(CONFIG_FILE)) {
    rmSync(CONFIG_FILE);
    return true;
  }
  return false;
}

export function configPath(): string {
  return CONFIG_FILE;
}
