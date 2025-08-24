#!/usr/bin/env node

/**
 * Startup script for the Arab Celebrity Quiz Bot
 */

const logger = require('./utils/logger');
const QuizBot = require('./index');

async function startBot() {
    console.log('🎭 بدء بوت اختبار المشاهير العرب...');
    console.log('=====================================');
    
    try {
        // Check if .env file exists
        const fs = require('fs-extra');
        if (!await fs.pathExists('.env')) {
                    console.error('❌ ملف .env غير موجود!');
        console.log('📝 يرجى نسخ env.example إلى .env وإضافة رمز Discord الخاص بك.');
            process.exit(1);
        }
        
        // Load environment variables
        require('dotenv').config();
        
        // Validate required environment variables
        if (!process.env.DISCORD_TOKEN) {
                    console.error('❌ DISCORD_TOKEN غير موجود في متغيرات البيئة!');
        console.log('📝 يرجى إضافة رمز بوت Discord إلى ملف .env.');
            process.exit(1);
        }
        
        // Check if data directory exists
        if (!await fs.pathExists('data')) {
            console.log('📁 إنشاء مجلد البيانات...');
            await fs.ensureDir('data');
        }
        
        // Check if celebrities.json exists
        if (!await fs.pathExists('data/celebrities.json')) {
            console.log('📋 إنشاء قاعدة بيانات مشاهير فارغة...');
            await fs.writeJson('data/celebrities.json', { celebrities: [] }, { spaces: 2 });
        }
        
        // Check if cache directory exists
        if (!await fs.pathExists('cache')) {
            console.log('📁 إنشاء مجلد التخزين المؤقت...');
            await fs.ensureDir('cache');
        }
        
        console.log('✅ البيئة والمجلدات جاهزة');
        console.log('🤖 تهيئة البوت...');
        
        // Create and start the bot
        const bot = new QuizBot();
        
        // Handle graceful shutdown
        process.on('SIGINT', async () => {
            console.log('\n🛑 إيقاف البوت...');
            await bot.destroy();
            console.log('✅ اكتمل إيقاف البوت');
            process.exit(0);
        });
        
        process.on('SIGTERM', async () => {
            console.log('\n🛑 إيقاف البوت...');
            await bot.destroy();
            console.log('✅ اكتمل إيقاف البوت');
            process.exit(0);
        });
        
        // Start the bot
        await bot.login(process.env.DISCORD_TOKEN);
        
        console.log('🎉 البوت متصل الآن!');
        console.log('📖 استخدم +help لرؤية الأوامر المتاحة');
        console.log('🎯 استخدم +مشاهير لبدء الاختبار');
        
    } catch (error) {
        console.error('❌ فشل في بدء البوت:', error.message);
        logger.error('خطأ في بدء التشغيل:', error);
        process.exit(1);
    }
}

// Run the startup function
startBot().catch(error => {
    console.error('❌ خطأ قاتل أثناء بدء التشغيل:', error.message);
    process.exit(1);
}); 