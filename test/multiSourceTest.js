/**
 * Test script for multi-source image system
 */

const MultiSourceImageService = require('../services/multiSourceImageService');
const EnhancedImageCache = require('../services/enhancedImageCache');
const logger = require('../utils/logger');

async function testMultiSourceSystem() {
    console.log('🧪 Testing Multi-Source Image System...\n');
    
    try {
        // Test 1: Multi-Source Service
        console.log('1. Testing Multi-Source Service...');
        const multiSource = new MultiSourceImageService();
        
        // Test Wikipedia source
        console.log('   Testing Wikipedia source...');
        const wikiImages = await multiSource.fetchFromWikipedia('Amr Diab', 3);
        console.log(`   Found ${wikiImages.length} Wikipedia images`);
        
        // Test source status
        const status = multiSource.getSourceStatus();
        console.log('   Source status:', status.map(s => `${s.name}: ${s.enabled ? 'enabled' : 'disabled'}`));
        
        // Test 2: Enhanced Image Cache
        console.log('\n2. Testing Enhanced Image Cache...');
        const imageCache = new EnhancedImageCache();
        
        // Test getting images for a celebrity
        console.log('   Fetching images for "Amr Diab"...');
        const images = await imageCache.getCelebrityImages('Amr Diab', 5);
        console.log(`   Found ${images.length} images in cache`);
        
        if (images.length > 0) {
            console.log('   Image sources:', [...new Set(images.map(img => img.source))]);
            console.log('   First image info:', {
                source: images[0].source,
                title: images[0].title,
                hasData: !!images[0].data,
                size: images[0].size
            });
        }
        
        // Test cache stats
        const stats = await imageCache.getCacheStats();
        console.log('   Cache stats:', {
            fileCount: stats.fileCount,
            totalImages: stats.totalImages,
            totalSizeMB: stats.totalSizeMB.toFixed(2)
        });
        
        // Test 3: Random Image Selection
        console.log('\n3. Testing Random Image Selection...');
        const randomImage = await imageCache.getRandomImage('Amr Diab');
        if (randomImage) {
            console.log('   Random image selected:', {
                source: randomImage.source,
                title: randomImage.title
            });
        } else {
            console.log('   No random image available');
        }
        
        console.log('\n✅ All tests completed successfully!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        logger.error(`Test error: ${error.message}`);
    }
}

async function testSpecificSource(sourceName, celebrityName = 'Amr Diab') {
    console.log(`🧪 Testing ${sourceName} source for "${celebrityName}"...\n`);
    
    try {
        const multiSource = new MultiSourceImageService();
        
        // Disable all sources except the one we're testing
        multiSource.sources.forEach(source => {
            if (source.name !== sourceName) {
                source.enabled = false;
            }
        });
        
        const images = await multiSource.getCelebrityImages(celebrityName, 5);
        console.log(`Found ${images.length} images from ${sourceName}`);
        
        if (images.length > 0) {
            images.forEach((img, index) => {
                console.log(`  ${index + 1}. ${img.title} (${img.source})`);
            });
        } else {
            console.log(`No images found from ${sourceName}`);
        }
        
    } catch (error) {
        console.error(`❌ ${sourceName} test failed:`, error.message);
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length > 0) {
        // Test specific source
        const source = args[0];
        const celebrity = args[1] || 'Amr Diab';
        testSpecificSource(source, celebrity);
    } else {
        // Run all tests
        testMultiSourceSystem();
    }
}

module.exports = {
    testMultiSourceSystem,
    testSpecificSource
}; 