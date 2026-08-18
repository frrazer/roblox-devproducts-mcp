import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { developerProducts } from "./roblox.js";
import { gamePasses } from "./game-passes.js";
import type { ResourceClient } from "./api.js";

type ToolResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

function ok(data: unknown): ToolResult {
  const text = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  return { content: [{ type: "text", text }] };
}

function fail(err: unknown): ToolResult {
  const message = err instanceof Error ? err.message : String(err);
  return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
}

interface ResourceToolConfig {
  client: ResourceClient;
  singular: string; // e.g. "developer_product" (tool-name fragment)
  plural: string; // e.g. "developer_products"
  idKey: string; // e.g. "productId" (agent-facing id parameter name)
  noun: string; // e.g. "developer product" (human label)
  nounPlural: string; // e.g. "developer products"
  ratePerSec: number; // write rate limit, for the bulk-tool descriptions
}

// Register the six tools (list / get / create / update / bulk create / bulk
// update) for one resource. Developer products and game passes share this
// template and differ only by naming and the write rate limit.
function registerResourceTools(server: McpServer, cfg: ResourceToolConfig): void {
  const { client, singular, plural, idKey, noun, nounPlural, ratePerSec } = cfg;
  const universeId = z.string().describe("The Roblox universe (game) ID.");

  server.registerTool(
    `list_${plural}`,
    {
      description:
        `List the ${nounPlural} for a Roblox universe (game). Returns each item's ID, ` +
        `name, price, description, and on-sale status. Use this to see a game's ${nounPlural} ` +
        `or to find an ID before updating one.`,
      inputSchema: {
        universeId,
        maxPageSize: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Maximum number of results to return per page."),
        pageToken: z
          .string()
          .optional()
          .describe("Token from a previous response to fetch the next page."),
      },
    },
    async ({ universeId, maxPageSize, pageToken }) => {
      try {
        return ok(await client.list(universeId, { maxPageSize, pageToken }));
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    `get_${singular}`,
    {
      description: `Get the full details of a single ${noun} by its ID within a universe.`,
      inputSchema: {
        universeId,
        [idKey]: z.string().describe(`The ${noun} ID.`),
      },
    },
    async (args: any) => {
      try {
        return ok(await client.get(args.universeId, args[idKey]));
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    `create_${singular}`,
    {
      description:
        `Create a new ${noun} in a universe. Only a name is required. To make it ` +
        `purchasable, also pass priceInRobux and isForSale: true — it cannot be put on sale ` +
        `without a price. Returns the created ${noun} including its new ID. Requires an API ` +
        `key scoped to write ${nounPlural}.`,
      inputSchema: {
        universeId,
        name: z.string().describe(`The ${noun} name shown to buyers.`),
        priceInRobux: z
          .number()
          .int()
          .nonnegative()
          .optional()
          .describe("Price in Robux. Required before it can be sold."),
        isForSale: z
          .boolean()
          .optional()
          .describe("Whether it is available for purchase. Requires a price."),
        description: z.string().optional().describe("Optional description."),
      },
    },
    async ({ universeId, name, priceInRobux, isForSale, description }) => {
      try {
        return ok(
          await client.create(universeId, { name, priceInRobux, isForSale, description }),
        );
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    `update_${singular}`,
    {
      description:
        `Update an existing ${noun}'s name, description, price, or on-sale status. Only the ` +
        `fields you provide change. Putting it on sale (isForSale: true) requires a price. ` +
        `Returns the updated ${noun}. Requires an API key scoped to write ${nounPlural}.`,
      inputSchema: {
        universeId,
        [idKey]: z.string().describe(`The ${noun} ID to update.`),
        name: z.string().optional().describe("New name."),
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
        description: z.string().optional().describe("New description."),
      },
    },
    async (args: any) => {
      try {
        return ok(
          await client.update(args.universeId, args[idKey], {
            name: args.name,
            priceInRobux: args.priceInRobux,
            isForSale: args.isForSale,
            description: args.description,
          }),
        );
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    `bulk_create_${plural}`,
    {
      description:
        `Create many ${nounPlural} in one call. Use this instead of calling create_${singular} ` +
        `repeatedly. Items are created sequentially with automatic rate limiting (the API allows ` +
        `${ratePerSec} writes/second). Returns a summary plus a per-item result (created 'id' or ` +
        `error); one failing item does not stop the rest.`,
      inputSchema: {
        universeId,
        items: z
          .array(
            z.object({
              name: z.string().describe(`The ${noun} name shown to buyers.`),
              priceInRobux: z
                .number()
                .int()
                .nonnegative()
                .optional()
                .describe("Price in Robux. Required before it can be sold."),
              isForSale: z
                .boolean()
                .optional()
                .describe("Whether it is for sale. Requires a price."),
              description: z.string().optional().describe("Optional description."),
            }),
          )
          .min(1)
          .describe(`The ${nounPlural} to create.`),
      },
    },
    async ({ universeId, items }) => {
      try {
        return ok(await client.bulkCreate(universeId, items));
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    `bulk_update_${plural}`,
    {
      description:
        `Update many ${nounPlural} in one call. Use this instead of calling update_${singular} ` +
        `repeatedly. Each entry targets one by ID and changes only the fields you provide. Items ` +
        `are updated sequentially with automatic rate limiting (${ratePerSec} writes/second). ` +
        `Returns a summary plus a per-item result; one failing item does not stop the rest.`,
      inputSchema: {
        universeId,
        updates: z
          .array(
            z.object({
              [idKey]: z.string().describe(`The ${noun} ID to update.`),
              name: z.string().optional().describe("New name."),
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
              description: z.string().optional().describe("New description."),
            }),
          )
          .min(1)
          .describe(`The ${noun} updates to apply.`),
      },
    },
    async ({ universeId, updates }) => {
      try {
        const mapped = (updates as Array<Record<string, unknown>>).map((u) => ({
          id: u[idKey] as string,
          name: u.name as string | undefined,
          priceInRobux: u.priceInRobux as number | undefined,
          isForSale: u.isForSale as boolean | undefined,
          description: u.description as string | undefined,
        }));
        return ok(await client.bulkUpdate(universeId, mapped));
      } catch (err) {
        return fail(err);
      }
    },
  );
}

export async function runServer(): Promise<void> {
  const server = new McpServer({
    name: "roblox-devproducts",
    version: "0.3.0",
  });

  registerResourceTools(server, {
    client: developerProducts,
    singular: "developer_product",
    plural: "developer_products",
    idKey: "productId",
    noun: "developer product",
    nounPlural: "developer products",
    ratePerSec: 3,
  });

  registerResourceTools(server, {
    client: gamePasses,
    singular: "game_pass",
    plural: "game_passes",
    idKey: "gamePassId",
    noun: "game pass",
    nounPlural: "game passes",
    ratePerSec: 5,
  });

  // stdio transport: stdout is the protocol channel — never write logs there.
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
