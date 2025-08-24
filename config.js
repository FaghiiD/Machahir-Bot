/**
 * Configuration settings for the Arab Celebrity Quiz Bot
 */

require('dotenv').config();
const fs = require('fs-extra');
const path = require('path');

// Discord Configuration
const DISCORD_TOKEN = process.env.TOKEN;

// Bot Configuration
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Quiz Configuration
const QUIZ_TIMEOUT = parseInt(process.env.QUIZ_TIMEOUT) || 30;
const MAX_QUESTIONS = parseInt(process.env.MAX_QUESTIONS) || 10;
const POINTS_CORRECT = parseInt(process.env.POINTS_CORRECT) || 10;
const POINTS_QUICK_BONUS = parseInt(process.env.POINTS_QUICK_BONUS) || 5;

// Cache Configuration
const CACHE_MAX_AGE_DAYS = parseInt(process.env.CACHE_MAX_AGE_DAYS) || 7;
const CACHE_MAX_SIZE_MB = parseInt(process.env.CACHE_MAX_SIZE_MB) || 100;
const IMAGE_MAX_WIDTH = parseInt(process.env.IMAGE_MAX_WIDTH) || 800;
const IMAGE_MAX_HEIGHT = parseInt(process.env.IMAGE_MAX_HEIGHT) || 600;
const IMAGE_QUALITY = parseInt(process.env.IMAGE_QUALITY) || 85;

// Wikipedia API Configuration
const WIKIPEDIA_USER_AGENT = process.env.WIKIPEDIA_USER_AGENT || 'ArabCelebrityQuizBot/1.0';
const WIKIPEDIA_RATE_LIMIT = parseFloat(process.env.WIKIPEDIA_RATE_LIMIT) || 0.1;

// Removed Google API and multi-source configuration - using Wikipedia only

// Fuzzy Matching Configuration
const FUZZY_THRESHOLD = parseInt(process.env.FUZZY_THRESHOLD) || 80;
const FUZZY_SUGGESTION_THRESHOLD = parseInt(process.env.FUZZY_SUGGESTION_THRESHOLD) || 60;

// File Paths
const DATA_DIR = 'data';
const CACHE_DIR = 'cache';
const CELEBRITIES_FILE = path.join(DATA_DIR, 'celebrities.json');
const SCORES_FILE = path.join(DATA_DIR, 'scores.json');

// Validation
if (!DISCORD_TOKEN) {
    throw new Error("DISCORD_TOKEN environment variable is required");
}

// Ensure directories exist
fs.ensureDirSync(DATA_DIR);
fs.ensureDirSync(CACHE_DIR);

module.exports = {
    DISCORD_TOKEN,
    LOG_LEVEL,
    QUIZ_TIMEOUT,
    MAX_QUESTIONS,
    POINTS_CORRECT,
    POINTS_QUICK_BONUS,
    CACHE_MAX_AGE_DAYS,
    CACHE_MAX_SIZE_MB,
    IMAGE_MAX_WIDTH,
    IMAGE_MAX_HEIGHT,
    IMAGE_QUALITY,
    WIKIPEDIA_USER_AGENT,
    WIKIPEDIA_RATE_LIMIT,
    // Removed Google API exports
    FUZZY_THRESHOLD,
    FUZZY_SUGGESTION_THRESHOLD,
    DATA_DIR,
    CACHE_DIR,
    CELEBRITIES_FILE,
    SCORES_FILE
}; 