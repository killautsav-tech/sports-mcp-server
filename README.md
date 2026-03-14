# 🏟️ Sports MCP Server

A Model Context Protocol (MCP) server that unifies **The Odds API** and **SportMonks Football API v3** into a single tool surface for Claude Desktop and Claude Code.

## What This Does

| Source | Coverage | Tools |
|---|---|---|
| **The Odds API** | All sports — NBA, NFL, NHL, NCAAM, NCAAF, Soccer, Tennis, MMA, Golf, MLB | 10 tools: odds, scores, events, markets, participants, historical |
| **SportMonks** | Football (soccer) deep data — EPL, La Liga, Bundesliga, Ligue 1, Serie A, Champions League, etc. | 18 tools: fixtures, standings, statistics, xG, predictions, odds, livescores, squads |

**Total: 28 tools** available to Claude via MCP.

---

## Quick Start

### 1. Install dependencies

```bash
cd sports-mcp-server
npm install
npm run build
```

### 2. Set your API keys

You'll configure these in the Claude Desktop config (step 3), but for testing:

```bash
export ODDS_API_KEY="your-odds-api-key-here"
export SPORTMONKS_TOKEN="your-sportmonks-token-here"
```

### 3. Configure Claude Desktop

Add this to your Claude Desktop config file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "sports-data": {
      "command": "node",
      "args": ["/FULL/PATH/TO/sports-mcp-server/dist/index.js"],
      "env": {
        "ODDS_API_KEY": "your-odds-api-key-here",
        "SPORTMONKS_TOKEN": "your-sportmonks-token-here"
      }
    }
  }
}
```

> ⚠️ Replace `/FULL/PATH/TO/` with the actual absolute path to the project.

### 4. Restart Claude Desktop

After saving the config, restart Claude Desktop. You should see the sports tools available in the MCP tools menu.

---

## For Claude.ai (Web / Chrome) — ⭐ This is what you want

The web app needs an HTTP server, not stdio. Here's how:

### Step 1: Build & start the HTTP server

```bash
cd sports-mcp-server
npm install
npm run build

# Start the HTTP server with your API keys
ODDS_API_KEY=your-key-here SPORTMONKS_TOKEN=your-token-here npm run start:http
```

You should see:
```
🏟️  Sports MCP Server (HTTP/SSE) running on http://localhost:3456
   Tools: 10 Odds API + 18 SportMonks = 28 total
   Odds API key:     ✅ configured
   SportMonks token: ✅ configured
```

### Step 2: Connect in Claude.ai

1. Go to **claude.ai** → **Settings** (bottom-left gear icon)
2. Click **Integrations** in the left sidebar
3. Click **Add Custom Integration**
4. Set:
   - **Name**: `Sports Data`
   - **URL**: `http://localhost:3456/sse`
5. Save and enable it

That's it — the 28 tools are now available in your Claude.ai conversations.

### Optional: Protect with auth token

```bash
ODDS_API_KEY=xxx SPORTMONKS_TOKEN=xxx MCP_AUTH_TOKEN=my-secret npm run start:http
```

Then add the token in the integration config as a Bearer token.

### Optional: Run on a remote server

If you want it always-on (e.g. on a VPS or Render/Railway):

1. Deploy the project to your server
2. Run `npm run start:http` with your env vars
3. Use `https://your-server.com/sse` as the integration URL
4. Set `MCP_AUTH_TOKEN` for security

### Keep it running (local)

Use `pm2` or a simple background process:

```bash
# Install pm2 globally
npm install -g pm2

# Start as a daemon
ODDS_API_KEY=xxx SPORTMONKS_TOKEN=xxx pm2 start dist/server-http.js --name sports-mcp

# Auto-restart on reboot
pm2 startup
pm2 save
```

---

## For Claude Desktop (local app)

See the config under Quick Start above — uses stdio transport via `dist/index.js`.

---

## For Claude Code

```bash
claude mcp add sports-data node /FULL/PATH/TO/sports-mcp-server/dist/index.js \
  -e ODDS_API_KEY=your-key \
  -e SPORTMONKS_TOKEN=your-token
```

