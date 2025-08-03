# Overview

An enhanced Discord quiz bot focused on Arab celebrities that dynamically fetches images from Wikipedia and provides an interactive guessing game. The bot supports fuzzy string matching for user answers, maintains player scores and leaderboards, and includes intelligent caching to optimize performance. Players can participate in quiz sessions where they identify celebrities from images, with scoring based on correctness and response speed.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Bot Framework
- **Discord.py Integration**: Built using the discord.py library with command extensions for handling Discord interactions
- **Asynchronous Design**: Fully async/await architecture for non-blocking operations and concurrent handling of multiple quiz sessions
- **Modular Service Architecture**: Separated concerns into distinct service classes (WikipediaService, FuzzyMatcher, ImageCache, QuizGame)

## Quiz Game Logic
- **Session Management**: Tracks active quizzes per Discord channel to prevent conflicts
- **Scoring System**: Points-based system with bonuses for quick responses and streak multipliers
- **Question Generation**: Dynamic celebrity selection from curated database with randomized question ordering

## Fuzzy Matching System
- **Arabic Name Support**: Specialized handling for Arabic name transliterations and common variations
- **Typo Tolerance**: Uses rapidfuzz library for approximate string matching with configurable thresholds
- **Name Normalization**: Preprocessing pipeline that handles Arabic prefixes, common spelling variants, and Unicode normalization

## Image Processing and Caching
- **Wikipedia Integration**: Fetches celebrity images through Wikipedia API with proper rate limiting
- **Intelligent Caching**: File-based cache system with metadata tracking, size limits, and expiration policies
- **Image Optimization**: PIL-based image resizing and compression to optimize Discord upload performance

## Data Management
- **JSON-based Storage**: Celebrity database and user scores stored in structured JSON format
- **File System Organization**: Modular directory structure separating data, cache, and configuration
- **Configuration Management**: Environment variable-based configuration with sensible defaults

## Error Handling and Logging
- **Comprehensive Logging**: Multi-level logging with file and console output for debugging and monitoring
- **Graceful Degradation**: Fallback mechanisms for failed image fetches and API timeouts
- **Input Validation**: Robust validation for user inputs and configuration parameters

# External Dependencies

## Core Libraries
- **discord.py**: Discord bot framework for handling server interactions and commands
- **aiohttp**: Asynchronous HTTP client for Wikipedia API requests and image downloads
- **rapidfuzz**: High-performance fuzzy string matching for answer validation
- **Pillow (PIL)**: Image processing library for resizing and optimizing celebrity photos

## APIs and Services
- **Wikipedia API**: Primary source for celebrity images and biographical information
- **Discord API**: Platform integration for bot functionality and user interactions

## Development Tools
- **python-dotenv**: Environment variable management for configuration
- **asyncio**: Built-in async/await support for concurrent operations

## Data Storage
- **File System**: JSON files for celebrity database, user scores, and cache metadata
- **Local Cache**: Directory-based image caching with automatic cleanup and size management