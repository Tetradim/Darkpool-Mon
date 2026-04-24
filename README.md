# Darkpool Monitor

Real-time dashboard for tracking multi-million dollar institutional transactions (darkpool activity) for MAG7 stocks.

## Features
- **7 MAG7 Stock Cards**: NVDA, AAPL, MSFT, GOOGL, AMZN, META, TSLA
- **Real-time Bar Charts**: Buy/Sell volume visualization
- **Live Transaction Feed**: Multi-million dollar trades
- **Summary Statistics**: Buy/Sell ratio, volume tracking
- **Interactive Ticker Focus**: Click any stock card to filter dashboard views
- **Smart Alerts Panel**: Whale print + anomaly detection (z-score based)
- **Filter Persistence**: Remembers selected stock/timeframe/threshold/sort with localStorage
- **CSV Export**: Export current filtered transaction feed for journaling or downstream analysis
- **Feed Sorting**: Switch between latest-first and largest-first views

## Recommended Next Upgrades
If you want this to become a serious monitoring bot (not only a demo simulator), prioritize:

1. **Real dark pool + tape data ingestion**
   - Add a backend service that consumes ATS/TRF prints, SIP/CTA feed, or your broker/API source.
   - Store normalized events in PostgreSQL/TimescaleDB.
2. **Alerting and anomaly detection**
   - Trigger Discord/Telegram/email/webhook alerts for block prints, unusual buy:sell imbalance, and repeat sweeps.
   - Add rolling z-score / percentile thresholds instead of a static slider.
3. **Persistent historical analytics**
   - Keep minute and hourly aggregates so charts can show 1D/1W/1M without re-simulation.
   - Add top venue, top counterparty bucket, and session segmentation.
4. **Execution-quality frontend features**
   - Add multi-panel charting (volume, notional, price impact).
   - Add sortable table with export (CSV/JSON), saved filters, and replay mode.
5. **Production reliability**
   - Add tests, typed interfaces, and health checks.
   - Run ingestion + UI with Docker Compose and a monitored deploy target.

## Tech Stack
- React + Vite
- Recharts (charting)
- Tailwind CSS (dark theme)

## Getting Started
```bash
npm install
npm run dev
```

Open http://localhost:5173 to view the dashboard.

## Suggested Architecture Upgrade (Next Step)
To move from simulator to production intelligence:
- Add a backend ingestion service (TRF/ATS, broker/API, websocket stream) that normalizes prints.
- Persist events into TimescaleDB/PostgreSQL and pre-aggregate minute bars.
- Push server-side alerts over websocket (not only UI-only alerts).
- Add auth + user-defined watchlists + custom alert thresholds.
