"""
Wikipedia API service for fetching celebrity images and information
"""

import aiohttp
import asyncio
import logging
from urllib.parse import quote
import re

logger = logging.getLogger(__name__)

class WikipediaService:
    def __init__(self):
        self.base_url = "https://en.wikipedia.org/w/api.php"
        self.headers = {
            'User-Agent': 'ArabCelebrityQuizBot/1.0 (Discord Bot for Educational Purposes)'
        }
        self.session = None

    async def get_session(self):
        """Get or create aiohttp session"""
        if self.session is None or self.session.closed:
            self.session = aiohttp.ClientSession(headers=self.headers)
        return self.session

    async def close_session(self):
        """Close aiohttp session"""
        if self.session and not self.session.closed:
            await self.session.close()

    async def search_celebrities(self, query, limit=20):
        """Search for celebrities and get their images"""
        session = await self.get_session()
        
        params = {
            "action": "query",
            "generator": "search",
            "gsrnamespace": 0,
            "gsrlimit": limit,
            "prop": "pageimages|extracts",
            "pilimit": "max",
            "exintro": True,
            "exsentences": 1,
            "exlimit": "max",
            "pithumbsize": 300,
            "format": "json",
            "gsrsearch": query
        }
        
        try:
            async with session.get(self.base_url, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    return self.parse_search_results(data)
                else:
                    logger.error(f"Wikipedia search failed with status {response.status}")
                    return []
        except Exception as e:
            logger.error(f"Error searching Wikipedia: {e}")
            return []

    def parse_search_results(self, data):
        """Parse Wikipedia search results"""
        results = []
        
        if 'query' in data and 'pages' in data['query']:
            for page_id, page_data in data['query']['pages'].items():
                if page_id == '-1':  # Skip missing pages
                    continue
                
                result = {
                    'name': page_data.get('title', ''),
                    'description': page_data.get('extract', ''),
                    'image_url': None
                }
                
                # Get image URL
                if 'thumbnail' in page_data:
                    result['image_url'] = page_data['thumbnail']['source']
                elif 'original' in page_data:
                    result['image_url'] = page_data['original']['source']
                
                results.append(result)
        
        return results

    async def get_celebrity_image(self, celebrity_name):
        """Get main image for a specific celebrity"""
        session = await self.get_session()
        
        params = {
            "action": "query",
            "prop": "pageimages",
            "format": "json",
            "piprop": "original",
            "titles": celebrity_name,
            "pithumbsize": 500
        }
        
        try:
            async with session.get(self.base_url, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    if 'query' in data and 'pages' in data['query']:
                        page_data = list(data['query']['pages'].values())[0]
                        
                        if 'original' in page_data:
                            return page_data['original']['source']
                        elif 'thumbnail' in page_data:
                            return page_data['thumbnail']['source']
                
                logger.warning(f"No image found for {celebrity_name}")
                return None
                
        except Exception as e:
            logger.error(f"Error getting celebrity image: {e}")
            return None

    async def get_celebrity_profile(self, name):
        """Get complete celebrity profile with image, bio, and links"""
        session = await self.get_session()
        
        params = {
            "action": "query",
            "prop": "info|extracts|pageimages",
            "inprop": "url",
            "exsentences": 3,
            "titles": name,
            "format": "json",
            "pithumbsize": 400,
            "piprop": "original"
        }
        
        try:
            async with session.get(self.base_url, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    return self.parse_celebrity_profile(data)
                else:
                    logger.error(f"Failed to get profile for {name}")
                    return None
                    
        except Exception as e:
            logger.error(f"Error getting celebrity profile: {e}")
            return None

    def parse_celebrity_profile(self, data):
        """Parse celebrity profile data from Wikipedia API response"""
        profile = {}
        
        try:
            if 'query' in data and 'pages' in data['query']:
                page_data = list(data['query']['pages'].values())[0]
                
                # Skip if page doesn't exist
                if 'missing' in page_data:
                    return None
                
                profile['name'] = page_data.get('title', '')
                profile['description'] = page_data.get('extract', '')
                profile['wikipedia_url'] = page_data.get('fullurl', '')
                
                # Get image URL
                if 'original' in page_data:
                    profile['image_url'] = page_data['original']['source']
                elif 'thumbnail' in page_data:
                    profile['image_url'] = page_data['thumbnail']['source']
                else:
                    profile['image_url'] = None
                
                # Clean description
                if profile['description']:
                    profile['description'] = self.clean_description(profile['description'])
                
        except Exception as e:
            logger.error(f"Error parsing celebrity profile: {e}")
            return None
        
        return profile

    def clean_description(self, description):
        """Clean Wikipedia description text"""
        # Remove HTML tags
        description = re.sub(r'<[^>]+>', '', description)
        
        # Remove citation markers
        description = re.sub(r'\[\d+\]', '', description)
        
        # Remove extra whitespace
        description = re.sub(r'\s+', ' ', description).strip()
        
        # Limit length
        if len(description) > 300:
            description = description[:300] + "..."
        
        return description

    async def search_celebrity_variations(self, celebrity_name, aliases=None):
        """Search for celebrity using multiple name variations"""
        search_terms = [celebrity_name]
        
        if aliases:
            search_terms.extend(aliases)
        
        # Add common variations for Arab names
        variations = self.generate_name_variations(celebrity_name)
        search_terms.extend(variations)
        
        best_result = None
        best_score = 0
        
        for term in search_terms:
            try:
                profile = await self.get_celebrity_profile(term)
                if profile and profile.get('image_url'):
                    # Simple scoring based on name similarity
                    score = self.calculate_name_similarity(celebrity_name, profile['name'])
                    
                    if score > best_score:
                        best_score = score
                        best_result = profile
                        
                # Add small delay to respect rate limits
                await asyncio.sleep(0.1)
                
            except Exception as e:
                logger.error(f"Error searching for variation '{term}': {e}")
                continue
        
        return best_result

    def generate_name_variations(self, name):
        """Generate common variations for Arab names"""
        variations = []
        
        # Common transliteration variations
        replacements = {
            'mohammed': ['muhammad', 'mohamed'],
            'muhammad': ['mohammed', 'mohamed'],
            'ahmed': ['ahmad'],
            'ahmad': ['ahmed'],
            'omar': ['umar'],
            'umar': ['omar'],
            'hassan': ['hasan'],
            'hasan': ['hassan'],
            'hussein': ['husayn', 'hussain'],
            'husayn': ['hussein', 'hussain']
        }
        
        name_lower = name.lower()
        for original, variants in replacements.items():
            if original in name_lower:
                for variant in variants:
                    new_name = name_lower.replace(original, variant)
                    variations.append(new_name.title())
        
        # Add with/without common prefixes
        prefixes = ['al-', 'el-', 'abd', 'abdul']
        words = name.split()
        
        for prefix in prefixes:
            # Try adding prefix
            if not any(word.lower().startswith(prefix) for word in words):
                variations.append(f"{prefix.capitalize()} {name}")
            
            # Try removing prefix
            new_words = []
            for word in words:
                if word.lower().startswith(prefix):
                    new_words.append(word[len(prefix):])
                else:
                    new_words.append(word)
            
            if new_words != words:
                variations.append(' '.join(new_words))
        
        return list(set(variations))  # Remove duplicates

    def calculate_name_similarity(self, name1, name2):
        """Simple name similarity calculation"""
        name1 = name1.lower().strip()
        name2 = name2.lower().strip()
        
        if name1 == name2:
            return 100
        
        # Count common words
        words1 = set(name1.split())
        words2 = set(name2.split())
        
        common_words = words1.intersection(words2)
        total_words = words1.union(words2)
        
        if not total_words:
            return 0
        
        return (len(common_words) / len(total_words)) * 100

    async def __aenter__(self):
        """Async context manager entry"""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        await self.close_session()
