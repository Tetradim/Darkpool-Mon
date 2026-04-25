"""
Darkpool Monitor - Architecture Upgrade Module

This module adds:
- Authentication with JWT
- Backend ingestion service (TRF/ATS normalization)
- Database schema (TimescaleDB/PostgreSQL ready)
- User watchlists
- Server-side alert processing
"""

import os
import secrets
import hashlib
from datetime import datetime, timedelta
from typing import Optional

# Import from main server
try:
    from fastapi import Query, HTTPException
    from pydantic import BaseModel, EmailStr
except ImportError:
    pass

# ============================================================================
# Configuration
# ============================================================================

SECRET_KEY = os.getenv("SECRET_KEY", secrets.token_urlsafe(32))
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

# In-memory stores (replace with database in production)
users_db: dict = {}
api_keys_db: dict = {}
sessions_db: dict = {}


# ============================================================================
# Authentication
# ============================================================================

def hash_password(password: str) -> str:
    salt = SECRET_KEY[:16].encode()
    return hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 100000).hex()


def verify_password(password: str, hashed: str) -> bool:
    return hash_password(password) == hashed


def create_access_token(data: dict) -> str:
    import jwt
    to_encode = data.copy()
    expire = datetime.now() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire.isoformat()})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    import jwt
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except Exception:
        return None


# ============================================================================
# Ingestion Service: TRF/ATS Normalization
# ============================================================================

class PrintNormalizer:
    """Normalize prints from TRF/ATS/broker sources"""
    
    ATS_EXCHANGES = {
        "A": "BATS", "B": "BATS", "J": "CBOE", "K": "MEMX", 
        "Y": "IEX", "Z": "NASDAQ",
    }
    
    TRF_CODES = {
        "F": "FINRA/NASDAQ TRF", "X": "FINRA/NYSE TRF",
        "C": "CBOE TRF", "B": "BATS TRF",
    }
    
    def __init__(self):
        self.stats = {"ats": 0, "trf": 0, "exchange": 0}
    
    def normalize(self, raw_print: dict) -> dict:
        exchange = raw_print.get("exchange", "")
        market = raw_print.get("market", "")
        
        if exchange in self.ATS_EXCHANGES:
            feed_type = "ats"
            venue = self.ATS_EXCHANGES.get(exchange, exchange)
            self.stats["ats"] += 1
        elif exchange in self.TRF_CODES or market == "TRF":
            feed_type = "trf"
            venue = self.TRF_CODES.get(exchange, "TRF")
            self.stats["trf"] += 1
        else:
            feed_type = "exchange"
            venue = exchange or market or "UNKNOWN"
            self.stats["exchange"] += 1
        
        size = raw_print.get("size", 0)
        price = raw_print.get("price", 0)
        notional = size * price
        is_whale = size >= 50000 or notional >= 1000000
        is_block = size >= 10000
        
        return {
            **raw_print,
            "feed_type": feed_type,
            "venue": venue,
            "notional": round(notional, 2),
            "is_whale": is_whale,
            "is_block": is_block,
            "normalized_at": datetime.now().isoformat(),
        }
    
    def get_stats(self) -> dict:
        return {**self.stats, "total": sum(self.stats.values())}


normalizer = PrintNormalizer()


# ============================================================================
# Database Schema
# ============================================================================

DATABASE_SCHEMA = """
-- TimescaleDB hypertable schema
CREATE TABLE IF NOT EXISTS darkpool_transactions (
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

SELECT create_hypertable('darkpool_transactions', 'created_at');

CREATE INDEX idx_symbol ON darkpool_transactions (symbol, created_at DESC);
CREATE INDEX idx_whale ON darkpool_transactions (is_whale, created_at DESC);
CREATE INDEX idx_feed_type ON darkpool_transactions (feed_type, created_at DESC);

-- Minute aggregates
CREATE TABLE IF NOT EXISTS darkpool_minutes (
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
CREATE TABLE IF NOT EXISTS watchlist_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    symbols JSONB NOT NULL,
    filters JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
"""


# ============================================================================
# User Watchlists
# ============================================================================

class UserWatchlist:
    def __init__(self):
        self.watchlists = {}
    
    def create(self, user_id: str, name: str, symbols: list, filters: dict = None):
        if user_id not in self.watchlists:
            self.watchlists[user_id] = []
        
        wl = {
            "id": secrets.token_urlsafe(8),
            "name": name,
            "symbols": symbols,
            "filters": filters or {},
            "created_at": datetime.now().isoformat(),
        }
        self.watchlists[user_id].append(wl)
        return wl
    
    def get_user(self, user_id: str) -> list:
        return self.watchlists.get(user_id, [])
    
    def delete(self, user_id: str, watchlist_id: str) -> bool:
        wls = self.watchlists.get(user_id, [])
        for i, wl in enumerate(wls):
            if wl["id"] == watchlist_id:
                wls.pop(i)
                return True
        return False


user_watchlists = UserWatchlist()


# ============================================================================
# Server-Side Alert Processing
# ============================================================================

class ServerAlertProcessor:
    def __init__(self):
        self.thresholds = {}
        self.active_alerts = []
    
    def add_threshold(self, user_id: str, symbol: str, min_size: int, min_dollars: int, channel: str):
        if user_id not in self.thresholds:
            self.thresholds[user_id] = []
        
        self.thresholds[user_id].append({
            "id": secrets.token_urlsafe(8),
            "symbol": symbol,
            "min_size": min_size,
            "min_dollars": min_dollars,
            "channel": channel,
            "created_at": datetime.now().isoformat(),
        })
    
    def add_webhook(self, user_id: str, webhook_url: str):
        if user_id not in self.thresholds:
            self.thresholds[user_id] = []
        
        self.thresholds[user_id].append({
            "type": "webhook",
            "url": webhook_url,
            "created_at": datetime.now().isoformat(),
        })
    
    def check_trade(self, symbol: str, size: int, price: float) -> list:
        triggered = []
        notional = size * price
        
        for user_id, thresholds in self.thresholds.items():
            for th in thresholds:
                if th.get("symbol") != symbol:
                    continue
                
                if size >= th.get("min_size", 0) or notional >= th.get("min_dollars", 0):
                    triggered.append({
                        "user_id": user_id,
                        "threshold_id": th["id"],
                        "symbol": symbol,
                        "size": size,
                        "price": price,
                        "notional": notional,
                        "channel": th.get("channel"),
                        "timestamp": datetime.now().isoformat(),
                    })
        
        return triggered
    
    def get_thresholds(self, user_id: str) -> list:
        return self.thresholds.get(user_id, [])


alert_processor = ServerAlertProcessor()


# Export instances
__all__ = [
    "normalizer",
    "user_watchlists",
    "alert_processor",
    "DATABASE_SCHEMA",
    "hash_password",
    "verify_password",
    "create_access_token",
    "decode_token",
]