---

## Tool Reference

### The Odds API Tools (prefix: `odds_`)

| Tool | Description | Quota Cost |
|---|---|---|
| `odds_get_sports` | List all available sports and their keys | Free |
| `odds_get_events` | List upcoming/live events for a sport | Free |
| `odds_get_odds` | **Primary tool** — get odds for upcoming/live games (ML, spreads, totals) | markets × regions |
| `odds_get_scores` | Live scores + recently completed games | 1-2 |
| `odds_get_event_odds` | Odds for a single event — supports ALL markets including player props | unique markets × regions |
| `odds_get_event_markets` | Discover available market keys for an event | 1 |
| `odds_get_participants` | List teams/players for a sport | 1 |
| `odds_get_historical_odds` | Historical odds snapshot at a timestamp | 10 × markets × regions |
| `odds_get_historical_events` | Historical events at a timestamp | 1 |
| `odds_get_historical_event_odds` | Historical odds for single event — all markets | 10 × markets × regions |

**Common sport keys**: `basketball_nba`, `basketball_ncaab`, `americanfootball_nfl`, `americanfootball_ncaaf`, `icehockey_nhl`, `soccer_epl`, `soccer_germany_bundesliga`, `soccer_spain_la_liga`, `soccer_france_ligue_one`, `tennis_atp_*`, `tennis_wta_*`

### SportMonks Tools (prefix: `sm_`)

| Tool | Description |
|---|---|
| `sm_livescores` | Live soccer scores (inplay / all today / latest updated) |
| `sm_fixtures` | Fixtures by ID, date, date range, team, H2H, or search |
| `sm_leagues` | Leagues — all, by ID, live, by country, by team, search |
| `sm_seasons` | Seasons — all, by ID, by team, search |
| `sm_standings` | **League tables** — by season, round, or live |
| `sm_teams` | Teams — all, by ID, country, season, search |
| `sm_players` | Players — by ID, country, search |
| `sm_team_squads` | Team squad (current or by season) |
| `sm_statistics` | Season/stage/round statistics for teams or players |
| `sm_topscorers` | Top scorers by season or stage |
| `sm_predictions` | Probabilities and value bets (SM's own model) |
| `sm_expected_xg` | Expected goals (xG) by team or player |
| `sm_odds_prematch` | Pre-match odds by fixture, bookmaker, or market |
| `sm_odds_inplay` | In-play odds by fixture, bookmaker, or market |
| `sm_schedules` | Match schedules by season, team, or both |
| `sm_rounds` | Round data by season or ID |
| `sm_markets` | List available betting markets |
| `sm_bookmakers` | List available bookmakers |

### Using Includes (SportMonks)

SportMonks tools support an `include` parameter for enriched responses:

```
include: "participants,scores,league,statistics,events"
include: "player,position,teams"
include: "fixtures,rounds"
```

### Using Filters (SportMonks)

Some endpoints support `filters`:

```
filters: "fixtureLeagues:8"       # Filter by league ID
filters: "eventTypes:14,18"        # Filter event types
```

---

## Example Prompts

Once configured, you can ask Claude things like:

- "Get me tonight's NBA odds from DraftKings and FanDuel — spreads, moneylines, and totals"
- "Pull EPL standings for this season"
- "What are the live soccer scores right now?"
- "Compare the historical odds movement for the Lakers game last Tuesday"
- "Get Arsenal's xG data and current squad"
- "Show me value bets from SportMonks predictions for today's fixtures"
- "Get player props available for tonight's NFL game"

---

## Architecture

```
src/
├── index.ts          # MCP server entry — stdio transport (Claude Desktop / Claude Code)
├── server-http.ts    # MCP server entry — HTTP/SSE transport (claude.ai web)
├── odds-api.ts       # The Odds API tool definitions (10 tools)
├── sportmonks.ts     # SportMonks tool definitions (18 tools)
└── http.ts           # Shared HTTP utility (fetch + URL builder)
```

---

## License

MIT
