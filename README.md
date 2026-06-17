# Darkpool Monitor

Darkpool Monitor is a FastAPI, React, and Discord alerting system for monitoring large off-exchange prints, clustering them into price levels, and scoring confluence against dealer-exposure-style levels and options-flow context.

This is an intelligence and alerting tool. It does not auto-trade and should not be treated as financial advice. Dark pool prints are contextual levels, not standalone buy or sell signals.

## Current Capabilities

- FastAPI backend with health checks, provider discovery, compatibility routes, and dark pool intelligence endpoints.
- React dashboard with MAG7 simulation, live feed, scanner, options dashboard, flow map, alerts, watchlists, replay, admin, settings, CSV export, and persisted filters.
- Discord bot with slash commands for dark pool level summaries and user-configured whale thresholds.
- Offline `demo` provider so the app can run without paid data keys.
- FINRA provider support for public weekly ATS/OTC aggregate data.
- Dark pool level engine that clusters prints by symbol and price bucket.
- Heatseeker-style context concepts: king node, floor, ceiling, gatekeepers, air pockets, and confluence scoring.
- Alert candidate generation with severity, reasons, score, notional, and deduplication.
- Python and frontend test coverage for provider behavior, route smoke checks, options endpoints, alerting, confluence, level clustering, Discord command handling, z-scores, CSV export, and frontend build.

## Production Posture

The project is now structured so the bot can run locally in demo mode immediately, then be pointed at live providers as credentials become available.

Use `provider=demo` for local development, tests, and UI demos.
Use `provider=finra` for public FINRA aggregate data. FINRA data is useful for aggregate venue context, but it is not a real-time dark pool tape.

The app intentionally requires price confirmation and human review. It should not place orders automatically from a single print, confluence score, or Discord alert.

## Setup

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
npm install
```

Copy the environment template if you want live keys or a Discord bot:

```bash
copy .env.example .env
```

Run the backend:

```bash
python server.py
```

Run the frontend:

```bash
npm run dev
```

Open http://localhost:5173.

Run the Discord bot:

```bash
python discord_bot.py
```

## Environment Variables

- `SECRET_KEY`: persistent secret used for JWTs and password hashing.
- `PORT`: FastAPI port, default `8000`.
- `FRONTEND_URL`: CORS origin for the Vite app.
- `POLYGON_API_KEY`: optional future market-data integration.
- `INTRINIO_API_KEY`: optional future market-data integration.
- `UNUSUAL_WHALES_API_KEY`: optional future options-flow/GEX integration.
- `DISCORD_BOT_TOKEN`: Discord bot token.
- `DISCORD_GUILD_ID`: optional guild ID for faster command sync during development.
- `DISCORD_WEBHOOK_URL`: optional webhook for backend alert routing.
- `WHALE_THRESHOLD`: default share threshold for whale alerts.

## Key API Routes

Core:

- `GET /`
- `GET /health`
- `GET /providers`
- `GET /health/circuit`
- `POST /health/circuit/{provider}/reset`

Compatibility:

- `GET /api/full?symbol=AAPL&provider=demo`
- `GET /api/aggregate/AAPL?provider=demo`
- `GET /api/sentiment?provider=demo`

Dark pool intelligence:

- `GET /darkpool/otc?symbol=AAPL&provider=demo`
- `GET /darkpool/trades?symbol=AAPL&provider=demo`
- `GET /darkpool/levels?symbol=AAPL&provider=demo`
- `GET /darkpool/confluence?symbol=AAPL&provider=demo`
- `GET /darkpool/alert-candidates?symbol=AAPL&provider=demo`

Scanner and visualization:

- `GET /scanner/prints`
- `GET /scanner/heatmap`
- `GET /chart/heatmap`
- `GET /visualization/area`
- `GET /visualization/bar`
- `GET /visualization/combined`
- `GET /grafana/table`
- `GET /grafana/timeseries`

Options dashboard:

- `GET /options/highest-call-vol`
- `GET /options/highest-put-vol`
- `GET /options/high-vol-cheapies`
- `GET /options/high-vol-leaps`
- `GET /options/most-otm-strikes`
- `GET /options/large-otm-oi`
- `GET /marketcap/milestones`

Alerts and watchlists:

- `GET /alerts/config`
- `POST /alerts/config`
- `DELETE /alerts/config/{symbol}`
- `GET /alerts/check`
- `GET /alerts/whale-feed`
- `POST /alerts/route`
- `POST /alerts/webhook`
- `GET /watchlists`
- `POST /watchlists`

## Discord Commands

- `/darkpool symbol:AAPL provider:demo`: show top clustered levels and confluence scores.
- `/setalert symbol:AAPL threshold:100000`: set a whale threshold in shares.
- `/alertstatus`: list configured alert thresholds.
- `/removealert symbol:AAPL`: remove a threshold.

## Testing

Run backend tests:

```bash
pytest tests -q
```

Run frontend tests:

```bash
npm test
```

Run production build:

```bash
npm run build
```

Run dependency audit:

```bash
npm audit --audit-level=moderate
```

Current known frontend build note: Vite reports a chunk-size warning because the dashboard and all advanced views are bundled together. This is not a failure. Code splitting is the next performance improvement.

## Data and Interpretation Limits

FINRA public OTC/ATS data is delayed and aggregate. It is not an omniscient real-time view of dark-pool intent.

Real-time options flow, GEX, VEX, and live off-lit trade feeds require licensed providers. The app is prepared for those integrations, but demo mode uses deterministic synthetic data.

Dark pool prints can identify areas where institutional volume occurred. They do not prove intent. The level engine ranks areas of interest; it does not issue trade entries.

Confluence scores are stronger when a dark pool level aligns with exposure nodes, options-flow direction, and proximity to spot. Even high scores require price-action confirmation, liquidity checks, spread checks, news awareness, and risk controls.

## Research Inputs

Feature direction was informed by public documentation and product behavior from:

- Skylit Heatseeker docs: https://docs.skylit.ai/
- Skylit Heatseeker node workflow: https://www.skylit.ai/learn/reading-heatseeker
- Unusual Whales API docs: https://api.unusualwhales.com/docs
- FINRA Weekly Summary API: https://developer.finra.org/docs/api-explorer/query_api-equity-weekly_summary
- SEC Form ATS-N information: https://www.sec.gov/about/divisions-offices/division-trading-markets/alternative-trading-systems/form-ats-n-filings-information
- FlowAlgo: https://flowalgo.com/
- Cheddar Flow Discord bot: https://www.cheddarflow.com/cheddar-flow-discord-bot/
- BlackBoxStocks features: https://blackboxstocks.com/features/

## Next Production Steps

- Add a paid provider adapter for Unusual Whales or another licensed source for live dark pool prints, options flow, GEX, VEX, halts, and news.
- Persist normalized events and aggregates in PostgreSQL or TimescaleDB.
- Add Docker Compose for backend, frontend, and database.
- Add websocket push from backend alert candidates to the dashboard.
- Add code splitting for the React advanced views.
- Move in-memory auth, watchlists, thresholds, and alert state into persistent storage.
