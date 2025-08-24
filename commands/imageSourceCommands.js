/**
 * Image source management commands
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const logger = require('../utils/logger');

module.exports = [
    {
        data: new SlashCommandBuilder()
            .setName('imagesources')
            .setDescription('عرض حالة مصادر الصور المتاحة')
            .addSubcommand(subcommand =>
                subcommand
                    .setName('status')
                    .setDescription('عرض حالة جميع مصادر الصور'))
            .addSubcommand(subcommand =>
                subcommand
                    .setName('enable')
                    .setDescription('تفعيل مصدر صور معين')
                    .addStringOption(option =>
                        option.setName('source')
                            .setDescription('مصدر الصور')
                            .setRequired(true)
                            .addChoices(
                                { name: 'Wikipedia', value: 'wikipedia' },
                                { name: 'Google', value: 'google' },
                                { name: 'Instagram', value: 'instagram' },
                                { name: 'Twitter', value: 'twitter' },
                                { name: 'Facebook', value: 'facebook' }
                            )))
            .addSubcommand(subcommand =>
                subcommand
                    .setName('disable')
                    .setDescription('إيقاف مصدر صور معين')
                    .addStringOption(option =>
                        option.setName('source')
                            .setDescription('مصدر الصور')
                            .setRequired(true)
                            .addChoices(
                                { name: 'Wikipedia', value: 'wikipedia' },
                                { name: 'Google', value: 'google' },
                                { name: 'Instagram', value: 'instagram' },
                                { name: 'Twitter', value: 'twitter' },
                                { name: 'Facebook', value: 'facebook' }
                            ))),

        async execute(interaction) {
            try {
                const subcommand = interaction.options.getSubcommand();
                const quizGame = interaction.client.quizGame;

                if (!quizGame || !quizGame.imageCache) {
                    await interaction.reply('❌ خدمة الصور غير متاحة حالياً');
                    return;
                }

                switch (subcommand) {
                    case 'status':
                        await this.showSourceStatus(interaction, quizGame);
                        break;
                    case 'enable':
                        await this.enableSource(interaction, quizGame);
                        break;
                    case 'disable':
                        await this.disableSource(interaction, quizGame);
                        break;
                }
            } catch (error) {
                logger.error(`Error in imagesources command: ${error.message}`);
                await interaction.reply('❌ حدث خطأ أثناء تنفيذ الأمر');
            }
        }
    },

    {
        data: new SlashCommandBuilder()
            .setName('imagecache')
            .setDescription('إدارة ذاكرة التخزين المؤقت للصور')
            .addSubcommand(subcommand =>
                subcommand
                    .setName('stats')
                    .setDescription('عرض إحصائيات ذاكرة التخزين المؤقت'))
            .addSubcommand(subcommand =>
                subcommand
                    .setName('clear')
                    .setDescription('مسح ذاكرة التخزين المؤقت للصور'))
            .addSubcommand(subcommand =>
                subcommand
                    .setName('refresh')
                    .setDescription('تحديث صور مشهور معين')
                    .addStringOption(option =>
                        option.setName('celebrity')
                            .setDescription('اسم المشهور')
                            .setRequired(true))),

        async execute(interaction) {
            try {
                const subcommand = interaction.options.getSubcommand();
                const quizGame = interaction.client.quizGame;

                if (!quizGame || !quizGame.imageCache) {
                    await interaction.reply('❌ خدمة الصور غير متاحة حالياً');
                    return;
                }

                switch (subcommand) {
                    case 'stats':
                        await this.showCacheStats(interaction, quizGame);
                        break;
                    case 'clear':
                        await this.clearCache(interaction, quizGame);
                        break;
                    case 'refresh':
                        await this.refreshCelebrityImages(interaction, quizGame);
                        break;
                }
            } catch (error) {
                logger.error(`Error in imagecache command: ${error.message}`);
                await interaction.reply('❌ حدث خطأ أثناء تنفيذ الأمر');
            }
        }
    }
];

// Helper functions
async function showSourceStatus(interaction, quizGame) {
    const sourceStatus = quizGame.imageCache.getSourceStatus();
    
    const embed = new EmbedBuilder()
        .setTitle('📸 حالة مصادر الصور')
        .setDescription('مصادر الصور المتاحة ووضعها الحالي')
        .setColor('#4CAF50')
        .setTimestamp();

    for (const source of sourceStatus) {
        const status = source.enabled ? '✅ مفعل' : '❌ معطل';
        const priority = source.priority;
        
        embed.addFields({
            name: `${source.name.toUpperCase()} (الأولوية: ${priority})`,
            value: status,
            inline: true
        });
    }

    await interaction.reply({ embeds: [embed] });
}

async function enableSource(interaction, quizGame) {
    const source = interaction.options.getString('source');
    
    quizGame.imageCache.enableSource(source);
    
    const embed = new EmbedBuilder()
        .setTitle('✅ تم التفعيل')
        .setDescription(`تم تفعيل مصدر الصور: **${source}**`)
        .setColor('#4CAF50')
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

async function disableSource(interaction, quizGame) {
    const source = interaction.options.getString('source');
    
    quizGame.imageCache.disableSource(source);
    
    const embed = new EmbedBuilder()
        .setTitle('❌ تم الإيقاف')
        .setDescription(`تم إيقاف مصدر الصور: **${source}**`)
        .setColor('#FF6B6B')
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

async function showCacheStats(interaction, quizGame) {
    const stats = await quizGame.imageCache.getCacheStats();
    
    if (!stats) {
        await interaction.reply('❌ لا يمكن الحصول على إحصائيات ذاكرة التخزين المؤقت');
        return;
    }

    const embed = new EmbedBuilder()
        .setTitle('📊 إحصائيات ذاكرة التخزين المؤقت')
        .setColor('#2196F3')
        .addFields(
            { name: 'عدد الملفات', value: stats.fileCount.toString(), inline: true },
            { name: 'إجمالي الصور', value: stats.totalImages.toString(), inline: true },
            { name: 'الحجم الإجمالي', value: `${stats.totalSizeMB.toFixed(2)} MB`, inline: true },
            { name: 'الحد الأقصى', value: `${stats.maxSizeMB} MB`, inline: true },
            { name: 'ذاكرة التخزين المؤقت', value: stats.memoryCacheSize.toString(), inline: true }
        )
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

async function clearCache(interaction, quizGame) {
    await interaction.deferReply();
    
    await quizGame.imageCache.clearCache();
    
    const embed = new EmbedBuilder()
        .setTitle('🗑️ تم المسح')
        .setDescription('تم مسح ذاكرة التخزين المؤقت للصور بنجاح')
        .setColor('#FF9800')
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}

async function refreshCelebrityImages(interaction, quizGame) {
    const celebrityName = interaction.options.getString('celebrity');
    
    await interaction.deferReply();
    
    try {
        // Remove from cache to force refresh
        await quizGame.imageCache.removeFromCache(celebrityName);
        
        // Fetch new images
        const images = await quizGame.imageCache.getCelebrityImages(celebrityName, 5);
        
        const embed = new EmbedBuilder()
            .setTitle('🔄 تم التحديث')
            .setDescription(`تم تحديث صور المشهور: **${celebrityName}**`)
            .addFields(
                { name: 'عدد الصور الجديدة', value: images.length.toString(), inline: true }
            )
            .setColor('#4CAF50')
            .setTimestamp();

        if (images.length > 0) {
            const sources = [...new Set(images.map(img => img.source))];
            embed.addFields({ name: 'مصادر الصور', value: sources.join(', '), inline: true });
        }

        await interaction.editReply({ embeds: [embed] });
        
    } catch (error) {
        logger.error(`Error refreshing images for ${celebrityName}: ${error.message}`);
        await interaction.editReply('❌ حدث خطأ أثناء تحديث الصور');
    }
} 