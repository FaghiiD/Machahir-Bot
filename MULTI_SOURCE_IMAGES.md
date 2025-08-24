# Multi-Source Image System for Arab Celebrity Quiz Bot

## Overview

The bot now supports fetching celebrity images from multiple sources, providing better coverage and variety for celebrity photos. This enhancement addresses the issue of missing images and provides random selection from different time periods and sources.

## Features

### 🔄 Multiple Image Sources
- **Wikipedia**: High-quality, verified images from Wikipedia articles
- **Google Images**: Diverse images from Google Custom Search API
- **Instagram**: Recent photos from Instagram posts and profiles
- **Twitter**: Images from Twitter posts and profiles
- **Facebook**: Photos from Facebook profiles and pages

### 🎲 Random Image Selection
- Each quiz session shows a random image of the celebrity
- Images can be from different time periods (young, old, recent)
- Multiple images per celebrity for variety

### 📊 Enhanced Caching
- Stores multiple images per celebrity
- Base64 encoding for efficient storage
- Automatic cache cleanup and management
- Memory and file-based caching

### 🛠️ Management Commands
- `/imagesources status` - View status of all image sources
- `/imagesources enable <source>` - Enable a specific source
- `/imagesources disable <source>` - Disable a specific source
- `/imagecache stats` - View cache statistics
- `/imagecache clear` - Clear all cached images
- `/imagecache refresh <celebrity>` - Refresh images for a specific celebrity

## Setup Instructions

### 1. Environment Configuration

Add the following variables to your `.env` file:

```env
# Google Custom Search API Configuration
GOOGLE_API_KEY=your_google_api_key_here
GOOGLE_CSE_ID=your_google_custom_search_engine_id_here

# Multi-Source Image Configuration
MULTI_SOURCE_ENABLED=true
MAX_IMAGES_PER_CELEBRITY=10
IMAGE_SOURCE_PRIORITY=wikipedia,google,instagram,twitter,facebook
```

### 2. Google Custom Search API Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the Custom Search API
4. Create credentials (API Key)
5. Go to [Google Custom Search](https://cse.google.com/)
6. Create a new search engine
7. Enable "Image Search"
8. Copy the Search Engine ID (cx)

### 3. Source Priority Configuration

You can customize the priority order of image sources:

```env
IMAGE_SOURCE_PRIORITY=wikipedia,google,instagram,twitter,facebook
```

Sources are tried in order, and the first successful source provides images.

## Usage

### Basic Usage
The bot automatically uses the multi-source system when starting quizzes. No additional commands are needed.

### Managing Sources
```bash
# View all source status
/imagesources status

# Enable Instagram source
/imagesources enable instagram

# Disable Twitter source
/imagesources disable twitter
```

### Cache Management
```bash
# View cache statistics
/imagecache stats

# Clear all cached images
/imagecache clear

# Refresh images for a specific celebrity
/imagecache refresh "Amr Diab"
```

## Technical Details

### Image Processing
- All images are automatically resized to fit Discord limits
- JPEG compression for optimal file size
- Quality settings configurable via `IMAGE_QUALITY`

### Caching Strategy
- **Memory Cache**: Fast access for frequently used images
- **File Cache**: Persistent storage in JSON format
- **Automatic Cleanup**: Removes old files when cache limit is reached

### Error Handling
- Graceful fallback if one source fails
- Continues to next source in priority order
- Logs errors for debugging

### Rate Limiting
- Respects API rate limits for each source
- Configurable delays between requests
- Automatic retry logic for failed requests

## Troubleshooting

### No Images Found
1. Check if sources are enabled: `/imagesources status`
2. Verify API keys are correct
3. Check bot logs for specific error messages
4. Try refreshing cache: `/imagecache refresh <celebrity>`

### Poor Image Quality
1. Adjust `IMAGE_QUALITY` in environment variables
2. Modify `IMAGE_MAX_WIDTH` and `IMAGE_MAX_HEIGHT`
3. Enable higher priority sources

### Cache Issues
1. Clear cache: `/imagecache clear`
2. Check cache statistics: `/imagecache stats`
3. Verify disk space availability

## Performance Considerations

- **Memory Usage**: Each cached image uses memory proportional to its size
- **Disk Space**: Cache files are stored in JSON format with base64 encoding
- **API Limits**: Respect rate limits to avoid service disruptions
- **Network**: Multiple sources may increase initial load times

## Future Enhancements

- [ ] Support for more image sources (YouTube, TikTok, etc.)
- [ ] AI-powered image quality assessment
- [ ] Automatic image categorization (young/old, formal/casual)
- [ ] User preference settings for image types
- [ ] Bulk image refresh functionality

## Support

For issues or questions about the multi-source image system:
1. Check the bot logs for detailed error messages
2. Verify all API keys and configurations
3. Test individual sources using the management commands
4. Clear cache and retry if experiencing issues 