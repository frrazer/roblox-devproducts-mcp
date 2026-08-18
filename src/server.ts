import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as roblox from "./roblox.js";

type ToolResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

function ok(data: unknown): ToolResult {
  const text =
    typeof data === "string" ? data : JSON.stringify(data, null, 2);
  return { content: [{ type: "text", text }] };
}

function fail(err: unknown): ToolResult {
  const message = err instanceof Error ? err.message : String(err);
  return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
}

export async function runServer(): Promise<void> {
  const server = new McpServer({
    name: "roblox-devproducts",
    version: "0.1.0",
  });

  server.registerTool(
    "list_developer_products",
    {
      description:
        "List the developer products for a Roblox universe (game). Returns each " +
        "product's ID, name, price, and description. Call this when the user asks " +
        "what dev products a game has, or to find a product's ID before updating it.",
      inputSchema: {
        universeId: z.string().describe("The Roblox universe (game) ID."),
        maxPageSize: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Maximum number of products to return per page."),
        pageToken: z
          .string()
          .optional()
          .describe("Token from a previous response to fetch the next page."),
      },
    },
    async ({ universeId, maxPageSize, pageToken }) => {
      try {
        return ok(
          await roblox.listDeveloperProducts(universeId, { maxPageSize, pageToken }),
        );
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "get_developer_product",
    {
      description:
        "Get the full details of a single developer product by its product ID " +
        "within a universe. Use after list_developer_products to inspect one product.",
      inputSchema: {
        universeId: z.string().describe("The Roblox universe (game) ID."),
        productId: z.string().describe("The developer product ID."),
      },
    },
    async ({ universeId, productId }) => {
      try {
        return ok(await roblox.getDeveloperProduct(universeId, productId));
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "create_developer_product",
    {
      description:
        "Create a new developer product in a universe. Only a name is required. " +
        "To make it purchasable, also pass priceInRobux and isForSale: true — a " +
        "product cannot be put on sale without a price. Returns the created product " +
        "including its new product ID. Requires an API key scoped to write developer products.",
      inputSchema: {
        universeId: z.string().describe("The Roblox universe (game) ID."),
        name: z.string().describe("The product name shown to buyers."),
        priceInRobux: z
          .number()
          .int()
          .nonnegative()
          .optional()
          .describe("Price in Robux. Required before the product can be sold."),
        isForSale: z
          .boolean()
          .optional()
          .describe("Whether the product is available for purchase. Requires a price to be set."),
        description: z
          .string()
          .optional()
          .describe("Optional product description."),
      },
    },
    async ({ universeId, name, priceInRobux, isForSale, description }) => {
      try {
        return ok(
          await roblox.createDeveloperProduct(universeId, {
            name,
            priceInRobux,
            isForSale,
            description,
          }),
        );
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "update_developer_product",
    {
      description:
        "Update an existing developer product's name, description, price, or " +
        "on-sale status. Only the fields you provide are changed. Putting a product " +
        "on sale (isForSale: true) requires a price to be set. Returns the updated " +
        "product. Requires an API key scoped to write developer products.",
      inputSchema: {
        universeId: z.string().describe("The Roblox universe (game) ID."),
        productId: z.string().describe("The developer product ID to update."),
        name: z.string().optional().describe("New product name."),
        priceInRobux: z
          .number()
          .int()
          .nonnegative()
          .optional()
          .describe("New price in Robux."),
        isForSale: z
          .boolean()
          .optional()
          .describe("Put the product on sale (true) or take it off sale (false). Selling requires a price."),
        description: z.string().optional().describe("New product description."),
      },
    },
    async ({ universeId, productId, name, priceInRobux, isForSale, description }) => {
      try {
        return ok(
          await roblox.updateDeveloperProduct(universeId, productId, {
            name,
            priceInRobux,
            isForSale,
            description,
          }),
        );
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "bulk_create_developer_products",
    {
      description:
        "Create many developer products in a single call. Use this instead of " +
        "calling create_developer_product repeatedly when creating more than a few " +
        "products. Items are created sequentially with automatic rate limiting (the " +
        "API allows 3 writes/second), so a large batch takes roughly a third of a " +
        "second per product. Returns a summary plus a per-item result (created " +
        "product ID or error); one failing item does not stop the rest.",
      inputSchema: {
        universeId: z.string().describe("The Roblox universe (game) ID."),
        products: z
          .array(
            z.object({
              name: z.string().describe("The product name shown to buyers."),
              priceInRobux: z
                .number()
                .int()
                .nonnegative()
                .optional()
                .describe("Price in Robux. Required before the product can be sold."),
              isForSale: z
                .boolean()
                .optional()
                .describe("Whether the product is for sale. Requires a price."),
              description: z
                .string()
                .optional()
                .describe("Optional product description."),
            }),
          )
          .min(1)
          .describe("The products to create."),
      },
    },
    async ({ universeId, products }) => {
      try {
        return ok(await roblox.bulkCreateDeveloperProducts(universeId, products));
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    "bulk_update_developer_products",
    {
      description:
        "Update many developer products in a single call. Use this instead of " +
        "calling update_developer_product repeatedly. Each entry targets a product " +
        "by ID and changes only the fields you provide. Items are updated " +
        "sequentially with automatic rate limiting (3 writes/second). Returns a " +
        "summary plus a per-item result; one failing item does not stop the rest.",
      inputSchema: {
        universeId: z.string().describe("The Roblox universe (game) ID."),
        updates: z
          .array(
            z.object({
              productId: z.string().describe("The developer product ID to update."),
              name: z.string().optional().describe("New product name."),
              priceInRobux: z
                .number()
                .int()
                .nonnegative()
                .optional()
                .describe("New price in Robux."),
              isForSale: z
                .boolean()
                .optional()
                .describe("Put on sale (true) or off sale (false). Selling requires a price."),
              description: z
                .string()
                .optional()
                .describe("New product description."),
            }),
          )
          .min(1)
          .describe("The product updates to apply."),
      },
    },
    async ({ universeId, updates }) => {
      try {
        return ok(await roblox.bulkUpdateDeveloperProducts(universeId, updates));
      } catch (err) {
        return fail(err);
      }
    },
  );

  // stdio transport: stdout is the protocol channel — never write logs there.
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
