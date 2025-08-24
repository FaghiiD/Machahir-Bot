/**
 * Quiz game service for managing quiz sessions and game logic
 */

const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const logger = require('../utils/logger');
const config = require('../config');
const WikipediaService = require('./wikipediaService');
const EnhancedFuzzyMatcher = require('./enhancedFuzzyMatcher');
const ImageCache = require('./imageCache');

class QuizGame {
    constructor(bot) {
        this.bot = bot;
        this.wikipediaService = new WikipediaService();
        this.fuzzyMatcher = new EnhancedFuzzyMatcher();
        this.imageCache = new ImageCache();
        
        // Active quizzes per channel
        this.activeQuizzes = new Map();
        
        // Quiz statistics
        this.stats = {
            quizzesPlayed: 0,
            questionsAnswered: 0,
            imagesFetched: 0,
            startTime: new Date()
        };
    }

    async startQuiz(channel) {
        const channelId = channel.id;
        
        // Check if there's already an active quiz in this channel
        if (this.activeQuizzes.has(channelId)) {
            const existingQuiz = this.activeQuizzes.get(channelId);
            logger.warn(`محاولة بدء اختبار جديد في قناة ${channel.name} بينما هناك اختبار نشط بالفعل`);
            throw new Error('هناك اختبار نشط بالفعل في هذه القناة');
        }
        
        // Double-check to prevent race conditions
        if (this.activeQuizzes.has(channelId)) {
            logger.warn(`تم اكتشاف اختبار نشط في القناة ${channel.name} بعد التحقق الأول`);
            throw new Error('هناك اختبار نشط بالفعل في هذه القناة');
        }
        
        // Send initial message
        const startMessage = await channel.send('🎯 **بدء اختبار المشاهير العرب!**\nجاري جلب صورة المشهور...');
        
        try {
            // Get random celebrity
            const celebrity = await this.getRandomCelebrity();
            if (!celebrity) {
                throw new Error('لا توجد مشاهير متاحة في قاعدة البيانات');
            }
            
            // Get celebrity image from multiple sources
            let celebrityImage = null;
            try {
                celebrityImage = await this.imageCache.getRandomImage(celebrity.name);
                if (celebrityImage) {
                    logger.info(`Found image for ${celebrity.name} from ${celebrityImage.source}`);
                }
            } catch (error) {
                logger.warn(`Failed to get image for ${celebrity.name}: ${error.message}`);
            }
            
            // Create quiz session
            const quizSession = {
                channel: channel,
                celebrity: celebrity,
                startTime: new Date(),
                timeout: null,
                messageCollector: null,
                participants: new Map(),
                hints: [],
                currentHint: 0,
                endedByCorrectAnswer: false // Flag to track if quiz ended by correct answer
            };
            
            this.activeQuizzes.set(channelId, quizSession);
            
            // Send quiz image
            await this.sendQuizImage(channel, celebrity, celebrityImage);
            
            // Set up message collector
            this.setupMessageCollector(quizSession);
            
            // Set timeout
            this.setQuizTimeout(quizSession);
            
            this.stats.quizzesPlayed++;
            this.stats.imagesFetched++;
            
            logger.info(`تم بدء الاختبار في القناة ${channel.name} للمشهور: ${celebrity.name}`);
            
        } catch (error) {
            logger.error(`خطأ في بدء الاختبار: ${error.message}`);
            await channel.send('❌ عذراً، حدث خطأ في بدء الاختبار. يرجى المحاولة مرة أخرى لاحقاً.');
            this.activeQuizzes.delete(channelId);
        }
    }

    async getRandomCelebrity() {
        try {
            const celebrities = await this.loadCelebrities();
            if (!celebrities.celebrities || celebrities.celebrities.length === 0) {
                return null;
            }
            
            const randomIndex = Math.floor(Math.random() * celebrities.celebrities.length);
            return celebrities.celebrities[randomIndex];
        } catch (error) {
            logger.error(`خطأ في الحصول على مشهور عشوائي: ${error.message}`);
            return null;
        }
    }

