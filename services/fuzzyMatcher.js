/**
 * Fuzzy string matching service with Arabic name support and typo tolerance
 */

const Fuse = require('fuse.js');
const logger = require('../utils/logger');
const config = require('../config');

class FuzzyMatcher {
    constructor(threshold = config.FUZZY_THRESHOLD) {
        this.threshold = threshold;
        
        // Common Arabic name variations and transliterations
        this.commonVariations = {
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
            'nasser': 'nasir',
            'nasir': 'nasser',
            'farid': 'fareed',
            'fareed': 'farid',
            'khalid': 'khaled',
            'khaled': 'khalid',
            'wehbe': 'wahbi',
            'wahbi': 'wehbe',
            'wehby': 'wehbe',
            'wahby': 'wehbe',
            'haifa': 'haifaa',
            'haifaa': 'haifa',
            'salah': 'salaah',
            'salaah': 'salah',
            'ali': 'aly',
            'aly': 'ali',
            'fatima': 'fatimah',
            'fatimah': 'fatima',
            'aisha': 'aishah',
            'aishah': 'aisha',
            'zainab': 'zaynab',
            'zaynab': 'zainab',
            'mariam': 'maryam',
            'maryam': 'mariam',
            'yusuf': 'yousef',
            'yousef': 'yusuf',
            'ibrahim': 'ebraheem',
            'ebraheem': 'ibrahim',
            'ismail': 'ismaeel',
            'ismaeel': 'ismail',
            'isma\'il': 'ismail'
        };
        
        // Common Arabic prefixes
        this.arabicPrefixes = [
            'al-', 'el-', 'al ', 'el ',
            'abd', 'abdul', 'abdel', 'abdal',
            'abu', 'abou', 'abo',
            'bin', 'ibn', 'ben',
            'al-', 'ad-', 'ar-', 'as-', 'at-', 'an-'
        ];
    }

    normalizeArabicName(name) {
        if (!name) return "";
        
        // Convert to string and normalize
        name = String(name);
        
        // Convert to lowercase (only for Latin characters)
        name = name.toLowerCase().trim();
        
        // Remove diacritics
        name = name.replace(/[ًٌٍَُِّْ]/g, ''); // Arabic diacritics
        
        // Handle common transliteration issues
        const replacements = {
            'ph': 'f',
            'kh': 'h',
            'gh': 'g',
            'aa': 'a',
            'ee': 'i',
            'oo': 'u',
            'ii': 'i',
            'uu': 'u'
        };
        
        for (const [old, new_] of Object.entries(replacements)) {
            name = name.replace(new RegExp(old, 'g'), new_);
        }
        
        // Apply common name variations
        for (const [variant, standard] of Object.entries(this.commonVariations)) {
            name = name.replace(new RegExp(variant, 'g'), standard);
        }
        
        // Normalize prefixes
        for (const prefix of this.arabicPrefixes) {
            if (name.startsWith(prefix)) {
                name = prefix.replace(/[- ]/g, '') + ' ' + name.substring(prefix.length).trim();
                break;
            }
        }
        
        // Remove extra spaces and normalize
        name = name.replace(/\s+/g, ' ').trim();
        
        return name;
    }

    extractNameComponents(name) {
        const normalized = this.normalizeArabicName(name);
        
        // Split into words
        const words = normalized.split(' ');
        
        // Filter out common prefixes and suffixes
        const filteredWords = words.filter(word => 
            word.length > 1 && 
            !this.arabicPrefixes.includes(word.toLowerCase())
        );
        
        return filteredWords;
    }

    matchCelebrityName(userInput, celebrityData) {
        const normalizedInput = this.normalizeArabicName(userInput);
        const celebrityName = celebrityData.name;
        const aliases = celebrityData.aliases || [];
        const arabicName = celebrityData.arabic_name;
        
        // Check exact match first
        if (normalizedInput === this.normalizeArabicName(celebrityName)) {
            return { isCorrect: true, score: 100, matchedName: celebrityName };
        }
        
        // Check aliases
        for (const alias of aliases) {
            if (normalizedInput === this.normalizeArabicName(alias)) {
                // If the input exactly matches an alias, it's correct
                // No need for additional "significant part" checks for exact alias matches
                return { isCorrect: true, score: 100, matchedName: alias };
            }
        }
        
        // Check Arabic name
        if (arabicName && normalizedInput === this.normalizeArabicName(arabicName)) {
            return { isCorrect: true, score: 100, matchedName: arabicName };
        }
        
        // For fuzzy matching, be very strict
        // Only allow matches if the input is very close to the actual name
        
        // Check if input is too short
        if (normalizedInput.length < 4) {
            return { isCorrect: false, score: 0, matchedName: null };
        }
        
        // For single words, be less strict but still require some similarity
        const inputWords = normalizedInput.split(' ').filter(word => word.length > 0);
        if (inputWords.length === 1) {
            // Single words should match if they are exact matches or very close
            const celebrityWords = this.normalizeArabicName(celebrityName).split(' ').filter(word => word.length > 0);
            const aliasWords = aliases.flatMap(alias => this.normalizeArabicName(alias).split(' ').filter(word => word.length > 0));
            const arabicWords = arabicName ? this.normalizeArabicName(arabicName).split(' ').filter(word => word.length > 0) : [];
            
            const allWords = [...celebrityWords, ...aliasWords, ...arabicWords];
            
            // Check for exact word match
            const exactWordMatch = allWords.some(word => word === inputWords[0]);
            if (exactWordMatch) {
                return { isCorrect: true, score: 95, matchedName: inputWords[0] };
            }
        }
        
        // Use Fuse.js with very strict settings
        const searchData = [celebrityName, ...aliases];
        if (arabicName) {
            searchData.push(arabicName);
        }
        
        const fuse = new Fuse(searchData, {
            threshold: 0.3, // More lenient threshold (30%)
            includeScore: true,
            keys: ['name'],
            getFn: (obj, path) => {
                if (typeof obj === 'string') {
                    return this.normalizeArabicName(obj);
                }
                return this.normalizeArabicName(obj[path]);
            }
        });
        
        const results = fuse.search(normalizedInput);
        
        if (results.length > 0) {
            const bestMatch = results[0];
            const score = Math.round((1 - bestMatch.score) * 100);
            
            // Require reasonable threshold for fuzzy matches
            const requiredThreshold = 80; // Reasonable threshold for close matches
            
            return {
                isCorrect: score >= requiredThreshold,
                score: score,
                matchedName: bestMatch.item
            };
        }
        
        return { isCorrect: false, score: 0, matchedName: null };
    }

