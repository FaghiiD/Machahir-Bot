"""
Fuzzy string matching service with Arabic name support and typo tolerance
"""

import logging
from rapidfuzz import fuzz, process
import re
import unicodedata

logger = logging.getLogger(__name__)

class FuzzyMatcher:
    def __init__(self, threshold=80):
        self.threshold = threshold
        
        # Common Arabic name variations and transliterations
        self.common_variations = {
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
            'khaled': 'khalid'
        }
        
        # Common Arabic prefixes
        self.arabic_prefixes = [
            'al-', 'el-', 'al ', 'el ',
            'abd', 'abdul', 'abdel', 'abdal',
            'abu', 'abou', 'abo',
            'bin', 'ibn', 'ben',
            'al-', 'ad-', 'ar-', 'as-', 'at-', 'an-'
        ]

    def normalize_arabic_name(self, name):
        """Normalize Arabic names for better matching"""
        if not name:
            return ""
        
        # Convert to string and normalize unicode
        name = str(name)
        name = unicodedata.normalize('NFKD', name)
        
        # Convert to lowercase
        name = name.lower().strip()
        
        # Remove diacritics and special characters
        name = re.sub(r'[ًٌٍَُِّْ]', '', name)  # Arabic diacritics
        name = re.sub(r'[^\w\s\-]', ' ', name)   # Non-word characters except hyphens
        
        # Handle common transliteration issues
        replacements = {
            'ph': 'f',
            'kh': 'h',
            'gh': 'g',
            'aa': 'a',
            'ee': 'i',
            'oo': 'u',
            'oo': 'o',
            'ii': 'i',
            'uu': 'u'
        }
        
        for old, new in replacements.items():
            name = name.replace(old, new)
        
        # Apply common name variations
        for variant, standard in self.common_variations.items():
            name = name.replace(variant, standard)
        
        # Normalize prefixes
        for prefix in self.arabic_prefixes:
            if name.startswith(prefix):
                name = prefix.replace('-', '').replace(' ', '') + ' ' + name[len(prefix):].strip()
                break
        
        # Remove extra spaces and normalize
        name = re.sub(r'\s+', ' ', name).strip()
        
        return name

    def extract_name_components(self, name):
        """Extract and normalize name components"""
        normalized = self.normalize_arabic_name(name)
        
        # Split into words
        words = normalized.split()
        
        # Identify prefixes, first names, and last names
        prefixes = []
        names = []
        
        for word in words:
            if any(word.startswith(prefix.replace('-', '').replace(' ', '')) for prefix in self.arabic_prefixes):
                prefixes.append(word)
            else:
                names.append(word)
        
        return {
            'prefixes': prefixes,
            'names': names,
            'full_normalized': normalized,
            'original': name
        }

    def match_celebrity_name(self, user_input, celebrity_data):
        """Match user input against celebrity name and aliases"""
        if not user_input or not celebrity_data:
            return 0
        
        # Normalize user input
        normalized_input = self.normalize_arabic_name(user_input)
        
        # Prepare celebrity names to match against
        match_candidates = []
        
        # Main name
        main_name = celebrity_data.get('name', '')
        if main_name:
            match_candidates.append(self.normalize_arabic_name(main_name))
        
        # Aliases
        aliases = celebrity_data.get('aliases', [])
        for alias in aliases:
            if alias:
                match_candidates.append(self.normalize_arabic_name(alias))
        
        # Arabic name
        arabic_name = celebrity_data.get('arabic_name', '')
        if arabic_name:
            match_candidates.append(self.normalize_arabic_name(arabic_name))
        
        # Remove duplicates
        match_candidates = list(set(match_candidates))
        
        if not match_candidates:
            return 0
        
        # Calculate best match score
        best_score = 0
        
        for candidate in match_candidates:
            if not candidate:
                continue
            
            # Try different matching strategies
            scores = [
                fuzz.ratio(normalized_input, candidate),
                fuzz.partial_ratio(normalized_input, candidate),
                fuzz.token_sort_ratio(normalized_input, candidate),
                fuzz.token_set_ratio(normalized_input, candidate)
            ]
            
            # Also try matching individual name components
            input_components = self.extract_name_components(user_input)
            candidate_components = self.extract_name_components(candidate)
            
            # Match individual names
            for input_name in input_components['names']:
                for candidate_name in candidate_components['names']:
                    scores.append(fuzz.ratio(input_name, candidate_name))
            
            # Get best score for this candidate
            candidate_best = max(scores) if scores else 0
            best_score = max(best_score, candidate_best)
        
        return best_score

    def find_best_celebrity_match(self, user_input, celebrities_list):
        """Find the best matching celebrity from a list"""
        if not user_input or not celebrities_list:
            return None, 0
        
        best_celebrity = None
        best_score = 0
        
        for celebrity in celebrities_list:
            score = self.match_celebrity_name(user_input, celebrity)
            
            if score > best_score:
                best_score = score
                best_celebrity = celebrity
        
        return best_celebrity, best_score

    def is_correct_answer(self, user_input, celebrity_data, threshold=None):
        """Check if user input is a correct answer for the celebrity"""
        if threshold is None:
            threshold = self.threshold
        
        score = self.match_celebrity_name(user_input, celebrity_data)
        return score >= threshold, score

    def get_fuzzy_matches(self, user_input, celebrities_list, limit=5, threshold=None):
        """Get multiple fuzzy matches sorted by score"""
        if threshold is None:
            threshold = self.threshold
        
        matches = []
        
        for celebrity in celebrities_list:
            score = self.match_celebrity_name(user_input, celebrity)
            
            if score >= threshold:
                matches.append((celebrity, score))
        
        # Sort by score descending
        matches.sort(key=lambda x: x[1], reverse=True)
        
        return matches[:limit]

    def match_with_suggestions(self, user_input, celebrities_list, suggestion_threshold=60):
        """Match with suggestions for close matches"""
        best_celebrity, best_score = self.find_best_celebrity_match(user_input, celebrities_list)
        
        result = {
            'is_correct': False,
            'score': best_score,
            'celebrity': best_celebrity,
            'suggestions': []
        }
        
        if best_score >= self.threshold:
            result['is_correct'] = True
        elif best_score >= suggestion_threshold:
            # Provide suggestions for close matches
            suggestions = self.get_fuzzy_matches(
                user_input, 
                celebrities_list, 
                limit=3, 
                threshold=suggestion_threshold
            )
            result['suggestions'] = [cel for cel, score in suggestions]
        
        return result

    def normalize_answer_for_display(self, user_input):
        """Normalize user input for display purposes"""
        # Keep original formatting but fix common issues
        normalized = user_input.strip()
        
        # Capitalize words properly
        words = normalized.split()
        capitalized_words = []
        
        for word in words:
            # Don't capitalize common Arabic particles
            if word.lower() in ['al', 'el', 'bin', 'ibn', 'abu', 'abd']:
                capitalized_words.append(word.lower())
            else:
                capitalized_words.append(word.capitalize())
        
        return ' '.join(capitalized_words)

    def get_match_explanation(self, user_input, celebrity_data, score):
        """Generate explanation for match score"""
        if score >= 95:
            return "Perfect match!"
        elif score >= self.threshold:
            return f"Good match (confidence: {score:.1f}%)"
        elif score >= 60:
            return f"Close match, but not quite right (similarity: {score:.1f}%)"
        else:
            return f"Not a match (similarity: {score:.1f}%)"

    def debug_match_process(self, user_input, celebrity_data):
        """Debug information for match process"""
        normalized_input = self.normalize_arabic_name(user_input)
        
        debug_info = {
            'user_input': user_input,
            'normalized_input': normalized_input,
            'celebrity_name': celebrity_data.get('name', ''),
            'celebrity_aliases': celebrity_data.get('aliases', []),
            'celebrity_arabic': celebrity_data.get('arabic_name', ''),
            'match_candidates': [],
            'scores': []
        }
        
        # Prepare match candidates
        candidates = []
        if celebrity_data.get('name'):
            candidates.append(celebrity_data['name'])
        if celebrity_data.get('aliases'):
            candidates.extend(celebrity_data['aliases'])
        if celebrity_data.get('arabic_name'):
            candidates.append(celebrity_data['arabic_name'])
        
        for candidate in candidates:
            normalized_candidate = self.normalize_arabic_name(candidate)
            score = fuzz.ratio(normalized_input, normalized_candidate)
            
            debug_info['match_candidates'].append({
                'original': candidate,
                'normalized': normalized_candidate,
                'score': score
            })
        
        return debug_info
