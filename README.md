# Arab Celebrity Quiz Bot (JavaScript)

A Discord bot that tests knowledge of Arab celebrities through interactive quizzes. The bot fetches celebrity images from Wikipedia and uses fuzzy matching to handle various name variations and typos.

## Features

- 🎭 **Interactive Quiz System**: Start quizzes with celebrity images
- 🌐 **Wikipedia Integration**: Automatically fetches celebrity images and information
- 🔍 **Fuzzy Matching**: Handles Arabic name variations and typos
- 💾 **Image Caching**: Efficient caching system for celebrity images
- 📊 **Statistics Tracking**: Track quiz performance and bot usage
- 🎯 **Prefix Commands**: Easy-to-use command system
- 🌍 **Arabic Name Support**: Handles Arabic names and transliterations

## Commands

- `+مشاهير` - Start a new quiz session
- `+addcelebrity` - Add a new celebrity to the database
- `+listcelebrities [page]` - List all celebrities in the database
- `+stats` - Show bot statistics
- `+help` - Show help message
- `+test` - Test if the bot is working

## Installation

### Prerequisites

- Node.js 18.0.0 or higher
- npm or yarn
- Discord Bot Token

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd arab-celebrity-quiz-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` and add your Discord bot token:
   ```
   DISCORD_TOKEN=your_discord_bot_token_here
   ```

4. **Set up the data directory**
   ```bash
   mkdir -p data cache logs
   ```

5. **Copy the celebrities database**
   ```bash
   cp data/celebrities.json data/celebrities.json
   ```

6. **Start the bot and use the command**
   ```bash
   npm start
   ```
   Then use `+مشاهير` in your Discord server to start a quiz!

### Running the Bot

**Development mode:**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

## Configuration

The bot can be configured through environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `DISCORD_TOKEN` | Discord bot token | Required |
| `LOG_LEVEL` | Logging level | `info` |
| `QUIZ_TIMEOUT` | Quiz timeout in seconds | `30` |
| `MAX_QUESTIONS` | Maximum questions per quiz | `10` |
| `POINTS_CORRECT` | Points for correct answer | `10` |
| `POINTS_QUICK_BONUS` | Bonus points for fast answers | `5` |
| `CACHE_MAX_AGE_DAYS` | Cache expiration in days | `7` |
| `CACHE_MAX_SIZE_MB` | Maximum cache size in MB | `100` |
| `IMAGE_MAX_WIDTH` | Maximum image width | `800` |
| `IMAGE_MAX_HEIGHT` | Maximum image height | `600` |
| `IMAGE_QUALITY` | JPEG quality for cached images | `85` |
| `WIKIPEDIA_USER_AGENT` | User agent for Wikipedia API | `ArabCelebrityQuizBot/1.0` |
| `WIKIPEDIA_RATE_LIMIT` | Rate limit for Wikipedia API | `0.1` |
| `FUZZY_THRESHOLD` | Fuzzy matching threshold | `80` |
| `FUZZY_SUGGESTION_THRESHOLD` | Suggestion threshold | `60` |

## Project Structure

```
├── index.js                 # Main entry point
├── config.js               # Configuration settings
├── package.json            # Dependencies and scripts
├── env.example             # Environment variables example
├── README.md               # This file
├── services/               # Core services
│   ├── wikipediaService.js # Wikipedia API integration
│   ├── fuzzyMatcher.js     # Fuzzy string matching
│   ├── imageCache.js       # Image caching system
│   └── quizGame.js         # Quiz game logic
├── utils/                  # Utilities
│   └── logger.js           # Logging utility
├── data/                   # Data files
│   ├── celebrities.json    # Celebrity database
│   └── scores.json         # Score tracking
├── cache/                  # Image cache directory
└── logs/                   # Log files
```

## How It Works

### Quiz Flow

1. User types `+مشاهير` to start a quiz
2. Bot randomly selects a celebrity from the database
3. Bot fetches celebrity image from Wikipedia (or uses cached version)
4. Bot sends the image and asks users to identify the celebrity
5. Users type their answers - wrong answers are silently ignored
6. Bot uses fuzzy matching to check answers
7. Users can keep guessing until someone gets the correct answer
8. Quiz ends when someone gets it right or time runs out

### Fuzzy Matching

The bot uses advanced fuzzy matching to handle:
- Arabic name variations (Mohammed/Muhammad, Ahmed/Ahmad)
- Common transliterations
- Typos and spelling mistakes
- Name prefixes (Al-, El-, Abdul, etc.)
- Partial matches

### Image Caching

- Images are cached both in memory and on disk
- Automatic cache cleanup when size limit is reached
- Image processing (resizing, compression) for efficiency
- Rate limiting to respect Wikipedia API limits

## Adding Celebrities

Use the `+addcelebrity` command to add new celebrities:

```
+addcelebrity "Celebrity Name"|"Alias 1,Alias 2"|"Arabic Name"|category
```

Example:
```
+addcelebrity "Omar Sharif"|"Omar El-Sharif,Michel Demitri Shalhoub"|"عمر الشريف"|actor
```

The bot will automatically:
- Fetch Wikipedia information
- Get celebrity image
- Add to the database

## Development

### Running Tests
```bash
npm test
```

### Code Style
The project uses standard JavaScript conventions. Consider using ESLint for code quality:

```bash
npm install --save-dev eslint
```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Troubleshooting

### Common Issues

**Bot doesn't respond to commands:**
- Check if the bot has the correct permissions
- Verify the bot token is correct
- Ensure the bot is online

**Images don't load:**
- Check internet connection
- Verify Wikipedia API is accessible
- Check cache directory permissions

**Fuzzy matching not working:**
- Adjust `FUZZY_THRESHOLD` in environment variables
- Check celebrity database format

### Logs

Logs are stored in the `logs/` directory:
- `combined.log` - All logs
- `error.log` - Error logs only

## License

This project is licensed under the MIT License.

## Acknowledgments

- Wikipedia API for celebrity information and images
- Discord.js for Discord bot functionality
- Fuse.js for fuzzy string matching
- Sharp for image processing 