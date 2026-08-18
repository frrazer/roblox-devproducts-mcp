import { resolveApiKey } from "./config.js";

const BASE = "https://apis.roblox.com/developer-products/v2";

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

async function request(path: string, init: RequestInit = {}): Promise<unknown> {
  const resolved = resolveApiKey();
  if (!resolved) throw new MissingKeyError();

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "x-api-key": resolved.key,
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
    const detail =
      typeof body === "string" ? body : JSON.stringify(body);
    throw new RobloxApiError(res.status, `HTTP ${res.status}: ${detail}`);
  }
  return body;
}

export interface ListOptions {
  maxPageSize?: number;
  pageToken?: string;
}

export function listDeveloperProducts(
  universeId: string,
  opts: ListOptions = {},
): Promise<unknown> {
  const params = new URLSearchParams();
  if (opts.maxPageSize) params.set("maxPageSize", String(opts.maxPageSize));
  if (opts.pageToken) params.set("pageToken", opts.pageToken);
  const query = params.toString();
  return request(
    `/universes/${universeId}/developer-products/creator${query ? `?${query}` : ""}`,
  );
}

export function getDeveloperProduct(
  universeId: string,
  productId: string,
): Promise<unknown> {
  return request(
    `/universes/${universeId}/developer-products/${productId}/creator`,
  );
}

export interface DeveloperProductInput {
  name?: string;
  description?: string;
  priceInRobux?: number;
  isForSale?: boolean;
}

function toForm(input: DeveloperProductInput): FormData {
  const form = new FormData();
  if (input.name !== undefined) form.append("name", input.name);
  if (input.description !== undefined) form.append("description", input.description);
  if (input.priceInRobux !== undefined) form.append("price", String(input.priceInRobux));
  if (input.isForSale !== undefined) form.append("isForSale", String(input.isForSale));
  return form;
}

export function createDeveloperProduct(
  universeId: string,
  input: DeveloperProductInput,
): Promise<unknown> {
  return request(`/universes/${universeId}/developer-products`, {
    method: "POST",
    body: toForm(input),
  });
}

function patchDeveloperProduct(
  universeId: string,
  productId: string,
  input: DeveloperProductInput,
): Promise<unknown> {
  return request(`/universes/${universeId}/developer-products/${productId}`, {
    method: "PATCH",
    body: toForm(input),
  });
}

// Update returns 204 with no body, so re-fetch and return the updated product.
export async function updateDeveloperProduct(
  universeId: string,
  productId: string,
  input: DeveloperProductInput,
): Promise<unknown> {
  await patchDeveloperProduct(universeId, productId, input);
  return getDeveloperProduct(universeId, productId);
}

// ---------------------------------------------------------------------------
// Bulk operations.
//
// The developer-product WRITE endpoints allow only 3 requests/second across ALL
// of a user's/group's API keys, so bulk calls run sequentially with a delay
// between each request to stay under that limit. One failing item does not
// abort the batch — every item gets its own result.
// ---------------------------------------------------------------------------

const RATE_LIMIT_DELAY_MS = 350; // ~2.85 req/s, safely under the 3 req/s cap

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface BulkItemResult {
  index: number;
  ok: boolean;
  productId?: number;
  name?: string;
  error?: string;
}

export interface BulkSummary {
  total: number;
  succeeded: number;
  failed: number;
  results: BulkItemResult[];
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

export async function bulkCreateDeveloperProducts(
  universeId: string,
  products: DeveloperProductInput[],
): Promise<BulkSummary> {
  const results: BulkItemResult[] = [];
  for (let i = 0; i < products.length; i++) {
    if (i > 0) await sleep(RATE_LIMIT_DELAY_MS);
    try {
      const created = (await createDeveloperProduct(universeId, products[i])) as {
        productId?: number;
        name?: string;
      };
      results.push({
        index: i,
        ok: true,
        productId: created?.productId,
        name: created?.name,
      });
    } catch (err) {
      results.push({
        index: i,
        ok: false,
        name: products[i].name,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return summarize(results);
}

export interface BulkUpdateItem extends DeveloperProductInput {
  productId: string;
}

export async function bulkUpdateDeveloperProducts(
  universeId: string,
  updates: BulkUpdateItem[],
): Promise<BulkSummary> {
  const results: BulkItemResult[] = [];
  for (let i = 0; i < updates.length; i++) {
    if (i > 0) await sleep(RATE_LIMIT_DELAY_MS);
    const { productId, ...fields } = updates[i];
    try {
      await patchDeveloperProduct(universeId, productId, fields);
      results.push({ index: i, ok: true, productId: Number(productId) });
    } catch (err) {
      results.push({
        index: i,
        ok: false,
        productId: Number(productId),
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return summarize(results);
}
