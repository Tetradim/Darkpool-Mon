# Code Review and Refactor Notes

## Findings

- `server.py` remains too large and still contains several legacy demo endpoints. The new service modules reduce the blast radius for dark pool intelligence and Discord behavior, but future work should continue moving route logic into routers and services.
- Discord behavior was duplicated between `discord_bot.py` and `/discord/commands`. This is now routed through shared command-summary and formatting services.
- Bot functionality lagged comparable Discord market bots. Missing features included specific slash commands for levels, confluence, alerts, watchlist summaries, and channel subscriptions.
- Provider and demo behavior is testable, but persistent storage is still in-memory. Production deployments need database-backed users, watchlists, subscriptions, alert state, and audit logs.
- Frontend builds and tests pass, but the Vite bundle is still large. Code splitting advanced views is the next frontend refactor.

## Refactor Implemented

- Added `darkpool.command_service` for reusable command summaries.
- Added `darkpool.discord_formatting` for Discord-ready embed payloads.
- Added `darkpool.subscriptions` for Discord channel subscription state.
- Refactored Discord commands to use shared services.
- Added matching FastAPI routes for watchlist summaries and subscription management.
- Extended tests to cover Discord bot imports, backend Discord interactions, command summary generation, embed payloads, and subscription behavior.

## Research Takeaways

- Unusual Whales emphasizes many slash commands plus notification topics for options flow, market halts, ticker updates, news, OI updates, and live flow.
- Cheddar Flow promotes Discord dark pool and options-flow bots with delayed dark pool/order-flow data.
- Tradytics separates querying bots from autoposting bots, which supports this project’s split between slash commands and channel subscriptions.
- InsiderFinance and Whale Flow Hunter advertise broad command coverage across dark pool, GEX, options flow, insider/congress trades, market data, and alerts.

## Next Refactor Targets

- Split `server.py` into FastAPI routers: auth, darkpool, visualization, discord, alerts, watchlists, admin.
- Replace in-memory auth/watchlists/subscriptions with a database repository.
- Add a scheduler that evaluates subscriptions and posts alert candidates to Discord webhooks.
- Add a live provider adapter for licensed options-flow/GEX data.
- Add frontend route-level code splitting.
