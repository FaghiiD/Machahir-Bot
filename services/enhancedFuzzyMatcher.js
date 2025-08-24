/**
 * Enhanced Fuzzy String Matching Service with Advanced Arabic Name Support
 */

const Fuse = require('fuse.js');
const logger = require('../utils/logger');
const config = require('../config');

class EnhancedFuzzyMatcher {
    constructor(threshold = config.FUZZY_THRESHOLD) {
        this.threshold = threshold;
        
        // Extended Arabic name variations and transliterations
        this.commonVariations = {
            // Common name variations
            'mohammed': 'muhammad',
            'mohamed': 'muhammad',
            'mohammad': 'muhammad',
            'ahmed': 'ahmad',
            'ahmad': 'ahmed',
            'helmy': 'hilmi',
            'hilmi': 'helmy',
            'hilmy': 'helmy',
            'helmi': 'helmy',
            'omar': 'umar',
            'umar': 'omar',
            'hassan': 'hasan',
            'hasan': 'hassan',
            'hussein': 'husayn',
            'husayn': 'hussein',
            'hussain': 'hussein',
            'abdallah': 'abdullah',
            'abdullah': 'abdallah',
            'abd allah': 'abdullah',
            'abd al': 'abdul',
            'abdel': 'abdul',
            'abdul': 'abdel',
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
            'isma\'il': 'ismail',
            
            // Additional variations
            'mohammed': 'muhammad',
            'mohamed': 'muhammad',
            'mohammad': 'muhammad',
            'ahmed': 'ahmad',
            'ahmad': 'ahmed',
            'helmy': 'hilmi',
            'hilmi': 'helmy',
            'hilmy': 'helmy',
            'helmi': 'helmy',
            'omar': 'umar',
            'umar': 'omar',
            'hassan': 'hasan',
            'hasan': 'hassan',
            'hussein': 'husayn',
            'husayn': 'hussein',
            'hussain': 'hussein',
            'abdallah': 'abdullah',
            'abdullah': 'abdallah',
            'abd allah': 'abdullah',
            'abd al': 'abdul',
            'abdel': 'abdul',
            'abdul': 'abdel',
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

        // Arabic to English character mappings
        this.arabicToEnglish = {
            'ا': 'a', 'ب': 'b', 'ت': 't', 'ث': 'th', 'ج': 'j', 'ح': 'h', 'خ': 'kh',
            'د': 'd', 'ذ': 'th', 'ر': 'r', 'ز': 'z', 'س': 's', 'ش': 'sh', 'ص': 's',
            'ض': 'd', 'ط': 't', 'ظ': 'th', 'ع': 'a', 'غ': 'gh', 'ف': 'f', 'ق': 'q',
            'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n', 'ه': 'h', 'و': 'w', 'ي': 'y',
            'ة': 'h', 'ى': 'a', 'ئ': 'a', 'ؤ': 'w', 'إ': 'i', 'أ': 'a', 'آ': 'aa',
            'ء': 'a'
        };
    }

    normalizeArabicName(name) {
        if (!name) return "";
        
        // Convert to string and normalize
        name = String(name);
        
        // Convert Arabic characters to English
        let normalized = '';
        for (let char of name) {
            if (this.arabicToEnglish[char]) {
                normalized += this.arabicToEnglish[char];
            } else {
                normalized += char;
            }
        }
        
        // Convert to lowercase and trim
        normalized = normalized.toLowerCase().trim();
        
        // Remove diacritics
        normalized = normalized.replace(/[ًٌٍَُِّْ]/g, '');
        
        // Handle common transliteration issues
        const replacements = {
            'ph': 'f',
            'kh': 'h',
            'gh': 'g',
            'aa': 'a',
            'ee': 'i',
            'oo': 'u',
            'ii': 'i',
            'uu': 'u',
            'th': 't',
            'sh': 's',
            'ch': 'k'
        };
        
        for (const [old, new_] of Object.entries(replacements)) {
            normalized = normalized.replace(new RegExp(old, 'g'), new_);
        }
        
        // Apply common name variations
        for (const [variant, standard] of Object.entries(this.commonVariations)) {
            normalized = normalized.replace(new RegExp(`\\b${variant}\\b`, 'g'), standard);
        }
        
        // Normalize prefixes
        for (const prefix of this.arabicPrefixes) {
            if (normalized.startsWith(prefix)) {
                normalized = prefix.replace(/[- ]/g, '') + ' ' + normalized.substring(prefix.length).trim();
                break;
            }
        }
        
        // Remove extra spaces and normalize
        normalized = normalized.replace(/\s+/g, ' ').trim();
        
        return normalized;
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
        
        // Check aliases - but only accept single-word aliases for single-word celebrities
        for (const alias of aliases) {
            if (normalizedInput === this.normalizeArabicName(alias)) {
                const aliasWords = this.normalizeArabicName(alias).split(' ').filter(word => word.length > 0);
                const celebrityWords = this.normalizeArabicName(celebrityName).split(' ').filter(word => word.length > 0);
                
                // For multi-word celebrities, only accept multi-word aliases
                if (celebrityWords.length > 1) {
                    if (aliasWords.length > 1) {
                        return { isCorrect: true, score: 100, matchedName: alias };
                    } else {
                        // Reject single-word aliases for multi-word celebrities
                        return { isCorrect: false, score: 0, matchedName: null };
                    }
                }
                // For single-word celebrities, accept both single and multi-word aliases
                else {
                    return { isCorrect: true, score: 100, matchedName: alias };
                }
            }
        }
        
        // Check Arabic name
        if (arabicName && normalizedInput === this.normalizeArabicName(arabicName)) {
            return { isCorrect: true, score: 100, matchedName: arabicName };
        }
        
        // Check if input is too short (but allow single names)
        if (normalizedInput.length < 3) {
            return { isCorrect: false, score: 0, matchedName: null };
        }
        
        // Create all possible variations to check against
        const allVariations = [
            celebrityName,
            ...aliases,
            ...(arabicName ? [arabicName] : [])
        ];
        
        // Add normalized versions
        allVariations.push(
            this.normalizeArabicName(celebrityName),
            ...aliases.map(alias => this.normalizeArabicName(alias)),
            ...(arabicName ? [this.normalizeArabicName(arabicName)] : [])
        );
        
        // Only allow full name or alias matches, no single word matching
        const inputWords = normalizedInput.split(' ').filter(word => word.length > 0);
        
        // If input is only one word, it must be a full name celebrity (like "Fairuz")
        if (inputWords.length === 1) {
            // Check if this single word exactly matches a celebrity's full name
            for (const variation of allVariations) {
                const variationWords = this.normalizeArabicName(variation).split(' ').filter(word => word.length > 0);
                // Only match if the celebrity also has only one word in their name
                if (variationWords.length === 1 && variationWords[0] === inputWords[0]) {
                    return { isCorrect: true, score: 100, matchedName: variation };
                }
            }
            // Single word input that doesn't match a single-word celebrity name is incorrect
            return { isCorrect: false, score: 0, matchedName: null };
        }
        
        // Use Fuse.js with more lenient settings
        const fuse = new Fuse(allVariations, {
            threshold: 0.4, // More lenient threshold (40%)
            includeScore: true,
            minMatchCharLength: 2,
            findAllMatches: false,
            location: 0,
            distance: 100,
            useExtendedSearch: false,
            ignoreLocation: true,
            ignoreFieldNorm: true
        });
        
        const results = fuse.search(normalizedInput);
        
        if (results.length > 0) {
            const bestMatch = results[0];
            const score = Math.round((1 - bestMatch.score) * 100);
            
            // More lenient threshold for fuzzy matches
            const requiredThreshold = 70; // Lower threshold for better matching
            
            return {
                isCorrect: score >= requiredThreshold,
                score: score,
                matchedName: bestMatch.item
            };
        }
        
        // Additional check for word-by-word similarity
        const inputWordsSet = new Set(inputWords);
        for (const variation of allVariations) {
            const variationWords = this.normalizeArabicName(variation).split(' ').filter(word => word.length > 0);
            const variationWordsSet = new Set(variationWords);
            
            // Check if at least 50% of words match
            const intersection = new Set([...inputWordsSet].filter(x => variationWordsSet.has(x)));
            if (intersection.size > 0 && intersection.size >= Math.min(inputWordsSet.size, variationWordsSet.size) * 0.5) {
                return { isCorrect: true, score: 85, matchedName: variation };
            }
        }
        
        return { isCorrect: false, score: 0, matchedName: null };
    }

    findBestCelebrityMatch(userInput, celebritiesList) {
        const fuse = new Fuse(celebritiesList, {
            threshold: this.threshold / 100,
            includeScore: true,
            keys: ['name', 'aliases', 'arabic_name'],
            getFn: (obj, path) => {
                if (path === 'name') {
                    return this.normalizeArabicName(obj.name);
                } else if (path === 'aliases') {
                    return obj.aliases ? obj.aliases.map(alias => this.normalizeArabicName(alias)).join(' ') : '';
                } else if (path === 'arabic_name') {
                    return obj.arabic_name ? this.normalizeArabicName(obj.arabic_name) : '';
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
            keys: ['name', 'aliases', 'arabic_name'],
            getFn: (obj, path) => {
                if (path === 'name') {
                    return this.normalizeArabicName(obj.name);
                } else if (path === 'aliases') {
                    return obj.aliases ? obj.aliases.map(alias => this.normalizeArabicName(alias)).join(' ') : '';
                } else if (path === 'arabic_name') {
                    return obj.arabic_name ? this.normalizeArabicName(obj.arabic_name) : '';
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
            
            // Add Arabic name as suggestion
            if (celebrityData.arabic_name) {
                suggestions.push(celebrityData.arabic_name);
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
        } else if (score >= 70) {
            return "Close match, but not quite right.";
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

module.exports = EnhancedFuzzyMatcher; 