    findBestCelebrityMatch(userInput, celebritiesList) {
        const fuse = new Fuse(celebritiesList, {
            threshold: this.threshold / 100,
            includeScore: true,
            keys: ['name', 'aliases'],
            getFn: (obj, path) => {
                if (path === 'name') {
                    return this.normalizeArabicName(obj.name);
                } else if (path === 'aliases') {
                    return obj.aliases ? obj.aliases.map(alias => this.normalizeArabicName(alias)).join(' ') : '';
                }
                return '';
            }
        });
        
        const results = fuse.search(userInput);
        
        if (results.length > 0) {
            const bestMatch = results[0];
            return {
                celebrity: bestMatch.item,
                score: Math.round((1 - bestMatch.score) * 100)
            };
        }
        
        return null;
    }

    isCorrectAnswer(userInput, celebrityData, threshold = null) {
        const matchResult = this.matchCelebrityName(userInput, celebrityData);
        const matchThreshold = threshold || this.threshold;
        return matchResult.score >= matchThreshold;
    }

    getFuzzyMatches(userInput, celebritiesList, limit = 5, threshold = null) {
        const matchThreshold = threshold || this.threshold;
        const fuse = new Fuse(celebritiesList, {
            threshold: matchThreshold / 100,
            includeScore: true,
            keys: ['name', 'aliases'],
            getFn: (obj, path) => {
                if (path === 'name') {
                    return this.normalizeArabicName(obj.name);
                } else if (path === 'aliases') {
                    return obj.aliases ? obj.aliases.map(alias => this.normalizeArabicName(alias)).join(' ') : '';
                }
                return '';
            }
        });
        
        const results = fuse.search(userInput);
        
        return results.slice(0, limit).map(result => ({
            celebrity: result.item,
            score: Math.round((1 - result.score) * 100)
        }));
    }

    matchWithSuggestions(userInput, celebrityData, suggestionThreshold = config.FUZZY_SUGGESTION_THRESHOLD) {
        const matchResult = this.matchCelebrityName(userInput, celebrityData);
        
        if (matchResult.isCorrect) {
            return {
                isCorrect: true,
                score: matchResult.score,
                matchedName: matchResult.matchedName,
                suggestions: []
            };
        }
        
        // Generate suggestions if score is above suggestion threshold
        const suggestions = [];
        if (matchResult.score >= suggestionThreshold) {
            suggestions.push(matchResult.matchedName);
            
            // Add aliases as suggestions
            if (celebrityData.aliases) {
                suggestions.push(...celebrityData.aliases.slice(0, 2));
            }
        }
        
        return {
            isCorrect: false,
            score: matchResult.score,
            matchedName: matchResult.matchedName,
            suggestions: suggestions
        };
    }

    normalizeAnswerForDisplay(userInput) {
        if (!userInput) return '';
        
        // Capitalize first letter of each word
        return userInput.split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }

    getMatchExplanation(userInput, celebrityData, score) {
        if (score >= 100) {
            return "Perfect match!";
        } else if (score >= 90) {
            return "Very close match!";
        } else if (score >= 80) {
            return "Good match with minor differences.";
        } else if (score >= 60) {
            return "Partial match, but not quite right.";
        } else {
            return "No match found.";
        }
    }

    calculateWordSimilarity(word1, word2) {
        if (!word1 || !word2) return 0;
        
        const longer = word1.length > word2.length ? word1 : word2;
        const shorter = word1.length > word2.length ? word2 : word1;
        
        if (longer.length === 0) return 1.0;
        
        const distance = this.levenshteinDistance(longer, shorter);
        return (longer.length - distance) / longer.length;
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

    debugMatchProcess(userInput, celebrityData) {
        const normalizedInput = this.normalizeArabicName(userInput);
        const normalizedCelebrity = this.normalizeArabicName(celebrityData.name);
        
        logger.debug(`Debug match process:`);
        logger.debug(`  Original input: "${userInput}"`);
        logger.debug(`  Normalized input: "${normalizedInput}"`);
        logger.debug(`  Celebrity name: "${celebrityData.name}"`);
        logger.debug(`  Normalized celebrity: "${normalizedCelebrity}"`);
        
        const matchResult = this.matchCelebrityName(userInput, celebrityData);
        logger.debug(`  Match result:`, matchResult);
        
        return matchResult;
    }
}

module.exports = FuzzyMatcher; 