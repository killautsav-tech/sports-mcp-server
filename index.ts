#!/usr/bin/env node

/**
 * Sports MCP Server
 *
 * Combines The Odds API (multi-sport odds, scores, lines) and
 * SportMonks Football API v3 (soccer fixtures, stats, standings, xG, predictions)
 * into a single MCP server for Claude Desktop and Claude Code.
 *
 * Environment variables:
 *   ODDS_API_KEY      — Your The Odds API key
 *   SPORTMONKS_TOKEN  — Your SportMonks API token
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { oddsTools } from "./odds-api.js";
import { sportmonksTools } from "./sportmonks.js";

// ── Read API keys from environment ──

const ODDS_API_KEY = process.env.ODDS_API_KEY ?? "";
const SPORTMONKS_TOKEN = process.env.SPORTMONKS_TOKEN ?? "";

// ── Create server ──

const server = new McpServer({
  name: "sports-data",
  version: "1.0.0",
});

// ── Register The Odds API tools ──

for (const tool of oddsTools) {
  server.tool(
    tool.name,
    tool.description,
    tool.schema.shape,
    async (args) => {
      if (!ODDS_API_KEY) {
        return {
          content: [
            {
              type: "text" as const,
              text: "❌ ODDS_API_KEY environment variable is not set. Please set it in your Claude Desktop config or environment.",
            },
          ],
        };
      }
      try {
        const result = await tool.handler(args as Record<string, unknown>, ODDS_API_KEY);
        return { content: [{ type: "text" as const, text: result }] };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text" as const, text: `❌ Odds API error: ${msg}` }],
          isError: true,
        };
      }
    }
  );
}

// ── Register SportMonks tools ──

for (const tool of sportmonksTools) {
  server.tool(
    tool.name,
    tool.description,
    tool.schema.shape,
    async (args) => {
      if (!SPORTMONKS_TOKEN) {
        return {
          content: [
            {
              type: "text" as const,
              text: "❌ SPORTMONKS_TOKEN environment variable is not set. Please set it in your Claude Desktop config or environment.",
            },
          ],
        };
      }
      try {
        const result = await tool.handler(args as Record<string, unknown>, SPORTMONKS_TOKEN);
        return { content: [{ type: "text" as const, text: result }] };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text" as const, text: `❌ SportMonks API error: ${msg}` }],
          isError: true,
        };
      }
    }
  );
}

// ── Start server ──

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `🏟️  Sports MCP Server running — ${oddsTools.length} Odds API tools + ${sportmonksTools.length} SportMonks tools`
  );
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
