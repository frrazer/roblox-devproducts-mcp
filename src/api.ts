import { resolveApiKey } from "./config.js";

export class RobloxApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "RobloxApiError";
    this.status = status;
  }
}

export class MissingKeyError extends Error {
  constructor() {
    super(
      "No Roblox API key configured. Run `roblox-devproducts-mcp setup` to add one, " +
        "or set the ROBLOX_API_KEY environment variable.",
    );
    this.name = "MissingKeyError";
  }
}

async function apiRequest(url: string, init: RequestInit = {}): Promise<unknown> {
  const resolved = resolveApiKey();
  if (!resolved) throw new MissingKeyError();

  const res = await fetch(url, {
    ...init,
    headers: {
      "x-api-key": resolved.key,
      // No default content-type: create/update send multipart/form-data (the
      // FormData body sets its own boundary); reads send no body.
      ...(init.headers ?? {}),
    },
  });

  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!res.ok) {
    const detail = typeof body === "string" ? body : JSON.stringify(body);
    throw new RobloxApiError(res.status, `HTTP ${res.status}: ${detail}`);
  }
  return body;
}

// Developer products and game passes share identical create/update form fields.
export interface ItemInput {
  name?: string;
  description?: string;
  priceInRobux?: number;
  isForSale?: boolean;
}

// Both create and update take multipart/form-data — a JSON body returns HTTP 415.
// The agent-facing `priceInRobux` maps to the `price` form field. The API rejects
// isForSale=true unless a price is set.
function toForm(input: ItemInput): FormData {
  const form = new FormData();
  if (input.name !== undefined) form.append("name", input.name);
  if (input.description !== undefined) form.append("description", input.description);
  if (input.priceInRobux !== undefined) form.append("price", String(input.priceInRobux));
  if (input.isForSale !== undefined) form.append("isForSale", String(input.isForSale));
  return form;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface ListOptions {
  maxPageSize?: number;
  pageToken?: string;
}

export interface BulkItemResult {
  index: number;
  ok: boolean;
  id?: number;
  name?: string;
  error?: string;
}

export interface BulkSummary {
  total: number;
  succeeded: number;
  failed: number;
  results: BulkItemResult[];
}

export interface BulkUpdateItem extends ItemInput {
  id: string;
}

function summarize(results: BulkItemResult[]): BulkSummary {
  const succeeded = results.filter((r) => r.ok).length;
  return {
    total: results.length,
    succeeded,
    failed: results.length - succeeded,
    results,
  };
}

export interface ResourceConfig {
  /** Full API base, e.g. https://apis.roblox.com/developer-products/v2 */
  base: string;
  /** Collection path segment, e.g. "developer-products" or "game-passes". */
  collection: string;
  /** Id field in the item response, e.g. "productId" or "gamePassId". */
  idField: string;
  /** Minimum ms between write requests to respect the endpoint's rate limit. */
  writeDelayMs: number;
}

export interface ResourceClient {
  list(universeId: string, opts?: ListOptions): Promise<unknown>;
  get(universeId: string, id: string): Promise<unknown>;
  create(universeId: string, input: ItemInput): Promise<unknown>;
  update(universeId: string, id: string, input: ItemInput): Promise<unknown>;
  bulkCreate(universeId: string, items: ItemInput[]): Promise<BulkSummary>;
  bulkUpdate(universeId: string, updates: BulkUpdateItem[]): Promise<BulkSummary>;
}

/**
 * Build a client for one Roblox monetization resource. Developer products and
 * game passes have identical shapes and only differ by base URL, collection
 * segment, id field, and write rate limit.
 */
export function createResourceClient(cfg: ResourceConfig): ResourceClient {
  const collection = (universeId: string) =>
    `${cfg.base}/universes/${universeId}/${cfg.collection}`;

  function list(universeId: string, opts: ListOptions = {}): Promise<unknown> {
    const params = new URLSearchParams();
    if (opts.maxPageSize) params.set("pageSize", String(opts.maxPageSize));
    if (opts.pageToken) params.set("pageToken", opts.pageToken);
    const query = params.toString();
    return apiRequest(`${collection(universeId)}/creator${query ? `?${query}` : ""}`);
  }

  function get(universeId: string, id: string): Promise<unknown> {
    return apiRequest(`${collection(universeId)}/${id}/creator`);
  }

  function create(universeId: string, input: ItemInput): Promise<unknown> {
    return apiRequest(collection(universeId), { method: "POST", body: toForm(input) });
  }

  function patch(universeId: string, id: string, input: ItemInput): Promise<unknown> {
    return apiRequest(`${collection(universeId)}/${id}`, {
      method: "PATCH",
      body: toForm(input),
    });
  }

  // Update returns 204 with no body, so re-fetch and return the updated item.
  async function update(universeId: string, id: string, input: ItemInput): Promise<unknown> {
    await patch(universeId, id, input);
    return get(universeId, id);
  }

  // Bulk calls run sequentially with a delay between writes to stay under the
  // endpoint's per-user rate limit. One failing item does not abort the batch.
  async function bulkCreate(universeId: string, items: ItemInput[]): Promise<BulkSummary> {
    const results: BulkItemResult[] = [];
    for (let i = 0; i < items.length; i++) {
      if (i > 0) await sleep(cfg.writeDelayMs);
      try {
        const created = (await create(universeId, items[i])) as Record<string, unknown>;
        results.push({
          index: i,
          ok: true,
          id: created?.[cfg.idField] as number | undefined,
          name: created?.name as string | undefined,
        });
      } catch (err) {
        results.push({
          index: i,
          ok: false,
          name: items[i].name,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return summarize(results);
  }

  async function bulkUpdate(
    universeId: string,
    updates: BulkUpdateItem[],
  ): Promise<BulkSummary> {
    const results: BulkItemResult[] = [];
    for (let i = 0; i < updates.length; i++) {
      if (i > 0) await sleep(cfg.writeDelayMs);
      const { id, ...fields } = updates[i];
      try {
        await patch(universeId, id, fields);
        results.push({ index: i, ok: true, id: Number(id) });
      } catch (err) {
        results.push({
          index: i,
          ok: false,
          id: Number(id),
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return summarize(results);
  }

  return { list, get, create, update, bulkCreate, bulkUpdate };
}
