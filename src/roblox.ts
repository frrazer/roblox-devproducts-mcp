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
      "content-type": "application/json",
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
// Create / update request bodies.
//
// Body shape mirrors the resource returned by list/get. Price is nested under
// `priceInformation.defaultPriceInRobux` (confirmed against the live API), not
// a top-level field. This is the single place request bodies are constructed —
// adjust here if the beta API changes.
// ---------------------------------------------------------------------------

export interface DeveloperProductInput {
  name?: string;
  description?: string;
  priceInRobux?: number;
}

function toBody(input: DeveloperProductInput): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (input.name !== undefined) body.name = input.name;
  if (input.description !== undefined) body.description = input.description;
  if (input.priceInRobux !== undefined) {
    body.priceInformation = { defaultPriceInRobux: input.priceInRobux };
  }
  return body;
}

export function createDeveloperProduct(
  universeId: string,
  input: DeveloperProductInput,
): Promise<unknown> {
  return request(`/universes/${universeId}/developer-products`, {
    method: "POST",
    body: JSON.stringify(toBody(input)),
  });
}

export function updateDeveloperProduct(
  universeId: string,
  productId: string,
  input: DeveloperProductInput,
): Promise<unknown> {
  return request(
    `/universes/${universeId}/developer-products/${productId}`,
    {
      method: "PATCH",
      body: JSON.stringify(toBody(input)),
    },
  );
}
