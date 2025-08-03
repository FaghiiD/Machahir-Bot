import discord
from discord.ext import commands
import logging
from dotenv import load_dotenv
import os
import json
import asyncio
import random
from datetime import datetime

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

# Bot data
active_quizzes = {}
stats = {
    'quizzes_played': 0,
    'questions_answered': 0,
    'start_time': datetime.now()
}

def load_celebrities():
    """Load celebrities from JSON file"""
    try:
        with open('data/celebrities.json', 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        logger.warning("celebrities.json not found, creating empty database")
        return {"celebrities": []}
    except Exception as e:
        logger.error(f"Error loading celebrities: {e}")
        return {"celebrities": []}

# Load celebrities data
celebrities_data = load_celebrities()

@bot.event
async def on_ready():
    logger.info(f'{bot.user} has connected to Discord!')
    logger.info(f'Bot is in {len(bot.guilds)} guilds')
    activity = discord.Game(name="Arab Celebrity Quiz! Use +quiz to start")
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

@bot.command(name='quiz')
async def start_quiz(ctx):
    """Start a celebrity quiz"""
    if ctx.channel.id in active_quizzes:
        await ctx.send("❌ A quiz is already active in this channel! Wait for it to finish.")
        return
    
    if not celebrities_data['celebrities']:
        await ctx.send("❌ No celebrities in database. Use +addcelebrity to add some!")
        return
    
    # Select random celebrity
    celebrity = random.choice(celebrities_data['celebrities'])
    
    # Mark channel as having active quiz
    active_quizzes[ctx.channel.id] = {
        'celebrity': celebrity,
        'start_time': datetime.now(),
        'attempts': 0
    }
    
    embed = discord.Embed(
        title="🎯 Celebrity Quiz!",
        description=f"Who is this famous Arab celebrity?",
        color=0x3498db
    )
    
    # Add hints
    hints = []
    if celebrity.get('category'):
        hints.append(f"**Category:** {celebrity['category']}")
    if celebrity.get('description'):
        hints.append(f"**Hint:** {celebrity['description'][:100]}...")
    
    if hints:
        embed.add_field(name="Hints", value="\n".join(hints), inline=False)
    
    embed.add_field(name="How to answer", value="Type your answer in the chat!", inline=False)
    embed.set_footer(text="Type the celebrity's name to answer • 30 seconds to answer")
    
    await ctx.send(embed=embed)
    
    # Set timeout
    await asyncio.sleep(30)
    if ctx.channel.id in active_quizzes:
        correct_name = active_quizzes[ctx.channel.id]['celebrity']['name']
        await ctx.send(f"⏰ Time's up! The answer was **{correct_name}**")
        del active_quizzes[ctx.channel.id]

@bot.command(name='stats')
async def show_stats(ctx):
    """Show bot statistics"""
    uptime = datetime.now() - stats['start_time']
    
    embed = discord.Embed(
        title="📊 Bot Statistics",
        color=0xe74c3c
    )
    
    embed.add_field(name="Quizzes Played", value=stats['quizzes_played'], inline=True)
    embed.add_field(name="Questions Answered", value=stats['questions_answered'], inline=True)
    embed.add_field(name="Celebrities in DB", value=len(celebrities_data['celebrities']), inline=True)
    embed.add_field(name="Active Quizzes", value=len(active_quizzes), inline=True)
    embed.add_field(name="Uptime", value=str(uptime).split('.')[0], inline=True)
    
    await ctx.send(embed=embed)

@bot.command(name='listcelebrities')
async def list_celebrities(ctx):
    """List all celebrities in the database"""
    if not celebrities_data['celebrities']:
        await ctx.send("📝 The celebrity database is empty. Use +addcelebrity to add some!")
        return
    
    embed = discord.Embed(
        title="🌟 Celebrity Database",
        color=0x3498db
    )
    
    celebrity_list = []
    for i, celebrity in enumerate(celebrities_data['celebrities'][:10], 1):  # Show first 10
        name = celebrity['name']
        category = celebrity.get('category', 'Unknown')
        celebrity_list.append(f"{i}. **{name}** ({category})")
    
    embed.description = "\n".join(celebrity_list)
    
    if len(celebrities_data['celebrities']) > 10:
        embed.set_footer(text=f"Showing 10 of {len(celebrities_data['celebrities'])} celebrities")
    else:
        embed.set_footer(text=f"Total: {len(celebrities_data['celebrities'])} celebrities")
    
    await ctx.send(embed=embed)

@bot.command(name='help')
async def help_command(ctx):
    """Show help"""
    embed = discord.Embed(
        title="🎯 Arab Celebrity Quiz Bot Help",
        description="Dynamic celebrity quiz with Wikipedia integration!",
        color=0x9b59b6
    )
    
    commands_info = [
        ("🎲 `+quiz`", "Start a new celebrity quiz"),
        ("📋 `+listcelebrities`", "View all celebrities in database"),
        ("📊 `+stats`", "Show bot statistics"),
        ("🧪 `+test`", "Test if bot is working"),
        ("🏓 `+ping`", "Check bot latency"),
        ("❓ `+help`", "Show this help message")
    ]
    
    for name, description in commands_info:
        embed.add_field(name=name, value=description, inline=False)
    
    embed.add_field(
        name="🎮 How to Play",
        value="Use +quiz to start, then type your answer in the chat!",
        inline=False
    )
    
    embed.set_footer(text="Bot supports Arabic names and handles typos!")
    await ctx.send(embed=embed)

@bot.event
async def on_message(message):
    # Ignore bot messages
    if message.author.bot:
        return
    
    # Check if this is a quiz answer
    if message.channel.id in active_quizzes:
        quiz_data = active_quizzes[message.channel.id]
        celebrity = quiz_data['celebrity']
        user_answer = message.content.lower().strip()
        
        # Check if answer matches
        correct_answers = [celebrity['name'].lower()]
        if celebrity.get('aliases'):
            correct_answers.extend([alias.lower() for alias in celebrity['aliases']])
        if celebrity.get('arabic_name'):
            correct_answers.append(celebrity['arabic_name'].lower())
        
        # Simple fuzzy matching - check if answer contains main parts
        is_correct = False
        for correct_answer in correct_answers:
            if user_answer in correct_answer or correct_answer in user_answer:
                is_correct = True
                break
            # Check word-by-word match
            user_words = user_answer.split()
            correct_words = correct_answer.split()
            if len(user_words) >= 1 and len(correct_words) >= 1:
                if any(word in correct_answer for word in user_words if len(word) > 2):
                    is_correct = True
                    break
        
        if is_correct:
            # Correct answer
            time_taken = datetime.now() - quiz_data['start_time']
            await message.add_reaction("✅")
            
            embed = discord.Embed(
                title="🎉 Correct!",
                description=f"**{celebrity['name']}** is correct!",
                color=0x00ff00
            )
            
            if celebrity.get('description'):
                embed.add_field(name="About", value=celebrity['description'][:200], inline=False)
            
            embed.add_field(name="Time taken", value=f"{time_taken.seconds} seconds", inline=True)
            embed.add_field(name="Answered by", value=message.author.mention, inline=True)
            
            await message.channel.send(embed=embed)
            
            # Update stats
            stats['questions_answered'] += 1
            del active_quizzes[message.channel.id]
        else:
            # Wrong answer
            quiz_data['attempts'] += 1
            if quiz_data['attempts'] >= 3:
                await message.add_reaction("❌")
                await message.channel.send(f"❌ Sorry, the correct answer was **{celebrity['name']}**")
                del active_quizzes[message.channel.id]
            else:
                await message.add_reaction("❌")
                remaining = 3 - quiz_data['attempts']
                await message.channel.send(f"❌ Wrong! You have {remaining} attempts left.")
    
    # Process commands
    await bot.process_commands(message)

@bot.event
async def on_command_error(ctx, error):
    if isinstance(error, commands.CommandNotFound):
        logger.warning(f"Command not found: {ctx.message.content}")
        await ctx.send(f"❌ Command not found. Use +help to see available commands.")
    else:
        logger.error(f"Command error: {error}")
        await ctx.send("❌ An error occurred while processing the command.")

if __name__ == "__main__":
    token = os.getenv('DISCORD_TOKEN')
    if not token:
        logger.error("DISCORD_TOKEN not found in environment variables")
        exit(1)
    
    logger.info("Starting Arabic Celebrity Quiz Bot...")
    bot.run(token)