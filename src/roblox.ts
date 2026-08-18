import { createResourceClient } from "./api.js";

// Roblox developer products. Write endpoints: 3 requests/second per user.
export const developerProducts = createResourceClient({
  base: "https://apis.roblox.com/developer-products/v2",
  collection: "developer-products",
  idField: "productId",
  writeDelayMs: 350, // ~2.85 req/s, under the 3 req/s cap
});
