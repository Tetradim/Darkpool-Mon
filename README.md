# Darkpool Monitor

Real-time dashboard for tracking multi-million dollar institutional transactions (darkpool activity) for MAG7 stocks.

---

## Features

### Core Features
- **7 MAG7 Stock Cards**: NVDA, AAPL, MSFT, GOOGL, AMZN, META, TSLA with live statistics
- **Real-time Bar Charts**: Buy/Sell volume visualization with interactive tooltips
- **Live Transaction Feed**: Multi-million dollar trades with venue/source details
- **Summary Statistics**: Buy/Sell ratio, total volume, average price tracking
- **Interactive Ticker Focus**: Click any stock card to filter dashboard views
- **Filter Persistence**: Remembers selected stock/timeframe/threshold/sort with localStorage
- **CSV Export**: Export current filtered transaction feed

### Scanner & Heatmap
- **Sortable Prints**: Real-time anomaly prints sorted by venue, confidence, z-score, ADV%
- **Flow Map Heatmap**: Ticker × time bucket visualization
- **Z-score Detection**: Identify price anomalies (>2 stdev)
- **ADV% Thresholds**: Flag trades >2% (elevated) or >5% (critical) of average daily volume

### Options Dashboard
- **Highest Call Volume**: Call volume changes with strike/price info
- **Highest Put Volume**: Put volume changes with strike/price info
- **High Vol Cheapies**: High volume, low price contracts
- **High Vol LEAPs**: Long-dated options (6+ months)
- **Most OTM Strikes**: Out-of-the-money strike distribution
- **Large OTM OI**: Large open interest at OTM strikes
- **Market Cap Milestones**: Track market cap thresholds

### Alert System
- **Whale Alerts**: Configurable threshold alerts (size/dollars)
- **Anomaly Alerts**: Auto-triggered on z-score/ADV% detection
- **Multi-channel Routing**: Discord, Slack, Teams, Telegram, Email
- **Deduplication**: Time window + size-based dedup (60s default)
- **Ack/Snooze Actions**: Alert state management
- **Webhook Integration**: Send alerts to Discord webhooks
- **Server-Side Processing**: Alert thresholds stored per user

### Historical Analytics
- **Time-range Queries**: Query transactions by symbol, start, end dates
- **Daily Summaries**: Daily recap with transaction counts and volume
- **7-Day History**: Historical summary statistics
- **Database Ready**: TimescaleDB schema for persistence

### Authentication
- **User Registration**: Email + password with PBKDF2 hashing
- **JWT Tokens**: 24-hour access tokens
- **API Key Management**: Create/list provider API keys
- **Token-protected Endpoints**: Secure user-specific data

### User Watchlists
- **Create Watchlists**: Custom symbol lists per user
- **Token-protected CRUD**: Manage watchlists with authentication
- **Per-user Storage**: Database-backed watchlists

### Analysis & Signals
- **VWAP Analysis**: Volume-weighted average price
- **NBBO Quote**: National best bid/offer pricing
- **Order Book Imbalance**: Buy/sell pressure indicators
- **Volume Profile**: Point of control (VPOC), value area
- **Market Sentiment**: Time-of-day session analysis
- **Complete Analysis**: All signals combined endpoint

### System Health
- **Feed Status**: Data source connectors (FINRA, Polygon, Intrinio)
- **Health Metrics**: Feed lag, dropped events, parser errors
- **Circuit Breaker**: Provider failure detection with exponential backoff
- **Reconnect UI**: Manual circuit reset

### Advanced Visualizations
- **Grafana Integration**: Infinity plugin tables, timeseries panels
- **Plotly Charts**: Area, bar, combined visualizations
- **HTML Panels**: Direct Plotly embedding

### Replay Mode
- **Event Replay**: Historical event loading and playback
- **Speed Control**: Adjustable playback speed (0.5x-10x)
- **Seek/Skip**: Navigate to specific events

### Settings & Customization
- **5 Themes**: settrader, cyberpunk, matrix, fire, monochrome
- **Chart Types**: bar, area, line, candlestick
- **Layout Options**: grid, list, heatmap views
- **Card Sizes**: compact, normal, expanded
- **Whale Threshold**: Customizable size threshold (default 50K shares)
- **Keyboard Shortcuts**: Quick actions with key bindings

---

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register new user |
| POST | `/auth/token` | Login and get JWT |
| POST | `/auth/api-keys` | Create API key |
| GET | `/auth/api-keys` | List user's API keys |

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
| GET | `/options/high-vol-leaps` | High vol LEAPs |
| GET | `/options/most-otm-strikes` | Most OTM strikes |
| GET | `/options/large-otm-oi` | Large OTM OI |
| GET | `/marketcap/milestones` | Market cap milestones |

