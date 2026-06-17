# Discord Refactor and Feature Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor Discord-facing behavior into shared services and add the highest-value Discord trading-bot features: on-demand levels, confluence, alerts, watchlist summaries, and autopost subscriptions.

**Architecture:** Move Discord command payload construction and watchlist/subscription state into `darkpool/` modules. Keep `discord_bot.py` thin: commands call services and send formatted embeds. Expose matching FastAPI endpoints so the UI, webhook workers, and Discord bot use the same logic.

**Tech Stack:** Python 3.11, FastAPI, Pydantic v2, discord.py, pytest.

---

### Task 1: Review-Driven Tests

**Files:**
- Create: `tests/test_discord_features.py`

- [ ] Add tests for command summaries, watchlist summaries, subscription creation, and embed payloads before implementation.
- [ ] Run targeted tests and confirm they fail because the new modules do not exist yet.

### Task 2: Command Summary Service

**Files:**
- Create: `darkpool/command_service.py`
- Create: `darkpool/discord_formatting.py`

- [ ] Add service functions for `darkpool`, `levels`, `confluence`, `alerts`, and `watchlist` summaries.
- [ ] Add Discord embed payload formatting that can be tested without connecting to Discord.

### Task 3: Watchlist and Subscription Store

**Files:**
- Create: `darkpool/subscriptions.py`
- Modify: `server.py`

- [ ] Add in-memory watchlist and subscription store with deterministic IDs.
- [ ] Add API endpoints to create/list/delete subscription topics.
- [ ] Add API route for watchlist intelligence summaries.

### Task 4: Discord Bot Commands

**Files:**
- Modify: `discord_bot.py`

- [ ] Add `/levels`, `/confluence`, `/alerts`, `/watchlist`, `/subscribe`, and `/subscriptions`.
- [ ] Refactor `/darkpool` to call the command service.
- [ ] Keep no-token startup and webhook alert behavior working.

### Task 5: Docs and Verification

**Files:**
- Modify: `README.md`

- [ ] Document the new Discord commands and subscription endpoints.
- [ ] Run `pytest tests -q`, `npm test`, `npm run build`, `npm audit --audit-level=moderate`, and API smoke tests.
