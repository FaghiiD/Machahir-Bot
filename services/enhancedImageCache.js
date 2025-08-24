/**
 * Enhanced Image Cache service with multi-source support
 */

const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const sharp = require('sharp');
const NodeCache = require('node-cache');
const logger = require('../utils/logger');
const config = require('../config');
// Removed multi-source dependency - using Wikipedia only

class EnhancedImageCache {
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
        
        // Initialize original Wikipedia service only
        const WikipediaService = require('./wikipediaService');
        this.wikipediaService = new WikipediaService();
        
        // Ensure cache directory exists
        fs.ensureDirSync(this.cacheDir);
    }

    async getCelebrityImages(celebrityName, maxImages = 5) {
        const cacheKey = this.generateCacheKey(celebrityName);
        
        // Check memory cache first
        const cachedImages = this.memoryCache.get(cacheKey);
        if (cachedImages && cachedImages.length > 0) {
            // Validate cached images before returning
            const validImages = await this.validateCachedImages(cachedImages, celebrityName);
            if (validImages.length > 0) {
                logger.debug(`Found ${validImages.length} valid images in memory cache for: ${celebrityName}`);
                return this.shuffleArray(validImages).slice(0, maxImages);
            } else {
                // Remove invalid cache from memory
                this.memoryCache.del(cacheKey);
                logger.info(`Removed invalid images from memory cache for: ${celebrityName}`);
            }
        }
        
        // Check file cache
        const filePath = path.join(this.cacheDir, `${cacheKey}.json`);
        if (await fs.pathExists(filePath)) {
            try {
                const cachedData = await fs.readJson(filePath);
                if (cachedData.images && cachedData.images.length > 0) {
                    // Validate cached images before using
                    const validImages = await this.validateCachedImages(cachedData.images, celebrityName);
                    if (validImages.length > 0) {
                        this.memoryCache.set(cacheKey, validImages);
                        logger.debug(`Loaded ${validImages.length} valid images from file cache for: ${celebrityName}`);
                        return this.shuffleArray(validImages).slice(0, maxImages);
                    } else {
                        // Remove invalid cache file
                        await fs.remove(filePath);
                        logger.info(`Removed invalid cache file for: ${celebrityName}`);
                    }
                }
            } catch (error) {
                logger.error(`Error reading cached images for ${celebrityName}: ${error.message}`);
            }
        }
        
        // Fetch new images from multiple sources
        return await this.fetchAndCacheImages(celebrityName, cacheKey, filePath, maxImages);
    }

    async fetchAndCacheImages(celebrityName, cacheKey, filePath, maxImages) {
        try {
            logger.info(`Fetching Wikipedia image for: ${celebrityName}`);
            
            // Use ONLY the original Wikipedia service
            const wikipediaImageUrl = await this.wikipediaService.getCelebrityImage(celebrityName);
            
            if (!wikipediaImageUrl) {
                logger.warn(`No Wikipedia image found for: ${celebrityName}`);
                return [];
            }
            
            const sourceImage = {
                url: wikipediaImageUrl,
                source: 'wikipedia',
                title: celebrityName
            };
            
            logger.info(`Found Wikipedia image for ${celebrityName}`);
            
            // Download and process the image
            const processedImage = await this.downloadAndProcessImage(sourceImage, celebrityName);
            
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
                source: 'wikipedia-only'
            };
            
            await fs.writeJson(filePath, cacheData, { spaces: 2 });
            
            // Store in memory cache
            this.memoryCache.set(cacheKey, processedImages);
            
            // Check cache size and clean if necessary
            await this.cleanupCache();
            
            logger.info(`Successfully cached Wikipedia image for: ${celebrityName}`);
            return processedImages;
            
        } catch (error) {
            logger.error(`Error fetching Wikipedia image for ${celebrityName}: ${error.message}`);
            return [];
        }
    }

    async downloadAndProcessImage(sourceImage, celebrityName) {
        try {
            // Download image directly (Wikipedia URLs are trusted)
            const response = await axios.get(sourceImage.url, {
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
                ...sourceImage,
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

    async cleanupCache() {
        try {
            const files = await fs.readdir(this.cacheDir);
            const cacheFiles = files.filter(file => file.endsWith('.json'));
            
            let totalSize = 0;
            const fileStats = [];
            
            // Calculate total size and get file stats
            for (const file of cacheFiles) {
                const filePath = path.join(this.cacheDir, file);
                const stats = await fs.stat(filePath);
                totalSize += stats.size;
                fileStats.push({
                    name: file,
                    path: filePath,
                    size: stats.size,
                    mtime: stats.mtime
                });
            }
            
            const totalSizeMB = totalSize / (1024 * 1024);
            
            // If cache is too large, remove oldest files
            if (totalSizeMB > this.maxSizeMB) {
                logger.info(`Cache size (${totalSizeMB.toFixed(2)}MB) exceeds limit (${this.maxSizeMB}MB), cleaning up...`);
                
                // Sort by modification time (oldest first)
                fileStats.sort((a, b) => a.mtime.getTime() - b.mtime.getTime());
                
                let removedSize = 0;
                const filesToRemove = [];
                
                for (const fileStat of fileStats) {
                    if (totalSizeMB - removedSize <= this.maxSizeMB) break;
                    
                    filesToRemove.push(fileStat);
                    removedSize += fileStat.size / (1024 * 1024);
                }
                
                // Remove files
                for (const fileStat of filesToRemove) {
                    try {
                        await fs.remove(fileStat.path);
                        logger.debug(`Removed cached file: ${fileStat.name}`);
                    } catch (error) {
                        logger.error(`Error removing cached file ${fileStat.name}: ${error.message}`);
                    }
                }
                
                logger.info(`Removed ${filesToRemove.length} files, freed ${removedSize.toFixed(2)}MB`);
            }
            
        } catch (error) {
            logger.error(`Error during cache cleanup: ${error.message}`);
        }
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
            
            logger.info('Enhanced image cache cleared successfully');
        } catch (error) {
            logger.error(`Error clearing cache: ${error.message}`);
        }
    }

    async getCacheStats() {
        try {
            const files = await fs.readdir(this.cacheDir);
            const cacheFiles = files.filter(file => file.endsWith('.json'));
            
            let totalSize = 0;
            let totalImages = 0;
            
            for (const file of cacheFiles) {
                const filePath = path.join(this.cacheDir, file);
                const stats = await fs.stat(filePath);
                totalSize += stats.size;
                
                try {
                    const cacheData = await fs.readJson(filePath);
                    if (cacheData.images) {
                        totalImages += cacheData.images.length;
                    }
                } catch (error) {
                    // Skip corrupted files
                }
            }
            
            return {
                fileCount: cacheFiles.length,
                totalSizeMB: totalSize / (1024 * 1024),
                totalImages,
                memoryCacheSize: this.memoryCache.keys().length,
                maxSizeMB: this.maxSizeMB
            };
        } catch (error) {
            logger.error(`Error getting cache stats: ${error.message}`);
            return null;
        }
    }

    async isImageCached(celebrityName) {
        const cacheKey = this.generateCacheKey(celebrityName);
        
        // Check memory cache
        if (this.memoryCache.has(cacheKey)) {
            return true;
        }
        
        // Check file cache
        const filePath = path.join(this.cacheDir, `${cacheKey}.json`);
        return await fs.pathExists(filePath);
    }

    async removeFromCache(celebrityName) {
        const cacheKey = this.generateCacheKey(celebrityName);
        
        // Remove from memory cache
        this.memoryCache.del(cacheKey);
        
        // Remove from file cache
        const filePath = path.join(this.cacheDir, `${cacheKey}.json`);
        if (await fs.pathExists(filePath)) {
            await fs.remove(filePath);
            logger.debug(`Removed images from cache: ${celebrityName}`);
        }
    }

    // Simple Wikipedia-only system - no multi-source management needed

    isLikelyGroupPhoto(title) {
        if (!title) return false;
        
        const titleLower = title.toLowerCase();
        
        // Keywords that indicate group photos
        const groupKeywords = [
            'group', 'team', 'ensemble', 'cast', 'crew', 'band', 'duo', 'trio', 'quartet',
            'family', 'together', 'meeting', 'conference', 'award', 'ceremony', 'event',
            'party', 'wedding', 'reunion', 'gathering', 'assembly', 'collection',
            'lineup', 'roster', 'staff', 'members', 'players', 'actors', 'performers',
            'panel', 'board', 'committee', 'council', 'delegation', 'delegates',
            'attendees', 'participants', 'guests', 'invitees', 'speakers', 'presenters'
        ];
        
        // Check for group indicators
        const hasGroupKeyword = groupKeywords.some(keyword => titleLower.includes(keyword));
        
        // Check for multiple names (indicated by "and", "&", or multiple commas)
        const hasMultipleNames = titleLower.includes(' and ') || 
                                titleLower.includes(' & ') || 
                                (titleLower.split(',').length > 2);
        
        // Check for numbers that might indicate multiple people (but not years or single digits)
        const hasMultipleNumbers = (titleLower.match(/\d+/g) || []).length > 1;
        const hasLargeNumber = /\d{2,}/.test(titleLower) && !/\b(19|20)\d{2}\b/.test(titleLower); // Exclude years
        
        // Check for specific patterns that indicate multiple people
        const hasPeopleCount = /\d+\s*(people|persons|men|women|guests|attendees|members)/.test(titleLower);
        
        return hasGroupKeyword || hasMultipleNames || hasMultipleNumbers || hasLargeNumber || hasPeopleCount;
    }

    async validateCachedImages(cachedImages, celebrityName) {
        const validImages = [];
        
        for (const image of cachedImages) {
            // Check if image data exists and is valid
            if (!image.data || typeof image.data !== 'string') {
                logger.warn(`Removing invalid image data for ${celebrityName}: ${image.title}`);
                continue;
            }
            
            // Simple validation: check if the image title contains the celebrity name
            const titleLower = image.title.toLowerCase();
            const celebrityWords = celebrityName.toLowerCase().split(' ').filter(word => word.length > 2);
            const hasCelebrityName = celebrityWords.some(word => titleLower.includes(word));
            
            if (!hasCelebrityName) {
                logger.warn(`Removing image without celebrity name for ${celebrityName}: ${image.title}`);
                continue;
            }
            
            validImages.push(image);
        }
        
        logger.info(`Validated ${cachedImages.length} cached images for ${celebrityName}, kept ${validImages.length} valid ones`);
        return validImages;
    }

    validateImageRelevance(imageData, celebrityName) {
        // Check if the image title/page title is relevant to the celebrity
        if (!imageData.title) return false;
        
        const title = imageData.title.toLowerCase();
        const celebrityWords = celebrityName.toLowerCase().split(' ').filter(word => word.length > 2);
        
        // Check if at least one significant word from the celebrity name appears in the title
        const hasRelevantWord = celebrityWords.some(word => title.includes(word));
        
        // Additional checks for common false positives
        const isLikelyRelevant = hasRelevantWord && 
            !title.includes('list of') &&
            !title.includes('category:') &&
            !title.includes('template:') &&
            !title.includes('user:') &&
            !title.includes('talk:');
        
        return isLikelyRelevant;
    }
}

module.exports = EnhancedImageCache; 