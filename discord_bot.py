"""Discord bot for Darkpool Monitor."""

from __future__ import annotations

import os
import logging
from datetime import datetime

import discord
from discord import app_commands
from dotenv import load_dotenv

from darkpool.confluence import score_confluence
from darkpool.fixtures import get_stock, sample_exposure_nodes, sample_options_flow
from darkpool.level_engine import cluster_darkpool_levels
from darkpool.providers import fetch_provider_result

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DISCORD_TOKEN = os.getenv("DISCORD_BOT_TOKEN", "")
DISCORD_GUILD_ID = os.getenv("DISCORD_GUILD_ID", "")

ALERT_THRESHOLDS: dict[str, int] = {}


class DarkpoolBot(discord.Client):
    """Discord bot for dark pool monitoring commands."""

    def __init__(self):
        intents = discord.Intents.default()
        intents.message_content = True
        super().__init__(intents=intents)
        self.tree = app_commands.CommandTree(self)

    async def setup_hook(self):
        if DISCORD_GUILD_ID:
            guild = discord.Object(id=int(DISCORD_GUILD_ID))
            self.tree.copy_global_to(guild=guild)
            await self.tree.sync(guild=guild)
        else:
            await self.tree.sync()
        logger.info("Commands synced")


bot = DarkpoolBot()


@bot.tree.command()
async def darkpool(interaction: discord.Interaction, symbol: str = "AAPL", provider: str = "demo"):
    """Get dark pool levels and confluence context for a symbol."""
    await interaction.response.defer()

    try:
        sym = symbol.upper()
        provider_result = await fetch_provider_result(sym, provider=provider, limit=300)
        stock = get_stock(sym)
        spot = float(stock.get("basePrice", 100.0))
        levels = cluster_darkpool_levels(provider_result.prints)[:3]
        scores = score_confluence(
            sym,
            spot,
            levels,
            sample_exposure_nodes(sym, spot),
            sample_options_flow(sym),
        )[:3]

        embed = discord.Embed(
            title=f"Darkpool: {sym}",
            description="Context levels only. Require price confirmation before acting.",
            color=discord.Color.blue(),
            timestamp=datetime.utcnow(),
        )
        embed.add_field(name="Provider", value=provider_result.provider, inline=True)
        embed.add_field(name="Prints", value=f"{len(provider_result.prints):,}", inline=True)
        embed.add_field(name="Spot", value=f"${spot:.2f}", inline=True)

        if provider_result.degraded and provider_result.message:
            embed.add_field(name="Mode", value=provider_result.message[:1024], inline=False)

        if levels:
            embed.add_field(
                name="Top Levels",
                value="\n".join(
                    f"${level.price:.2f} | score {level.strength_score:.1f} | {level.total_size:,} sh"
                    for level in levels
                ),
                inline=False,
            )
        if scores:
            embed.add_field(
                name="Confluence",
                value="\n".join(
                    f"${score.level_price:.2f} | {score.direction} | {score.score:.1f}"
                    for score in scores
                ),
                inline=False,
            )

        await interaction.followup.send(embed=embed)
    except Exception as exc:
        logger.exception("Discord /darkpool failed")
        await interaction.followup.send(f"Error: {exc}")


@bot.tree.command()
async def setalert(interaction: discord.Interaction, symbol: str, threshold: int = 100000):
    """Set a whale alert threshold for a symbol."""
    ALERT_THRESHOLDS[symbol.upper()] = threshold
    embed = discord.Embed(
        title=f"Alert set for {symbol.upper()}",
        description=f"Whale alerts trigger for {threshold:,}+ shares",
        color=discord.Color.green(),
    )
    embed.add_field(name="Symbol", value=symbol.upper(), inline=True)
    embed.add_field(name="Threshold", value=f"{threshold:,}", inline=True)
    await interaction.response.send_message(embed=embed)


@bot.tree.command()
async def alertstatus(interaction: discord.Interaction):
    """Show all configured whale alerts."""
    if not ALERT_THRESHOLDS:
        await interaction.response.send_message("No alerts configured. Use /setalert symbol:AAPL threshold:100000")
        return

    embed = discord.Embed(title="Active Whale Alerts", color=discord.Color.gold())
    for symbol, threshold in ALERT_THRESHOLDS.items():
        embed.add_field(name=symbol, value=f"{threshold:,} shares", inline=True)
    await interaction.response.send_message(embed=embed)


@bot.tree.command()
async def removealert(interaction: discord.Interaction, symbol: str):
    """Remove a whale alert for a symbol."""
    sym = symbol.upper()
    if sym in ALERT_THRESHOLDS:
        del ALERT_THRESHOLDS[sym]
        await interaction.response.send_message(f"Alert removed for {sym}")
    else:
        await interaction.response.send_message(f"No alert found for {sym}")


@bot.event
async def on_ready():
    logger.info("Logged in as %s", bot.user)


@bot.event
async def on_guild_join(guild: discord.Guild):
    logger.info("Joined guild: %s (%s)", guild.name, guild.id)


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
        "title": f"Darkpool Alert: {symbol}",
        "description": f"{direction} {size:,} shares @ ${price:.2f}",
        "color": color,
        "fields": [
            {"name": "Type", "value": alert_type, "inline": True},
            {"name": "Notional", "value": f"${size * price:,.0f}", "inline": True},
        ],
        "timestamp": datetime.utcnow().isoformat(),
    }
    payload = {"content": f"Darkpool {alert_type.title()} Alert", "embeds": [embed]}

    async with httpx.AsyncClient() as client:
        await client.post(webhook_url, json=payload, timeout=10.0)


if __name__ == "__main__":
    if DISCORD_TOKEN:
        bot.run(DISCORD_TOKEN)
    else:
        print("DISCORD_BOT_TOKEN not set in .env")
        print("Add to .env: DISCORD_BOT_TOKEN=your_token_here")
        print("Optional: DISCORD_GUILD_ID=your_server_id")
