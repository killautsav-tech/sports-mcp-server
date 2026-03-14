/**
 * SportMonks Football API v3 — Tool definitions and handlers.
 * Base URL: https://api.sportmonks.com/v3/football
 * Auth: api_token query parameter
 */

import { z } from "zod";
import { fetchJson, buildUrl } from "./http.js";

const BASE = "https://api.sportmonks.com/v3/football";

// ── Helpers ──

function smUrl(
  path: string,
  apiToken: string,
  extra: Record<string, string | number | boolean | undefined> = {}
): string {
  return buildUrl(BASE, path, { api_token: apiToken, ...extra });
}

function metaInfo(data: unknown): string {
  const d = data as { rate_limit?: { remaining?: number; resets_in_seconds?: number } };
  if (d?.rate_limit) {
    return `\n\n---\n⏱️ Rate limit: ${d.rate_limit.remaining ?? "?"} remaining | resets in ${d.rate_limit.resets_in_seconds ?? "?"}s`;
  }
  return "";
}

// ── Tool registry ──

export interface ToolDef {
  name: string;
  description: string;
  schema: z.ZodObject<z.ZodRawShape>;
  handler: (args: Record<string, unknown>, apiToken: string) => Promise<string>;
}

export const sportmonksTools: ToolDef[] = [
  // ── LIVESCORES ──
  {
    name: "sm_livescores",
    description:
      "Get live football/soccer scores. Modes: 'inplay' (currently playing), 'all' (today's livescores), 'latest' (most recently updated). Use include param for enriched data.",
    schema: z.object({
      mode: z
        .enum(["inplay", "all", "latest"])
        .default("inplay")
        .describe("inplay = currently playing, all = today's matches, latest = recently updated"),
      include: z
        .string()
        .optional()
        .describe(
          'Comma-separated includes e.g. "participants,scores,league,events,statistics"'
        ),
    }),
    handler: async (args, apiToken) => {
      const pathMap = { inplay: "/livescores/inplay", all: "/livescores", latest: "/livescores/latest" };
      const url = smUrl(pathMap[args.mode as keyof typeof pathMap], apiToken, {
        include: args.include as string | undefined,
      });
      const { data } = await fetchJson(url);
      return JSON.stringify(data, null, 2) + metaInfo(data);
    },
  },

  // ── FIXTURES ──
  {
    name: "sm_fixtures",
    description:
      "Get football fixtures. Supports: by ID, by date, by date range, by date range for team, head-to-head, search by name. The core endpoint for match data.",
    schema: z.object({
      mode: z
        .enum(["by_id", "by_date", "by_date_range", "by_date_range_team", "h2h", "search"])
        .describe("Query mode"),
      id: z.string().optional().describe("Fixture ID (for by_id mode)"),
      date: z.string().optional().describe("Date YYYY-MM-DD (for by_date)"),
      startDate: z.string().optional().describe("Start date YYYY-MM-DD (for by_date_range)"),
      endDate: z.string().optional().describe("End date YYYY-MM-DD (for by_date_range)"),
      teamId: z.string().optional().describe("Team ID (for by_date_range_team)"),
      team1Id: z.string().optional().describe("First team ID (for h2h)"),
      team2Id: z.string().optional().describe("Second team ID (for h2h)"),
      searchQuery: z.string().optional().describe("Search term (for search mode)"),
      include: z
        .string()
        .optional()
        .describe('Comma-separated includes e.g. "participants,scores,league,odds,statistics,events,lineups"'),
      filters: z.string().optional().describe('Filters e.g. "fixtureLeagues:8"'),
      page: z.number().optional().describe("Page number for pagination"),
    }),
    handler: async (args, apiToken) => {
      let path: string;
      switch (args.mode) {
        case "by_id":
          path = `/fixtures/${args.id}`;
          break;
        case "by_date":
          path = `/fixtures/date/${args.date}`;
          break;
        case "by_date_range":
          path = `/fixtures/between/${args.startDate}/${args.endDate}`;
          break;
        case "by_date_range_team":
          path = `/fixtures/between/${args.startDate}/${args.endDate}/${args.teamId}`;
          break;
        case "h2h":
          path = `/fixtures/head-to-head/${args.team1Id}/${args.team2Id}`;
          break;
        case "search":
          path = `/fixtures/search/${encodeURIComponent(args.searchQuery as string)}`;
          break;
        default:
          throw new Error(`Unknown mode: ${args.mode}`);
      }
      const url = smUrl(path, apiToken, {
        include: args.include as string | undefined,
        filters: args.filters as string | undefined,
        page: args.page as number | undefined,
      });
      const { data } = await fetchJson(url);
      return JSON.stringify(data, null, 2) + metaInfo(data);
    },
  },

  // ── LEAGUES ──
  {
    name: "sm_leagues",
    description:
      "Get football leagues. Modes: 'all', 'by_id', 'live' (leagues currently in play), 'by_country', 'by_team', 'search'. Returns league IDs needed for other endpoints.",
    schema: z.object({
      mode: z
        .enum(["all", "by_id", "live", "by_country", "by_team", "search"])
        .default("all"),
      id: z.string().optional().describe("League ID"),
      countryId: z.string().optional().describe("Country ID"),
      teamId: z.string().optional().describe("Team ID"),
      searchQuery: z.string().optional().describe("Search term"),
      include: z.string().optional().describe('e.g. "country,currentSeason,seasons"'),
      page: z.number().optional(),
    }),
    handler: async (args, apiToken) => {
      let path: string;
      switch (args.mode) {
        case "all": path = "/leagues"; break;
        case "by_id": path = `/leagues/${args.id}`; break;
        case "live": path = "/leagues/live"; break;
        case "by_country": path = `/leagues/countries/${args.countryId}`; break;
        case "by_team": path = `/leagues/teams/${args.teamId}`; break;
        case "search": path = `/leagues/search/${encodeURIComponent(args.searchQuery as string)}`; break;
        default: throw new Error(`Unknown mode: ${args.mode}`);
      }
      const url = smUrl(path, apiToken, {
        include: args.include as string | undefined,
        page: args.page as number | undefined,
      });
      const { data } = await fetchJson(url);
      return JSON.stringify(data, null, 2) + metaInfo(data);
    },
  },

  // ── SEASONS ──
  {
    name: "sm_seasons",
    description:
      "Get football seasons. Modes: 'all', 'by_id', 'by_team', 'search'. Season IDs are needed for standings, statistics, and topscorers.",
    schema: z.object({
      mode: z.enum(["all", "by_id", "by_team", "search"]).default("all"),
      id: z.string().optional(),
      teamId: z.string().optional(),
      searchQuery: z.string().optional(),
      include: z.string().optional(),
      page: z.number().optional(),
    }),
    handler: async (args, apiToken) => {
      let path: string;
      switch (args.mode) {
        case "all": path = "/seasons"; break;
        case "by_id": path = `/seasons/${args.id}`; break;
        case "by_team": path = `/seasons/teams/${args.teamId}`; break;
        case "search": path = `/seasons/search/${encodeURIComponent(args.searchQuery as string)}`; break;
        default: throw new Error(`Unknown mode: ${args.mode}`);
      }
      const url = smUrl(path, apiToken, {
        include: args.include as string | undefined,
        page: args.page as number | undefined,
      });
      const { data } = await fetchJson(url);
      return JSON.stringify(data, null, 2) + metaInfo(data);
    },
  },

  // ── STANDINGS ──
  {
    name: "sm_standings",
    description:
      "Get league standings / tables. Modes: 'by_season', 'by_round', 'live' (live standings by league). Essential for form analysis.",
    schema: z.object({
      mode: z.enum(["by_season", "by_round", "live"]).default("by_season"),
      seasonId: z.string().optional().describe("Season ID"),
      roundId: z.string().optional().describe("Round ID"),
      leagueId: z.string().optional().describe("League ID (for live mode)"),
      include: z.string().optional().describe('e.g. "participant,details"'),
    }),
    handler: async (args, apiToken) => {
      let path: string;
      switch (args.mode) {
        case "by_season": path = `/standings/seasons/${args.seasonId}`; break;
        case "by_round": path = `/standings/rounds/${args.roundId}`; break;
        case "live": path = `/standings/live/leagues/${args.leagueId}`; break;
        default: throw new Error(`Unknown mode: ${args.mode}`);
      }
      const url = smUrl(path, apiToken, {
        include: args.include as string | undefined,
      });
      const { data } = await fetchJson(url);
      return JSON.stringify(data, null, 2) + metaInfo(data);
    },
  },

  // ── TEAMS ──
  {
    name: "sm_teams",
    description:
      "Get football teams. Modes: 'by_id', 'by_country', 'by_season', 'search'. Returns team IDs used across all endpoints.",
    schema: z.object({
      mode: z.enum(["all", "by_id", "by_country", "by_season", "search"]).default("search"),
      id: z.string().optional(),
      countryId: z.string().optional(),
      seasonId: z.string().optional(),
      searchQuery: z.string().optional(),
      include: z.string().optional().describe('e.g. "players,coach,venue,statistics"'),
      page: z.number().optional(),
    }),
    handler: async (args, apiToken) => {
      let path: string;
      switch (args.mode) {
        case "all": path = "/teams"; break;
        case "by_id": path = `/teams/${args.id}`; break;
        case "by_country": path = `/teams/countries/${args.countryId}`; break;
        case "by_season": path = `/teams/seasons/${args.seasonId}`; break;
        case "search": path = `/teams/search/${encodeURIComponent(args.searchQuery as string)}`; break;
        default: throw new Error(`Unknown mode: ${args.mode}`);
      }
      const url = smUrl(path, apiToken, {
        include: args.include as string | undefined,
        page: args.page as number | undefined,
      });
      const { data } = await fetchJson(url);
      return JSON.stringify(data, null, 2) + metaInfo(data);
    },
  },

  // ── PLAYERS ──
  {
    name: "sm_players",
    description:
      "Get football players. Modes: 'by_id', 'by_country', 'search'. Rich data with includes.",
    schema: z.object({
      mode: z.enum(["all", "by_id", "by_country", "search"]).default("search"),
      id: z.string().optional(),
      countryId: z.string().optional(),
      searchQuery: z.string().optional(),
      include: z.string().optional().describe('e.g. "teams,statistics,position"'),
      page: z.number().optional(),
    }),
    handler: async (args, apiToken) => {
      let path: string;
      switch (args.mode) {
        case "all": path = "/players"; break;
        case "by_id": path = `/players/${args.id}`; break;
        case "by_country": path = `/players/countries/${args.countryId}`; break;
        case "search": path = `/players/search/${encodeURIComponent(args.searchQuery as string)}`; break;
        default: throw new Error(`Unknown mode: ${args.mode}`);
      }
      const url = smUrl(path, apiToken, {
        include: args.include as string | undefined,
        page: args.page as number | undefined,
      });
      const { data } = await fetchJson(url);
      return JSON.stringify(data, null, 2) + metaInfo(data);
    },
  },

  // ── TEAM SQUADS ──
  {
    name: "sm_team_squads",
    description:
      "Get a team's current squad or squad for a specific season.",
    schema: z.object({
      teamId: z.string().describe("Team ID"),
      seasonId: z.string().optional().describe("Season ID (optional — omit for current squad)"),
      include: z.string().optional().describe('e.g. "player,position"'),
    }),
    handler: async (args, apiToken) => {
      const path = args.seasonId
        ? `/squads/teams/${args.teamId}/seasons/${args.seasonId}`
        : `/squads/teams/${args.teamId}`;
      const url = smUrl(path, apiToken, {
        include: args.include as string | undefined,
      });
      const { data } = await fetchJson(url);
      return JSON.stringify(data, null, 2) + metaInfo(data);
    },
  },

  // ── STATISTICS ──
  {
    name: "sm_statistics",
    description:
      "Get season/stage/round statistics for a participant (team or player). Essential for form and performance analysis.",
    schema: z.object({
      mode: z
        .enum(["season_participant", "stage", "round"])
        .default("season_participant"),
      seasonId: z.string().optional().describe("Season ID"),
      participantId: z.string().optional().describe("Team or Player ID (for season_participant)"),
      stageId: z.string().optional().describe("Stage ID"),
      roundId: z.string().optional().describe("Round ID"),
      include: z.string().optional(),
    }),
    handler: async (args, apiToken) => {
      let path: string;
      switch (args.mode) {
        case "season_participant":
          path = `/statistics/seasons/${args.seasonId}/participants/${args.participantId}`;
          break;
        case "stage":
          path = `/statistics/stages/${args.stageId}`;
          break;
        case "round":
          path = `/statistics/rounds/${args.roundId}`;
          break;
        default:
          throw new Error(`Unknown mode: ${args.mode}`);
      }
      const url = smUrl(path, apiToken, {
        include: args.include as string | undefined,
      });
      const { data } = await fetchJson(url);
      return JSON.stringify(data, null, 2) + metaInfo(data);
    },
  },

  // ── TOPSCORERS ──
  {
    name: "sm_topscorers",
    description:
      "Get top scorers for a season or stage.",
    schema: z.object({
      mode: z.enum(["by_season", "by_stage"]).default("by_season"),
      seasonId: z.string().optional(),
      stageId: z.string().optional(),
      include: z.string().optional().describe('e.g. "player,participant"'),
    }),
    handler: async (args, apiToken) => {
      const path =
        args.mode === "by_season"
          ? `/topscorers/seasons/${args.seasonId}`
          : `/topscorers/stages/${args.stageId}`;
      const url = smUrl(path, apiToken, {
        include: args.include as string | undefined,
      });
      const { data } = await fetchJson(url);
      return JSON.stringify(data, null, 2) + metaInfo(data);
    },
  },

  // ── PREDICTIONS ──
  {
    name: "sm_predictions",
    description:
      "Get SportMonks predictions. Modes: 'probabilities' (all), 'by_fixture' (fixture-specific probabilities), 'value_bets', 'value_bets_by_fixture'. Great for model cross-reference.",
    schema: z.object({
      mode: z
        .enum(["probabilities", "by_fixture", "value_bets", "value_bets_by_fixture"])
        .default("probabilities"),
      fixtureId: z.string().optional().describe("Fixture ID"),
      include: z.string().optional(),
      page: z.number().optional(),
    }),
    handler: async (args, apiToken) => {
      let path: string;
      switch (args.mode) {
        case "probabilities": path = "/predictions/probabilities"; break;
        case "by_fixture": path = `/predictions/probabilities/fixtures/${args.fixtureId}`; break;
        case "value_bets": path = "/predictions/value-bets"; break;
        case "value_bets_by_fixture": path = `/predictions/value-bets/fixtures/${args.fixtureId}`; break;
        default: throw new Error(`Unknown mode: ${args.mode}`);
      }
      const url = smUrl(path, apiToken, {
        include: args.include as string | undefined,
        page: args.page as number | undefined,
      });
      const { data } = await fetchJson(url);
      return JSON.stringify(data, null, 2) + metaInfo(data);
    },
  },

  // ── EXPECTED GOALS (xG) ──
  {
    name: "sm_expected_xg",
    description:
      "Get Expected Goals (xG) data by team or player. Requires xG add-on plan.",
    schema: z.object({
      mode: z.enum(["by_team", "by_player"]).default("by_team"),
      id: z.string().describe("Team ID or Player ID"),
      include: z.string().optional(),
    }),
    handler: async (args, apiToken) => {
      const path = args.mode === "by_team" ? `/expected/teams/${args.id}` : `/expected/players/${args.id}`;
      const url = smUrl(path, apiToken, {
        include: args.include as string | undefined,
      });
      const { data } = await fetchJson(url);
      return JSON.stringify(data, null, 2) + metaInfo(data);
    },
  },

  // ── PRE-MATCH ODDS ──
  {
    name: "sm_odds_prematch",
    description:
      "Get pre-match odds from SportMonks. Modes: 'by_fixture', 'by_fixture_bookmaker', 'by_fixture_market', 'latest'. Useful for comparing with The Odds API data.",
    schema: z.object({
      mode: z
        .enum(["by_fixture", "by_fixture_bookmaker", "by_fixture_market", "latest"])
        .default("by_fixture"),
      fixtureId: z.string().optional().describe("Fixture ID"),
      bookmakerId: z.string().optional().describe("Bookmaker ID"),
      marketId: z.string().optional().describe("Market ID"),
      include: z.string().optional(),
      page: z.number().optional(),
    }),
    handler: async (args, apiToken) => {
      let path: string;
      switch (args.mode) {
        case "by_fixture": path = `/odds/pre-match/fixtures/${args.fixtureId}`; break;
        case "by_fixture_bookmaker":
          path = `/odds/pre-match/fixtures/${args.fixtureId}/bookmakers/${args.bookmakerId}`; break;
        case "by_fixture_market":
          path = `/odds/pre-match/fixtures/${args.fixtureId}/markets/${args.marketId}`; break;
        case "latest": path = "/odds/pre-match/latest"; break;
        default: throw new Error(`Unknown mode: ${args.mode}`);
      }
      const url = smUrl(path, apiToken, {
        include: args.include as string | undefined,
        page: args.page as number | undefined,
      });
      const { data } = await fetchJson(url);
      return JSON.stringify(data, null, 2) + metaInfo(data);
    },
  },

  // ── IN-PLAY ODDS ──
  {
    name: "sm_odds_inplay",
    description:
      "Get live in-play odds from SportMonks. Modes: 'all', 'by_fixture', 'by_fixture_bookmaker', 'by_fixture_market', 'latest'.",
    schema: z.object({
      mode: z
        .enum(["all", "by_fixture", "by_fixture_bookmaker", "by_fixture_market", "latest"])
        .default("by_fixture"),
      fixtureId: z.string().optional(),
      bookmakerId: z.string().optional(),
      marketId: z.string().optional(),
      include: z.string().optional(),
      page: z.number().optional(),
    }),
    handler: async (args, apiToken) => {
      let path: string;
      switch (args.mode) {
        case "all": path = "/odds/inplay"; break;
        case "by_fixture": path = `/odds/inplay/fixtures/${args.fixtureId}`; break;
        case "by_fixture_bookmaker":
          path = `/odds/inplay/fixtures/${args.fixtureId}/bookmakers/${args.bookmakerId}`; break;
        case "by_fixture_market":
          path = `/odds/inplay/fixtures/${args.fixtureId}/markets/${args.marketId}`; break;
        case "latest": path = "/odds/inplay/latest"; break;
        default: throw new Error(`Unknown mode: ${args.mode}`);
      }
      const url = smUrl(path, apiToken, {
        include: args.include as string | undefined,
        page: args.page as number | undefined,
      });
      const { data } = await fetchJson(url);
      return JSON.stringify(data, null, 2) + metaInfo(data);
    },
  },

  // ── SCHEDULES ──
  {
    name: "sm_schedules",
    description:
      "Get match schedules. Modes: 'by_season', 'by_team', 'by_season_team'. Useful for planning which fixtures to track.",
    schema: z.object({
      mode: z.enum(["by_season", "by_team", "by_season_team"]).default("by_season"),
      seasonId: z.string().optional(),
      teamId: z.string().optional(),
      include: z.string().optional(),
      page: z.number().optional(),
    }),
    handler: async (args, apiToken) => {
      let path: string;
      switch (args.mode) {
        case "by_season": path = `/schedules/seasons/${args.seasonId}`; break;
        case "by_team": path = `/schedules/teams/${args.teamId}`; break;
        case "by_season_team": path = `/schedules/seasons/${args.seasonId}/teams/${args.teamId}`; break;
        default: throw new Error(`Unknown mode: ${args.mode}`);
      }
      const url = smUrl(path, apiToken, {
        include: args.include as string | undefined,
        page: args.page as number | undefined,
      });
      const { data } = await fetchJson(url);
      return JSON.stringify(data, null, 2) + metaInfo(data);
    },
  },

  // ── ROUNDS ──
  {
    name: "sm_rounds",
    description:
      "Get round information. Modes: 'by_season', 'by_id'. Round IDs are needed for standings by round.",
    schema: z.object({
      mode: z.enum(["all", "by_id", "by_season"]).default("by_season"),
      id: z.string().optional(),
      seasonId: z.string().optional(),
      include: z.string().optional().describe('e.g. "fixtures"'),
    }),
    handler: async (args, apiToken) => {
      let path: string;
      switch (args.mode) {
        case "all": path = "/rounds"; break;
        case "by_id": path = `/rounds/${args.id}`; break;
        case "by_season": path = `/rounds/seasons/${args.seasonId}`; break;
        default: throw new Error(`Unknown mode: ${args.mode}`);
      }
      const url = smUrl(path, apiToken, {
        include: args.include as string | undefined,
      });
      const { data } = await fetchJson(url);
      return JSON.stringify(data, null, 2) + metaInfo(data);
    },
  },

  // ── MARKETS (for odds) ──
  {
    name: "sm_markets",
    description:
      "List available betting markets in SportMonks. Use market IDs with sm_odds_prematch and sm_odds_inplay.",
    schema: z.object({
      mode: z.enum(["all", "by_id", "search"]).default("all"),
      id: z.string().optional(),
      searchQuery: z.string().optional(),
    }),
    handler: async (args, apiToken) => {
      let path: string;
      switch (args.mode) {
        case "all": path = "/markets"; break;
        case "by_id": path = `/markets/${args.id}`; break;
        case "search": path = `/markets/search/${encodeURIComponent(args.searchQuery as string)}`; break;
        default: throw new Error(`Unknown mode: ${args.mode}`);
      }
      const url = smUrl(path, apiToken);
      const { data } = await fetchJson(url);
      return JSON.stringify(data, null, 2) + metaInfo(data);
    },
  },

  // ── BOOKMAKERS ──
  {
    name: "sm_bookmakers",
    description:
      "List available bookmakers in SportMonks. Use bookmaker IDs with odds endpoints.",
    schema: z.object({
      mode: z.enum(["all", "by_id", "search", "by_fixture"]).default("all"),
      id: z.string().optional(),
      searchQuery: z.string().optional(),
      fixtureId: z.string().optional(),
    }),
    handler: async (args, apiToken) => {
      let path: string;
      switch (args.mode) {
        case "all": path = "/bookmakers"; break;
        case "by_id": path = `/bookmakers/${args.id}`; break;
        case "search": path = `/bookmakers/search/${encodeURIComponent(args.searchQuery as string)}`; break;
        case "by_fixture": path = `/bookmakers/fixtures/${args.fixtureId}`; break;
        default: throw new Error(`Unknown mode: ${args.mode}`);
      }
      const url = smUrl(path, apiToken);
      const { data } = await fetchJson(url);
      return JSON.stringify(data, null, 2) + metaInfo(data);
    },
  },
];
