import assert from "node:assert/strict";
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

test("registers all Search1API tools", async () => {
  const hooks = await plugin({});
  assert.deepEqual(Object.keys(hooks.tool ?? {}), [
    "search1api_search",
    "search1api_news",
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
