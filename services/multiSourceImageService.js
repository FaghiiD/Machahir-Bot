/**
 * Multi-source image service for fetching celebrity images from various platforms
 */

const axios = require('axios');
const logger = require('../utils/logger');
const config = require('../config');

class MultiSourceImageService {
    constructor() {
        this.sources = [
            { name: 'wikipedia', priority: 1, enabled: true },
            { name: 'google', priority: 2, enabled: true },
            { name: 'instagram', priority: 3, enabled: true },
            { name: 'twitter', priority: 4, enabled: true },
            { name: 'facebook', priority: 5, enabled: true }
        ];
        
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        };
    }

    async getCelebrityImages(celebrityName, maxImages = 5) {
        const allImages = [];
        
        // Sort sources by priority
        const sortedSources = this.sources
            .filter(source => source.enabled)
            .sort((a, b) => a.priority - b.priority);
        
        for (const source of sortedSources) {
            try {
                const images = await this.fetchFromSource(source.name, celebrityName, maxImages);
                if (images && images.length > 0) {
                    allImages.push(...images);
                    logger.info(`Found ${images.length} images from ${source.name} for ${celebrityName}`);
                }
            } catch (error) {
                logger.warn(`Failed to fetch from ${source.name}: ${error.message}`);
            }
        }
        
        // Remove duplicates and limit results
        const uniqueImages = this.removeDuplicateImages(allImages);
        return uniqueImages.slice(0, maxImages);
    }

    async fetchFromSource(sourceName, celebrityName, maxImages) {
        switch (sourceName) {
            case 'wikipedia':
                return await this.fetchFromWikipedia(celebrityName, maxImages);
            case 'google':
                return await this.fetchFromGoogle(celebrityName, maxImages);
            case 'instagram':
                return await this.fetchFromInstagram(celebrityName, maxImages);
            case 'twitter':
                return await this.fetchFromTwitter(celebrityName, maxImages);
            case 'facebook':
                return await this.fetchFromFacebook(celebrityName, maxImages);
            default:
                return [];
        }
    }

    async fetchFromWikipedia(celebrityName, maxImages) {
        try {
            // First, try to find the exact page for the celebrity
            const exactParams = {
                action: "query",
                titles: celebrityName,
                prop: "pageimages",
                pilimit: "max",
                pithumbsize: 500,
                format: "json"
            };
            
            const exactResponse = await axios.get("https://en.wikipedia.org/w/api.php", { 
                params: exactParams, 
                headers: this.headers,
                timeout: 10000 
            });
            
            const images = [];
            
            // Check if exact page exists and has images
            if (exactResponse.status === 200 && exactResponse.data.query) {
                for (const page of Object.values(exactResponse.data.query.pages)) {
                    if (page.pageid && page.thumbnail && page.thumbnail.source) {
                        images.push({
                            url: page.thumbnail.source,
                            source: 'wikipedia',
                            title: page.title,
                            width: page.thumbnail.width,
                            height: page.thumbnail.height,
                            relevance: 'exact'
                        });
                    }
                }
            }
            
            // If we don't have enough images, search for similar pages
            if (images.length < maxImages) {
                const searchParams = {
                    action: "query",
                    generator: "search",
                    gsrnamespace: 0,
                    gsrlimit: 10, // Limit search results
                    prop: "pageimages",
                    pilimit: "max",
                    pithumbsize: 500,
                    format: "json",
                    gsrsearch: `"${celebrityName}"` // Use quotes for exact phrase search
                };
                
                const searchResponse = await axios.get("https://en.wikipedia.org/w/api.php", { 
                    params: searchParams, 
                    headers: this.headers,
                    timeout: 10000 
                });
                
                if (searchResponse.status === 200 && searchResponse.data.query) {
                    for (const page of Object.values(searchResponse.data.query.pages)) {
                        // Only add if we don't already have this page and it has a thumbnail
                        if (page.thumbnail && page.thumbnail.source && 
                            !images.some(img => img.url === page.thumbnail.source)) {
                            
                            // Check if the page title is relevant to the celebrity
                            const imageData = {
                                url: page.thumbnail.source,
                                source: 'wikipedia',
                                title: page.title,
                                width: page.thumbnail.width,
                                height: page.thumbnail.height
                            };
                            
                            if (this.validateImageRelevance(imageData, celebrityName)) {
                                images.push({
                                    url: page.thumbnail.source,
                                    source: 'wikipedia',
                                    title: page.title,
                                    width: page.thumbnail.width,
                                    height: page.thumbnail.height,
                                    relevance: 'search'
                                });
                            }
                        }
                    }
                }
            }
            
            // Sort by relevance (exact matches first) and limit results
            const sortedImages = images.sort((a, b) => {
                if (a.relevance === 'exact' && b.relevance !== 'exact') return -1;
                if (b.relevance === 'exact' && a.relevance !== 'exact') return 1;
                return 0;
            });
            
            return sortedImages.slice(0, maxImages);
            
        } catch (error) {
            logger.error(`Wikipedia fetch error: ${error.message}`);
        }
        return [];
    }

    async fetchFromGoogle(celebrityName, maxImages) {
        try {
            // Using Google Custom Search API (requires API key)
            if (!config.GOOGLE_API_KEY || !config.GOOGLE_CSE_ID) {
                logger.warn('Google API credentials not configured');
                return [];
            }
            
            const params = {
                key: config.GOOGLE_API_KEY,
                cx: config.GOOGLE_CSE_ID,
                q: `${celebrityName} portrait solo individual`,
                searchType: 'image',
                num: maxImages,
                imgType: 'face',
                imgSize: 'medium'
            };
            
            const response = await axios.get("https://www.googleapis.com/customsearch/v1", { 
                params, 
                headers: this.headers,
                timeout: 10000 
            });
            
            if (response.status === 200 && response.data.items) {
                return response.data.items.map(item => ({
                    url: item.link,
                    source: 'google',
                    title: item.title,
                    width: item.image?.width,
                    height: item.image?.height
                }));
            }
        } catch (error) {
            logger.error(`Google fetch error: ${error.message}`);
        }
        return [];
    }

    async fetchFromInstagram(celebrityName, maxImages) {
        try {
            // Instagram scraping (basic approach - in production you'd use their API)
            const searchQuery = encodeURIComponent(celebrityName);
            const response = await axios.get(`https://www.instagram.com/explore/tags/${searchQuery}/`, {
                headers: this.headers,
                timeout: 10000
            });
            
            // Extract image URLs from Instagram response
            const imageUrls = this.extractInstagramImages(response.data, maxImages);
            
            return imageUrls.map(url => ({
                url,
                source: 'instagram',
                title: `${celebrityName} on Instagram`
            }));
        } catch (error) {
            logger.error(`Instagram fetch error: ${error.message}`);
        }
        return [];
    }

    async fetchFromTwitter(celebrityName, maxImages) {
        try {
            // Twitter scraping (basic approach - in production you'd use their API)
            const searchQuery = encodeURIComponent(celebrityName);
            const response = await axios.get(`https://twitter.com/search?q=${searchQuery}&src=typed_query&f=image`, {
                headers: this.headers,
                timeout: 10000
            });
            
            // Extract image URLs from Twitter response
            const imageUrls = this.extractTwitterImages(response.data, maxImages);
            
            return imageUrls.map(url => ({
                url,
                source: 'twitter',
                title: `${celebrityName} on Twitter`
            }));
        } catch (error) {
            logger.error(`Twitter fetch error: ${error.message}`);
        }
        return [];
    }

    async fetchFromFacebook(celebrityName, maxImages) {
        try {
            // Facebook scraping (basic approach - in production you'd use their API)
            const searchQuery = encodeURIComponent(celebrityName);
            const response = await axios.get(`https://www.facebook.com/search/photos/?q=${searchQuery}`, {
                headers: this.headers,
                timeout: 10000
            });
            
            // Extract image URLs from Facebook response
            const imageUrls = this.extractFacebookImages(response.data, maxImages);
            
            return imageUrls.map(url => ({
                url,
                source: 'facebook',
                title: `${celebrityName} on Facebook`
            }));
        } catch (error) {
            logger.error(`Facebook fetch error: ${error.message}`);
        }
        return [];
    }

    extractInstagramImages(html, maxImages) {
        const images = [];
        const regex = /"display_url":"([^"]+)"/g;
        let match;
        let count = 0;
        
        while ((match = regex.exec(html)) && count < maxImages) {
            const imageUrl = match[1].replace(/\\u0026/g, '&');
            if (this.isValidImageUrl(imageUrl)) {
                images.push(imageUrl);
                count++;
            }
        }
        
        return images;
    }

    extractTwitterImages(html, maxImages) {
        const images = [];
        const regex = /https:\/\/pbs\.twimg\.com\/media\/[^"]+\.(?:jpg|jpeg|png|gif)/g;
        let match;
        let count = 0;
        
        while ((match = regex.exec(html)) && count < maxImages) {
            if (this.isValidImageUrl(match[0])) {
                images.push(match[0]);
                count++;
            }
        }
        
        return images;
    }

    extractFacebookImages(html, maxImages) {
        const images = [];
        const regex = /https:\/\/scontent\.fbcdn\.net\/[^"]+\.(?:jpg|jpeg|png|gif)/g;
        let match;
        let count = 0;
        
        while ((match = regex.exec(html)) && count < maxImages) {
            if (this.isValidImageUrl(match[0])) {
                images.push(match[0]);
                count++;
            }
        }
        
        return images;
    }

    isValidImageUrl(url) {
        return url && 
               url.startsWith('http') && 
               /\.(jpg|jpeg|png|gif|webp)$/i.test(url) &&
               !url.includes('avatar') &&
               !url.includes('icon');
    }

    removeDuplicateImages(images) {
        const seen = new Set();
        return images.filter(image => {
            const key = image.url.toLowerCase();
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    async getRandomImage(celebrityName) {
        const images = await this.getCelebrityImages(celebrityName, 10);
        if (images.length === 0) {
            return null;
        }
        
        // Randomly select an image
        const randomIndex = Math.floor(Math.random() * images.length);
        return images[randomIndex];
    }

    async validateImageUrl(imageUrl) {
        try {
            const response = await axios.head(imageUrl, {
                headers: this.headers,
                timeout: 5000
            });
            
            const contentType = response.headers['content-type'];
            return contentType && contentType.startsWith('image/');
        } catch (error) {
            return false;
        }
    }

    validateImageRelevance(imageData, celebrityName) {
        // Check if the image title/page title is relevant to the celebrity
        if (!imageData.title) return false;
        
        const title = imageData.title.toLowerCase();
        const celebrityWords = celebrityName.toLowerCase().split(' ').filter(word => word.length > 2);
        
        // Check if at least one significant word from the celebrity name appears in the title
        const hasRelevantWord = celebrityWords.some(word => title.includes(word));
        
        // Additional checks for common false positives and group photos
        const isLikelyRelevant = hasRelevantWord && 
            !title.includes('list of') &&
            !title.includes('category:') &&
            !title.includes('template:') &&
            !title.includes('user:') &&
            !title.includes('talk:') &&
            !title.includes('group') &&
            !title.includes('team') &&
            !title.includes('ensemble') &&
            !title.includes('cast') &&
            !title.includes('crew') &&
            !title.includes('band') &&
            !title.includes('duo') &&
            !title.includes('trio') &&
            !title.includes('quartet') &&
            !title.includes('family') &&
            !title.includes('with') &&
            !title.includes('and') &&
            !title.includes('together') &&
            !title.includes('meeting') &&
            !title.includes('conference') &&
            !title.includes('award') &&
            !title.includes('ceremony') &&
            !title.includes('event') &&
            !title.includes('party') &&
            !title.includes('wedding') &&
            !title.includes('reunion');
        
        return isLikelyRelevant;
    }

    enableSource(sourceName) {
        const source = this.sources.find(s => s.name === sourceName);
        if (source) {
            source.enabled = true;
            logger.info(`Enabled image source: ${sourceName}`);
        }
    }

    disableSource(sourceName) {
        const source = this.sources.find(s => s.name === sourceName);
        if (source) {
            source.enabled = false;
            logger.info(`Disabled image source: ${sourceName}`);
        }
    }

    getSourceStatus() {
        return this.sources.map(source => ({
            name: source.name,
            enabled: source.enabled,
            priority: source.priority
        }));
    }
}

module.exports = MultiSourceImageService; 