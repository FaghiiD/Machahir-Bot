/**
 * Basic tests for the Arab Celebrity Quiz Bot
 */

const FuzzyMatcher = require('../services/fuzzyMatcher');
const WikipediaService = require('../services/wikipediaService');
const ImageCache = require('../services/imageCache');

describe('FuzzyMatcher', () => {
    let fuzzyMatcher;

    beforeEach(() => {
        fuzzyMatcher = new FuzzyMatcher();
    });

    test('should normalize Arabic names correctly', () => {
        expect(fuzzyMatcher.normalizeArabicName('Mohammed Ahmed')).toBe('muhammad ahmad');
        expect(fuzzyMatcher.normalizeArabicName('Al-Omar')).toBe('al omar');
        expect(fuzzyMatcher.normalizeArabicName('Abdullah')).toBe('abdullah');
    });

    test('should match celebrity names correctly', () => {
        const celebrity = {
            name: 'Omar Sharif',
            aliases: ['Omar El-Sharif', 'Michel Demitri Shalhoub']
        };

        const exactMatch = fuzzyMatcher.matchCelebrityName('Omar Sharif', celebrity);
        expect(exactMatch.isCorrect).toBe(true);
        expect(exactMatch.score).toBe(100);

        const aliasMatch = fuzzyMatcher.matchCelebrityName('Omar El-Sharif', celebrity);
        expect(aliasMatch.isCorrect).toBe(true);
        expect(aliasMatch.score).toBe(100);

        const closeMatch = fuzzyMatcher.matchCelebrityName('Omar Shariff', celebrity);
        expect(closeMatch.score).toBeGreaterThan(80);
    });

    test('should handle typos and variations', () => {
        const celebrity = {
            name: 'Mohammed Salah',
            aliases: ['Mo Salah']
        };

        const typoMatch = fuzzyMatcher.matchCelebrityName('Mohamed Salah', celebrity);
        expect(typoMatch.isCorrect).toBe(true);

        const variationMatch = fuzzyMatcher.matchCelebrityName('Mo Salah', celebrity);
        expect(variationMatch.isCorrect).toBe(true);
    });
});

describe('WikipediaService', () => {
    let wikipediaService;

    beforeEach(() => {
        wikipediaService = new WikipediaService();
    });

    test('should clean descriptions correctly', () => {
        const htmlDescription = '<p>This is a <b>test</b> description with HTML tags.</p>';
        const cleaned = wikipediaService.cleanDescription(htmlDescription);
        expect(cleaned).toBe('This is a test description with HTML tags.');
    });

    test('should generate name variations', () => {
        const variations = wikipediaService.generateNameVariations('Mohammed Ahmed');
        expect(variations).toContain('muhammad ahmad');
        expect(variations).toContain('al mohammed ahmed');
    });

    test('should calculate name similarity', () => {
        const similarity = wikipediaService.calculateNameSimilarity('Omar Sharif', 'Omar El-Sharif');
        expect(similarity).toBeGreaterThan(50);
    });
});

describe('ImageCache', () => {
    let imageCache;

    beforeEach(() => {
        imageCache = new ImageCache();
    });

    test('should generate cache keys correctly', () => {
        const key1 = imageCache.generateCacheKey('Omar Sharif');
        const key2 = imageCache.generateCacheKey('Omar Sharif');
        expect(key1).toBe(key2);
        expect(key1).toMatch(/^[a-z0-9_]+$/);
    });

    test('should check if image is cached', async () => {
        const isCached = await imageCache.isImageCached('Test Celebrity');
        expect(typeof isCached).toBe('boolean');
    });

    test('should get cache stats', async () => {
        const stats = await imageCache.getCacheStats();
        expect(stats).toHaveProperty('fileCount');
        expect(stats).toHaveProperty('totalSizeMB');
        expect(stats).toHaveProperty('memoryCacheSize');
    });
});

// Mock test for configuration
describe('Configuration', () => {
    test('should load configuration correctly', () => {
        const config = require('../config');
        expect(config).toHaveProperty('DISCORD_TOKEN');
        expect(config).toHaveProperty('QUIZ_TIMEOUT');
        expect(config).toHaveProperty('FUZZY_THRESHOLD');
    });
}); 