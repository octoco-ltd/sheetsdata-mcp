# SheetsData MCP

**Electronic component datasheets for AI agents** — specs, pinouts, package data on demand. No PDFs required.

[SheetsData](https://sheetsdata.com) is an MCP server that gives AI agents instant, structured access to electronic component data. One tool call returns the pinout. Another returns electrical specs. No PDFs. No uploads. No context window stuffing.

> **Beta** — SheetsData is currently in public beta. APIs, pricing, and features may change. See [Disclaimer](#disclaimer) below.

<p align="center">
  <a href="https://sheetsdata.com/signup">Get API Key</a> &nbsp;·&nbsp;
  <a href="https://sheetsdata.com">Website</a>
</p>

## Demo

```
Agent: search_parts("buck converter 3A 28V")
→ TPS54302, LM2596, MP2315 with stock & pricing from JLCPCB, Mouser, DigiKey

Agent: read_datasheet("TPS54302", section="pinout")
→ Pin table: BOOT(6), EN(5), FB(4), GND(1), SW(2), VIN(3)

Agent: check_design_fit("TPS54302", input_voltage=12, output_current=2)
→ PASS — all parameters within datasheet limits

Agent: find_alternative("TPS54302", constraints="in_stock,jlcpcb")
→ MP2315, TPS54331 ranked by package/spec match
```

The agent never sees a PDF. The engineer never uploads one.

## Tools

| Tool | Description |
|------|-------------|
| `search_parts` | Search by part number or keyword across JLCPCB, Mouser, DigiKey. Results merged by MPN with pricing and stock. |
| `search_datasheets` | Semantic search across all extracted datasheets. Natural language queries like "low-noise LDO with PSRR above 70dB". |
| `prefetch_datasheets` | Batch warm-up extraction for up to 20 parts. Fire-and-forget — reduces wait times. |
| `check_extraction_status` | Poll extraction progress after prefetch or read_datasheet. |
| `get_part_details` | Full component details — pricing, stock, parameters from all providers. |
| `read_datasheet` | Structured datasheet sections (summary, pinout, electrical, abs_max, package) or semantic search within a datasheet. |
| `compare_parts` | Compare 2–5 parts side by side with merged provider data. |
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

## Resources

Data the server exposes for agent context:

| Resource | Description |
|----------|-------------|
| `sheetsdata://providers` | List of active component data providers (JLCPCB, Mouser, DigiKey, Nexar) and their current status. |
| `sheetsdata://workflow` | Recommended tool workflow for component selection — search, evaluate, read datasheet, validate, compare. |

## Install

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

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

### Claude Code

```bash
claude mcp add sheetsdata \
  --transport http \
  "https://mcp.sheetsdata.com/mcp" \
  --header "Authorization: Bearer YOUR_API_KEY"
```

### Cursor

Add to `.cursor/mcp.json` in your project root:

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

Or use the deep link: `cursor://anysphere.cursor-deeplink/mcp/install?name=SheetsData&config=...`

### VS Code (GitHub Copilot)

Add to your VS Code `settings.json`:

```json
{
  "mcp": {
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
}
```

### Windsurf

Add to `~/.codeium/windsurf/mcp_config.json`:

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

### Cline

In VS Code, open Cline MCP Settings and add:

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

### Amp (Sourcegraph)

Add to Amp settings:

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

### Zed

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
SHEETSDATA_API_KEY=your_key npx sheetsdata-mcp
```

Or with the `--api-key` flag:

```bash
npx sheetsdata-mcp --api-key your_key
```

## Get Your API Key

1. Sign up at [sheetsdata.com/signup](https://sheetsdata.com/signup)
2. Go to [Dashboard → API Keys](https://sheetsdata.com/dashboard/keys)
3. Create a new key and paste it into the config above

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
