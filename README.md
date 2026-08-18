# roblox-devproducts-mcp

A local [MCP](https://modelcontextprotocol.io) server that lets AI agents (Claude Code, etc.)
manage **Roblox developer products** through the [Open Cloud API](https://create.roblox.com/docs/cloud/reference/features/developer-products).

Runs entirely on your machine. Your API key is stored locally and never leaves your computer.

## Tools

| Tool | What it does |
| --- | --- |
| `list_developer_products` | List a universe's developer products (id, name, price, description) |
| `get_developer_product` | Get one product's full details by ID |
| `create_developer_product` | Create a new developer product |
| `update_developer_product` | Update a product's name, price, description, or on-sale status |
| `bulk_create_developer_products` | Create many products in one call (auto rate-limited to 3/sec) |
| `bulk_update_developer_products` | Update many products in one call (auto rate-limited to 3/sec) |

## Setup

### 1. Get an Open Cloud API key

1. Go to the [Creator Dashboard → Open Cloud → API Keys](https://create.roblox.com/dashboard/credentials).
2. Create a key and add the **Developer Products** API system.
3. Scope it (read and/or write) to the universes you want to manage.

Use the narrowest scope you need — this key only needs developer-product access, not your whole account.

### 2. Install

```bash
npm install -g roblox-devproducts-mcp
```

(Or clone this repo and run `npm install && npm run build`, then use `node dist/cli.js` as the command.)

### 3. Store your key

```bash
roblox-devproducts-mcp setup
```

This prompts for your key (hidden input) and saves it to your OS config directory.
No secrets end up in any shared config file. Check it worked with:

```bash
roblox-devproducts-mcp status
```

### 4. Connect it to Claude Code

Either register it:

```bash
claude mcp add roblox-devproducts -- roblox-devproducts-mcp
```

or add a `.mcp.json` to your project (safe to commit — it contains no secret):

```json
{
  "mcpServers": {
    "roblox-devproducts": {
      "command": "roblox-devproducts-mcp"
    }
  }
}
```

The tools appear as `mcp__roblox-devproducts__*` in your next session; `/mcp` shows status.

## Managing your key

| Command | Action |
| --- | --- |
| `roblox-devproducts-mcp setup` | Store or replace the key |
| `roblox-devproducts-mcp setup --clear` | Delete the stored key |
| `roblox-devproducts-mcp status` | Show whether a key is configured and where it came from |

A key stored by `setup` takes precedence. If you haven't run `setup`, the `ROBLOX_API_KEY` environment variable is used as a fallback (handy for CI).

## License

MIT
