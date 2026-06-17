"""Discord Bot for Darkpool Monitor.

Provides slash commands and webhook alerts for Discord servers.
"""

import os
import logging
from datetime import datetime

import discord
from discord import app_commands
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============================================================================
# Bot Configuration
# ============================================================================

DISCORD_TOKEN = os.getenv("DISCORD_BOT_TOKEN", "")
GUILD_ID = os.getenv("DISCORD_GUILD_ID", "")


class DarkpoolBot(discord.Client):
    """Discord bot for darkpool monitoring."""

    def __init__(self):
        intents = discord.Intents.default()
        intents.message_content = True
        super().__init__(intents=intents)
        self.tree = app_commands.CommandTree(self)

    async def setup_hook(self):
        """Set up the bot."""
        await self.tree.sync()
        logger.info("Commands synced")


# ============================================================================
# Initialize Bot
# ============================================================================

bot = DarkpoolBot()


# ============================================================================
# Slash Commands
# ============================================================================

@bot.tree.command()
async def darkpool(interaction: discord.Interaction, symbol: str = None, tier: str = "T1"):
    """Get dark pool data for a symbol.

    Parameters
    ----------
    symbol : str, optional
        Stock symbol (e.g., AAPL, NVDA). Leave empty for all symbols.
    tier : str
        T1 (S&P 500), T2 (NMS), or OTCE (OTC) - default: T1
    """
    import httpx

    await interaction.response.defer()

    try:
        # Get FINRA data
        # First get available weeks
        async with httpx.AsyncClient(follow_redirects=True) as client:
            # Establish session
            await client.get("https://www.finra.org/finra-data", timeout=10)

            # Get weeks
            weeks_req = {
                "compareFilters": [
                    {"compareType": "EQUAL", "fieldName": "summaryTypeCode", "fieldValue": "ATS_W_SMBL"},
                    {"compareType": "EQUAL", "fieldName": "tierIdentifier", "fieldValue": tier},
                ],
                "fields": ["weekStartDate"],
                "limit": 4,
                "sortFields": ["-weekStartDate"],
            }

            weeks_resp = await client.post(
                "https://api.finra.org/data/group/otcMarket/name/weeklyDownloadDetails",
                headers={"Content-Type": "application/json"},
                json=weeks_req,
                timeout=20,
            )

            weeks = weeks_resp.json() if weeks_resp.status_code == 200 else []
            latest_week = weeks[0]["weekStartDate"] if weeks else "N/A"

            # Get data for symbol
            if symbol:
                data_req = {
                    "compareFilters": [
                        {"compareType": "EQUAL", "fieldName": "weekStartDate", "fieldValue": latest_week},
                        {"compareType": "EQUAL", "fieldName": "tierIdentifier", "fieldValue": tier},
                        {"compareType": "EQUAL", "fieldName": "summaryTypeCode", "fieldValue": "ATS_W_SMBL"},
                        {"compareType": "EQUAL", "fieldName": "issueSymbolIdentifier", "fieldValue": symbol.upper()},
                    ],
                    "fields": ["issueSymbolIdentifier", "totalWeeklyShareQuantity", "totalWeeklyTradeCount"],
                    "limit": 10,
                    "sortFields": ["-totalWeeklyShareQuantity"],
                }

                data_resp = await client.post(
                    "https://api.finra.org/data/group/otcMarket/name/weeklySummary",
                    headers={"Content-Type": "application/json"},
                    json=data_req,
                    timeout=20,
                )

                records = data_resp.json() if data_resp.status_code == 200 else []
                record_count = len(records)

                if records:
                    total_shares = sum(r.get("totalWeeklyShareQuantity", 0) for r in records)
                    total_trades = sum(r.get("totalWeeklyTradeCount", 0) for r in records)

                    embed = discord.Embed(
                        title=f"📊 Darkpool: {symbol.upper()}",
                        color=discord.Color.blue(),
                        timestamp=datetime.utcnow(),
                    )
                    embed.add_field(name="Week", value=latest_week, inline=True)
                    embed.add_field(name="Records", value=f"{record_count:,}", inline=True)
                    embed.add_field(name="Total Shares", value=f"{total_shares:,.0f}", inline=True)
                    embed.add_field(name="Total Trades", value=f"{total_trades:,}", inline=True)
                    embed.add_field(name="Tier", value=tier, inline=True)
                    embed.add_field(name="Provider", value="FINRA", inline=True)

                    await interaction.followup.send(embed=embed)
                else:
                    await interaction.followup.send(f"No dark pool data found for {symbol.upper()}")
            else:
                # No symbol, show summary of available data
                embed = discord.Embed(
                    title="📊 Darkpool Monitor",
                    description="Use `/darkpool symbol:AAPL` or `/darkpool symbol:NVDA tier:T1`",
                    color=discord.Color.blue(),
                )
                embed.add_field(name="Tier", value=tier, inline=True)
                embed.add_field(name="Latest Week", value=latest_week, inline=True)
                embed.add_field(name="Provider", value="FINRA (Free)", inline=True)

                await interaction.followup.send(embed=embed)

    except Exception as e:
        logger.error(f"Error: {e}")
        await interaction.followup.send(f"Error: {str(e)}")


