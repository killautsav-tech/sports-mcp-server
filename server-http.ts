#!/usr/bin/env node

/**
 * Sports MCP Server — HTTP mode for claude.ai web integration.
 *
 * Run this instead of index.ts when you want to connect via claude.ai (browser).
 * Uses Streamable HTTP transport on a local port.
 *
 * Usage:
 *   ODDS_API_KEY=xxx SPORTMONKS_TOKEN=xxx node dist/server-http.js
 *   # Then add http://localhost:3456/mcp as a custom integration in claude.ai
 *
 * Environment variables:
 *   ODDS_API_KEY      — Your The Odds API key
 *   SPORTMONKS_TOKEN  — Your SportMonks API token
 *   PORT              — Server port (default: 3456)
 *   MCP_AUTH_TOKEN    — Optional bearer token to protect the endpoint
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { oddsTools } from "./odds-api.js";
import { sportmonksTools } from "./sportmonks.js";

const ODDS_API_KEY = process.env.ODDS_API_KEY ?? "";
const SPORTMONKS_TOKEN = process.env.SPORTMONKS_TOKEN ?? "";
const PORT = parseInt(process.env.PORT ?? "3456", 10);
const AUTH_TOKEN = process.env.MCP_AUTH_TOKEN ?? "";

// ── Build server with tools ──

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "sports-data",
    version: "1.0.0",
  });

  for (const tool of oddsTools) {
    server.tool(tool.name, tool.description, tool.schema.shape, async (args) => {
      if (!ODDS_API_KEY) {
        return {
          content: [{ type: "text" as const, text: "❌ ODDS_API_KEY not set." }],
        };
      }
      try {
        const result = await tool.handler(args as Record<string, unknown>, ODDS_API_KEY);
        return { content: [{ type: "text" as const, text: result }] };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `❌ Odds API error: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    });
  }

  for (const tool of sportmonksTools) {
    server.tool(tool.name, tool.description, tool.schema.shape, async (args) => {
      if (!SPORTMONKS_TOKEN) {
        return {
          content: [{ type: "text" as const, text: "❌ SPORTMONKS_TOKEN not set." }],
        };
      }
      try {
        const result = await tool.handler(args as Record<string, unknown>, SPORTMONKS_TOKEN);
        return { content: [{ type: "text" as const, text: result }] };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `❌ SportMonks error: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    });
  }

  return server;
}

// ── SSE transport over HTTP ──

// Track active transports for message routing
const transports: Map<string, SSEServerTransport> = new Map();

const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  // CORS headers for browser access
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Optional auth check
  if (AUTH_TOKEN) {
    const authHeader = req.headers.authorization ?? "";
    if (authHeader !== `Bearer ${AUTH_TOKEN}`) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }
  }

  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  // Health check
  if (url.pathname === "/" || url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        server: "sports-data",
        tools: oddsTools.length + sportmonksTools.length,
        odds_api_configured: !!ODDS_API_KEY,
        sportmonks_configured: !!SPORTMONKS_TOKEN,
      })
    );
    return;
  }

  // SSE endpoint — client connects here for event stream
  if (url.pathname === "/sse" && req.method === "GET") {
    const mcpServer = createMcpServer();
    const transport = new SSEServerTransport("/messages", res);
    const sessionId = transport.sessionId;
    transports.set(sessionId, transport);

    res.on("close", () => {
      transports.delete(sessionId);
    });

    await mcpServer.connect(transport);
    return;
  }

  // Message endpoint — client posts JSON-RPC messages here
  if (url.pathname === "/messages" && req.method === "POST") {
    const sessionId = url.searchParams.get("sessionId") ?? "";
    const transport = transports.get(sessionId);

    if (!transport) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unknown session. Connect to /sse first." }));
      return;
    }

    await transport.handlePostMessage(req, res);
    return;
  }

  // Fallback
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found. Use /sse to connect." }));
});

httpServer.listen(PORT, () => {
  console.error(`🏟️  Sports MCP Server (HTTP/SSE) running on http://localhost:${PORT}`);
  console.error(`   SSE endpoint:     http://localhost:${PORT}/sse`);
  console.error(`   Message endpoint: http://localhost:${PORT}/messages`);
  console.error(`   Health check:     http://localhost:${PORT}/health`);
  console.error(`   Tools: ${oddsTools.length} Odds API + ${sportmonksTools.length} SportMonks = ${oddsTools.length + sportmonksTools.length} total`);
  console.error(`   Odds API key:     ${ODDS_API_KEY ? "✅ configured" : "❌ missing"}`);
  console.error(`   SportMonks token: ${SPORTMONKS_TOKEN ? "✅ configured" : "❌ missing"}`);
  console.error(`   Auth:             ${AUTH_TOKEN ? "✅ bearer token required" : "⚠️  open (set MCP_AUTH_TOKEN to protect)"}`);
});
