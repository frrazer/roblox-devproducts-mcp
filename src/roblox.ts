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

// ---------------------------------------------------------------------------
// Create / update.
//
// Both endpoints take multipart/form-data — a JSON body returns HTTP 415.
// Field names are the Open Cloud form fields; the agent-facing `priceInRobux`
// maps to the `price` field. The API rejects isForSale=true unless a price is
// already set. This is the single place request bodies are constructed.
// ---------------------------------------------------------------------------

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

// Update returns 204 with no body, so re-fetch and return the updated product.
export async function updateDeveloperProduct(
  universeId: string,
  productId: string,
  input: DeveloperProductInput,
): Promise<unknown> {
  await request(`/universes/${universeId}/developer-products/${productId}`, {
    method: "PATCH",
    body: toForm(input),
  });
  return getDeveloperProduct(universeId, productId);
}
