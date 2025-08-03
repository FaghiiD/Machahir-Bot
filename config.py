"""
Configuration settings for the Arab Celebrity Quiz Bot
"""

import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Discord Configuration
DISCORD_TOKEN = os.getenv('DISCORD_TOKEN')

# Bot Configuration
LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')

# Quiz Configuration
QUIZ_TIMEOUT = int(os.getenv('QUIZ_TIMEOUT', '30'))
MAX_QUESTIONS = int(os.getenv('MAX_QUESTIONS', '10'))
POINTS_CORRECT = int(os.getenv('POINTS_CORRECT', '10'))
POINTS_QUICK_BONUS = int(os.getenv('POINTS_QUICK_BONUS', '5'))

# Cache Configuration
CACHE_MAX_AGE_DAYS = int(os.getenv('CACHE_MAX_AGE_DAYS', '7'))
CACHE_MAX_SIZE_MB = int(os.getenv('CACHE_MAX_SIZE_MB', '100'))
IMAGE_MAX_WIDTH = int(os.getenv('IMAGE_MAX_WIDTH', '800'))
IMAGE_MAX_HEIGHT = int(os.getenv('IMAGE_MAX_HEIGHT', '600'))
IMAGE_QUALITY = int(os.getenv('IMAGE_QUALITY', '85'))

# Wikipedia API Configuration
WIKIPEDIA_USER_AGENT = os.getenv('WIKIPEDIA_USER_AGENT', 'ArabCelebrityQuizBot/1.0')
WIKIPEDIA_RATE_LIMIT = float(os.getenv('WIKIPEDIA_RATE_LIMIT', '0.1'))

# Fuzzy Matching Configuration
FUZZY_THRESHOLD = int(os.getenv('FUZZY_THRESHOLD', '80'))
FUZZY_SUGGESTION_THRESHOLD = int(os.getenv('FUZZY_SUGGESTION_THRESHOLD', '60'))

# File Paths
DATA_DIR = 'data'
CACHE_DIR = 'cache'
CELEBRITIES_FILE = os.path.join(DATA_DIR, 'celebrities.json')
SCORES_FILE = os.path.join(DATA_DIR, 'scores.json')

# Validation
if not DISCORD_TOKEN:
    raise ValueError("DISCORD_TOKEN environment variable is required")

# Ensure directories exist
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(CACHE_DIR, exist_ok=True)