    async sendQuizImage(channel, celebrity, celebrityImage) {
        try {
            let imageBuffer = null;
            
            if (celebrityImage && celebrityImage.data) {
                try {
                    // Get image buffer from base64 data
                    imageBuffer = await this.imageCache.getImageBuffer(celebrityImage.data);
                    logger.info(`تم تحميل صورة بنجاح للمشهور: ${celebrity.name} من ${celebrityImage.source}`);
                } catch (imageError) {
                    logger.warn(`فشل في تحميل صورة للمشهور ${celebrity.name}: ${imageError.message}`);
                    // Continue without image
                }
            }
            
            const embed = new EmbedBuilder()
                .setTitle('🎭 من هو هذا المشهور العربي؟')
                .setDescription('اكتب إجابتك أدناه!\n\n*استمر في التخمين حتى يجيب أحد إجابة صحيحة!*')
                .setColor('#FF6B6B')
                .setFooter({ text: `⏰ الوقت المتبقي: ${config.QUIZ_TIMEOUT} ثانية` })
                .setTimestamp();
            
            if (imageBuffer) {
                const attachment = new AttachmentBuilder(imageBuffer, { name: 'celebrity.jpg' });
                embed.setImage('attachment://celebrity.jpg');
                const message = await channel.send({ embeds: [embed], files: [attachment] });
                
                // Start countdown timer
                this.startCountdownTimer(message, config.QUIZ_TIMEOUT);
                logger.info(`تم إرسال صورة الاختبار مع العداد التنازلي للمشهور: ${celebrity.name}`);
            } else {
                embed.setDescription('🎭 من هو هذا المشهور العربي؟\n\n*لا توجد صورة متاحة*\n\nاكتب إجابتك أدناه!\n\n*استمر في التخمين حتى يجيب أحد إجابة صحيحة!*');
                const message = await channel.send({ embeds: [embed] });
                
                // Start countdown timer
                this.startCountdownTimer(message, config.QUIZ_TIMEOUT);
                logger.info(`تم إرسال اختبار بدون صورة مع العداد التنازلي للمشهور: ${celebrity.name}`);
            }
            
        } catch (error) {
            logger.error(`خطأ في إرسال صورة الاختبار: ${error.message}`);
            await channel.send('❌ خطأ في تحميل صورة المشهور. يرجى المحاولة مرة أخرى.');
        }
    }

    startCountdownTimer(message, totalSeconds) {
        let remainingSeconds = totalSeconds;
        
        const updateTimer = async () => {
            if (remainingSeconds <= 0) {
                return; // Timer finished
            }
            
            try {
                const embed = message.embeds[0];
                if (embed) {
                    embed.setFooter({ text: `⏰ الوقت المتبقي: ${remainingSeconds} ثانية` });
                    await message.edit({ embeds: [embed] });
                }
                
                remainingSeconds--;
                
                if (remainingSeconds > 0) {
                    setTimeout(updateTimer, 1000);
                }
            } catch (error) {
                // Message might have been deleted or bot lost permissions
                logger.debug(`Could not update countdown timer: ${error.message}`);
            }
        };
        
        // Start the countdown
        setTimeout(updateTimer, 1000);
    }

    setupMessageCollector(quizSession) {
        const filter = message => 
            !message.author.bot && 
            message.channel.id === quizSession.channel.id;
        
        quizSession.messageCollector = quizSession.channel.createMessageCollector({
            filter: filter,
            time: config.QUIZ_TIMEOUT * 1000
        });
        
        quizSession.messageCollector.on('collect', async (message) => {
            await this.handleAnswer(message, quizSession);
        });
        
        quizSession.messageCollector.on('end', () => {
            // Only end quiz with embed if it wasn't ended by a correct answer
            if (!quizSession.endedByCorrectAnswer) {
                this.endQuiz(quizSession);
            }
        });
    }

    async handleAnswer(message, quizSession) {
        const userInput = message.content.trim();
        const userId = message.author.id;
        
        // Check answer - ALWAYS check every message, don't block users after failed attempts
        const matchResult = this.fuzzyMatcher.matchWithSuggestions(
            userInput, 
            quizSession.celebrity,
            config.FUZZY_SUGGESTION_THRESHOLD
        );
        
        if (matchResult.isCorrect) {
            // Correct answer - end the quiz
            await this.handleCorrectAnswer(message, quizSession, matchResult);
        } else {
            // Wrong answer - track participation but allow them to keep trying
            // Only add to participants if not already there (for statistics)
            if (!quizSession.participants.has(userId)) {
                quizSession.participants.set(userId, {
                    user: message.author,
                    answer: userInput,
                    score: matchResult.score,
                    timestamp: new Date(),
                    attempts: 1
                });
            } else {
                // Update existing participant with new attempt
                const participant = quizSession.participants.get(userId);
                participant.attempts = (participant.attempts || 0) + 1;
                participant.lastAnswer = userInput;
                participant.lastScore = matchResult.score;
                participant.lastTimestamp = new Date();
            }
            
            this.stats.questionsAnswered++;
        }
    }

    async handleCorrectAnswer(message, quizSession, matchResult) {
        const timeTaken = (new Date() - quizSession.startTime) / 1000;
        const points = this.calculatePoints(timeTaken);
        
        const embed = new EmbedBuilder()
            .setTitle('🎉 صحيح!')
            .setDescription(`**${message.author.username}** أجاب إجابة صحيحة!\n\n**الإجابة:** ${quizSession.celebrity.name} (${quizSession.celebrity.arabic_name})`)
            .addFields(
                { name: 'النقاط', value: `${points}`, inline: true },
                { name: 'الوقت', value: `${timeTaken.toFixed(1)}ثانية`, inline: true }
            )
            .setColor('#4CAF50')
            .setTimestamp();
        
        if (quizSession.celebrity.description) {
            embed.addFields({ name: 'حول', value: quizSession.celebrity.description });
        }
        
        await message.reply({ embeds: [embed] });
        
        // Mark that quiz ended by correct answer
        quizSession.endedByCorrectAnswer = true;
        
        // End quiz immediately without sending another embed
        this.endQuizSilently(quizSession);
    }



