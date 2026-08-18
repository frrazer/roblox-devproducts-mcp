import { createResourceClient } from "./api.js";

// Roblox game passes. Write endpoints: 5 requests/second per user.
export const gamePasses = createResourceClient({
  base: "https://apis.roblox.com/game-passes/v1",
  collection: "game-passes",
  idField: "gamePassId",
  writeDelayMs: 220, // ~4.5 req/s, under the 5 req/s cap
});