### Analysis
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/analysis/zscore` | Z-score calculation |
| GET | `/analysis/anomalies` | Anomaly detection |
| GET | `/analysis/baseline` | Baseline statistics |
| GET | `/nbbo/quote` | NBBO quote |
| GET | `/nbbo/trades` | Trades vs NBBO |
| GET | `/vwap/analysis` | VWAP analysis |
| GET | `/orderbook/imbalance` | Order book pressure |
| GET | `/volume/profile` | Volume profile |
| GET | `/sentiment/timeofday` | Market session timing |
| GET | `/analysis/complete` | All signals combined |

### Alerts
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/alerts/trigger-log` | Alert history |
| GET | `/alerts/routing-status` | Routing history |
| POST | `/alerts/route` | Route alert (dedup) |
| POST | `/alerts/webhook` | Send webhook |
| POST | `/alerts/config` | Configure alert |
| DELETE | `/alerts/config/{symbol}` | Delete alert |
| GET | `/alerts/check` | Check threshold |
| GET | `/alerts/whale-feed` | Whale activity |
| POST | `/alerts/server/threshold` | Server-side threshold |
| POST | `/alerts/server/webhook` | Add webhook |
| GET | `/alerts/server/thresholds` | List thresholds |

### Watchlists
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/watchlists` | All watchlists |
| POST | `/watchlists` | Create watchlist |
| DELETE | `/watchlists/{id}` | Delete watchlist |
| GET | `/watchlist/user` | User watchlists (auth) |
| POST | `/watchlist/user/create` | Create user watchlist |
| DELETE | `/watchlist/user/{id}` | Delete user watchlist |

### Historical
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/history/range` | Time-range query |
| GET | `/history/daily` | Daily summary |
| GET | `/history/summary` | Historical summary |

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | API info |
| GET | `/health` | Health check |
| GET | `/health/system` | System metrics |
| GET | `/data/sources` | Data source status |
| GET | `/health/circuit` | Circuit status |
| POST | `/health/circuit/{p}/reset` | Reset circuit |

### Reports
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/reports/daily` | Daily recap |
| GET | `/reports/export` | Compliance export |

### WebSocket
| Endpoint | Description |
|----------|-------------|
| `/ws/transactions` | Real-time transactions |
| `/ws/alerts` | Real-time alerts |
| `/ws/health` | System health stream |

### Utilities
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/providers` | Available providers |
| GET | `/ticker/{sym}/deep-dive` | Ticker deep dive |
| GET | `/replay/events` | Replay events |
| GET | `/normalize/stats` | Normalizer stats |
| GET | `/schema/database` | Database schema |

---

## Architecture

### Frontend Components
- **`src/App.jsx`**: Main dashboard application
- **`src/OptionsDashboard.jsx`**: Options metrics views
- **`src/ProductionViews.jsx`**: Scanner, Alerts, Watchlist, Health views
- **`src/AdvancedViews.jsx`**: FlowMap, Replay, Admin views
- **`src/SettingsModal.jsx`**: Settings configuration
- **`src/themes.js`**: Theme definitions
- **`src/eventBus.ts`**: Event bus for component communication
- **`src/storage.ts`**: Persistent localStorage wrapper
- **`src/replayPipeline.ts`**: Historical replay engine
- **`src/schemas.ts`**: Type schemas

### Database Schema (TimescaleDB/PostgreSQL)
```sql
-- Transactions hypertable
CREATE TABLE darkpool_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol VARCHAR(10) NOT NULL,
    side VARCHAR(4) NOT NULL,
    size INTEGER NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    venue VARCHAR(50),
    feed_type VARCHAR(10),
    source VARCHAR(20),
    notional DECIMAL(15,2),
    is_whale BOOLEAN DEFAULT FALSE,
    is_block BOOLEAN DEFAULT FALSE,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Minute aggregates
CREATE TABLE darkpool_minutes (
    time_bucket TIMESTAMPTZ NOT NULL,
    symbol VARCHAR(10) NOT NULL,
    buy_volume INTEGER,
    sell_volume INTEGER,
    trade_count INTEGER,
    avg_price DECIMAL(10,2),
    notional DECIMAL(15,2),
    whale_count INTEGER,
    PRIMARY KEY (time_bucket, symbol)
);

-- User watchlists
CREATE TABLE watchlist_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    symbols JSONB NOT NULL,
    filters JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Technology Stack
- **Frontend**: React + Vite + Tailwind + Recharts
- **Backend**: FastAPI (Python)
- **Authentication**: JWT with PBKDF2
- **Database**: TimescaleDB/PostgreSQL (ready)
- **Deployment**: Docker

---

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt
npm install

# Run backend
python server.py

# Run frontend
npm run dev
```

Open http://localhost:5173 to view the dashboard.

---

## Configuration

### Default Thresholds
- **Whale**: 50,000 shares OR $1,000,000 notional
- **Block**: 10,000 shares
- **Anomaly**: Z-score >2
- **ADV% Critical**: >5%
- **ADV% Elevated**: >2%

### Circuit Breaker States
- **CLOSED**: Normal operation
- **OPEN**: Failing, reject requests
- **HALF_OPEN**: Testing recovery

### Trade Interpretation
- BUY above ask = Aggressive buying → Bullish
- SELL below bid = Aggressive selling → Bearish
- VWAP > mid = Institutional buying pressure
- VWAP < mid = Institutional selling pressure

---

## Reference Tools
| Tool | Key Features |
|------|-------------|
| [FlowAlgo](https://flowalgo.com) | Big prints stream, level clustering |
| [Cheddar Flow](https://www.cheddarflow.com) | Historical backtesting, export |
| [Tradytics](https://tradytics.com) | Dark flow heatmap |
| [BlackBoxStocks](https://blackboxstocks.com) | Scanner-first workflow |
| [OpenBB](https://docs.openbb.co) | Slash-command bot |

---

## License
MIT