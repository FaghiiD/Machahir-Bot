"""
Enhanced Discord Quiz Bot - Main Entry Point
Dynamically fetches Arab celebrity images from Wikipedia with fuzzy matching support
"""

import asyncio
import logging
import os
from dotenv import load_dotenv
from bot.quiz_bot import QuizBot

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('bot.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

async def main():
    """Main function to start the Discord bot"""
    try:
        # Get Discord token from environment
        token = os.getenv('DISCORD_TOKEN')
        if not token:
            logger.error("DISCORD_TOKEN not found in environment variables")
            return
        
        # Initialize and start the bot
        bot = QuizBot()
        
        logger.info("Starting Discord Quiz Bot...")
        await bot.start(token)
        
    except KeyboardInterrupt:
        logger.info("Bot stopped by user")
    except Exception as e:
        logger.error(f"Error starting bot: {e}")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Bot shutdown complete")
