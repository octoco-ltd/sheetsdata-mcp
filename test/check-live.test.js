// Tests for scripts/check-live.mjs: reading prices and comparing the
// repo's listings with a server's list results. The network call itself
// is exercised only when the script is run (a release step).

import assert from "node:assert/strict";
import { test } from "node:test";
import { parityProblems, priceFromDescription, readmePrices, readRepoListings } from "../scripts/check-live.mjs";

test("priceFromDescription reads the price a tool description opens with", () => {
  assert.equal(priceFromDescription("Free. Start here."), "Free");
  assert.equal(priceFromDescription("Costs 2¢ per call. Reads a datasheet."), "2¢");
  assert.equal(priceFromDescription("Costs 10¢ per call. That is the upload fee."), "10¢");
  assert.equal(priceFromDescription("Reads a datasheet. Costs 2¢ per call."), null);
  assert.equal(priceFromDescription("Freely searches."), null);
  assert.equal(priceFromDescription(""), null);
});

test("readmePrices reads only the Tools table", () => {
  const readme = [
    "## Tools",
    "",
    "| Tool | Price | What it does |",
    "|------|------:|--------------|",
    "| `search_parts` | Free | Find parts. |",
    "| `read_datasheet` | 2¢ | Read a section. |",
    "",
    "## Prompts",
    "",
    "| `bom-review` | Review a BOM. |",
  ].join("\n");
  assert.deepEqual([...readmePrices(readme)], [
    ["search_parts", "Free"],
    ["read_datasheet", "2¢"],
  ]);
});

const repo = {
  tools: ["search_parts", "read_datasheet"],
  prices: new Map([
    ["search_parts", "Free"],
    ["read_datasheet", "2¢"],
  ]),
  prompts: ["bom-review"],
  resources: ["sheetsdata://workflow"],
};

const live = {
  tools: [
    { name: "search_parts", description: "Free. Start here." },
    { name: "read_datasheet", description: "Costs 2¢ per call. Reads a datasheet." },
  ],
  prompts: [{ name: "bom-review" }],
  resources: [{ uri: "sheetsdata://workflow" }],
};

test("parityProblems: matching listings have no problems, whatever the order", () => {
  assert.deepEqual(parityProblems({ ...live, tools: [...live.tools].reverse() }, repo), []);
});

test("parityProblems: a price change on the server is reported", () => {
  const changed = { ...live, tools: [live.tools[0], { name: "read_datasheet", description: "Costs 5¢ per call." }] };
  assert.deepEqual(parityProblems(changed, repo), ["tool read_datasheet: README says 2¢, the server says 5¢"]);
});

test("parityProblems: tools, prompts and resources only one side has are reported", () => {
  const changed = {
    tools: [...live.tools, { name: "new_tool", description: "Free. New." }],
    prompts: [],
    resources: [...live.resources, { uri: "sheetsdata://new" }],
  };
  assert.deepEqual(parityProblems(changed, repo), [
    "tool new_tool: served, but not listed",
    "prompt bom-review: listed, but not served",
    "resource sheetsdata://new: served, but not listed",
  ]);
});

test("parityProblems: a description without a price is reported, not read as free", () => {
  const changed = { ...live, tools: [live.tools[0], { name: "read_datasheet", description: "Reads a datasheet." }] };
  assert.deepEqual(parityProblems(changed, repo), [
    "tool read_datasheet: the server's description doesn't open with a price",
  ]);
});

test("the README prices every listed tool in the form the server states prices", () => {
  const { tools, prices } = readRepoListings();
  for (const name of tools) {
    assert.match(prices.get(name) ?? "", /^(Free|\d+¢)$/, `README price for ${name}`);
  }
});
