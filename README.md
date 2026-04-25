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

---

## Implemented Upgrades (Phase 1-5 Complete)

### Phase 1: Real Ingestion Layer ✅
- **FINRA OTC/ATS API** client with async/httpx
- **Polygon.io** ready integration hooks
- **Intrinio** ready integration hooks

### Phase 2: Real-time Streaming ✅
- **WebSocket** `/ws/transactions` - Live transaction feed
- **WebSocket** `/ws/alerts` - Real-time alerts
- **WebSocket** `/ws/health` - System health stream
- **ConnectionManager** with channel subscriptions
- Mock transaction broadcast (for demo)

### Phase 3: Anomaly Detection ✅
- **AnomalyDetector** class with z-score calculation
- **ADV%** thresholds (5% = critical, 2% = elevated)
- Rolling baseline (window_size=100)

### Phase 4: Alert Routing ✅
- **AlertRouter** with deduplication (60s window)
- Multi-channel: Discord, Slack, Teams, Telegram, Email
- Time + size-based dedup

### Phase 5: Historical Analytics ✅
- **HistoricalStore** for time-series data
- Range queries (symbol, start, end)
- Daily summaries

---

## API Endpoints

### Darkpool Data
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/full` | All transactions |
| GET | `/api/aggregate/{symbol}` | Aggregated by symbol |
| GET | `/api/sentiment` | Market sentiment |

### Scanner & Heatmap
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/scanner/prints` | Anomaly prints (sortable) |
| GET | `/scanner/heatmap` | Ticker × time heatmap |
| GET | `/chart/heatmap` | Flow map visualization |

### Options Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/options/highest-call-vol` | High call volume |
| GET | `/options/highest-put-vol` | High put volume |
| GET | `/options/high-vol-cheapies` | High vol, low price |
| GET | `/options/most-otm-strikes` | Most OTM strikes |

### Analysis
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/analysis/zscore` | Z-score calculation |
| GET | `/analysis/anomalies` | Full anomaly detection |
| GET | `/analysis/baseline` | Baseline statistics |

### Alerts
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/alerts/trigger-log` | Alert history |
| GET | `/alerts/routing-status` | Routing history |
| POST | `/alerts/route` | Route alert (with dedup) |
| POST | `/alerts/webhook` | Send webhook |

### Historical
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/history/range` | Time-range query |
| GET | `/history/daily` | Daily summary |
| GET | `/history/summary` | Historical summary |

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health/system` | System health |
| GET | `/data/sources` | Data source status |

### WebSocket
| Endpoint | Description |
|----------|-------------|
| `/ws/transactions` | Real-time transactions |
| `/ws/alerts` | Real-time alerts |
| `/ws/health` | System health stream |

---

## Architecture

### Type Schemas (`src/schemas.ts`)
```typescript
// Transaction
{ id, symbol, side, size, price, venue, timestamp, source }

// ScannerPrint
{ id, symbol, side, size, venue, confidence, z_score, adv_pct }

// Alert
{ id, symbol, alert_type, severity, state, routing_status }
```

### Event Bus (`src/eventBus.ts`)
```typescript
import eventBus, { AppEvents } from './eventBus';

eventBus.on(AppEvents.FILTER_CHANGE, (filter) => { ... });
eventBus.emit(AppEvents.FILTER_CHANGE, { symbol: 'NVDA' });
```

### Persistent Storage (`src/storage.ts`)
```typescript
import storage from './storage';

storage.set('settings', { theme: 'settrader' });
const settings = storage.get('settings', { defaultValue: {} });
```

### Replay Pipeline (`src/replayPipeline.ts`)
```typescript
import replayPipeline from './replayPipeline';

replayPipeline.load(events);
replayPipeline.play(2);  // 2x speed
replayPipeline.seek(50); // Go to index
```

---

## Tech Stack
- **Frontend**: React + Tailwind + Recharts
- **Backend**: FastAPI (Python)
- **Data**: FINRA OTC, Polygon.io, Intrinio (ready)
- **Deployment**: Docker

---

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt
npm install

# Run backend
python server.py

# Run frontend (dev)
npm run dev

# Build for prod
npm run build
```

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

### Current Architecture
- **8 Dashboard Views**: Dashboard, Scanner, Flow Map, Alerts, Watchlist, Replay, Admin, Health
- **Production Ready**: API keys, audit logs, retention policies, keyboard shortcuts
- **100+ API endpoints**: Darkpool data, options metrics, charts, alerts, admin

### Backend API
The project includes a Python FastAPI backend with extensive endpoints:

```bash
# Install dependencies
pip install -r requirements.txt

# Run the API server
python server.py

