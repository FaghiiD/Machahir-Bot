import discord
from discord.ext import commands
import logging
from dotenv import load_dotenv
import os
import json
import asyncio
import random
from datetime import datetime
import aiohttp
from urllib.parse import quote

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

async def get_celebrity_image(celebrity_name):
    """Fetch celebrity image from Wikipedia"""
    try:
        async with aiohttp.ClientSession() as session:
            # Try direct page lookup first
            search_url = "https://en.wikipedia.org/w/api.php"
            
            # Method 1: Direct title lookup
            page_params = {
                "action": "query",
                "format": "json",
                "titles": celebrity_name,
                "prop": "pageimages",
                "pithumbsize": "500"
            }
            
            async with session.get(search_url, params=page_params) as response:
                if response.status == 200:
                    data = await response.json()
                    logger.info(f"Direct lookup response for {celebrity_name}: {data}")
                    if 'query' in data and 'pages' in data['query']:
                        for page_id, page_data in data['query']['pages'].items():
                            if page_id != '-1' and 'thumbnail' in page_data:
                                return page_data['thumbnail']['source']
            
            # Method 2: Search and get page images
            search_params = {
                "action": "query",
                "format": "json",
                "list": "search",
                "srsearch": celebrity_name,
                "srlimit": "3"
            }
            
            async with session.get(search_url, params=search_params) as response:
                if response.status == 200:
                    data = await response.json()
                    if 'query' in data and 'search' in data['query']:
                        for result in data['query']['search']:
                            title = result['title']
                            
                            # Get image for this title
                            image_params = {
                                "action": "query",
                                "format": "json",
                                "titles": title,
                                "prop": "pageimages",
                                "pithumbsize": "500"
                            }
                            
                            async with session.get(search_url, params=image_params) as img_response:
                                if img_response.status == 200:
                                    img_data = await img_response.json()
                                    if 'query' in img_data and 'pages' in img_data['query']:
                                        for page_id, page_data in img_data['query']['pages'].items():
                                            if 'thumbnail' in page_data:
                                                logger.info(f"Found image for {celebrity_name}: {page_data['thumbnail']['source']}")
                                                return page_data['thumbnail']['source']
                                
    except Exception as e:
        logger.error(f"Error fetching image for {celebrity_name}: {e}")
    
    logger.warning(f"No image found for {celebrity_name}")
    return None

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
    
    # Send loading message
    loading_msg = await ctx.send("🔍 **Fetching celebrity image...**")
    
    # Select random celebrity
    celebrity = random.choice(celebrities_data['celebrities'])
    
    # Try to get image from stored URL first, then fetch from Wikipedia
    image_url = celebrity.get('image_url')
    if not image_url:
        image_url = await get_celebrity_image(celebrity['name'])
    
    # Mark channel as having active quiz
    active_quizzes[ctx.channel.id] = {
        'celebrity': celebrity,
        'start_time': datetime.now(),
        'attempts': 0
    }
    
    embed = discord.Embed(
        title="🎯 Who is this celebrity?",
        description="Type the name of this famous Arab celebrity!",
        color=0x3498db
    )
    
    # Add image if found
    if image_url:
        embed.set_image(url=image_url)
    else:
        # If no image, show category as hint
        if celebrity.get('category'):
            embed.add_field(name="Category", value=celebrity['category'], inline=False)
        embed.add_field(name="Note", value="Image not available", inline=False)
    
    embed.add_field(name="How to answer", value="Type your answer in this chat!", inline=False)
    embed.set_footer(text="You have 30 seconds to answer • Type the celebrity's name")
    
    # Update the loading message with the quiz
    await loading_msg.edit(content="", embed=embed)
    
    # Update stats
    stats['quizzes_played'] += 1
    
    # Set timeout
    await asyncio.sleep(30)
    if ctx.channel.id in active_quizzes:
        correct_name = active_quizzes[ctx.channel.id]['celebrity']['name']
        await ctx.send(f"⏰ **Time's up!** The answer was **{correct_name}**")
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