    calculatePoints(timeTaken) {
        let points = config.POINTS_CORRECT;
        
        // Quick bonus for fast answers
        if (timeTaken <= 10) {
            points += config.POINTS_QUICK_BONUS;
        }
        
        return points;
    }

    setQuizTimeout(quizSession) {
        quizSession.timeout = setTimeout(() => {
            this.endQuiz(quizSession);
        }, config.QUIZ_TIMEOUT * 1000);
    }

    endQuizSilently(quizSession) {
        const channelId = quizSession.channel.id;
        
        // Clear timeout and collector
        if (quizSession.timeout) {
            clearTimeout(quizSession.timeout);
        }
        if (quizSession.messageCollector) {
            quizSession.messageCollector.stop();
        }
        
        // Remove from active quizzes
        this.activeQuizzes.delete(channelId);
        
        logger.info(`انتهى الاختبار بصمت في القناة ${quizSession.channel.name}`);
    }

    async endQuiz(quizSession) {
        const channelId = quizSession.channel.id;
        
        // Clear timeout and collector
        if (quizSession.timeout) {
            clearTimeout(quizSession.timeout);
        }
        if (quizSession.messageCollector) {
            quizSession.messageCollector.stop();
        }
        
        // Remove from active quizzes
        this.activeQuizzes.delete(channelId);
        
        // Send "nobody answered" message when quiz times out
        const embed = new EmbedBuilder()
            .setTitle('⏰ انتهى الوقت!')
            .setDescription(`لم يجب أحد الإجابة الصحيحة!\n\n**الإجابة الصحيحة:** ${quizSession.celebrity.name} (${quizSession.celebrity.arabic_name})`)
            .setColor('#FF6B6B')
            .setTimestamp();
        
        if (quizSession.celebrity.description) {
            embed.addFields({ name: 'حول', value: quizSession.celebrity.description });
        }
        
        if (quizSession.celebrity.wikipedia_url) {
            embed.addFields({ name: 'اعرف المزيد', value: quizSession.celebrity.wikipedia_url });
        }
        
        await quizSession.channel.send({ embeds: [embed] });
        
        logger.info(`انتهى الاختبار في القناة ${quizSession.channel.name} - لم يجب أحد`);
    }

    

    async loadCelebrities() {
        try {
            const fs = require('fs-extra');
            const data = await fs.readJson(config.CELEBRITIES_FILE);
            return data;
        } catch (error) {
            logger.error(`خطأ في تحميل المشاهير: ${error.message}`);
            return { celebrities: [] };
        }
    }

    async updateCelebrity(celebrity) {
        try {
            const fs = require('fs-extra');
            const data = await this.loadCelebrities();
            
            const index = data.celebrities.findIndex(c => c.name === celebrity.name);
            if (index !== -1) {
                data.celebrities[index] = celebrity;
                await fs.writeJson(config.CELEBRITIES_FILE, data, { spaces: 2 });
            }
        } catch (error) {
            logger.error(`خطأ في تحديث المشهور: ${error.message}`);
        }
    }

    getStats() {
        const uptime = new Date() - this.stats.startTime;
        return {
            ...this.stats,
            uptime: Math.floor(uptime / 1000),
            activeQuizzes: this.activeQuizzes.size
        };
    }

    isQuizActive(channelId) {
        return this.activeQuizzes.has(channelId);
    }

    // Clean up any stale quiz sessions
    cleanupStaleSessions() {
        const now = new Date();
        let cleanedCount = 0;
        
        for (const [channelId, session] of this.activeQuizzes.entries()) {
            const sessionAge = now - session.startTime;
            const maxAge = (config.QUIZ_TIMEOUT + 60) * 1000; // Quiz timeout + 1 minute buffer
            
            if (sessionAge > maxAge) {
                logger.warn(`تنظيف جلسة اختبار قديمة في القناة ${session.channel?.name || channelId}`);
                this.activeQuizzes.delete(channelId);
                cleanedCount++;
            }
        }
        
        if (cleanedCount > 0) {
            logger.info(`تم تنظيف ${cleanedCount} جلسة اختبار قديمة`);
        }
        
        return cleanedCount;
    }

    // Get active quiz count for debugging
    getActiveQuizCount() {
        return this.activeQuizzes.size;
    }
}

module.exports = QuizGame; 