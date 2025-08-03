import discord
from discord.ext import commands
import logging
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Set up bot
intents = discord.Intents.default()
intents.message_content = True
intents.reactions = True

bot = commands.Bot(command_prefix='+', intents=intents, help_command=None)

@bot.event
async def on_ready():
    logger.info(f'{bot.user} has connected to Discord!')
    logger.info(f'Bot is in {len(bot.guilds)} guilds')
    activity = discord.Game(name="Arab Celebrity Quiz! Use +test to test")
    await bot.change_presence(activity=activity)

@bot.command(name='test')
async def test_command(ctx):
    """Simple test command"""
    await ctx.send("✅ Bot is working! Prefix commands are active.")
    logger.info(f"Test command used by {ctx.author}")

@bot.command(name='ping')
async def ping_command(ctx):
    """Ping command"""
    await ctx.send(f"Pong! Latency: {round(bot.latency * 1000)}ms")

@bot.command(name='help')
async def help_command(ctx):
    """Show help"""
    embed = discord.Embed(
        title="🎯 Arab Celebrity Quiz Bot Help",
        description="Bot is working with prefix commands!",
        color=0x9b59b6
    )
    embed.add_field(name="+test", value="Test if bot is working", inline=False)
    embed.add_field(name="+ping", value="Check bot latency", inline=False)
    embed.add_field(name="+help", value="Show this help", inline=False)
    await ctx.send(embed=embed)

@bot.event
async def on_command_error(ctx, error):
    if isinstance(error, commands.CommandNotFound):
        logger.warning(f"Command not found: {ctx.message.content}")
        await ctx.send(f"Command not found. Use +help to see available commands.")
    else:
        logger.error(f"Command error: {error}")

if __name__ == "__main__":
    token = os.getenv('DISCORD_TOKEN')
    if not token:
        logger.error("DISCORD_TOKEN not found in environment variables")
        exit(1)
    
    logger.info("Starting simple Discord bot...")
    bot.run(token)