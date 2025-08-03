"""
Image caching service to avoid repeated API calls and optimize performance
"""

import os
import hashlib
import aiohttp
import asyncio
import logging
from datetime import datetime, timedelta
import json
from urllib.parse import urlparse
from PIL import Image
import io

logger = logging.getLogger(__name__)

class ImageCache:
    def __init__(self, cache_dir="cache", max_age_days=7, max_size_mb=100):
        self.cache_dir = cache_dir
        self.max_age = timedelta(days=max_age_days)
        self.max_size_bytes = max_size_mb * 1024 * 1024
        
        # Create cache directory
        os.makedirs(self.cache_dir, exist_ok=True)
        
        # Cache metadata file
        self.metadata_file = os.path.join(self.cache_dir, "cache_metadata.json")
        self.metadata = self.load_metadata()
        
        # HTTP session for downloading
        self.session = None

    async def get_session(self):
        """Get or create aiohttp session"""
        if self.session is None or self.session.closed:
            self.session = aiohttp.ClientSession(
                headers={'User-Agent': 'ArabCelebrityQuizBot/1.0 Image Cache'}
            )
        return self.session

    async def close_session(self):
        """Close aiohttp session"""
        if self.session and not self.session.closed:
            await self.session.close()

    def load_metadata(self):
        """Load cache metadata from file"""
        try:
            if os.path.exists(self.metadata_file):
                with open(self.metadata_file, 'r') as f:
                    return json.load(f)
        except Exception as e:
            logger.error(f"Error loading cache metadata: {e}")
        
        return {}

    def save_metadata(self):
        """Save cache metadata to file"""
        try:
            with open(self.metadata_file, 'w') as f:
                json.dump(self.metadata, f, indent=2, default=str)
        except Exception as e:
            logger.error(f"Error saving cache metadata: {e}")

    def get_cache_key(self, url):
        """Generate cache key from URL"""
        return hashlib.md5(url.encode()).hexdigest()

    def get_file_extension(self, url, content_type=None):
        """Determine file extension from URL or content type"""
        # Try to get extension from URL
        parsed_url = urlparse(url)
        path_ext = os.path.splitext(parsed_url.path)[1].lower()
        
        if path_ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp']:
            return path_ext
        
        # Try to get extension from content type
        if content_type:
            content_type = content_type.lower()
            if 'jpeg' in content_type or 'jpg' in content_type:
                return '.jpg'
            elif 'png' in content_type:
                return '.png'
            elif 'gif' in content_type:
                return '.gif'
            elif 'webp' in content_type:
                return '.webp'
        
        # Default to jpg
        return '.jpg'

    def is_cache_valid(self, cache_key):
        """Check if cached item is still valid"""
        if cache_key not in self.metadata:
            return False
        
        item = self.metadata[cache_key]
        cached_time = datetime.fromisoformat(item['cached_at'])
        
        return datetime.now() - cached_time < self.max_age

    def get_cached_file_path(self, cache_key):
        """Get the file path for a cached item"""
        if cache_key in self.metadata:
            return self.metadata[cache_key]['file_path']
        return None

    async def cache_image(self, url, max_width=800, max_height=600, quality=85):
        """Download and cache an image with optimization"""
        cache_key = self.get_cache_key(url)
        
        # Check if already cached and valid
        if self.is_cache_valid(cache_key):
            cached_path = self.get_cached_file_path(cache_key)
            if cached_path and os.path.exists(cached_path):
                logger.debug(f"Using cached image for {url}")
                return cached_path
        
        try:
            session = await self.get_session()
            
            # Download image
            async with session.get(url) as response:
                if response.status != 200:
                    logger.error(f"Failed to download image: {response.status}")
                    return None
                
                image_data = await response.read()
                content_type = response.headers.get('content-type', '')
                
                # Process and optimize image
                optimized_data = self.optimize_image(
                    image_data, 
                    max_width, 
                    max_height, 
                    quality
                )
                
                if not optimized_data:
                    logger.error("Failed to optimize image")
                    return None
                
                # Save to cache
                file_ext = self.get_file_extension(url, content_type)
                file_name = f"{cache_key}{file_ext}"
                file_path = os.path.join(self.cache_dir, file_name)
                
                with open(file_path, 'wb') as f:
                    f.write(optimized_data)
                
                # Update metadata
                self.metadata[cache_key] = {
                    'url': url,
                    'file_path': file_path,
                    'file_name': file_name,
                    'cached_at': datetime.now().isoformat(),
                    'content_type': content_type,
                    'file_size': len(optimized_data)
                }
                
                self.save_metadata()
                
                # Clean up old cache if needed
                await self.cleanup_cache()
                
                logger.info(f"Cached image from {url} to {file_path}")
                return file_path
                
        except Exception as e:
            logger.error(f"Error caching image from {url}: {e}")
            return None

    def optimize_image(self, image_data, max_width, max_height, quality):
        """Optimize image size and quality"""
        try:
            # Open image with PIL
            image = Image.open(io.BytesIO(image_data))
            
            # Convert to RGB if necessary
            if image.mode in ('RGBA', 'LA', 'P'):
                # Create white background
                background = Image.new('RGB', image.size, (255, 255, 255))
                if image.mode == 'P':
                    image = image.convert('RGBA')
                background.paste(image, mask=image.split()[-1] if 'A' in image.mode else None)
                image = background
            
            # Resize if too large
            if image.width > max_width or image.height > max_height:
                image.thumbnail((max_width, max_height), Image.Resampling.LANCZOS)
            
            # Save optimized image
            output = io.BytesIO()
            image.save(output, format='JPEG', quality=quality, optimize=True)
            
            return output.getvalue()
            
        except Exception as e:
            logger.error(f"Error optimizing image: {e}")
            return None

    async def get_cached_image(self, url):
        """Get cached image or download and cache it"""
        return await self.cache_image(url)

    async def cleanup_cache(self):
        """Clean up old cache files and manage cache size"""
        try:
            current_time = datetime.now()
            total_size = 0
            files_to_remove = []
            
            # Check each cached item
            for cache_key, item in list(self.metadata.items()):
                file_path = item['file_path']
                
                # Check if file exists
                if not os.path.exists(file_path):
                    del self.metadata[cache_key]
                    continue
                
                # Check age
                cached_time = datetime.fromisoformat(item['cached_at'])
                if current_time - cached_time > self.max_age:
                    files_to_remove.append((cache_key, file_path, 0))  # 0 for expired
                    continue
                
                # Track total size
                file_size = item.get('file_size', os.path.getsize(file_path))
                total_size += file_size
                
                # Add to potential removal list if cache is too large
                if total_size > self.max_size_bytes:
                    files_to_remove.append((cache_key, file_path, cached_time.timestamp()))
            
            # Remove expired files
            expired_count = 0
            for cache_key, file_path, timestamp in files_to_remove:
                if timestamp == 0:  # Expired file
                    self.remove_cached_file(cache_key, file_path)
                    expired_count += 1
            
            # Remove oldest files if cache is still too large
            if total_size > self.max_size_bytes:
                # Sort by timestamp (oldest first)
                size_removals = [(k, p, t) for k, p, t in files_to_remove if t > 0]
                size_removals.sort(key=lambda x: x[2])
                
                removed_size = 0
                for cache_key, file_path, _ in size_removals:
                    if total_size - removed_size <= self.max_size_bytes:
                        break
                    
                    file_size = self.metadata.get(cache_key, {}).get('file_size', 0)
                    self.remove_cached_file(cache_key, file_path)
                    removed_size += file_size
            
            # Save updated metadata
            self.save_metadata()
            
            if expired_count > 0:
                logger.info(f"Cleaned up {expired_count} expired cache files")
                
        except Exception as e:
            logger.error(f"Error during cache cleanup: {e}")

    def remove_cached_file(self, cache_key, file_path):
        """Remove a single cached file"""
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
            
            if cache_key in self.metadata:
                del self.metadata[cache_key]
                
        except Exception as e:
            logger.error(f"Error removing cached file {file_path}: {e}")

    def get_cache_stats(self):
        """Get cache statistics"""
        total_files = len(self.metadata)
        total_size = 0
        valid_files = 0
        
        for item in self.metadata.values():
            if os.path.exists(item['file_path']):
                total_size += item.get('file_size', 0)
                
                if self.is_cache_valid(item['file_path']):
                    valid_files += 1
        
        return {
            'total_files': total_files,
            'valid_files': valid_files,
            'total_size_mb': total_size / (1024 * 1024),
            'max_size_mb': self.max_size_bytes / (1024 * 1024),
            'max_age_days': self.max_age.days
        }

    async def preload_celebrity_images(self, celebrities_list):
        """Preload images for a list of celebrities"""
        logger.info(f"Preloading images for {len(celebrities_list)} celebrities...")
        
        tasks = []
        for celebrity in celebrities_list:
            image_url = celebrity.get('image_url')
            if image_url:
                task = self.cache_image(image_url)
                tasks.append(task)
        
        # Process in batches to avoid overwhelming the server
        batch_size = 5
        for i in range(0, len(tasks), batch_size):
            batch = tasks[i:i + batch_size]
            await asyncio.gather(*batch, return_exceptions=True)
            
            # Small delay between batches
            if i + batch_size < len(tasks):
                await asyncio.sleep(1)
        
        logger.info("Image preloading complete")

    async def __aenter__(self):
        """Async context manager entry"""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        await self.close_session()
