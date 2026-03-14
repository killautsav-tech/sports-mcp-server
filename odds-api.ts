/**
 * The Odds API v4 — Tool definitions and handlers.
 * Base URL: https://api.the-odds-api.com
 * Auth: apiKey query parameter
 */

import { z } from "zod";
import { fetchJson, buildUrl } from "./http.js";

const BASE = "https://api.the-odds-api.com";

// ── Shared param helpers ──

function withKey(
  params: Record<string, string | number | boolean | undefined>,
  apiKey: string
) {
  return { ...params, apiKey };
}

function quotaInfo(headers: Record<string, string>): string {
  const used = headers["x-requests-used"] ?? "?";
  const remaining = headers["x-requests-remaining"] ?? "?";
  const last = headers["x-requests-last"] ?? "?";
  return `\n\n---\n📊 Quota: ${used} used | ${remaining} remaining | last call cost ${last}`;
}

// ── Tool registry ──

export interface ToolDef {
  name: string;
  description: string;
  schema: z.ZodObject<z.ZodRawShape>;
  handler: (args: Record<string, unknown>, apiKey: string) => Promise<string>;
}

export const oddsTools: ToolDef[] = [
  // 1. GET sports
  {
    name: "odds_get_sports",
    description:
      "List all available sports from The Odds API. Returns sport keys used in other endpoints. Free — no quota cost.",
    schema: z.object({
      all: z
        .boolean()
        .optional()
        .describe("If true, include out-of-season sports"),
    }),
    handler: async (args, apiKey) => {
      const url = buildUrl(BASE, "/v4/sports/", withKey({ all: args.all as boolean | undefined }, apiKey));
      const { data, headers } = await fetchJson(url);
      return JSON.stringify(data, null, 2) + quotaInfo(headers);
    },
  },

  // 2. GET events
  {
    name: "odds_get_events",
    description:
      "List upcoming and live events for a sport. Returns event IDs, teams, and commence times. Free — no quota cost. Use sport keys from odds_get_sports.",
    schema: z.object({
      sport: z
        .string()
        .describe(
          'Sport key e.g. "basketball_nba", "americanfootball_nfl", "icehockey_nhl", "soccer_epl", "tennis_atp_us_open", or "upcoming" for next 8 games across all sports'
        ),
      commenceTimeFrom: z
        .string()
        .optional()
        .describe("ISO 8601 filter — events on/after this time"),
      commenceTimeTo: z
        .string()
        .optional()
        .describe("ISO 8601 filter — events on/before this time"),
      eventIds: z
        .string()
        .optional()
        .describe("Comma-separated event IDs to filter"),
    }),
    handler: async (args, apiKey) => {
      const url = buildUrl(
        BASE,
        `/v4/sports/${args.sport}/events`,
        withKey(
          {
            commenceTimeFrom: args.commenceTimeFrom as string | undefined,
            commenceTimeTo: args.commenceTimeTo as string | undefined,
            eventIds: args.eventIds as string | undefined,
          },
          apiKey
        )
      );
      const { data, headers } = await fetchJson(url);
      return JSON.stringify(data, null, 2) + quotaInfo(headers);
    },
  },

  // 3. GET odds
  {
    name: "odds_get_odds",
    description:
      "Get upcoming and live game odds for a sport. Returns bookmaker odds for specified markets and regions. This is the primary endpoint for pre-game odds analysis. Cost = markets × regions.",
    schema: z.object({
      sport: z
        .string()
        .describe(
          'Sport key e.g. "basketball_nba", "americanfootball_nfl", "icehockey_nhl", "soccer_epl", or "upcoming"'
        ),
      regions: z
        .string()
        .default("us")
        .describe(
          'Comma-separated regions: "us", "us2", "uk", "eu", "au". Determines which bookmakers are returned.'
        ),
      markets: z
        .string()
        .default("h2h")
        .describe(
          'Comma-separated markets: "h2h" (moneyline), "spreads", "totals", "outrights". Each market × region = 1 quota.'
        ),
      oddsFormat: z
        .enum(["american", "decimal"])
        .default("american")
        .describe("Odds format"),
      bookmakers: z
        .string()
        .optional()
        .describe(
          "Comma-separated bookmaker keys to filter (overrides regions). e.g. draftkings,fanduel"
        ),
      eventIds: z
        .string()
        .optional()
        .describe("Comma-separated event IDs to filter"),
      commenceTimeFrom: z.string().optional(),
      commenceTimeTo: z.string().optional(),
    }),
    handler: async (args, apiKey) => {
      const url = buildUrl(BASE, `/v4/sports/${args.sport}/odds/`, {
        apiKey,
        regions: args.regions as string,
        markets: args.markets as string,
        oddsFormat: args.oddsFormat as string,
        bookmakers: args.bookmakers as string | undefined,
        eventIds: args.eventIds as string | undefined,
        commenceTimeFrom: args.commenceTimeFrom as string | undefined,
        commenceTimeTo: args.commenceTimeTo as string | undefined,
      });
      const { data, headers } = await fetchJson(url);
      return JSON.stringify(data, null, 2) + quotaInfo(headers);
    },
  },

  // 4. GET scores
  {
    name: "odds_get_scores",
    description:
      "Get live scores and recently completed game scores. Live scores update ~every 30s. Use daysFrom (1-3) to include completed games. Cost: 1 without daysFrom, 2 with daysFrom.",
    schema: z.object({
      sport: z
        .string()
        .describe('Sport key e.g. "basketball_nba", "icehockey_nhl"'),
      daysFrom: z
        .number()
        .min(1)
        .max(3)
        .optional()
        .describe(
          "Include completed games from this many days ago (1-3). Without this, only live + upcoming are returned."
        ),
      eventIds: z
        .string()
        .optional()
        .describe("Comma-separated event IDs"),
    }),
    handler: async (args, apiKey) => {
      const url = buildUrl(BASE, `/v4/sports/${args.sport}/scores/`, {
        apiKey,
        daysFrom: args.daysFrom as number | undefined,
        eventIds: args.eventIds as string | undefined,
      });
      const { data, headers } = await fetchJson(url);
      return JSON.stringify(data, null, 2) + quotaInfo(headers);
    },
  },

  // 5. GET event odds
  {
    name: "odds_get_event_odds",
    description:
      "Get odds for a SINGLE event with any available market (including player props, alternate lines, period markets). Use odds_get_events to find event IDs first. Cost = unique markets returned × regions.",
    schema: z.object({
      sport: z.string().describe("Sport key"),
      eventId: z.string().describe("Event ID from odds_get_events"),
      regions: z.string().default("us").describe("Comma-separated regions"),
      markets: z
        .string()
        .default("h2h")
        .describe(
          'Any valid market keys. Common: "h2h", "spreads", "totals", "player_points", "player_pass_tds", "player_rebounds", etc.'
        ),
      oddsFormat: z.enum(["american", "decimal"]).default("american"),
      bookmakers: z.string().optional(),
    }),
    handler: async (args, apiKey) => {
      const url = buildUrl(
        BASE,
        `/v4/sports/${args.sport}/events/${args.eventId}/odds`,
        {
          apiKey,
          regions: args.regions as string,
          markets: args.markets as string,
          oddsFormat: args.oddsFormat as string,
          bookmakers: args.bookmakers as string | undefined,
        }
      );
      const { data, headers } = await fetchJson(url);
      return JSON.stringify(data, null, 2) + quotaInfo(headers);
    },
  },

  // 6. GET event markets
  {
    name: "odds_get_event_markets",
    description:
      "Discover which market keys are available for a specific event from each bookmaker. Use this before odds_get_event_odds to know which markets to request. Cost: 1 quota.",
    schema: z.object({
      sport: z.string().describe("Sport key"),
      eventId: z.string().describe("Event ID"),
      regions: z.string().default("us"),
      bookmakers: z.string().optional(),
    }),
    handler: async (args, apiKey) => {
      const url = buildUrl(
        BASE,
        `/v4/sports/${args.sport}/events/${args.eventId}/markets`,
        {
          apiKey,
          regions: args.regions as string,
          bookmakers: args.bookmakers as string | undefined,
        }
      );
      const { data, headers } = await fetchJson(url);
      return JSON.stringify(data, null, 2) + quotaInfo(headers);
    },
  },

  // 7. GET participants
  {
    name: "odds_get_participants",
    description:
      "List teams/players for a sport (whitelist of known participants). Cost: 1 quota.",
    schema: z.object({
      sport: z.string().describe("Sport key"),
    }),
    handler: async (args, apiKey) => {
      const url = buildUrl(BASE, `/v4/sports/${args.sport}/participants`, {
        apiKey,
      });
      const { data, headers } = await fetchJson(url);
      return JSON.stringify(data, null, 2) + quotaInfo(headers);
    },
  },

  // 8. GET historical odds
  {
    name: "odds_get_historical_odds",
    description:
      "Get a snapshot of odds at a specific historical timestamp (available from June 2020, 5-min intervals from Sep 2022). Cost: 10 × markets × regions. PAID PLANS ONLY.",
    schema: z.object({
      sport: z.string().describe("Sport key"),
      date: z
        .string()
        .describe("ISO 8601 timestamp for the snapshot, e.g. 2024-03-10T18:00:00Z"),
      regions: z.string().default("us"),
      markets: z.string().default("h2h"),
      oddsFormat: z.enum(["american", "decimal"]).default("american"),
      bookmakers: z.string().optional(),
    }),
    handler: async (args, apiKey) => {
      const url = buildUrl(
        BASE,
        `/v4/historical/sports/${args.sport}/odds`,
        {
          apiKey,
          date: args.date as string,
          regions: args.regions as string,
          markets: args.markets as string,
          oddsFormat: args.oddsFormat as string,
          bookmakers: args.bookmakers as string | undefined,
        }
      );
      const { data, headers } = await fetchJson(url);
      return JSON.stringify(data, null, 2) + quotaInfo(headers);
    },
  },

  // 9. GET historical events
  {
    name: "odds_get_historical_events",
    description:
      "List events as they appeared at a historical timestamp. Use to find event IDs for historical event odds. Cost: 1 quota. PAID PLANS ONLY.",
    schema: z.object({
      sport: z.string().describe("Sport key"),
      date: z.string().describe("ISO 8601 timestamp"),
      eventIds: z.string().optional(),
      commenceTimeFrom: z.string().optional(),
      commenceTimeTo: z.string().optional(),
    }),
    handler: async (args, apiKey) => {
      const url = buildUrl(
        BASE,
        `/v4/historical/sports/${args.sport}/events`,
        {
          apiKey,
          date: args.date as string,
          eventIds: args.eventIds as string | undefined,
          commenceTimeFrom: args.commenceTimeFrom as string | undefined,
          commenceTimeTo: args.commenceTimeTo as string | undefined,
        }
      );
      const { data, headers } = await fetchJson(url);
      return JSON.stringify(data, null, 2) + quotaInfo(headers);
    },
  },

  // 10. GET historical event odds
  {
    name: "odds_get_historical_event_odds",
    description:
      "Get historical odds for a SINGLE event at a specific timestamp. Supports all markets including player props (available after 2023-05-03). Cost: 10 × markets × regions. PAID PLANS ONLY.",
    schema: z.object({
      sport: z.string().describe("Sport key"),
      eventId: z.string().describe("Historical event ID"),
      date: z.string().describe("ISO 8601 timestamp"),
      regions: z.string().default("us"),
      markets: z.string().default("h2h"),
      oddsFormat: z.enum(["american", "decimal"]).default("american"),
      bookmakers: z.string().optional(),
    }),
    handler: async (args, apiKey) => {
      const url = buildUrl(
        BASE,
        `/v4/historical/sports/${args.sport}/events/${args.eventId}/odds`,
        {
          apiKey,
          date: args.date as string,
          regions: args.regions as string,
          markets: args.markets as string,
          oddsFormat: args.oddsFormat as string,
          bookmakers: args.bookmakers as string | undefined,
        }
      );
      const { data, headers } = await fetchJson(url);
      return JSON.stringify(data, null, 2) + quotaInfo(headers);
    },
  },
];
