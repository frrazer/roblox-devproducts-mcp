#!/usr/bin/env node
import { runServer } from "./server.js";
import { saveApiKey, clearApiKey, configPath, resolveApiKey } from "./config.js";

const HELP = `roblox-devproducts-mcp — MCP server for Roblox developer products

Usage:
  roblox-devproducts-mcp            Run the MCP server (stdio). Used by Claude Code.
  roblox-devproducts-mcp setup      Prompt for and store your Open Cloud API key.
  roblox-devproducts-mcp setup --clear   Remove the stored API key.
  roblox-devproducts-mcp status     Show whether an API key is configured.
  roblox-devproducts-mcp help       Show this help.

A stored key (from the setup command) takes precedence. If no key is stored,
the ROBLOX_API_KEY environment variable is used as a fallback.
`;

async function main(): Promise<void> {
  const cmd = process.argv[2];

  switch (cmd) {
    case "setup": {
      if (process.argv.includes("--clear")) {
        const removed = clearApiKey();
        console.log(
          removed
            ? `Removed stored API key (${configPath()}).`
            : "No stored API key to remove.",
        );
        return;
      }
      // @inquirer/prompts is imported lazily so it never loads in server mode.
      const { password } = await import("@inquirer/prompts");
      const key = await password({
        message: "Paste your Roblox Open Cloud API key:",
        mask: true,
      });
      if (!key.trim()) {
        console.error("No key entered. Aborted.");
        process.exitCode = 1;
        return;
      }
      const path = saveApiKey(key);
      console.log(`\nSaved to ${path}`);
      console.log(
        "Make sure the key is scoped to developer products (read/write) for the " +
          "universes you want to manage, in the Creator Dashboard.",
      );
      return;
    }

    case "status": {
      const resolved = resolveApiKey();
      if (!resolved) {
        console.log("No API key configured. Run: roblox-devproducts-mcp setup");
      } else {
        const where =
          resolved.source === "env" ? "ROBLOX_API_KEY env var" : configPath();
        console.log(`API key configured (source: ${where}).`);
      }
      return;
    }

    case "help":
    case "--help":
    case "-h":
      console.log(HELP);
      return;

    case undefined:
      // No subcommand: run the MCP server over stdio.
      await runServer();
      return;

    default:
      console.error(`Unknown command: ${cmd}\n`);
      console.error(HELP);
      process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
