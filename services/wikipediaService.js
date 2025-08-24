/**
 * Wikipedia API service for fetching celebrity images and information
 */

const axios = require('axios');
const logger = require('../utils/logger');
const config = require('../config');

class WikipediaService {
    constructor() {
        this.baseUrl = "https://en.wikipedia.org/w/api.php";
        this.headers = {
            'User-Agent': config.WIKIPEDIA_USER_AGENT
        };
        this.rateLimitDelay = config.WIKIPEDIA_RATE_LIMIT * 1000; // Convert to milliseconds
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

    async searchCelebrities(query, limit = 20) {
        await this.rateLimit();
        
        const params = {
            action: "query",
            generator: "search",
            gsrnamespace: 0,
            gsrlimit: limit,
            prop: "pageimages|extracts",
            pilimit: "max",
            exintro: true,
            exsentences: 1,
            exlimit: "max",
            pithumbsize: 300,
            format: "json",
            gsrsearch: query
        };
        
        try {
            const response = await axios.get(this.baseUrl, { 
                params, 
                headers: this.headers,
                timeout: 10000 
            });
            
            if (response.status === 200) {
                return this.parseSearchResults(response.data);
            } else {
                logger.error(`Wikipedia search failed with status ${response.status}`);
                return [];
            }
        } catch (error) {
            logger.error(`Error searching Wikipedia: ${error.message}`);
            return [];
        }
    }

    parseSearchResults(data) {
        const results = [];
        
        if (data.query && data.query.pages) {
            for (const [pageId, pageData] of Object.entries(data.query.pages)) {
                if (pageId === '-1') continue; // Skip missing pages
                
                const result = {
                    name: pageData.title || '',
                    description: pageData.extract || '',
                    image_url: null
                };
                
                // Get image URL
                if (pageData.thumbnail) {
                    result.image_url = pageData.thumbnail.source;
                } else if (pageData.original) {
                    result.image_url = pageData.original.source;
                }
                
                results.push(result);
            }
        }
        
        return results;
    }

    async getCelebrityImage(celebrityName) {
        await this.rateLimit();
        
        const params = {
            action: "query",
            prop: "pageimages",
            format: "json",
            piprop: "original",
            titles: celebrityName,
            pithumbsize: 500
        };
        
        try {
            const response = await axios.get(this.baseUrl, { 
                params, 
                headers: this.headers,
                timeout: 10000 
            });
            
            if (response.status === 200) {
                return this.parseImageResult(response.data);
            } else {
                logger.error(`Wikipedia image fetch failed with status ${response.status}`);
                return null;
            }
        } catch (error) {
            logger.error(`Error fetching celebrity image: ${error.message}`);
            return null;
        }
    }

    parseImageResult(data) {
        if (data.query && data.query.pages) {
            const pages = data.query.pages;
            const pageId = Object.keys(pages)[0];
            const pageData = pages[pageId];
            
            if (pageData.original) {
                return pageData.original.source;
            } else if (pageData.thumbnail) {
                return pageData.thumbnail.source;
            }
        }
        
        return null;
    }

    async getCelebrityProfile(name) {
        await this.rateLimit();
        
        const params = {
            action: "query",
            prop: "extracts|pageimages",
            format: "json",
            exintro: true,
            exsentences: 3,
            piprop: "original",
            titles: name,
            pithumbsize: 500
        };
        
        try {
            const response = await axios.get(this.baseUrl, { 
                params, 
                headers: this.headers,
                timeout: 10000 
            });
            
            if (response.status === 200) {
                return this.parseCelebrityProfile(response.data);
            } else {
                logger.error(`Wikipedia profile fetch failed with status ${response.status}`);
                return null;
            }
        } catch (error) {
            logger.error(`Error fetching celebrity profile: ${error.message}`);
            return null;
        }
    }

    parseCelebrityProfile(data) {
        if (data.query && data.query.pages) {
            const pages = data.query.pages;
            const pageId = Object.keys(pages)[0];
            const pageData = pages[pageId];
            
            if (pageId === '-1') return null; // Page not found
            
            return {
                name: pageData.title,
                description: this.cleanDescription(pageData.extract),
                image_url: pageData.original ? pageData.original.source : null,
                wikipedia_url: `https://en.wikipedia.org/wiki/${encodeURIComponent(pageData.title)}`
            };
        }
        
        return null;
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

    async searchCelebrityVariations(celebrityName, aliases = []) {
        const variations = this.generateNameVariations(celebrityName);
        const allNames = [celebrityName, ...aliases, ...variations];
        const results = [];
        
        for (const name of allNames) {
            const searchResults = await this.searchCelebrities(name, 5);
            results.push(...searchResults);
        }
        
        // Remove duplicates based on name
        const uniqueResults = results.filter((result, index, self) => 
            index === self.findIndex(r => r.name === result.name)
        );
        
        return uniqueResults;
    }

    generateNameVariations(name) {
        const variations = [];
        
        // Common Arabic name variations
        const commonVariations = {
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
            'abdel': 'abdul'
        };
        
        // Generate variations
        for (const [variant, standard] of Object.entries(commonVariations)) {
            if (name.toLowerCase().includes(variant)) {
                variations.push(name.toLowerCase().replace(variant, standard));
            }
        }
        
        // Add name with "al-" prefix
        if (!name.toLowerCase().startsWith('al ')) {
            variations.push(`al ${name}`);
        }
        
        // Add name without "al-" prefix
        if (name.toLowerCase().startsWith('al ')) {
            variations.push(name.substring(3));
        }
        
        return variations;
    }

    calculateNameSimilarity(name1, name2) {
        const normalize = (name) => name.toLowerCase().replace(/[^a-z\s]/g, '').trim();
        const n1 = normalize(name1);
        const n2 = normalize(name2);
        
        if (n1 === n2) return 100;
        
        // Simple similarity calculation
        const words1 = n1.split(' ');
        const words2 = n2.split(' ');
        
        let matches = 0;
        for (const word1 of words1) {
            for (const word2 of words2) {
                if (word1 === word2 || word1.includes(word2) || word2.includes(word1)) {
                    matches++;
                }
            }
        }
        
        return Math.round((matches / Math.max(words1.length, words2.length)) * 100);
    }
}

module.exports = WikipediaService; 