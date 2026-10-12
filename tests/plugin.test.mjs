import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import plugin from "../dist/index.js";

const context = {
  sessionID: "test-session",
  messageID: "test-message",
  agent: "test-agent",
  directory: process.cwd(),
  worktree: process.cwd(),
  abort: new AbortController().signal,
  metadata() {},
  async ask() {},
};

test("exposes the OpenCode server plugin target", async () => {
  const packageJson = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8")
  );
  assert.equal(packageJson.exports["./server"].import, "./dist/index.js");
  assert.equal(packageJson.exports["./server"].types, "./dist/index.d.ts");
});

test("registers all Search1API tools", async () => {
  const hooks = await plugin({});
  assert.deepEqual(Object.keys(hooks.tool ?? {}), [
    "search1api_search",
    "search1api_news",
    "search1api_ask",
    "search1api_crawl",
    "search1api_sitemap",
    "search1api_trending",
  ]);
});

test("search tool forwards arguments and configured API key", async () => {
  const originalFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (input, init) => {
    captured = { input: String(input), init };
    return new Response(JSON.stringify({ results: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const hooks = await plugin({}, { apiKey: "plugin-key" });
    const output = await hooks.tool.search1api_search.execute(
      { query: "OpenCode plugins", maxResults: 3, searchService: "github" },
      context
    );
    assert.equal(captured.input, "https://api.search1api.com/search");
    assert.equal(
      new Headers(captured.init.headers).get("Authorization"),
      "Bearer plugin-key"
    );
    assert.deepEqual(JSON.parse(captured.init.body), {
      query: "OpenCode plugins",
      max_results: 3,
      search_service: "github",
      crawl_results: 0,
    });
    assert.deepEqual(JSON.parse(output), { results: [] });
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test("current engines, week and pagination reach the API and preserve metadata", async (context) => {
  const hooks = await plugin({}, { apiKey: "plugin-key" });
  const wire = { results: [{ title: "Repo", link: "https://example.com", snippet: "s", published_date: "2026-10-12", metadata: { stars: 0 } }] };
  const requests = [];
  context.mock.method(globalThis, "fetch", async (input, init) => {
    requests.push({ url: String(input), body: JSON.parse(init.body) });
    return Response.json(wire);
  });
  for (const searchService of ["bingcn", "yandex", "grokipedia"]) {
    hooks.tool.search1api_search.args.searchService.parse(searchService);
    const output = await hooks.tool.search1api_search.execute({ query: "q", searchService, timeRange: "week", page: 2 }, contextForTool());
    assert.deepEqual(JSON.parse(output), wire);
    assert.equal(requests.at(-1).body.search_service, searchService);
    assert.equal(requests.at(-1).body.time_range, "week");
    assert.equal(requests.at(-1).body.page, 2);
  }
  assert.throws(() => hooks.tool.search1api_search.args.searchService.parse("sogou"));
});

function contextForTool() { return { ...context, abort: new AbortController().signal }; }

test("ask sends only query and preserves intent, source, relevance and errors", async (context) => {
  const hooks = await plugin({}, { apiKey: "plugin-key" });
  const wire = { query: "Bun this week", intent: { search_query: "Bun", sources: ["github"], time_range: "week" }, results: [{ title: "Bun", link: "https://example.com", snippet: "s", source: "github", relevance: 0.9 }], errors: [] };
  let body, signal;
  context.mock.method(globalThis, "fetch", async (input, init) => {
    assert.equal(String(input), "https://api.search1api.com/ask");
    body = JSON.parse(init.body); signal = init.signal;
    return Response.json(wire);
  });
  const toolContext = contextForTool();
  const output = await hooks.tool.search1api_ask.execute({ query: "Bun this week", maxResults: 2 }, toolContext);
  assert.deepEqual(body, { query: "Bun this week" });
  assert.equal(signal, toolContext.abort);
  assert.deepEqual(JSON.parse(output), wire);
  assert.deepEqual(Object.keys(hooks.tool.search1api_ask.args), ["query"]);
  assert.throws(() => hooks.tool.search1api_ask.args.query.parse(" "));
});
