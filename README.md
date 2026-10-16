# SheetsData MCP

[![npm](https://img.shields.io/npm/v/@sheetsdata/mcp)](https://www.npmjs.com/package/@sheetsdata/mcp) [![MCP Badge](https://lobehub.com/badge/mcp/octoco-ltd-sheetsdata-mcp)](https://lobehub.com/mcp/octoco-ltd-sheetsdata-mcp) [![sheetsdata-mcp MCP server](https://glama.ai/mcp/servers/octoco-ltd/sheetsdata-mcp/badges/score.svg)](https://glama.ai/mcp/servers/octoco-ltd/sheetsdata-mcp)

[![sheetsdata-mcp MCP server](https://glama.ai/mcp/servers/octoco-ltd/sheetsdata-mcp/badges/card.svg)](https://glama.ai/mcp/servers/octoco-ltd/sheetsdata-mcp)

**Electronic component datasheets for AI agents** — pinouts, specs, package info and design checks from manufacturer PDFs.

[SheetsData](https://sheetsdata.com) is a hosted MCP server. Your agent finds parts across JLCPCB, Mouser and DigiKey, reads any section of a part's datasheet as text and tables, compares parts, checks a BOM, and checks your operating conditions against the datasheet's ratings. The agent never sees a PDF, and you don't have to find or paste one.

```
Server URL:  https://mcp.sheetsdata.com/mcp   (Streamable HTTP)
Sign-in:     MCP OAuth (browser), or an API key as "Authorization: Bearer <key>"
```

This repository holds the install configs, the [`@sheetsdata/mcp`](https://www.npmjs.com/package/@sheetsdata/mcp) stdio proxy for clients that only start local servers, and the Claude Desktop bundle. The server itself is a hosted service.

<p align="center">
  <a href="https://sheetsdata.com/signup">Create a free account</a> &nbsp;·&nbsp;
  <a href="#install">Install in your client</a> &nbsp;·&nbsp;
  <a href="https://sheetsdata.com/pricing">Pricing</a> &nbsp;·&nbsp;
  <a href="https://sheetsdata.com/help">Docs</a>
</p>

## What it looks like

"Is the TPS54302 fine with 24 V in and 2.5 A out?"

```
check_design_fit("TPS54302", input_voltage=24, output_current=2.5)

overall: WARNING
  input_voltage  24 V  PASS  within the recommended range 4.5–28 V (14.3% margin)
                             datasheet row: "| V I |  | 4.5 | 28 | V |"
  unmatched: output_current
```

A condition the tool can't find a limit for is listed as `unmatched` and keeps the verdict at WARNING: a clean PASS means every condition was checked against the datasheet.

"Buck converters that take 24 V in and give at least 2 A" (free):

```
find_parts("buck converter", constraints=[vin_max >= 24 V, iout >= 2 A])

AP63357DV-7       32 V  3.5 A  pass@digikey   stock: DigiKey 49,457   datasheet: ready
LM2596S-5.0/NOPB  40 V  3 A    pass@digikey   stock: DigiKey 4,460    datasheet: ready
LMR33630ADDAR     36 V  3 A    pass@digikey   stock: JLCPCB 17,768    datasheet: ready
```

```
read_datasheet("TPS54302", section="pinout")
→ GND (1), SW (2), VIN (3), FB (4), EN (5), BOOT (6)
```

## Tools

Prices are per call and the same on every plan. A call that fails is not charged. Current prices are on [sheetsdata.com/pricing](https://sheetsdata.com/pricing).

| Tool | Price | What it does |
|------|------:|--------------|
| `search_parts` | Free | Find parts by part number or keyword across JLCPCB, Mouser and DigiKey, merged by MPN, with stock, price and datasheet status from each. |
| `find_parts` | Free | Find parts that meet numeric specs with units (e.g. Vin ≥ 24 V, Iout ≥ 2 A), package or stock; each constraint reports pass, fail or unknown with its source. |
| `get_part_details` | 3¢ | A part's key parameters, package, pricing, stock and datasheet status, by MPN or LCSC number. |
| `check_bom` | 3¢ | Check up to 20 BOM lines for lifecycle, stock against quantity, single-distributor sourcing, datasheet status and stale prices. |
| `prefetch_datasheets` | 1¢ | Start reading up to 20 datasheets at once, so a whole BOM is ready before you ask about it. |
| `check_extraction_status` | Free | Report how far a datasheet that is still being read has got. |
| `read_datasheet` | 10¢ | Any section of a datasheet as text and tables (summary, pinout, electrical, absolute maximum ratings, package, or any heading), or a search within one datasheet. |
| `search_datasheets` | 2¢ | Search every datasheet read so far by meaning, e.g. "LDO with PSRR above 70 dB". |
| `compare_parts` | 8¢ | Compare 2–5 parts side by side: parameters, package, pricing, stock and datasheet summaries. |
| `find_alternative` | 6¢ | Find drop-in and functional substitutes for a part, ranked by spec, package and stock match. |
| `check_design_fit` | 12¢ | Check operating conditions against the absolute maximum and recommended ratings: PASS, WARNING or FAIL per condition, with the datasheet row it used. |
| `analyze_image` | 10¢ | Read values off a datasheet figure: a characteristic graph, package drawing or pin diagram. |
| `request_datasheet_upload` | Free | Get a private upload link for a datasheet PDF we couldn't find. |
| `confirm_datasheet_upload` | 50¢ | Verify the uploaded PDF (hash, valid PDF, MPN on page one) and read it into your organisation's private library. Not charged if the file fails the checks. |

Pass manufacturer part numbers (`TPS54302`, `STM32F446RCT6`) or LCSC numbers (`C2837938`), not values like `100nF` or reference designators like `R1`. A datasheet nobody has asked for yet is read on first request (poll `check_extraction_status`); after that it is cached for everyone.

## Prompts

Built-in prompts that walk the agent through common hardware tasks:

| Prompt | What it does |
|--------|--------------|
| `component-selection` | Select a component: define requirements, search candidates, compare specs, validate design fit. |
| `bom-review` | Review a bill of materials: look up each part, check stock and lifecycle, flag risks, suggest alternatives. |
| `datasheet-deep-dive` | Summarise a part and extract its pinout, electrical specs, absolute maximum ratings and application circuit. |
| `design-validation` | Check each component against its operating conditions and flag out-of-spec parameters. |
| `second-source` | Find second-source alternatives that match package, specs and availability. |
| `interface-check` | Check electrical and protocol compatibility between two ICs on a shared bus (SPI, I2C, UART): logic levels, timing, pull-ups, level shifters. |
| `firmware-kickstart` | Extract the register map, initialisation sequence and protocol details of a peripheral IC into a firmware integration guide. |
| `thermal-review` | Thermal and derating analysis: absolute maximum and recommended limits, junction temperature from RθJA, SOA derating, exposed-pad needs. |

## Resources

| Resource | What it holds |
|----------|---------------|
| `sheetsdata://workflow` | The recommended tool order for component selection and design validation. |
| `sheetsdata://tips/datasheet-pitfalls` | The eight most common datasheet reading mistakes: absolute maximum vs recommended, typical vs worst case, thermal derating, logic levels, I2C/SPI gotchas, decoupling, exposed pads, lifecycle. |
| `sheetsdata://tips/design-review-checklist` | A hardware design review checklist (power, signal interfaces, component selection, firmware), pointing at the tool or prompt for each check. |

## Pricing

- **Free to start.** A new account gets $5 of credit, no card needed ($20 more when you add a card). Searching (`search_parts`, `find_parts`) is free.
- **Trial** is pay as you go from a prepaid balance: 5 new datasheets a day (datasheets already read are unlimited), 30 requests a minute.
- **Pro** is $39 a month minimum, with your calls counting toward it: no daily cap on new datasheets, higher rate limits and a private parts library.

Plans, limits and fees: [sheetsdata.com/pricing](https://sheetsdata.com/pricing).

## Authentication

Use whichever your client supports; both bill the same organisation.

| | **OAuth (recommended)** | **API key** |
|---|---|---|
| Best for | Interactive clients | CI, scripts, headless agents, clients without MCP OAuth |
| What you do | Add the URL, then sign in to SheetsData in the browser tab that opens | Create a key at [sheetsdata.com/dashboard/keys](https://sheetsdata.com/dashboard/keys) and send `Authorization: Bearer <key>` |
| Standards | OAuth 2.1 with PKCE, dynamic client registration ([RFC 7591](https://datatracker.ietf.org/doc/html/rfc7591)), discovery ([RFC 8414](https://datatracker.ietf.org/doc/html/rfc8414), [RFC 9728](https://datatracker.ietf.org/doc/html/rfc9728)) | Bearer token ([RFC 6750](https://datatracker.ietf.org/doc/html/rfc6750)) |
| Revoke | Per app, from [the dashboard](https://sheetsdata.com/dashboard/keys) | Delete the key |

If a client asks how to register an OAuth client, choose automatic (dynamic) registration; SheetsData doesn't support client ID metadata documents yet.

## Install

One-click installs (sign in on first use):

[![Install in Cursor](https://img.shields.io/badge/Install_in-Cursor-000?style=for-the-badge&logo=cursor)](https://cursor.com/install-mcp?name=sheetsdata&config=eyJ1cmwiOiJodHRwczovL21jcC5zaGVldHNkYXRhLmNvbS9tY3AifQ%3D%3D)
[![Install in VS Code](https://img.shields.io/badge/Install_in-VS_Code-007ACC?style=for-the-badge&logo=visualstudiocode)](https://insiders.vscode.dev/redirect/mcp/install?name=sheetsdata&config=%7B%22type%22%3A%22http%22%2C%22url%22%3A%22https%3A%2F%2Fmcp.sheetsdata.com%2Fmcp%22%7D)
[![Install in VS Code Insiders](https://img.shields.io/badge/Install_in-VS_Code_Insiders-24bfa5?style=for-the-badge&logo=visualstudiocode)](https://insiders.vscode.dev/redirect/mcp/install?name=sheetsdata&config=%7B%22type%22%3A%22http%22%2C%22url%22%3A%22https%3A%2F%2Fmcp.sheetsdata.com%2Fmcp%22%7D&quality=insiders)
[![Install in Kiro](https://img.shields.io/badge/Install_in-Kiro-7B3FE4?style=for-the-badge)](https://kiro.dev/launch/mcp/add?name=sheetsdata&config=%7B%22url%22%3A%22https%3A%2F%2Fmcp.sheetsdata.com%2Fmcp%22%7D)
[![Download .mcpb for Claude Desktop](https://img.shields.io/badge/Download_.mcpb-Claude_Desktop-D97757?style=for-the-badge&logo=anthropic)](https://github.com/octoco-ltd/sheetsdata-mcp/releases/latest)

Every client below was checked against its own documentation on 2026-10-16 (linked in each section). In the snippets, replace `YOUR_API_KEY` with a key from [sheetsdata.com/dashboard/keys](https://sheetsdata.com/dashboard/keys).

- [Claude (claude.ai and Claude Desktop)](#claude-claudeai-and-claude-desktop)
- [Claude Code](#claude-code)
- [ChatGPT](#chatgpt)
- [OpenAI Codex](#openai-codex)
- [Cursor](#cursor)
- [VS Code (GitHub Copilot)](#vs-code-github-copilot)
- [GitHub Copilot CLI](#github-copilot-cli)
- [Gemini CLI](#gemini-cli)
- [Google Antigravity](#google-antigravity)
- [Windsurf (Devin Desktop)](#windsurf-devin-desktop)
- [Zed](#zed)
- [Cline](#cline)
- [Roo Code](#roo-code)
- [Continue](#continue)
- [Goose](#goose)
- [Amp](#amp)
- [Kiro](#kiro)
- [JetBrains (Junie and AI Assistant)](#jetbrains-junie-and-ai-assistant)
- [opencode](#opencode)
- [LM Studio](#lm-studio)
- [Warp](#warp)
- [Any client that only starts local servers](#any-client-that-only-starts-local-servers)
- [Your own code](#your-own-code)

### Claude (claude.ai and Claude Desktop)

**Custom connector (OAuth).** Open **Customize → Connectors**, click **+ Add**, then **Add custom connector**. Name it `SheetsData`, paste `https://mcp.sheetsdata.com/mcp` and click **Continue**. Under **OAuth client**, choose **Register automatically**: SheetsData doesn't support the default "Use Claude's published identity" option yet. Click **Add**, then **Connect**, and sign in to SheetsData in the browser tab that opens. On Team and Enterprise plans an owner adds it under **Organization settings → Connectors → Add → Custom → Web**. Free plans can add one custom connector.

**Claude Desktop bundle.** Download `sheetsdata-x.y.z.mcpb` from the [latest release](https://github.com/octoco-ltd/sheetsdata-mcp/releases/latest) and drop it onto the Claude Desktop window. Leave the API key field blank to sign in with OAuth, or paste a key.

<details>
<summary>Use an API key instead</summary>

In the custom connector dialog, add the request header `Authorization: Bearer YOUR_API_KEY`. Or, in Claude Desktop, open **Settings → Developer → Edit Config** and add the stdio proxy (needs Node.js; `claude_desktop_config.json` only starts local servers, so it cannot hold the remote URL):

```json
{
  "mcpServers": {
    "sheetsdata": {
      "command": "npx",
      "args": ["-y", "@sheetsdata/mcp"],
      "env": { "SHEETSDATA_API_KEY": "YOUR_API_KEY" }
    }
  }
}
```

Restart Claude. The proxy sends the key in a header, never on the command line.
</details>

Docs: [Custom connectors using remote MCP](https://support.claude.com/en/articles/11175166-getting-started-with-custom-connectors-using-remote-mcp)

### Claude Code

```bash
claude mcp add --transport http sheetsdata https://mcp.sheetsdata.com/mcp
```

Start Claude Code, run `/mcp`, choose **sheetsdata → Authenticate** and sign in (or run `claude mcp login sheetsdata` from your shell). Add `--scope user` to have SheetsData in every project.

<details>
<summary>Use an API key instead</summary>

```bash
claude mcp add --transport http sheetsdata https://mcp.sheetsdata.com/mcp \
  --header "Authorization: Bearer YOUR_API_KEY"
```

In a project's `.mcp.json`, give the entry `"type": "http"`; an entry without a type is treated as a local server.
</details>

Docs: [Claude Code MCP](https://code.claude.com/docs/en/mcp)

### ChatGPT

On the web, open [chatgpt.com/plugins](https://chatgpt.com/plugins), click **+**, then **Add custom MCP server**. Name it `SheetsData`, paste `https://mcp.sheetsdata.com/mcp` and choose **OAuth**. Accept the warning, choose **Create as a plugin**, install it and sign in to SheetsData. Your plan and workspace settings decide whether custom servers are available. ChatGPT cannot send an API key.

Docs: [Custom MCP servers in ChatGPT](https://developers.openai.com/api/docs/guides/custom-mcp-server)

### OpenAI Codex

```bash
codex mcp add sheetsdata --url https://mcp.sheetsdata.com/mcp
codex mcp login sheetsdata
```

The second command opens your browser to sign in. The Codex IDE extension and app read the same `~/.codex/config.toml`.

<details>
<summary>Use an API key instead</summary>

Add to `~/.codex/config.toml`, and set `SHEETSDATA_API_KEY` in your shell:

```toml
[mcp_servers.sheetsdata]
url = "https://mcp.sheetsdata.com/mcp"
bearer_token_env_var = "SHEETSDATA_API_KEY"
```
</details>

Docs: [Codex MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)

### Cursor

Click [**Install in Cursor**](https://cursor.com/install-mcp?name=sheetsdata&config=eyJ1cmwiOiJodHRwczovL21jcC5zaGVldHNkYXRhLmNvbS9tY3AifQ%3D%3D), or add to `~/.cursor/mcp.json` (every project) or `.cursor/mcp.json` (one project):

```json
{
  "mcpServers": {
    "sheetsdata": {
      "url": "https://mcp.sheetsdata.com/mcp"
    }
  }
}
```

Cursor opens your browser to sign in when it first connects.

<details>
<summary>Use an API key instead</summary>

```json
{
  "mcpServers": {
    "sheetsdata": {
      "url": "https://mcp.sheetsdata.com/mcp",
      "headers": { "Authorization": "Bearer YOUR_API_KEY" }
    }
  }
}
```
</details>

Docs: [Cursor MCP](https://cursor.com/docs/context/mcp)

### VS Code (GitHub Copilot)

Click [**Install in VS Code**](https://insiders.vscode.dev/redirect/mcp/install?name=sheetsdata&config=%7B%22type%22%3A%22http%22%2C%22url%22%3A%22https%3A%2F%2Fmcp.sheetsdata.com%2Fmcp%22%7D), run `code --add-mcp '{"name":"sheetsdata","type":"http","url":"https://mcp.sheetsdata.com/mcp"}'`, or add to `.vscode/mcp.json` (run **MCP: Open User Configuration** for every workspace):

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

Start the server; VS Code asks you to sign in. Use it from Copilot Chat in agent mode.

<details>
<summary>Use an API key instead</summary>

VS Code asks for the key the first time the server starts and keeps it out of the file:

```json
{
  "inputs": [
    { "type": "promptString", "id": "sheetsdata-key", "description": "SheetsData API key", "password": true }
  ],
  "servers": {
    "sheetsdata": {
      "type": "http",
      "url": "https://mcp.sheetsdata.com/mcp",
      "headers": { "Authorization": "Bearer ${input:sheetsdata-key}" }
    }
  }
}
```
</details>

Docs: [VS Code MCP configuration](https://code.visualstudio.com/docs/agents/reference/mcp-configuration)

### GitHub Copilot CLI

```bash
copilot mcp add --transport http sheetsdata https://mcp.sheetsdata.com/mcp
```

Or run `/mcp add` in a session, choose HTTP and paste the URL. Copilot CLI signs in with OAuth when the server asks.

<details>
<summary>Use an API key instead</summary>

```bash
copilot mcp add --transport http sheetsdata https://mcp.sheetsdata.com/mcp \
  --header "Authorization: Bearer YOUR_API_KEY"
```
</details>

Docs: [Adding MCP servers to Copilot CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-mcp-servers)

### Gemini CLI

```bash
gemini mcp add --transport http --scope user sheetsdata https://mcp.sheetsdata.com/mcp
```

Start Gemini CLI, run `/mcp auth sheetsdata` and sign in.

<details>
<summary>Use an API key instead</summary>

```bash
gemini mcp add --transport http --scope user \
  --header "Authorization: Bearer YOUR_API_KEY" \
  sheetsdata https://mcp.sheetsdata.com/mcp
```

Editing `~/.gemini/settings.json` by hand? Use `"httpUrl"` for the address; `"url"` means the older SSE transport.
</details>

Docs: [Gemini CLI MCP servers](https://geminicli.com/docs/tools/mcp-server)

### Google Antigravity

Open the **…** menu → **MCP Servers** → **Manage MCP Servers** → **View raw config** (`~/.gemini/config/mcp_config.json`, or `.agents/mcp_config.json` in a workspace) and add:

```json
{
  "mcpServers": {
    "sheetsdata": {
      "serverUrl": "https://mcp.sheetsdata.com/mcp"
    }
  }
}
```

Antigravity needs `serverUrl`; it rejects `url`. Then open **Agent settings → Customizations** and click **Authenticate** next to sheetsdata. For an API key, add `"headers": { "Authorization": "Bearer YOUR_API_KEY" }` to the entry.

Docs: [Antigravity MCP](https://antigravity.google/docs/mcp)

### Windsurf (Devin Desktop)

In the Cascade panel, open the **…** menu → **MCPs** → **Open MCP config file** (`~/.config/devin/mcp_config.json`; `%APPDATA%\devin\mcp_config.json` on Windows; older Windsurf versions use `~/.codeium/windsurf/mcp_config.json`) and add:

```json
{
  "mcpServers": {
    "sheetsdata": {
      "serverUrl": "https://mcp.sheetsdata.com/mcp"
    }
  }
}
```

You sign in to SheetsData in your browser when it connects. For an API key, add `"headers": { "Authorization": "Bearer YOUR_API_KEY" }` to the entry.

Docs: [Cascade MCP](https://docs.devin.ai/desktop/cascade/mcp)

### Zed

Add to your Zed `settings.json` (or **Settings → AI → MCP Servers → Add Server → Add Remote Server**):

```json
{
  "context_servers": {
    "sheetsdata": {
      "url": "https://mcp.sheetsdata.com/mcp"
    }
  }
}
```

Zed asks you to sign in. For an API key, add `"headers": { "Authorization": "Bearer YOUR_API_KEY" }` to the entry.

Docs: [Zed MCP](https://zed.dev/docs/ai/mcp)

### Cline

Open **MCP Servers → Remote Servers**, name it `SheetsData`, paste `https://mcp.sheetsdata.com/mcp`, choose **Streamable HTTP** and click **Add Server**; complete the browser sign-in when prompted. In Cline CLI, run `cline mcp` and choose **Authorize OAuth** for sheetsdata.

<details>
<summary>Use an API key instead</summary>

Open **MCP Servers → Configure → Configure MCP Servers** (`cline_mcp_settings.json`) and add the entry below. Without `"type"`, Cline assumes SSE.

```json
{
  "mcpServers": {
    "sheetsdata": {
      "type": "streamableHttp",
      "url": "https://mcp.sheetsdata.com/mcp",
      "headers": { "Authorization": "Bearer YOUR_API_KEY" }
    }
  }
}
```

Or from Cline CLI: `cline mcp add sheetsdata https://mcp.sheetsdata.com/mcp --transport http --header "Authorization: Bearer YOUR_API_KEY" --yes`
</details>

Docs: [Cline MCP](https://docs.cline.bot/mcp/mcp-overview)

### Roo Code

Roo Code's docs don't describe MCP OAuth, so use an API key. Open **MCP → Edit Global MCP** (`mcp_settings.json`) or the project's `.roo/mcp.json`:

```json
{
  "mcpServers": {
    "sheetsdata": {
      "type": "streamable-http",
      "url": "https://mcp.sheetsdata.com/mcp",
      "headers": { "Authorization": "Bearer YOUR_API_KEY" }
    }
  }
}
```

Docs: [Using MCP in Roo Code](https://roocodeinc.github.io/Roo-Code/features/mcp/using-mcp-in-roo)

### Continue

Continue's docs don't describe MCP OAuth, so use an API key. Save as `.continue/mcpServers/sheetsdata.yaml` in your workspace and add `SHEETSDATA_API_KEY` to your Continue secrets:

```yaml
name: SheetsData
version: 0.0.1
schema: v1
mcpServers:
  - name: SheetsData
    type: streamable-http
    url: https://mcp.sheetsdata.com/mcp
    requestOptions:
      headers:
        Authorization: "Bearer ${{ secrets.SHEETSDATA_API_KEY }}"
```

Docs: [Continue MCP](https://docs.continue.dev/customize/deep-dives/mcp)

### Goose

In Goose Desktop, open **Extensions → Add custom extension** and choose Streamable HTTP with the URL `https://mcp.sheetsdata.com/mcp`; in the CLI, run `goose configure` → **Add Extension** → **Remote Extension (Streamable HTTP)**. Goose runs the OAuth sign-in when it connects. Or add to `~/.config/goose/config.yaml`:

```yaml
extensions:
  sheetsdata:
    name: SheetsData
    type: streamable_http
    uri: https://mcp.sheetsdata.com/mcp
    enabled: true
    timeout: 300
```

For an API key, add `headers: { Authorization: "Bearer YOUR_API_KEY" }` to the entry.

Docs: [Using extensions in Goose](https://goose-docs.ai/docs/getting-started/using-extensions)

### Amp

```bash
amp mcp add sheetsdata https://mcp.sheetsdata.com/mcp
```

Amp opens your browser to sign in.

<details>
<summary>Use an API key instead</summary>

Add to `~/.config/amp/settings.json` (or `.amp/settings.json` in a project, then run `amp mcp approve sheetsdata`):

```json
{
  "amp.mcpServers": {
    "sheetsdata": {
      "url": "https://mcp.sheetsdata.com/mcp",
      "headers": { "Authorization": "Bearer YOUR_API_KEY" }
    }
  }
}
```
</details>

Docs: [Amp MCP](https://ampcode.com/docs/customize/mcp)

### Kiro

Click [**Install in Kiro**](https://kiro.dev/launch/mcp/add?name=sheetsdata&config=%7B%22url%22%3A%22https%3A%2F%2Fmcp.sheetsdata.com%2Fmcp%22%7D), or add to `~/.kiro/settings/mcp.json` (or `.kiro/settings/mcp.json` in a workspace):

```json
{
  "mcpServers": {
    "sheetsdata": {
      "url": "https://mcp.sheetsdata.com/mcp"
    }
  }
}
```

Kiro asks you to sign in. For an API key, add `"headers": { "Authorization": "Bearer YOUR_API_KEY" }` to the entry.

Docs: [Kiro MCP configuration](https://kiro.dev/docs/mcp/configuration/)

### JetBrains (Junie and AI Assistant)

**Junie** (IDE and CLI): add to `~/.junie/mcp/mcp.json` (or `.junie/mcp/mcp.json` in a project), then run `/mcp` and choose **Authorize**. For an API key, add `"headers": { "Authorization": "Bearer YOUR_API_KEY" }`.

```json
{
  "mcpServers": {
    "sheetsdata": {
      "url": "https://mcp.sheetsdata.com/mcp"
    }
  }
}
```

**AI Assistant**: its docs describe neither OAuth nor headers for remote servers, so run the local proxy. Open **Settings → Tools → AI Assistant → Model Context Protocol (MCP) → Add** and paste the [stdio entry](#any-client-that-only-starts-local-servers) below.

Docs: [Junie MCP](https://junie.jetbrains.com/docs/junie-cli-mcp-configuration.html), [AI Assistant MCP](https://www.jetbrains.com/help/ai-assistant/mcp.html)

### opencode

Add to `opencode.json`:

```json
{
  "mcp": {
    "sheetsdata": {
      "type": "remote",
      "url": "https://mcp.sheetsdata.com/mcp",
      "enabled": true
    }
  }
}
```

opencode signs in automatically, or run `opencode mcp auth sheetsdata`. For an API key, add `"headers": { "Authorization": "Bearer YOUR_API_KEY" }` to the entry.

Docs: [opencode MCP servers](https://opencode.ai/docs/mcp-servers/)

### LM Studio

LM Studio's docs don't describe MCP OAuth, so use an API key. Open the **Program** tab → **Install** → **Edit mcp.json**:

```json
{
  "mcpServers": {
    "sheetsdata": {
      "url": "https://mcp.sheetsdata.com/mcp",
      "headers": { "Authorization": "Bearer YOUR_API_KEY" }
    }
  }
}
```

Docs: [LM Studio MCP](https://lmstudio.ai/docs/app/mcp)

### Warp

Open **Settings → Agents → MCP servers → + Add** and paste:

```json
{
  "sheetsdata": {
    "url": "https://mcp.sheetsdata.com/mcp"
  }
}
```

Warp opens your browser to sign in when the server starts. For an API key, add `"headers": { "Authorization": "Bearer YOUR_API_KEY" }` to the entry.

Docs: [Warp MCP](https://docs.warp.dev/agents/capabilities/mcp/)

### Any client that only starts local servers

The `@sheetsdata/mcp` package (Node.js 18+) proxies stdio to the hosted server. Without `SHEETSDATA_API_KEY` it opens your browser to sign in with OAuth and caches the token.

```json
{
  "mcpServers": {
    "sheetsdata": {
      "command": "npx",
      "args": ["-y", "@sheetsdata/mcp"],
      "env": { "SHEETSDATA_API_KEY": "YOUR_API_KEY" }
    }
  }
}
```

From a shell: `SHEETSDATA_API_KEY=YOUR_API_KEY npx -y @sheetsdata/mcp`, or `npx -y @sheetsdata/mcp --api-key YOUR_API_KEY`.

### Your own code

Connect with the [MCP TypeScript SDK](https://modelcontextprotocol.io/docs/sdk) over Streamable HTTP (the SDK can also run the OAuth flow):

```ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const transport = new StreamableHTTPClientTransport(new URL("https://mcp.sheetsdata.com/mcp"), {
  requestInit: { headers: { Authorization: "Bearer YOUR_API_KEY" } },
});
const client = new Client({ name: "my-agent", version: "1.0.0" });
await client.connect(transport);

const result = await client.callTool({ name: "search_parts", arguments: { query: "TPS54302" } });
```

## Recommended workflow

```
1. search_parts / find_parts → candidates by part number, keyword or spec
2. get_part_details          → parameters, package, pricing, stock
3. read_datasheet            → "summary" first, then the sections you need
4. check_design_fit          → your operating conditions against the ratings
5. find_alternative          → substitutes, if needed
6. compare_parts             → finalists side by side
7. check_bom                 → lifecycle, stock and sourcing for the whole BOM
```

## Support

- Email: [support@sheetsdata.com](mailto:support@sheetsdata.com)
- Issues: [github.com/octoco-ltd/sheetsdata-mcp/issues](https://github.com/octoco-ltd/sheetsdata-mcp/issues)
- Docs: [sheetsdata.com/help](https://sheetsdata.com/help)

## Disclaimer

Data is extracted from publicly available manufacturer datasheets by automated tools, including AI. It may contain errors, omissions or inaccuracies.

**SheetsData and Octoco Ltd provide this data on an "as is" basis and make no warranties, express or implied, regarding its accuracy, completeness or fitness for any particular purpose.** Always verify critical specifications against the official manufacturer datasheet before making design, purchasing or manufacturing decisions.

By using this service, you acknowledge that:

- Extracted data may differ from the original manufacturer datasheet
- SheetsData is not a substitute for reviewing official documentation
- Octoco Ltd is not liable for any damages, losses, or design failures arising from the use of this data
- Features, APIs and pricing may change

For terms of use, see [sheetsdata.com/terms](https://sheetsdata.com/terms).

## License

MIT (this repository: install configs, the npm proxy and the Claude Desktop bundle). The hosted service is covered by the [terms of use](https://sheetsdata.com/terms).
