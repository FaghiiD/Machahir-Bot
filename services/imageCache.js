/**
 * Simple Image Cache service - Original working version
 */

const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const sharp = require('sharp');
const NodeCache = require('node-cache');
const logger = require('../utils/logger');
const config = require('../config');

class ImageCache {
    constructor() {
        this.cacheDir = config.CACHE_DIR;
        this.memoryCache = new NodeCache({
            stdTTL: config.CACHE_MAX_AGE_DAYS * 24 * 60 * 60,
            checkperiod: 600
        });
        
        this.maxSizeMB = config.CACHE_MAX_SIZE_MB;
        this.maxWidth = config.IMAGE_MAX_WIDTH;
        this.maxHeight = config.IMAGE_MAX_HEIGHT;
        this.quality = config.IMAGE_QUALITY;
        
        // Ensure cache directory exists
        fs.ensureDirSync(this.cacheDir);
    }

    async getCelebrityImages(celebrityName, maxImages = 5) {
        const cacheKey = this.generateCacheKey(celebrityName);
        
        // Check memory cache first
        const cachedImages = this.memoryCache.get(cacheKey);
        if (cachedImages && cachedImages.length > 0) {
            logger.debug(`Found ${cachedImages.length} images in memory cache for: ${celebrityName}`);
            return this.shuffleArray(cachedImages).slice(0, maxImages);
        }
        
        // Check file cache
        const filePath = path.join(this.cacheDir, `${cacheKey}.json`);
        if (await fs.pathExists(filePath)) {
            try {
                const cachedData = await fs.readJson(filePath);
                if (cachedData.images && cachedData.images.length > 0) {
                    this.memoryCache.set(cacheKey, cachedData.images);
                    logger.debug(`Loaded ${cachedData.images.length} images from file cache for: ${celebrityName}`);
                    return this.shuffleArray(cachedData.images).slice(0, maxImages);
                }
            } catch (error) {
                logger.error(`Error reading cached images for ${celebrityName}: ${error.message}`);
            }
        }
        
        // Fetch new images from Wikipedia
        return await this.fetchAndCacheImages(celebrityName, cacheKey, filePath, maxImages);
    }

    async fetchAndCacheImages(celebrityName, cacheKey, filePath, maxImages) {
        try {
            logger.info(`Fetching Wikipedia image for: ${celebrityName}`);
            
            // Use the original Wikipedia service
            const WikipediaService = require('./wikipediaService');
            const wikipediaService = new WikipediaService();
            
            const wikipediaImageUrl = await wikipediaService.getCelebrityImage(celebrityName);
            
            if (!wikipediaImageUrl) {
                logger.warn(`No Wikipedia image found for: ${celebrityName}`);
                return [];
            }
            
            logger.info(`Found Wikipedia image for ${celebrityName}: ${wikipediaImageUrl}`);
            
            // Download and process the image
            const processedImage = await this.downloadAndProcessImage(wikipediaImageUrl, celebrityName);
            
            if (!processedImage) {
                logger.warn(`Failed to process image for: ${celebrityName}`);
                return [];
            }
            
            const processedImages = [processedImage];
            
            // Save to file cache
            const cacheData = {
                celebrityName,
                images: processedImages,
                timestamp: Date.now(),
                source: 'wikipedia'
            };
            
            await fs.writeJson(filePath, cacheData, { spaces: 2 });
            
            // Store in memory cache
            this.memoryCache.set(cacheKey, processedImages);
            
            logger.info(`Successfully cached Wikipedia image for: ${celebrityName}`);
            return processedImages;
            
        } catch (error) {
            logger.error(`Error fetching Wikipedia image for ${celebrityName}: ${error.message}`);
            return [];
        }
    }

    async downloadAndProcessImage(imageUrl, celebrityName) {
        try {
            // Download image
            const response = await axios.get(imageUrl, {
                responseType: 'arraybuffer',
                timeout: 30000,
                headers: {
                    'User-Agent': config.WIKIPEDIA_USER_AGENT
                }
            });
            
            if (response.status !== 200) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            // Process image with Sharp
            const processedImageBuffer = await this.processImage(response.data);
            
            // Convert to base64 for storage
            const base64Image = processedImageBuffer.toString('base64');
            
            return {
                url: imageUrl,
                source: 'wikipedia',
                title: celebrityName,
                data: base64Image,
                size: processedImageBuffer.length,
                processed: true
            };
            
        } catch (error) {
            logger.error(`Error downloading/processing image for ${celebrityName}: ${error.message}`);
            return null;
        }
    }

    async getRandomImage(celebrityName) {
        const images = await this.getCelebrityImages(celebrityName, 10);
        if (images.length === 0) {
            return null;
        }
        
        // Return a random image
        const randomIndex = Math.floor(Math.random() * images.length);
        return images[randomIndex];
    }

    async getImageBuffer(base64Image) {
        return Buffer.from(base64Image, 'base64');
    }

    async processImage(imageBuffer) {
        try {
            const image = sharp(imageBuffer);
            const metadata = await image.metadata();
            
            // Resize if necessary
            if (metadata.width > this.maxWidth || metadata.height > this.maxHeight) {
                image.resize(this.maxWidth, this.maxHeight, {
                    fit: 'inside',
                    withoutEnlargement: true
                });
            }
            
            // Convert to JPEG with specified quality
            return await image
                .jpeg({ quality: this.quality })
                .toBuffer();
                
        } catch (error) {
            logger.error(`Error processing image: ${error.message}`);
            // Return original buffer if processing fails
            return imageBuffer;
        }
    }

    generateCacheKey(celebrityName) {
        return celebrityName
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '_')
            .replace(/_+/g, '_')
            .substring(0, 100);
    }

    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    async clearCache() {
        try {
            // Clear memory cache
            this.memoryCache.flushAll();
            
            // Clear file cache
            const files = await fs.readdir(this.cacheDir);
            const cacheFiles = files.filter(file => file.endsWith('.json'));
            
            for (const file of cacheFiles) {
                await fs.remove(path.join(this.cacheDir, file));
            }
            
            logger.info('Image cache cleared successfully');
        } catch (error) {
            logger.error(`Error clearing cache: ${error.message}`);
        }
    }
}

module.exports = ImageCache; 