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

### Phase 1: Real Ingestion Layer
1. **FINRA OTC/ATS API** - Free public dark pool reporting data
   - https://www.finra.org/filing-reporting/otc-transparency
   - https://www.finra.org/filing-reporting/otc-transparency/otc-transparency-data-api
2. **Polygon** - Dark pool trade identification from exchange metadata
   - https://polygon.io/knowledge-base/article/does-polygon-offer-dark-pool-data
3. **Intrinio** - Dark pool capable trade filtering (`darkpool_only`)
   - https://docs.intrinio.com/documentation/web_api/get_security_trades_v2

### Phase 2: Data Normalization
- Event schema: ATS vs Non-ATS vs TRF enriched metadata
- Standardized ticker normalization across data sources
- Timestamp alignment and latency tracking

### Phase 3: Anomaly Detection Engine
- Z-score deviation from baseline
- Percent of Average Daily Volume (ADV) thresholds
- Repeat level / support-resistance clustering (inspired by FlowAlgo)
- Pattern recognition for block prints and sweeps

### Phase 4: Alert Routing
- Discord/Telegram webhook integration
- Deduplication windows to prevent alert spam
- Urgency levels (inspired by FlowAlgo's alert intensity)
- Custom threshold configuration per ticker

### Phase 5: Historical Analytics & Replay Mode
- Persistent storage (PostgreSQL/TimescaleDB)
- 1D/1W/1M historical backtesting view
- False-positive tracking
- Export workflows (CSV/JSON) - inspired by Cheddar Flow

### Reference Tools
| Tool | Key Features to Borrow |
|------|----------------------|
| [FlowAlgo](https://flowalgo.com) | Big prints stream, level clustering, urgency alerts |
| [Cheddar Flow](https://www.cheddarflow.com/features/dark-pool-data/) | Historical backtesting, price-level accumulation, export UX |
| [Tradytics](https://tradytics.com) | Dark flow heatmap, top prints dashboard |
| [BlackBoxStocks](https://blackboxstocks.com) | Scanner-first workflow, one-pane operations |
| [OpenBB](https://docs.openbb.co/platform/reference/equity/darkpool) | Slash-command bot workflows, Discord automation |

### Tech Additions for Production
- Node.js/Express backend for API ingestion
- PostgreSQL/TimescaleDB for time-series storage
- Redis for real-time caching and dedup
- Docker Compose for deployment

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
