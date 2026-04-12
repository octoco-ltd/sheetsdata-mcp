# SheetsData MCP

[![MCP Badge](https://lobehub.com/badge/mcp/octoco-ltd-sheetsdata-mcp)](https://lobehub.com/mcp/octoco-ltd-sheetsdata-mcp) [![sheetsdata-mcp MCP server](https://glama.ai/mcp/servers/octoco-ltd/sheetsdata-mcp/badges/score.svg)](https://glama.ai/mcp/servers/octoco-ltd/sheetsdata-mcp)

[![sheetsdata-mcp MCP server](https://glama.ai/mcp/servers/octoco-ltd/sheetsdata-mcp/badges/card.svg)](https://glama.ai/mcp/servers/octoco-ltd/sheetsdata-mcp)

**Electronic component datasheets for AI agents** — specs, pinouts, package data on demand. No PDFs required.

[SheetsData](https://sheetsdata.com) is an MCP server that gives AI agents instant, structured access to electronic component data. One tool call returns the pinout. Another returns electrical specs. No PDFs. No uploads. No context window stuffing.

> **Beta** — SheetsData is currently in public beta. APIs, pricing, and features may change. See [Disclaimer](#disclaimer) below.

<p align="center">
  <a href="https://sheetsdata.com/signup">Get API Key</a> &nbsp;·&nbsp;
  <a href="https://sheetsdata.com">Website</a>
</p>

## Demo

```
Agent: read_datasheet("TPS54302", section="pinout")
→ Pin table: BOOT(6), EN(5), FB(4), GND(1), SW(2), VIN(3)

Agent: check_design_fit("TPS54302", input_voltage=12, output_current=2)
→ PASS — all parameters within datasheet limits

Agent: "What's the maximum SPI clock frequency for the STM32G030?"
→ Uses read_datasheet to find electrical specs — returns 32 MHz

Agent: find_alternative("TPS54302", constraints="in_stock")
→ MP2315, TPS54331 ranked by package/spec match
```

The agent never sees a PDF. The engineer never uploads one.

## Tools

| Tool | Description |
|------|-------------|
| `search_parts` | Search for components by part number or keyword. Results merged by MPN with pricing and stock. |
| `search_datasheets` | Semantic search across all extracted datasheets. Natural language queries like "low-noise LDO with PSRR above 70dB". |
| `prefetch_datasheets` | Batch warm-up extraction for up to 20 parts. Fire-and-forget — reduces wait times. |
| `check_extraction_status` | Poll extraction progress after prefetch or read_datasheet. |
| `get_part_details` | Full component details — specs, parameters, pricing, and stock. |
| `read_datasheet` | Structured datasheet sections (summary, pinout, electrical, abs_max, package) or semantic search within a datasheet. |
| `compare_parts` | Compare 2–5 parts side by side on real datasheet specs. |
| `check_design_fit` | Validate operating conditions against datasheet limits. PASS/FAIL/WARNING per parameter. |
| `find_alternative` | Find alternative/substitute components by specs, package, or availability. |
| `analyze_image` | Vision AI analysis of datasheet images — graphs, package drawings, pin diagrams. |

## Prompts

Built-in prompt templates that guide the agent through common hardware engineering tasks:

| Prompt | Description |
|--------|-------------|
| `component-selection` | Walk through selecting a component: define requirements, search candidates, compare specs, validate design fit. |
| `bom-review` | Review a bill of materials: look up each part, check stock and lifecycle, flag risks, suggest alternatives. |
| `datasheet-deep-dive` | Deep-dive into a specific part: summarize, extract pinout, electrical specs, absolute max ratings, and application circuit. |
| `design-validation` | Validate a design: check each component against operating conditions, flag out-of-spec parameters. |
| `second-source` | Find second-source alternatives for a part: match package, specs, and availability across providers. |
| `interface-check` | Check electrical and protocol compatibility between two ICs on a shared bus (SPI, I2C, UART). Verifies VOH/VOL vs VIH/VIL, flags level-shifter needs, extracts protocol config (SPI mode, I2C address, pull-up values). |
| `firmware-kickstart` | Extract register map, init sequence, and protocol details from a peripheral IC datasheet. Generates a firmware integration guide with register writes, transaction examples, and common pitfalls. |
| `thermal-review` | Thermal and derating analysis: compare operating conditions against abs max AND recommended limits, estimate junction temperature, check SOA derating curves, flag exposed-pad requirements. |

## Resources

Data the server exposes for agent context:

| Resource | Description |
|----------|-------------|
| `sheetsdata://workflow` | Recommended tool workflow for component selection — search, evaluate, read datasheet, validate, compare. |
| `sheetsdata://tips/datasheet-pitfalls` | The 8 most common datasheet interpretation mistakes — abs max confusion, typical vs worst-case, thermal derating, voltage levels, I2C/SPI gotchas, decoupling, exposed pads, lifecycle risks. |
| `sheetsdata://tips/design-review-checklist` | Hardware design review checklist covering power supply, signal interfaces, component selection, and firmware integration. |

## Authentication — pick OAuth, fall back to API key

SheetsData supports two auth paths. Use whichever works best for your client; both bill against the same org.

| | **OAuth 2.0** | **API key** |
|---|---|---|
| Best for | Interactive MCP clients (Claude Desktop, Cursor, etc.) | CI, scripts, headless agents, or clients that don't speak MCP OAuth |
| What you do | Click *Connect* in your client → log in here → done | Generate a key in the dashboard, paste as a `Bearer` header |
| Setup | Just paste a URL | Paste a URL + a header |
| Discovery | Automatic via [RFC 8414](https://datatracker.ietf.org/doc/html/rfc8414) / [RFC 9728](https://datatracker.ietf.org/doc/html/rfc9728) | n/a |
| Spec compliance | PKCE-mandatory, dynamic client registration ([RFC 7591](https://datatracker.ietf.org/doc/html/rfc7591)), refresh-token rotation | RFC 6750 Bearer |
| Revoke | Per-client, from `/dashboard/keys` | Delete the key |

> **Recommended:** OAuth. It's a single URL paste, no copy-pasting secrets, and you can yank a connected app from the dashboard at any time.

## Quickest paths (one-click install)

If you use **Cursor** or **VS Code** you can install with a single click — the editor will pre-fill the SheetsData server config and prompt you to authorize on first use.

[![Install in Cursor](https://img.shields.io/badge/Install_in_Cursor-One_click-000?style=for-the-badge&logo=cursor)](cursor://anysphere.cursor-deeplink/mcp/install?name=SheetsData&config=eyJ1cmwiOiJodHRwczovL21jcC5zaGVldHNkYXRhLmNvbS9tY3AifQ==)
[![Install in VS Code](https://img.shields.io/badge/Install_in_VS_Code-One_click-007ACC?style=for-the-badge&logo=visualstudiocode)](vscode:mcp/install?%7B%22name%22%3A%22sheetsdata%22%2C%22type%22%3A%22http%22%2C%22url%22%3A%22https%3A//mcp.sheetsdata.com/mcp%22%7D)

For everything else, copy the snippet from the right section below.

## Install

### Claude Desktop

Open Claude Desktop → **Settings** → **Connectors** → **Add custom connector** at the bottom of the list.

| Field | Value |
|---|---|
| Name | `SheetsData` |
| URL | `https://mcp.sheetsdata.com/mcp` |

Click **Add**. Claude Desktop will open a browser tab to the SheetsData consent screen — pick the org to authorize, and you're done. Tools appear in Claude immediately.

> **Note**: The `claude_desktop_config.json` file does **not** support the OAuth flow on Claude Desktop. The Connectors UI is the right path for OAuth — only fall back to the JSON config if you want to use an API key instead.

<details>
<summary>Use an API key instead (via JSON config)</summary>

Open Claude Desktop → Settings → Developer → **Edit Config**, then add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "sheetsdata": {
      "url": "https://mcp.sheetsdata.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

Restart Claude Desktop. Get a key from [sheetsdata.com/dashboard/keys](https://sheetsdata.com/dashboard/keys).
</details>

### Claude Code

```bash
claude mcp add sheetsdata --transport http "https://mcp.sheetsdata.com/mcp"
```

Claude Code will print a one-time OAuth URL — open it, authorize, done.

<details>
<summary>Use an API key instead</summary>

```bash
claude mcp add sheetsdata \
  --transport http \
  "https://mcp.sheetsdata.com/mcp" \
  --header "Authorization: Bearer YOUR_API_KEY"
```
</details>

### Cursor

Click the [**Install in Cursor**](cursor://anysphere.cursor-deeplink/mcp/install?name=SheetsData&config=eyJ1cmwiOiJodHRwczovL21jcC5zaGVldHNkYXRhLmNvbS9tY3AifQ==) badge above, *or* add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "sheetsdata": {
      "url": "https://mcp.sheetsdata.com/mcp"
    }
  }
}
```

Restart Cursor → MCP panel → **SheetsData** → **Connect**.

<details>
<summary>Use an API key instead</summary>

```json
{
  "mcpServers": {
    "sheetsdata": {
      "url": "https://mcp.sheetsdata.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```
</details>

### VS Code (GitHub Copilot)

Click the [**Install in VS Code**](vscode:mcp/install?%7B%22name%22%3A%22sheetsdata%22%2C%22type%22%3A%22http%22%2C%22url%22%3A%22https%3A//mcp.sheetsdata.com/mcp%22%7D) badge above, *or* add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "sheetsdata": {
      "type": "http",
      "url": "https://mcp.sheetsdata.com/mcp"
    }
  }
}
```

VS Code will prompt you to authorize on first use.

<details>
<summary>Use an API key instead</summary>

```json
{
  "servers": {
    "sheetsdata": {
      "type": "http",
      "url": "https://mcp.sheetsdata.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```
</details>

### Windsurf

Add to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "sheetsdata": {
      "url": "https://mcp.sheetsdata.com/mcp"
    }
  }
}
```

Restart Windsurf and click Connect on the SheetsData entry.

<details>
<summary>Use an API key instead</summary>

```json
{
  "mcpServers": {
    "sheetsdata": {
      "url": "https://mcp.sheetsdata.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```
</details>

### Amp (Sourcegraph)

Add to your Amp settings:

```json
{
  "amp.mcpServers": {
    "sheetsdata": {
      "url": "https://mcp.sheetsdata.com/mcp"
    }
  }
}
```

Amp will run the OAuth flow on first use.

<details>
<summary>Use an API key instead</summary>

```json
{
  "amp.mcpServers": {
    "sheetsdata": {
      "url": "https://mcp.sheetsdata.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```
</details>

### Cline

> Cline doesn't yet support the MCP OAuth flow — use an API key.

In VS Code, open Cline → gear icon → **MCP Servers**:

```json
{
  "mcpServers": {
    "sheetsdata": {
      "url": "https://mcp.sheetsdata.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      },
      "disabled": false
    }
  }
}
```

### Zed

> Zed doesn't yet support the MCP OAuth flow — use an API key.

Add to Zed `settings.json`:

```json
{
  "context_servers": {
    "sheetsdata": {
      "settings": {
        "url": "https://mcp.sheetsdata.com/mcp",
        "headers": {
          "Authorization": "Bearer YOUR_API_KEY"
        }
      }
    }
  }
}
```

### Continue.dev

> Continue doesn't yet support the MCP OAuth flow — use an API key.

Add to `~/.continue/config.yaml`:

```yaml
mcpServers:
  - name: sheetsdata
    url: https://mcp.sheetsdata.com/mcp
    headers:
      Authorization: "Bearer YOUR_API_KEY"
```

### npx (stdio proxy for any client)

For clients that only support stdio transport:

```bash
SHEETSDATA_API_KEY=your_key npx @sheetsdata/mcp
```

## Need an API key?

1. Sign up at [sheetsdata.com/signup](https://sheetsdata.com/signup) (30 seconds, free credits)
2. Go to [Dashboard → API Keys](https://sheetsdata.com/dashboard/keys)
3. Click **Create key**, copy the token, paste it into your config

You can also manage OAuth-authorized apps from the same page — see who has connected, when, and revoke any of them with one click.

## Recommended Workflow

```
1. search_parts       → Find candidates by keyword or part number
2. get_part_details    → Evaluate pricing, stock, parameters
3. read_datasheet      → Get detailed specs (pinout, electrical, package)
4. check_design_fit    → Validate against your operating conditions
5. find_alternative    → Find substitutes if needed
6. compare_parts       → Side-by-side comparison of finalists
```

## Support

- Email: [support@octoco.ltd](mailto:support@octoco.ltd)
- Issues: [github.com/octoco-ltd/sheetsdata-mcp/issues](https://github.com/octoco-ltd/sheetsdata-mcp/issues)
- Website: [sheetsdata.com](https://sheetsdata.com)

## Disclaimer

SheetsData is currently in **public beta**. Data is extracted from publicly available manufacturer datasheets using automated tools including AI. It may contain errors, omissions, or inaccuracies.

**SheetsData and Octoco Ltd provide this data on an "as is" basis and make no warranties, express or implied, regarding the accuracy, completeness, or fitness for any particular purpose.** Always verify critical specifications against the official manufacturer datasheet before making design, purchasing, or manufacturing decisions.

By using this service, you acknowledge that:

- Extracted data may differ from the original manufacturer datasheet
- SheetsData is not a substitute for reviewing official documentation
- Octoco Ltd is not liable for any damages, losses, or design failures arising from the use of this data
- Features, APIs, and pricing are subject to change during the beta period

For terms of use, see [sheetsdata.com/terms](https://sheetsdata.com/terms).

## License

MIT
