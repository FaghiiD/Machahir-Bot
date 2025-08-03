"""
Quiz game logic with scoring, leaderboards, and dynamic question generation
"""

import discord
from discord.ext import commands
import asyncio
import random
import logging
from datetime import datetime, timedelta
import json
import os
from io import BytesIO

logger = logging.getLogger(__name__)

class QuizGame:
    def __init__(self, bot):
        self.bot = bot
        self.active_quizzes = {}
        self.scores = self.load_scores()
        
        # Quiz settings
        self.question_timeout = 30  # seconds
        self.points_correct = 10
        self.points_quick_bonus = 5  # bonus for answering quickly
        self.max_questions_per_quiz = 10

    def load_scores(self):
        """Load player scores from file"""
        try:
            if os.path.exists('data/scores.json'):
                with open('data/scores.json', 'r') as f:
                    return json.load(f)
        except Exception as e:
            logger.error(f"Error loading scores: {e}")
        
        return {}

    def save_scores(self):
        """Save player scores to file"""
        try:
            os.makedirs('data', exist_ok=True)
            with open('data/scores.json', 'w') as f:
                json.dump(self.scores, f, indent=2)
        except Exception as e:
            logger.error(f"Error saving scores: {e}")

    async def start_quiz(self, ctx):
        """Start a new quiz session"""
        channel_id = ctx.channel.id
        
        if channel_id in self.active_quizzes:
            await ctx.send("❌ A quiz is already active in this channel!")
            return
        
        # Initialize quiz session
        quiz_session = {
            'channel_id': channel_id,
            'current_question': 0,
            'max_questions': self.max_questions_per_quiz,
            'participants': {},
            'start_time': datetime.now(),
            'used_celebrities': []
        }
        
        self.active_quizzes[channel_id] = quiz_session
        
        try:
            # Send quiz intro
            embed = discord.Embed(
                title="🎯 Arab Celebrity Quiz Started!",
                description=f"Get ready for {self.max_questions_per_quiz} questions about famous Arab celebrities!",
                color=0x00ff00
            )
            embed.add_field(name="⏱️ Time per question", value=f"{self.question_timeout} seconds", inline=True)
            embed.add_field(name="🏆 Points per correct answer", value=f"{self.points_correct} points", inline=True)
            embed.add_field(name="⚡ Quick answer bonus", value=f"+{self.points_quick_bonus} points", inline=True)
            embed.add_field(name="🎮 How to answer", value="React with 🅰️🅱️🅨🅳 or type your answer!", inline=False)
            
            await ctx.send(embed=embed)
            await asyncio.sleep(3)
            
            # Start first question
            await self.next_question(ctx)
            
        except Exception as e:
            logger.error(f"Error starting quiz: {e}")
            if channel_id in self.active_quizzes:
                del self.active_quizzes[channel_id]
            await ctx.send("❌ Error starting quiz. Please try again.")

    async def next_question(self, ctx):
        """Generate and send the next question"""
        channel_id = ctx.channel.id
        quiz_session = self.active_quizzes.get(channel_id)
        
        if not quiz_session:
            return
        
        quiz_session['current_question'] += 1
        current_q = quiz_session['current_question']
        max_q = quiz_session['max_questions']
        
        if current_q > max_q:
            await self.end_quiz(ctx)
            return
        
        try:
            # Get a random celebrity
            celebrity = await self.get_random_celebrity(quiz_session['used_celebrities'])
            
            if not celebrity:
                await ctx.send("❌ No more celebrities available for quiz!")
                await self.end_quiz(ctx)
                return
            
            quiz_session['used_celebrities'].append(celebrity['name'])
            
            # Generate question
            question_data = await self.generate_question(celebrity)
            
            if not question_data:
                await ctx.send("❌ Error generating question. Skipping...")
                await self.next_question(ctx)
                return
            
            # Store current question data
            quiz_session['current_question_data'] = question_data
            quiz_session['question_start_time'] = datetime.now()
            quiz_session['answered_users'] = set()
            
            # Send question
            embed = await self.create_question_embed(question_data, current_q, max_q)
            
            # Try to get and send image
            image_file = None
            if question_data['image_url']:
                image_file = await self.get_question_image(question_data['image_url'])
            
            if image_file:
                message = await ctx.send(embed=embed, file=image_file)
            else:
                message = await ctx.send(embed=embed)
            
            quiz_session['current_message'] = message
            
            # Add reaction options for multiple choice
            if question_data['type'] == 'multiple_choice':
                reactions = ['🇦', '🇧', '🇨', '🇩']
                for reaction in reactions[:len(question_data['options'])]:
                    await message.add_reaction(reaction)
            
            # Start question timer
            asyncio.create_task(self.question_timer(ctx, self.question_timeout))
            
        except Exception as e:
            logger.error(f"Error generating question: {e}")
            await ctx.send("❌ Error generating question. Trying next...")
            await asyncio.sleep(2)
            await self.next_question(ctx)

    async def get_random_celebrity(self, used_celebrities):
        """Get a random celebrity that hasn't been used"""
        available_celebrities = [
            cel for cel in self.bot.celebrities['celebrities']
            if cel['name'] not in used_celebrities
        ]
        
        if not available_celebrities:
            return None
        
        # Prefer celebrities with images
        with_images = [cel for cel in available_celebrities if cel.get('image_url')]
        
        if with_images:
            celebrity = random.choice(with_images)
        else:
            celebrity = random.choice(available_celebrities)
        
        # Try to fetch image from Wikipedia if not available
        if not celebrity.get('image_url'):
            logger.info(f"Fetching image for {celebrity['name']} from Wikipedia...")
            
            profile = await self.bot.wikipedia_service.search_celebrity_variations(
                celebrity['name'],
                celebrity.get('aliases', [])
            )
            
            if profile and profile.get('image_url'):
                celebrity['image_url'] = profile['image_url']
                celebrity['description'] = profile.get('description', celebrity.get('description', ''))
                
                # Save updated celebrity data
                self.bot.save_celebrities()
                self.bot.stats['images_fetched'] += 1
        
        return celebrity

    async def generate_question(self, celebrity):
        """Generate a quiz question for the celebrity"""
        # Determine question type
        question_types = ['multiple_choice', 'open_ended']
        question_type = random.choice(question_types)
        
        if question_type == 'multiple_choice':
            return await self.generate_multiple_choice_question(celebrity)
        else:
            return await self.generate_open_ended_question(celebrity)

    async def generate_multiple_choice_question(self, celebrity):
        """Generate a multiple choice question"""
        # Get other celebrities for wrong options
        other_celebrities = [
            cel for cel in self.bot.celebrities['celebrities']
            if cel['name'] != celebrity['name']
        ]
        
        if len(other_celebrities) < 3:
            # Not enough celebrities for multiple choice, fall back to open ended
            return await self.generate_open_ended_question(celebrity)
        
        # Select random wrong answers
        wrong_answers = random.sample(other_celebrities, 3)
        
        # Create options list
        options = [celebrity['name']] + [cel['name'] for cel in wrong_answers]
        random.shuffle(options)
        
        correct_index = options.index(celebrity['name'])
        
        return {
            'type': 'multiple_choice',
            'celebrity': celebrity,
            'question_text': "Who is this celebrity?",
            'options': options,
            'correct_answer': correct_index,
            'image_url': celebrity.get('image_url')
        }

    async def generate_open_ended_question(self, celebrity):
        """Generate an open-ended question"""
        question_templates = [
            "Who is this celebrity?",
            "Can you identify this famous person?",
            "Name this Arab celebrity:",
            "Who is shown in this image?"
        ]
        
        return {
            'type': 'open_ended',
            'celebrity': celebrity,
            'question_text': random.choice(question_templates),
            'image_url': celebrity.get('image_url')
        }

    async def create_question_embed(self, question_data, current_q, max_q):
        """Create Discord embed for question"""
        embed = discord.Embed(
            title=f"❓ Question {current_q}/{max_q}",
            description=question_data['question_text'],
            color=0x3498db
        )
        
        # Add options for multiple choice
        if question_data['type'] == 'multiple_choice':
            options_text = ""
            for i, option in enumerate(question_data['options']):
                letter = chr(65 + i)  # A, B, C, D
                options_text += f"🇦{letter if letter == 'A' else '🇧' if letter == 'B' else '🇨' if letter == 'C' else '🇩'} {option}\n"
            
            embed.add_field(name="Options:", value=options_text, inline=False)
        
        embed.add_field(name="⏱️ Time:", value=f"{self.question_timeout} seconds", inline=True)
        embed.add_field(name="🏆 Points:", value=f"{self.points_correct} (+{self.points_quick_bonus} bonus)", inline=True)
        
        # Add hint if celebrity has category
        category = question_data['celebrity'].get('category')
        if category:
            embed.add_field(name="💡 Hint:", value=f"Category: {category.title()}", inline=True)
        
        embed.set_footer(text="React with the letter or type your answer!")
        
        return embed

    async def get_question_image(self, image_url):
        """Get image for question (cached or download)"""
        try:
            # Use image cache to get optimized image
            cached_path = await self.bot.image_cache.get_cached_image(image_url)
            
            if cached_path and os.path.exists(cached_path):
                # Return as Discord file
                return discord.File(cached_path, filename="celebrity.jpg")
            else:
                logger.warning(f"Failed to cache image: {image_url}")
                return None
                
        except Exception as e:
            logger.error(f"Error getting question image: {e}")
            return None

    async def question_timer(self, ctx, timeout):
        """Timer for question timeout"""
        await asyncio.sleep(timeout)
        
        channel_id = ctx.channel.id
        quiz_session = self.active_quizzes.get(channel_id)
        
        if quiz_session and 'current_question_data' in quiz_session:
            await self.show_answer_and_continue(ctx)

    async def handle_reaction_answer(self, reaction, user):
        """Handle reaction-based answers"""
        channel_id = reaction.message.channel.id
        quiz_session = self.active_quizzes.get(channel_id)
        
        if not quiz_session or 'current_question_data' not in quiz_session:
            return
        
        # Check if user already answered
        if user.id in quiz_session['answered_users']:
            return
        
        question_data = quiz_session['current_question_data']
        
        # Only handle multiple choice reactions
        if question_data['type'] != 'multiple_choice':
            return
        
        # Map reactions to indices
        reaction_map = {'🇦': 0, '🇧': 1, '🇨': 2, '🇩': 3}
        
        if str(reaction.emoji) not in reaction_map:
            return
        
        selected_index = reaction_map[str(reaction.emoji)]
        correct_index = question_data['correct_answer']
        
        # Calculate points
        is_correct = selected_index == correct_index
        points = self.calculate_points(quiz_session, is_correct)
        
        # Update score
        if is_correct:
            self.update_user_score(user.id, str(user), points)
            quiz_session['answered_users'].add(user.id)
            
            # Send confirmation
            selected_option = question_data['options'][selected_index]
            embed = discord.Embed(
                title="✅ Correct!",
                description=f"{user.mention} got it right: **{selected_option}**\n+{points} points!",
                color=0x00ff00
            )
            
            await reaction.message.channel.send(embed=embed)
            
            # Continue to next question after short delay
            await asyncio.sleep(3)
            await self.show_answer_and_continue(reaction.message.channel)

    async def handle_text_answer(self, message):
        """Handle text-based answers"""
        channel_id = message.channel.id
        quiz_session = self.active_quizzes.get(channel_id)
        
        if not quiz_session or 'current_question_data' not in quiz_session:
            return
        
        # Check if user already answered
        if message.author.id in quiz_session['answered_users']:
            return
        
        question_data = quiz_session['current_question_data']
        celebrity = question_data['celebrity']
        user_answer = message.content.strip()
        
        # Use fuzzy matching to check answer
        is_correct, confidence = self.bot.fuzzy_matcher.is_correct_answer(user_answer, celebrity)
        
        if is_correct:
            # Calculate points
            points = self.calculate_points(quiz_session, True)
            
            # Update score
            self.update_user_score(message.author.id, str(message.author), points)
            quiz_session['answered_users'].add(message.author.id)
            
            # Send confirmation
            embed = discord.Embed(
                title="✅ Correct!",
                description=f"{message.author.mention} got it right: **{celebrity['name']}**\n+{points} points! (Confidence: {confidence:.1f}%)",
                color=0x00ff00
            )
            
            await message.channel.send(embed=embed)
            
            # Continue to next question after short delay
            await asyncio.sleep(3)
            await self.show_answer_and_continue(message.channel)
        
        elif confidence > 60:  # Close but not quite right
            embed = discord.Embed(
                title="🤔 Close!",
                description=f"{message.author.mention}, that's close but not quite right. Try again!",
                color=0xffa500
            )
            await message.channel.send(embed=embed, delete_after=5)

    def calculate_points(self, quiz_session, is_correct):
        """Calculate points for an answer"""
        if not is_correct:
            return 0
        
        base_points = self.points_correct
        
        # Quick answer bonus
        if 'question_start_time' in quiz_session:
            time_elapsed = (datetime.now() - quiz_session['question_start_time']).total_seconds()
            if time_elapsed < 10:  # Answered within 10 seconds
                base_points += self.points_quick_bonus
        
        return base_points

    def update_user_score(self, user_id, username, points):
        """Update user's score"""
        user_id_str = str(user_id)
        
        if user_id_str not in self.scores:
            self.scores[user_id_str] = {
                'username': username,
                'total_points': 0,
                'correct_answers': 0,
                'quizzes_played': 0,
                'last_played': None
            }
        
        self.scores[user_id_str]['total_points'] += points
        self.scores[user_id_str]['correct_answers'] += 1
        self.scores[user_id_str]['last_played'] = datetime.now().isoformat()
        self.scores[user_id_str]['username'] = username  # Update username in case it changed
        
        self.save_scores()

    async def show_answer_and_continue(self, ctx):
        """Show the correct answer and continue to next question"""
        channel_id = ctx.channel.id if hasattr(ctx, 'channel') else ctx.id
        quiz_session = self.active_quizzes.get(channel_id)
        
        if not quiz_session or 'current_question_data' not in quiz_session:
            return
        
        question_data = quiz_session['current_question_data']
        celebrity = question_data['celebrity']
        
        # Create answer embed
        embed = discord.Embed(
            title="📝 Answer",
            description=f"The correct answer was: **{celebrity['name']}**",
            color=0xe74c3c
        )
        
        # Add celebrity info
        if celebrity.get('description'):
            description = celebrity['description'][:200] + "..." if len(celebrity['description']) > 200 else celebrity['description']
            embed.add_field(name="About", value=description, inline=False)
        
        if celebrity.get('aliases'):
            embed.add_field(name="Also known as", value=", ".join(celebrity['aliases']), inline=True)
        
        if celebrity.get('arabic_name'):
            embed.add_field(name="Arabic name", value=celebrity['arabic_name'], inline=True)
        
        if celebrity.get('wikipedia_url'):
            embed.add_field(name="Learn more", value=f"[Wikipedia]({celebrity['wikipedia_url']})", inline=True)
        
        await ctx.send(embed=embed)
        
        # Clean up question data
        if 'current_question_data' in quiz_session:
            del quiz_session['current_question_data']
        
        # Continue to next question
        await asyncio.sleep(3)
        await self.next_question(ctx)

    async def end_quiz(self, ctx):
        """End the quiz and show results"""
        channel_id = ctx.channel.id
        quiz_session = self.active_quizzes.get(channel_id)
        
        if not quiz_session:
            return
        
        # Create results embed
        embed = discord.Embed(
            title="🏁 Quiz Complete!",
            description="Here are the final results:",
            color=0x9b59b6
        )
        
        # Get participants scores for this quiz
        participants = quiz_session.get('participants', {})
        
        if participants:
            # Sort by score
            sorted_participants = sorted(participants.items(), key=lambda x: x[1], reverse=True)
            
            results_text = ""
            for i, (user_id, score) in enumerate(sorted_participants[:10]):  # Top 10
                username = self.scores.get(str(user_id), {}).get('username', 'Unknown')
                medal = "🥇" if i == 0 else "🥈" if i == 1 else "🥉" if i == 2 else f"{i+1}."
                results_text += f"{medal} {username}: {score} points\n"
            
            embed.add_field(name="🏆 Leaderboard", value=results_text, inline=False)
        else:
            embed.add_field(name="😔 No Results", value="No one answered correctly this time!", inline=False)
        
        # Quiz stats
        duration = datetime.now() - quiz_session['start_time']
        embed.add_field(name="⏱️ Duration", value=str(duration).split('.')[0], inline=True)
        embed.add_field(name="❓ Questions", value=f"{quiz_session['current_question']}/{quiz_session['max_questions']}", inline=True)
        
        embed.set_footer(text="Thanks for playing! Use /quiz to start another round.")
        
        await ctx.send(embed=embed)
        
        # Clean up
        del self.active_quizzes[channel_id]

    async def get_leaderboard(self, ctx, limit=10):
        """Show global leaderboard"""
        if not self.scores:
            embed = discord.Embed(
                title="📊 Leaderboard",
                description="No scores recorded yet! Play a quiz to get started.",
                color=0x95a5a6
            )
            await ctx.send(embed=embed)
            return
        
        # Sort users by total points
        sorted_users = sorted(
            self.scores.items(),
            key=lambda x: x[1]['total_points'],
            reverse=True
        )
        
        embed = discord.Embed(
            title="🏆 Global Leaderboard",
            description="Top quiz masters:",
            color=0xf1c40f
        )
        
        leaderboard_text = ""
        for i, (user_id, data) in enumerate(sorted_users[:limit]):
            medal = "🥇" if i == 0 else "🥈" if i == 1 else "🥉" if i == 2 else f"{i+1}."
            username = data['username']
            points = data['total_points']
            correct = data['correct_answers']
            
            leaderboard_text += f"{medal} **{username}**\n"
            leaderboard_text += f"    📊 {points} points ({correct} correct)\n\n"
        
        embed.add_field(name="Rankings", value=leaderboard_text, inline=False)
        embed.set_footer(text=f"Total players: {len(self.scores)}")
        
        await ctx.send(embed=embed)
