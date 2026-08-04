import { tool, type Plugin, type PluginOptions } from "@opencode-ai/plugin";
import {
  crawl,
  news,
  search,
  sitemap,
  trending,
  type NewsService,
  type SearchService,
  type TimeRange,
  type TrendingService,
} from "search1api-cli/sdk";

function configuredApiKey(options: PluginOptions): string | undefined {
  return typeof options.apiKey === "string" && options.apiKey.length > 0
    ? options.apiKey
    : undefined;
}

export const Search1APIPlugin: Plugin = async (_input, options = {}) => {
  const apiKey = configuredApiKey(options);

  return {
    tool: {
      search1api_search: tool({
        description:
          "Search the live web for current facts, research, documentation, people, companies, products, and sources.",
        args: {
          query: tool.schema.string().describe("Search query."),
          maxResults: tool.schema.number().int().min(1).max(50).optional(),
          searchService: tool.schema
            .enum([
              "google",
              "bing",
              "duckduckgo",
              "yahoo",
              "x",
              "reddit",
              "github",
              "youtube",
              "arxiv",
              "wechat",
              "bilibili",
              "imdb",
              "wikipedia",
            ])
            .optional(),
          crawlResults: tool.schema.number().int().min(0).max(50).optional(),
          includeSites: tool.schema.array(tool.schema.string()).optional(),
          excludeSites: tool.schema.array(tool.schema.string()).optional(),
          timeRange: tool.schema.enum(["day", "month", "year"]).optional(),
        },
        async execute(args, context) {
          const data = await search(args.query, {
            apiKey,
            signal: context.abort,
            maxResults: args.maxResults,
            searchService: args.searchService as SearchService | undefined,
            crawlResults: args.crawlResults,
            includeSites: args.includeSites,
            excludeSites: args.excludeSites,
            timeRange: args.timeRange as TimeRange | undefined,
          });
          return JSON.stringify(data, null, 2);
        },
      }),
      search1api_news: tool({
        description: "Search current news and optionally retrieve full article content.",
        args: {
          query: tool.schema.string().describe("News query."),
          maxResults: tool.schema.number().int().min(1).max(50).optional(),
          searchService: tool.schema
            .enum(["google", "bing", "duckduckgo", "yahoo", "hackernews"])
            .optional(),
          crawlResults: tool.schema.number().int().min(0).max(50).optional(),
          includeSites: tool.schema.array(tool.schema.string()).optional(),
          excludeSites: tool.schema.array(tool.schema.string()).optional(),
          timeRange: tool.schema.enum(["day", "month", "year"]).optional(),
        },
        async execute(args, context) {
          const data = await news(args.query, {
            apiKey,
            signal: context.abort,
            maxResults: args.maxResults,
            searchService: args.searchService as NewsService | undefined,
            crawlResults: args.crawlResults,
            includeSites: args.includeSites,
            excludeSites: args.excludeSites,
            timeRange: args.timeRange as TimeRange | undefined,
          });
          return JSON.stringify(data, null, 2);
        },
      }),
      search1api_crawl: tool({
        description: "Retrieve clean readable content from a public URL.",
        args: {
          url: tool.schema.url().describe("Public page URL to retrieve."),
        },
        async execute({ url }, context) {
          const data = await crawl(url, { apiKey, signal: context.abort });
          return JSON.stringify(data, null, 2);
        },
      }),
      search1api_sitemap: tool({
        description: "Discover links related to a public URL or domain.",
        args: {
          url: tool.schema.url().describe("Public URL or domain to explore."),
        },
        async execute({ url }, context) {
          const data = await sitemap(url, { apiKey, signal: context.abort });
          return JSON.stringify(data, null, 2);
        },
      }),
      search1api_trending: tool({
        description: "Find trending repositories on GitHub or stories on Hacker News.",
        args: {
          service: tool.schema.enum(["github", "hackernews"]),
          maxResults: tool.schema.number().int().min(1).max(50).optional(),
        },
        async execute({ service, maxResults }, context) {
          const data = await trending(service as TrendingService, {
            apiKey,
            signal: context.abort,
            maxResults,
          });
          return JSON.stringify(data, null, 2);
        },
      }),
    },
  };
};

export default Search1APIPlugin;
