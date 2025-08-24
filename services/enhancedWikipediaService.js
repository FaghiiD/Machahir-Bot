/**
 * Enhanced Wikipedia API service for fetching celebrity images and information
 * with improved image search capabilities
 */

const axios = require('axios');
const logger = require('../utils/logger');
const config = require('../config');

class EnhancedWikipediaService {
    constructor() {
        this.baseUrl = "https://en.wikipedia.org/w/api.php";
        this.headers = {
            'User-Agent': config.WIKIPEDIA_USER_AGENT
        };
        this.rateLimitDelay = config.WIKIPEDIA_RATE_LIMIT * 1000;
        this.lastRequestTime = 0;
    }

    async rateLimit() {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        
        if (timeSinceLastRequest < this.rateLimitDelay) {
            const delay = this.rateLimitDelay - timeSinceLastRequest;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        this.lastRequestTime = Date.now();
    }

    async searchForCelebrityImage(celebrityName, aliases = []) {
        logger.info(`Searching for images of: ${celebrityName}`);
        
        // Try multiple search strategies
        const searchStrategies = [
            () => this.searchExactPage(celebrityName),
            () => this.searchWithVariations(celebrityName),
            () => this.searchWithAliases(celebrityName, aliases),
            () => this.searchInCategory(celebrityName),
            () => this.searchWithQuotes(celebrityName)
        ];

        for (const strategy of searchStrategies) {
            try {
                const result = await strategy();
                if (result && result.image_url) {
                    logger.info(`Found image for ${celebrityName}: ${result.image_url}`);
                    return result;
                }
            } catch (error) {
                logger.warn(`Strategy failed for ${celebrityName}: ${error.message}`);
            }
        }

        logger.warn(`No image found for ${celebrityName}`);
        return null;
    }

    async searchExactPage(name) {
        await this.rateLimit();
        
        const params = {
            action: "query",
            prop: "pageimages|extracts",
            format: "json",
            piprop: "original|thumbnail",
            titles: name,
            pithumbsize: 500,
            exintro: true,
            exsentences: 2
        };
        
        const response = await axios.get(this.baseUrl, { 
            params, 
            headers: this.headers,
            timeout: 10000 
        });
        
        return this.parsePageResult(response.data);
    }

    async searchWithVariations(name) {
        const variations = this.generateSearchVariations(name);
        
        for (const variation of variations) {
            const result = await this.searchExactPage(variation);
            if (result && result.image_url) {
                return result;
            }
        }
        
        return null;
    }

    async searchWithAliases(name, aliases) {
        for (const alias of aliases) {
            const result = await this.searchExactPage(alias);
            if (result && result.image_url) {
                return result;
            }
        }
        
        return null;
    }

    async searchInCategory(name) {
        await this.rateLimit();
        
        // Search for pages in relevant categories
        const categories = [
            'Moroccan_people',
            'Moroccan_singers',
            'Moroccan_actors',
            'Moroccan_television_presenters',
            'Moroccan_athletes',
            'Moroccan_writers'
        ];
        
        for (const category of categories) {
            const params = {
                action: "query",
                generator: "categorymembers",
                gcmtitle: `Category:${category}`,
                prop: "pageimages|extracts",
                format: "json",
                piprop: "original|thumbnail",
                pithumbsize: 500,
                exintro: true,
                exsentences: 1,
                gcmlimit: 50
            };
            
            try {
                const response = await axios.get(this.baseUrl, { 
                    params, 
                    headers: this.headers,
                    timeout: 10000 
                });
                
                const result = this.findMatchingPage(response.data, name);
                if (result && result.image_url) {
                    return result;
                }
            } catch (error) {
                logger.warn(`Category search failed for ${category}: ${error.message}`);
            }
        }
        
        return null;
    }

    async searchWithQuotes(name) {
        await this.rateLimit();
        
        const params = {
            action: "query",
            generator: "search",
            gsrnamespace: 0,
            gsrlimit: 10,
            prop: "pageimages|extracts",
            piprop: "original|thumbnail",
            pithumbsize: 500,
            exintro: true,
            exsentences: 1,
            format: "json",
            gsrsearch: `"${name}"`
        };
        
        const response = await axios.get(this.baseUrl, { 
            params, 
            headers: this.headers,
            timeout: 10000 
        });
        
        return this.findMatchingPage(response.data, name);
    }

    generateSearchVariations(name) {
        const variations = [];
        const nameLower = name.toLowerCase();
        
        // Common name variations
        const nameMap = {
            'mohammed': 'muhammad',
            'mohamed': 'muhammad',
            'mohammad': 'muhammad',
            'ahmed': 'ahmad',
            'omar': 'umar',
            'hassan': 'hasan',
            'hussein': 'husayn',
            'hussain': 'husayn',
            'abdallah': 'abdullah',
            'abd allah': 'abdullah',
            'abd al': 'abdul',
            'abdel': 'abdul',
            'rachid': 'rashid',
            'rashid': 'rachid'
        };
        
        // Generate variations
        for (const [variant, standard] of Object.entries(nameMap)) {
            if (nameLower.includes(variant)) {
                variations.push(nameLower.replace(variant, standard));
                variations.push(nameLower.replace(variant, variant.charAt(0).toUpperCase() + variant.slice(1)));
            }
        }
        
        // Add common prefixes/suffixes
        variations.push(`${name} (Moroccan)`);
        variations.push(`${name} (singer)`);
        variations.push(`${name} (actor)`);
        variations.push(`${name} (presenter)`);
        
        // Add without common prefixes
        if (nameLower.startsWith('al ')) {
            variations.push(name.substring(3));
        }
        if (nameLower.startsWith('el ')) {
            variations.push(name.substring(3));
        }
        
        return variations;
    }

    findMatchingPage(data, targetName) {
        if (!data.query || !data.query.pages) return null;
        
        const targetNameLower = targetName.toLowerCase();
        
        for (const [pageId, pageData] of Object.entries(data.query.pages)) {
            if (pageId === '-1') continue;
            
            const pageTitle = pageData.title.toLowerCase();
            
            // Check if the page title contains the target name
            if (pageTitle.includes(targetNameLower) || 
                this.calculateSimilarity(pageTitle, targetNameLower) > 70) {
                
                return {
                    name: pageData.title,
                    description: this.cleanDescription(pageData.extract),
                    image_url: pageData.original ? pageData.original.source : 
                               (pageData.thumbnail ? pageData.thumbnail.source : null),
                    wikipedia_url: `https://en.wikipedia.org/wiki/${encodeURIComponent(pageData.title)}`
                };
            }
        }
        
        return null;
    }

    parsePageResult(data) {
        if (!data.query || !data.query.pages) return null;
        
        const pages = data.query.pages;
        const pageId = Object.keys(pages)[0];
        const pageData = pages[pageId];
        
        if (pageId === '-1') return null; // Page not found
        
        return {
            name: pageData.title,
            description: this.cleanDescription(pageData.extract),
            image_url: pageData.original ? pageData.original.source : 
                       (pageData.thumbnail ? pageData.thumbnail.source : null),
            wikipedia_url: `https://en.wikipedia.org/wiki/${encodeURIComponent(pageData.title)}`
        };
    }

    calculateSimilarity(str1, str2) {
        const words1 = str1.split(/\s+/);
        const words2 = str2.split(/\s+/);
        
        let matches = 0;
        for (const word1 of words1) {
            for (const word2 of words2) {
                if (word1 === word2 || 
                    word1.includes(word2) || 
                    word2.includes(word1) ||
                    this.levenshteinDistance(word1, word2) <= 2) {
                    matches++;
                }
            }
        }
        
        return Math.round((matches / Math.max(words1.length, words2.length)) * 100);
    }

    levenshteinDistance(str1, str2) {
        const matrix = [];
        
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        
        return matrix[str2.length][str1.length];
    }

    cleanDescription(description) {
        if (!description) return '';
        
        // Remove HTML tags
        description = description.replace(/<[^>]*>/g, '');
        
        // Remove extra whitespace
        description = description.replace(/\s+/g, ' ').trim();
        
        // Limit length
        if (description.length > 300) {
            description = description.substring(0, 297) + '...';
        }
        
        return description;
    }

    async testImageUrl(imageUrl) {
        try {
            const response = await axios.head(imageUrl, { timeout: 5000 });
            return response.status === 200;
        } catch (error) {
            return false;
        }
    }

    async getValidImageUrl(celebrityName, aliases = []) {
        const result = await this.searchForCelebrityImage(celebrityName, aliases);
        
        if (result && result.image_url) {
            // Test if the image URL is accessible
            const isValid = await this.testImageUrl(result.image_url);
            if (isValid) {
                return result.image_url;
            } else {
                logger.warn(`Image URL not accessible for ${celebrityName}: ${result.image_url}`);
            }
        }
        
        return null;
    }
}

module.exports = EnhancedWikipediaService; 