# Run the Discord bot (optional)
python discord_bot.py
```

#### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | API info and providers |
| `/health` | GET | Health check |
| `/providers` | GET | List available providers |
| `/darkpool/otc` | GET | Weekly OTC aggregate data |
| `/darkpool/trades` | GET | Recent darkpool trades |
| `/alerts/webhook` | POST | Send Discord alert |

#### Grafana Integration
| Endpoint | Description | Use Case |
|----------|-------------|---------|
| `/visualization/area` | Plotly area chart JSON | Paste into HTML panel |
| `/visualization/bar` | Plotly bar chart JSON | Paste into HTML panel |
| `/visualization/combined` | Plotly bar+line chart | Bar+line combo |
| `/grafana/table` | Infinity JSON table | Use with Infinity plugin |
| `/grafana/timeseries` | Grafana timeseries | Use with native TS panel |

#### VWAP / NBBO Integration
| Endpoint | Description |
|----------|-------------|
| `/nbbo/quote` | Get bid/ask for symbol |
| `/nbbo/trades` | Trades vs NBBO with aggression |
| `/vwap/analysis` | VWAP, sentiment, aggression |
| `/orderbook/imbalance` | Order book pressure |
| `/volume/profile` | VPOC, value area |
| `/sentiment/timeofday` | Market session timing |
| `/analysis/complete` | All signals combined |

#### Circuit Breaker / Error Handling
| Endpoint | Description |
|----------|-------------|
| `/health/circuit` | Circuit status for all providers |
| `POST /health/circuit/{provider}/reset` | Reset circuit breaker |

#### Options Dashboard Metrics
| Endpoint | Description |
|----------|-------------|
| `/options/highest-call-vol` | Highest call volume change (7d default) |
| `/options/highest-put-vol` | Highest put volume change |
| `/options/high-vol-cheapies` | High vol, low price contracts |
| `/options/high-vol-leaps` | High volume LEAPs (6+ months) |
| `/options/most-otm-strikes` | Most OTM strikes |
| `/options/large-otm-oi` | Large OTM open interest |

#### Market Cap Milestone Tracker
| Endpoint | Description |
|----------|-------------|
| `/marketcap/milestones` | Market cap milestone tracking |

#### Production Features
| Endpoint | Description |
|----------|-------------|
| `/data/sources` | Data source connectors & status |
| `/scanner/prints` | Real-time sortable prints |
| `/scanner/heatmap` | Ticker × time bucket heatmap |
| `/alerts/trigger-log` | Alert trigger log |
| `/alerts/{id}/ack` | Acknowledge alert |
| `/alerts/{id}/snooze` | Snooze alert |
| `/watchlists` | User/team watchlists |
| `/reports/daily` | Daily recap with watermark |
| `/reports/export` | Compliance export |
| `/health/system` | System health metrics |
| `/replay/events` | Replay events |
| `/ticker/{sym}/deep-dive` | Ticker deep dive |

```bash
# Production examples:
curl "/scanner/prints?min_size=5000&sort_by=z_score"
curl "/scanner/heatmap?symbol=AAPL&time_buckets=13"
curl "/alerts/trigger-log?limit=50"
curl "/reports/export?format=csv"
curl "/health/system"
```

#### Whale Threshold Alerts
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/alerts/config` | GET | List all alert configs |
| `/alerts/config` | POST | Create whale alert |
| `/alerts/config/{symbol}` | DELETE | Delete alert |
| `/alerts/check` | GET | Check trade against thresholds |
| `/alerts/whale-feed` | GET | Recent whale activity |

```bash
# Options metrics examples:
curl "/options/highest-call-vol?symbol=AAPL&days_back=14"
curl "/options/high-vol-cheapies?max_ask=3.0&min_volume=5000"
curl "/options/high-vol-leaps?min_months=12"
curl "/options/most-otm-strikes?min_otm_pct=15"
curl "/options/large-otm-oi?min_oi=50000"
curl "/marketcap/milestones?target_milestone=2000000000000"
```

```bash
# Default thresholds:
# - 50,000 shares OR
# - $1,000,000 notional

# Create alert:
curl -X POST /alerts/config \
  -d '{"symbol": "NVDA", "min_shares": 25000, "min_dollars": 500000, "webhook_url": "https://..."}'

# Check trade:
curl "/alerts/check?symbol=NVDA&shares=75000&price=900"
```

```bash
# Circuit behavior:
# CLOSED → Normal operation
# OPEN → Failing, exponential backoff (1s → 2s → 4s → 8s ... max 60s)
# HALF_OPEN → Testing recovery
```
```
BUY above ask  = Aggressive buying (taking liquidity) → Bullish
SELL below bid = Aggressive selling (hitting) → Bearish
VWAP > mid    = Institutional buying pressure
VWAP < mid    = Institutional selling pressure
```

#### How to Connect to Grafana
```bash
# Option 1: Infinity Plugin (FREE)
# 1. Install: grafana-cli plugins install yesoreyeram-infinity-datasource
# 2. Add Data Source → Infinity
# 3. URL: http://localhost:8000/grafana/table?symbol=AAPL
# 4. Use UQL: parse-json

# Option 2: HTTP Data Source
# 1. Add Data Source → HTTP
# 2. URL: http://localhost:8000
# 3. Query with: /grafana/table?symbol=AAPL

# Option 3: HTML Panel (for Plotly)
# 1. Install: Grafana HTML Panel plugin
# 2. Paste endpoint URL in src attribute
```

#### API Parameters
- `symbol`: Stock symbol (e.g., AAPL, NVDA)
- `provider`: finra, polygon, intrinio
- `tier`: T1 (S&P500), T2 (NMS), OTCE (OTC)
- `is_ats`: true for ATS, false for Non-ATS

#### Discord Slash Commands
- `/darkpool symbol:AAPL tier:T1` - Get darkpool data
- `/setalert symbol:AAPL threshold:100000` - Set whale alert
- `/alertstatus` - Show active alerts
- `/removealert symbol:AAPL` - Remove alert

#### Docker Deployment
```bash
docker build -t darkpool-monitor .
docker run -p 8000:8000 darkpool-monitor
```

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