@bot.tree.command()
async def setalert(interaction: discord.Interaction, symbol: str, threshold: int = 100000):
    """Set a whale alert threshold for a symbol.

    Parameters
    ----------
    symbol : str
        Stock symbol (e.g., AAPL, NVDA)
    threshold : int
        Minimum share quantity to trigger alert (default: 100,000)
    """
    # Store in memory (use database for persistence in production)
    ALERT_THRESHOLDS[symbol.upper()] = threshold

    embed = discord.Embed(
        title=f"🐋 Alert Set for {symbol.upper()}",
        description=f"Whale alerts will trigger for {threshold:,}+ shares",
        color=discord.Color.green(),
    )
    embed.add_field(name="Symbol", value=symbol.upper(), inline=True)
    embed.add_field(name="Threshold", value=f"{threshold:,}", inline=True)

    await interaction.response.send_message(embed=embed)


@bot.tree.command()
async def alertstatus(interaction: discord.Interaction):
    """Show all configured whale alerts."""
    if not ALERT_THRESHOLDS:
        await interaction.response.send_message("No alerts configured. Use `/setalert symbol:AAPL threshold:100000`")
        return

    embed = discord.Embed(
        title="🐋 Active Whale Alerts",
        color=discord.Color.gold(),
    )

    for symbol, threshold in ALERT_THRESHOLDS.items():
        embed.add_field(name=symbol, value=f"{threshold:,} shares", inline=True)

    await interaction.response.send_message(embed=embed)


@bot.tree.command()
async def removealert(interaction: discord.Interaction, symbol: str):
    """Remove a whale alert for a symbol."""
    symbol = symbol.upper()
    if symbol in ALERT_THRESHOLDS:
        del ALERT_THRESHOLDS[symbol]
        await interaction.response.send_message(f"✅ Alert removed for {symbol}")
    else:
        await interaction.response.send_message(f"No alert found for {symbol}")


# In-memory alert storage (use Redis/database for production)
ALERT_THRESHOLDS: dict[str, int] = {}


# ============================================================================
# Event Handlers
# ============================================================================

@bot.event
async def on_ready():
    """Bot ready."""
    logger.info(f"Logged in as {bot.user}")


@bot.event
async def on_guild_join(guild: discord.Guild):
    """Handle joining a new guild."""
    logger.info(f"Joined guild: {guild.name} ({guild.id})")


# ============================================================================
# Webhook Handler (for sending alerts from backend)
# ============================================================================

async def send_alert(
    webhook_url: str,
    symbol: str,
    direction: str,
    size: int,
    price: float,
    alert_type: str = "whale",
):
    """Send an alert to a Discord webhook."""
    import httpx

    color = 0x00FF00 if direction == "BUY" else 0xFF0000

    embed = {
        "title": f"🚨 Darkpool Alert: {symbol}",
        "description": f"**{direction}** {size:,} shares @ ${price:.2f}",
        "color": color,
        "fields": [
            {"name": "Type", "value": alert_type, "inline": True},
            {"name": "Notional", "value": f"${size * price:,.0f}", "inline": True},
        ],
        "timestamp": datetime.utcnow().isoformat(),
    }

    payload = {
        "content": f"Darkpool {'🐋 Whale' if alert_type == 'whale' else '📊'} Alert",
        "embeds": [embed],
    }

    async with httpx.AsyncClient() as client:
        await client.post(webhook_url, json=payload, timeout=10.0)


# ============================================================================
# Run Bot
# ============================================================================

if __name__ == "__main__":
    if DISCORD_TOKEN:
        bot.run(DISCORD_TOKEN)
    else:
        print("DISCORD_BOT_TOKEN not set in .env")
        print("Add to .env: DISCORD_BOT_TOKEN=your_token_here")
        print("Optional: DISCORD_GUILD_ID=your_server_id")