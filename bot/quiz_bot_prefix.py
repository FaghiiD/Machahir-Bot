"""
Enhanced Discord Quiz Bot with Wikipedia integration and fuzzy matching - Prefix Commands Only
"""

import discord
from discord.ext import commands
import asyncio
import logging
import random
from datetime import datetime, timedelta
from .wikipedia_service import WikipediaService
from .fuzzy_matcher import FuzzyMatcher
from .image_cache import ImageCache
from .quiz_game import QuizGame
import json
import os

logger = logging.getLogger(__name__)

class QuizBot(commands.Bot):
    def __init__(self):
        intents = discord.Intents.default()
        intents.message_content = True
        intents.reactions = True
        
        super().__init__(
            command_prefix='+',
            intents=intents,
            help_command=None
        )
        
        # Initialize services
        self.wikipedia_service = WikipediaService()
        self.fuzzy_matcher = FuzzyMatcher()
        self.image_cache = ImageCache()
        self.quiz_game = QuizGame(self)
        
        # Active quizzes per channel
        self.active_quizzes = {}
        
        # Load celebrities database
        self.celebrities = self.load_celebrities()
        
        # Bot statistics
        self.stats = {
            'quizzes_played': 0,
            'questions_answered': 0,
            'images_fetched': 0,
            'start_time': datetime.now()
        }

    async def setup_hook(self):
        """Called when bot is starting up"""
        logger.info(f"Bot {self.user} is starting up...")
        logger.info("Using prefix commands (+quiz, +addcelebrity, etc.)")

    async def on_ready(self):
        """Called when bot is ready"""
        logger.info(f'{self.user} has connected to Discord!')
        logger.info(f'Bot is in {len(self.guilds)} guilds')
        
        # Set bot status
        activity = discord.Game(name="Arab Celebrity Quiz! Use +quiz to start")
        await self.change_presence(activity=activity)

    def load_celebrities(self):
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

    @commands.command(name="quiz", description="Start an Arab celebrity quiz")
    async def start_quiz(self, ctx):
        """Start a new quiz session"""
        if ctx.channel.id in self.active_quizzes:
            await ctx.send("❌ A quiz is already active in this channel! Wait for it to finish.")
            return
        
        await ctx.send("🎯 **Starting Arab Celebrity Quiz!**\nFetching a celebrity image...")
        
        try:
            # Start quiz game
            await self.quiz_game.start_quiz(ctx)
            self.stats['quizzes_played'] += 1
            
        except Exception as e:
            logger.error(f"Error starting quiz: {e}")
            await ctx.send("❌ Sorry, there was an error starting the quiz. Please try again later.")

    @commands.command(name="addcelebrity", description="Add a new celebrity to the database")
    async def add_celebrity(self, ctx, *, celebrity_info: str):
        """Add a new celebrity to the database
        Format: name|alias1,alias2|arabic_name|category
        """
        if not celebrity_info:
            await ctx.send("❌ Please provide celebrity information in the format: `name|alias1,alias2|arabic_name|category`")
            return
        
        try:
            parts = celebrity_info.split('|')
            if len(parts) < 2:
                await ctx.send("❌ Invalid format. Use: `name|alias1,alias2|arabic_name|category`")
                return
            
            name = parts[0].strip()
            aliases = [alias.strip() for alias in parts[1].split(',')] if len(parts) > 1 else []
            arabic_name = parts[2].strip() if len(parts) > 2 else ""
            category = parts[3].strip() if len(parts) > 3 else "actor"
            
            # Check if celebrity already exists
            existing = any(cel['name'].lower() == name.lower() for cel in self.celebrities['celebrities'])
            if existing:
                await ctx.send(f"❌ Celebrity '{name}' already exists in the database.")
                return
            
            # Try to fetch image from Wikipedia
            await ctx.send(f"🔍 Searching for '{name}' on Wikipedia...")
            
            celebrity_data = await self.wikipedia_service.get_celebrity_profile(name)
            
            if not celebrity_data or not celebrity_data.get('image_url'):
                await ctx.send(f"⚠️ Could not find image for '{name}' on Wikipedia. Adding without image.")
                celebrity_data = {'name': name, 'image_url': None, 'description': ''}
            
            # Create celebrity entry
            new_celebrity = {
                'name': name,
                'aliases': aliases,
                'arabic_name': arabic_name,
                'category': category,
                'image_url': celebrity_data.get('image_url'),
                'description': celebrity_data.get('description', ''),
                'wikipedia_url': celebrity_data.get('wikipedia_url', ''),
                'added_by': str(ctx.author),
                'added_date': datetime.now().isoformat()
            }
            
            # Add to database
            self.celebrities['celebrities'].append(new_celebrity)
            
            # Save to file
            self.save_celebrities()
            
            embed = discord.Embed(
                title="✅ Celebrity Added Successfully!",
                description=f"**{name}** has been added to the quiz database.",
                color=0x00ff00
            )
            embed.add_field(name="Aliases", value=", ".join(aliases) if aliases else "None", inline=True)
            embed.add_field(name="Arabic Name", value=arabic_name if arabic_name else "None", inline=True)
            embed.add_field(name="Category", value=category, inline=True)
            
            if celebrity_data.get('image_url'):
                embed.set_thumbnail(url=celebrity_data['image_url'])
                embed.add_field(name="Image", value="✅ Found on Wikipedia", inline=False)
            else:
                embed.add_field(name="Image", value="❌ Not found", inline=False)
            
            await ctx.send(embed=embed)
            
        except Exception as e:
            logger.error(f"Error adding celebrity: {e}")
            await ctx.send("❌ Error adding celebrity. Please check the format and try again.")

    def save_celebrities(self):
        """Save celebrities to JSON file"""
        try:
            os.makedirs('data', exist_ok=True)
            with open('data/celebrities.json', 'w', encoding='utf-8') as f:
                json.dump(self.celebrities, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"Error saving celebrities: {e}")

    @commands.command(name="listcelebrities", description="List all celebrities in the database")
    async def list_celebrities(self, ctx):
        """List all celebrities in the database"""
        if not self.celebrities['celebrities']:
            await ctx.send("📝 The celebrity database is empty. Use `+addcelebrity` to add some!")
            return
        
        # Create paginated list
        celebrities = self.celebrities['celebrities']
        per_page = 10
        pages = [celebrities[i:i + per_page] for i in range(0, len(celebrities), per_page)]
        
        if not pages:
            await ctx.send("📝 No celebrities found in database.")
            return
        
        # Show first page
        page = 0
        embed = self.create_celebrity_list_embed(pages[page], page + 1, len(pages))
        
        if len(pages) == 1:
            await ctx.send(embed=embed)
        else:
            message = await ctx.send(embed=embed)
            
            # Add navigation reactions
            await message.add_reaction('⬅️')
            await message.add_reaction('➡️')
            
            def check(reaction, user):
                return (user == ctx.author and 
                       str(reaction.emoji) in ['⬅️', '➡️'] and 
                       reaction.message.id == message.id)
            
            # Handle page navigation
            while True:
                try:
                    reaction, user = await self.wait_for('reaction_add', timeout=60.0, check=check)
                    
                    if str(reaction.emoji) == '➡️' and page < len(pages) - 1:
                        page += 1
                    elif str(reaction.emoji) == '⬅️' and page > 0:
                        page -= 1
                    
                    embed = self.create_celebrity_list_embed(pages[page], page + 1, len(pages))
                    await message.edit(embed=embed)
                    await message.remove_reaction(reaction, user)
                    
                except asyncio.TimeoutError:
                    await message.clear_reactions()
                    break

    def create_celebrity_list_embed(self, celebrities, page_num, total_pages):
        """Create embed for celebrity list"""
        embed = discord.Embed(
            title="🌟 Celebrity Database",
            description=f"Page {page_num}/{total_pages}",
            color=0x3498db
        )
        
        for i, celebrity in enumerate(celebrities, 1):
            name = celebrity['name']
            aliases = ", ".join(celebrity.get('aliases', []))
            arabic_name = celebrity.get('arabic_name', '')
            category = celebrity.get('category', 'Unknown')
            
            value = f"**Category:** {category}\n"
            if aliases:
                value += f"**Aliases:** {aliases}\n"
            if arabic_name:
                value += f"**Arabic:** {arabic_name}\n"
            
            embed.add_field(
                name=f"{(page_num-1)*10 + i}. {name}",
                value=value,
                inline=False
            )
        
        embed.set_footer(text=f"Total celebrities: {len(self.celebrities['celebrities'])}")
        return embed

    @commands.command(name="stats", description="Show bot statistics")
    async def show_stats(self, ctx):
        """Show bot statistics"""
        uptime = datetime.now() - self.stats['start_time']
        
        embed = discord.Embed(
            title="📊 Bot Statistics",
            color=0xe74c3c
        )
        
        embed.add_field(name="Quizzes Played", value=self.stats['quizzes_played'], inline=True)
        embed.add_field(name="Questions Answered", value=self.stats['questions_answered'], inline=True)
        embed.add_field(name="Images Fetched", value=self.stats['images_fetched'], inline=True)
        embed.add_field(name="Celebrities in DB", value=len(self.celebrities['celebrities']), inline=True)
        embed.add_field(name="Active Quizzes", value=len(self.active_quizzes), inline=True)
        embed.add_field(name="Uptime", value=str(uptime).split('.')[0], inline=True)
        
        await ctx.send(embed=embed)

    @commands.command(name="help", description="Show help information")
    async def help_command(self, ctx):
        """Show help information"""
        embed = discord.Embed(
            title="🎯 Arab Celebrity Quiz Bot Help",
            description="Dynamic celebrity quiz with Wikipedia integration!",
            color=0x9b59b6
        )
        
        commands_info = [
            ("🎲 `+quiz`", "Start a new celebrity quiz"),
            ("➕ `+addcelebrity`", "Add celebrity: `name|alias1,alias2|arabic_name|category`"),
            ("📋 `+listcelebrities`", "View all celebrities in database"),
            ("📊 `+stats`", "Show bot statistics"),
            ("❓ `+help`", "Show this help message")
        ]
        
        for name, description in commands_info:
            embed.add_field(name=name, value=description, inline=False)
        
        embed.add_field(
            name="🎮 How to Play",
            value="React with 🅰️🅱️🅨🅳 for multiple choice or type your answer!",
            inline=False
        )
        
        embed.set_footer(text="Bot supports Arabic names and handles typos with fuzzy matching!")
        
        await ctx.send(embed=embed)

    async def on_message(self, message):
        """Handle quiz answers and commands"""
        # Ignore bot messages
        if message.author.bot:
            return
        
        # Check if this is a quiz answer
        if message.channel.id in self.active_quizzes:
            await self.quiz_game.handle_answer(message)
        
        # Process commands
        await self.process_commands(message)

    async def on_reaction_add(self, reaction, user):
        """Handle quiz reactions"""
        if user.bot:
            return
        
        if reaction.message.channel.id in self.active_quizzes:
            await self.quiz_game.handle_reaction(reaction, user)