const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { managePresence, activePresenceChats, getSenderNumber } = require('../presenceSystem.js'); 
const { WA_DEFAULT_EPHEMERAL } = require('@whiskeysockets/baileys');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { promisify } = require('util');
const { Octokit } = require('@octokit/rest');
const { GeminiMessage, GeminiImage, GeminiRoastingMessage, GeminiImageRoasting } = require('./Gemini');
const { WikipediaSearch, WikipediaAI, WikipediaImage } = require('./Wikipedia');
const { Weather } = require('./Weather');
const { Translate } = require('./Translates');
const { Surah, SurahDetails } = require('./Quran');
const { Country } = require('./Country');
const { CheckSEO } = require('./SEO');
const { FileSearch } = require('./FileSearch');
const { AesEncryption, AesDecryption, CamelliaEncryption, CamelliaDecryption, ShaEncryption, Md5Encryption, RipemdEncryption, BcryptEncryption } = require('./Tools.js');
const { YoutubeVideo, YoutubeAudio, FacebookVideo, FacebookAudio, TwitterVideo, TwitterAudio, InstagramVideo, InstagramAudio, TikTokVideo, TikTokAudio, VimeoVideo, VimeoAudio  } = require('./Downloader');
const { DetikNews, DetikViral, DetikLatest } = require('./Detik');
const { AnimeVideo, downloadImage } = require('./Anime');
const { exec } = require('child_process');
const { exec: ytExec } = require('yt-dlp-exec');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const QRCode = require('qrcode');
const delay = ms => new Promise(res => setTimeout(res, ms));
const fs = require('fs');
const path = require('path');
const gTTS = require('gtts');
const P = require('pino');
const Tesseract = require('tesseract.js');
const ownerNumber = '2347017747337'; // Your Number
const os = require('os');
const process = require('process');
const dns = require('dns');
const chatSessions = require('./chatSessions'); 
const getAIResponse = require('./getAIResponse');
const playdl = require('play-dl');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const sharp = require('sharp');
const util = require('util');
const child_process = require('child_process');
const validFileTypes = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt'];

// ✅ Load config ONCE at the top
const configPath = path.join(__dirname, '../config.json');
const warningFile = './warnings.json';
let config = {};

try {
    if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    } else {
        console.error('❌ config.json not found');
        config = {
            ANTI_BADWORDS: false,
            SELF_BOT_MESSAGE: false,
            BAD_WORDS: [],
            prefix: '.'
        };
    }
} catch (error) {
    console.error('❌ Error loading config:', error);
    config = {
        ANTI_BADWORDS: false,
        SELF_BOT_MESSAGE: false,
        BAD_WORDS: [],
        prefix: '.'
    };
}

global.prefix = config.prefix || ".";


// ✅ Extract message text safely
function extractTextFromMessage(msg) {
    const message = msg.message;
    if (!message) return "";
    if (message.conversation) return message.conversation;
    if (message.extendedTextMessage?.text) return message.extendedTextMessage.text;
    if (message.imageMessage?.caption) return message.imageMessage.caption;
    if (message.videoMessage?.caption) return message.videoMessage.caption;
    if (message.documentMessage?.caption) return message.documentMessage.caption;
    return "";
}
function formatTime(seconds) {
    if (!seconds) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

// ✅ Badwords checker
function containsBadWords(message) {
    const regex = new RegExp(`\\b(${config.BAD_WORDS.join("|")})\\b`, "i");
    return regex.test(message);
}
// ✅ URL detector
const urlRegex =
    /(https?:\/\/[^\s]+|www\.[^\s]+|\b[a-zA-Z0-9-]+\.(com|net|org|io|gov|edu|ng|uk)\b)/i;

// ✅ Main Message Handler
async function Message(sock, messages) {
    if (!messages || !messages[0]) return;
    const msg = messages[0];
    const chatId = msg.key.remoteJid;

    // 🚫 Ignore system messages
    if (!msg.message) return;
    if (msg.message?.protocolMessage) return;
    if (msg.message?.senderKeyDistributionMessage) return;

    const messageBody = extractTextFromMessage(msg);
    if (!messageBody || typeof messageBody !== "string") return;

    console.log("📩 Message from", chatId, ":", messageBody);

    // 🚫 Anti-badwords
    if (config.ANTI_BADWORDS && containsBadWords(messageBody)) {
        try {
            await sock.sendMessage(chatId, { delete: msg.key });
            console.log(`🚫 Deleted badword message: ${msg.key.id}`);
            return;
        } catch (error) {
            console.error("❌ Error deleting badword message:", error);
        }
    }

    // 🚫 Anti-link (Group Specific)
    // Check if anti-link is enabled for this group
    const antilinkFile = './src/antilink.json';
    if (fs.existsSync(antilinkFile)) {
        try {
            const antilinkData = JSON.parse(fs.readFileSync(antilinkFile));
            
            // Check if anti-link is enabled for this specific group
            const isAntiLinkEnabled = antilinkData[chatId] && antilinkData[chatId].enabled;
            
            if (isAntiLinkEnabled && messageBody && msg.key.remoteJid.endsWith('@g.us')) {
                // Improved URL regex - more comprehensive
                const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([^\s]+\.[a-zA-Z]{2,}[^\s]*)|(bit\.ly\/[^\s]+)|(t\.co\/[^\s]+)|(goo\.gl\/[^\s]+)|(tinyurl\.com\/[^\s]+)|(t\.me\/[^\s]+)|(wa\.me\/[^\s]+)/gi;
                
                // Check if message contains links AND is not from the bot itself
                const containsLink = urlRegex.test(messageBody);
                
                if (containsLink && !msg.key.fromMe) {
                    console.log(`🔗 Anti-URL: Detected link in message from ${msg.key.participant}`);
                    
                    try {
                        // Add reaction first to show action
                        await sock.sendMessage(chatId, { react: { text: "🚫", key: msg.key } });
                        
                        // Try to delete the message - SIMPLIFIED approach
                        await sock.sendMessage(chatId, { 
                            delete: {
                                id: msg.key.id,
                                remoteJid: chatId,
                                fromMe: false,
                                participant: msg.key.participant
                            }
                        });
                        
                        console.log(`✅ Anti-URL: Successfully deleted message with ID: ${msg.key.id}`);
                        
                        // Warn user with better formatting
                        const warningMessage = msg.key.participant 
                            ? `⚠️ *Link Detected!*\n\n@${msg.key.participant.split('@')[0]} *Links are not allowed in this group!*\n\n🚫 Your message has been deleted.`
                            : `⚠️ *Link Detected!*\n\n🚫 Links are not allowed in this group!\n\nThe message has been deleted.`;
                        
                        const messageOptions = {
                            text: warningMessage
                        };
                        
                        if (msg.key.participant) {
                            messageOptions.mentions = [msg.key.participant];
                        }
                        
                        await sock.sendMessage(chatId, messageOptions);
                        return; // Stop further processing
                        
                    } catch (deleteError) {
                        console.error('❌ Anti-URL Deletion Error:', deleteError);
                        
                        // Enhanced error handling
                        let errorMessage = "⚠️ *System Error*\n\nFailed to process link detection.";
                        
                        if (deleteError.message?.includes("405") || deleteError.message?.includes("not authorized")) {
                            errorMessage = "⚠️ *Admin Rights Required!*\n\nI need admin permissions to delete messages in this group.";
                        } else if (deleteError.message?.includes("Message not found")) {
                            errorMessage = "⚠️ *Link Warning!*\n\nLinks are not allowed here. The message was already deleted.";
                        } else if (deleteError.message?.includes("Forbidden")) {
                            errorMessage = "⚠️ *Permission Denied!*\n\nI don't have permission to delete messages. Please make me admin.";
                        }
                        
                        await sock.sendMessage(chatId, { text: errorMessage });
                        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
                    }
                }
            }
        } catch (error) {
            console.error('❌ Error reading antilink.json:', error);
        }
    }

// ✅ Command Detection with Owner Priority
const currentPrefix = global.prefix;
let command = null;
let args = [];

// Check if message starts with prefix
if (messageBody.startsWith(currentPrefix)) {
    const parts = messageBody.slice(currentPrefix.length).trim().split(' ');
    command = parts[0];
    args = parts.slice(1);
    
    console.log('📥 Detected command:', command, 'from sender:', getSenderJid(msg));
    
    // 🎯 SPECIAL RULE: In chat mode, only owner commands work
    if (chatSessions.isChatEnabled(chatId)) {
        const senderJid = getSenderJid(msg); 
        const ownerJid = '234**********@s.whatsapp.net'; // YOUR_WHATSAPP_NUMBER@s.whatsapp.net(In This Format "234*********" without the "+").
        const isOwner = senderJid === ownerJid || msg.key.fromMe;
        
        if (!isOwner) {
            console.log('🔒 Non-owner command in chat mode - ignoring command');
            command = null; // Let AI handle this message
            args = [];
        } else {
            console.log('👑 Owner command in chat mode - processing command');
        }
    }
}

console.log('📥 Final command:', command);
console.log('📥 Args:', args);
console.log('📥 Prefix:', currentPrefix);

// ==============================================
// 🔹 AUTHORIZATION CHECK (ONLY FOR COMMANDS)
// ==============================================
function getSenderJid(msg) {
    // If you sent the message
    if (msg.key.fromMe) {
        return '234**********@s.whatsapp.net'; // YOUR_WHATSAPP_NUMBER@s.whatsapp.net(In This Format "234*********" without the "+").
    }
    
    const isGroup = msg.key.remoteJid.endsWith('@g.us');
    
    if (isGroup) {
        // Extract from participant field
        const participant = msg.key.participant;
        
        if (typeof participant === 'string') {
            return participant;
        } else if (participant?.id) {
            return participant.id;
        } else if (participant?.jid) {
            return participant.jid;
        } else {
            // Last resort - try to parse from message structure
            console.log('Participant structure:', participant);
            return null;
        }
    } else {
        // Private chat
        return msg.key.remoteJid;
    }
}

// 🤖 AI Response Logic (updated)
if (chatSessions.isChatEnabled(chatId) && !command) {
    // Prevent replying to itself
    if (msg.key.fromMe) return;

    await sock.sendMessage(chatId, { react: { text: "🤖", key: msg.key } });

    chatSessions.addMessage(chatId, "user", messageBody);
    const history = chatSessions.getMessages(chatId);
    const aiReply = await getAIResponse(history);
    
    chatSessions.addMessage(chatId, "assistant", aiReply);
    await sock.sendMessage(chatId, { text: aiReply }, { quoted: msg });
    return;
}

// ==============================================
// 🔹 COMMAND PROCESSING (Owner commands work in both modes)
// ==============================================
if (command) {
    const senderJid = getSenderJid(msg);
    const ownerJid = '234**********@s.whatsapp.net'; // YOUR_WHATSAPP_NUMBER@s.whatsapp.net(In This Format "234*********" without the "+").
    const isOwner = senderJid === ownerJid || msg.key.fromMe;

    // Check if command should be allowed based on public/private mode
    if (config.SELF_BOT_MESSAGE && !isOwner) {
        // Private mode + not owner = react with 🚫 and ignore
        await sock.sendMessage(chatId, { react: { text: "🚫", key: msg.key } });
        return;
    }

    // 🔹 setprefix command
    if (command === "setprefix") {
        if (!args[0]) {
            await sock.sendMessage(
                chatId,
                { text: `❌ Usage: ${currentPrefix}setprefix <newPrefix>` },
                { quoted: msg }
            );
            return;
        }

        const newPrefix = args[0].trim();

        // prevent empty or multi-character spaces
        if (newPrefix.length > 3) {
            await sock.sendMessage(
                chatId,
                { text: `❌ Prefix too long! Use 1–3 characters.` },
                { quoted: msg }
            );
            return;
        }

        global.prefix = newPrefix;

        try {
            const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
            config.prefix = newPrefix;
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

            await sock.sendMessage(
                chatId,
                { text: `✅ Prefix updated to: *${newPrefix}*` },
                { quoted: msg }
            );
            console.log(`🔄 Prefix changed to: ${newPrefix}`);
        } catch (err) {
            console.error("⚠️ Failed to update prefix:", err);
            await sock.sendMessage(
                chatId,
                { text: `⚠️ Error: Could not update prefix.` },
                { quoted: msg }
            );
        }
        return;
    }

   // 🔹 Alive Command with Performance Indicators
if (command === "alive") {
    await sock.sendMessage(chatId, { react: { text: "⌛", key: msg.key } });
    try {
        const startTime = Date.now();
        
        // Get metrics
        const uptime = process.uptime();
        const memoryUsage = process.memoryUsage();
        
        // Format uptime
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);
        const uptimeString = `${days}d ${hours}h ${minutes}m ${seconds}s`;
        
        // Memory calculations
        const usedMemory = (memoryUsage.rss / 1024 / 1024).toFixed(2);
        const totalMemory = (memoryUsage.heapTotal / 1024 / 1024).toFixed(2);
        const memoryPercentage = ((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100).toFixed(1);
        
        // Performance indicators
        const ping = Date.now() - startTime;
        let pingEmoji = "🟢";
        if (ping > 1000) pingEmoji = "🔴";
        else if (ping > 500) pingEmoji = "🟡";
        
        let memoryEmoji = "🟢";
        if (memoryPercentage > 80) memoryEmoji = "🔴";
        else if (memoryPercentage > 60) memoryEmoji = "🟡";
        
        const statusMessage = `I'm Alive And Well Nigga

${pingEmoji} STATUS: ONLINE (${uptimeString})  
📶 PING: ${ping}ms | Koyeb Server`;

        await sock.sendMessage(chatId, { text: statusMessage }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
        
    } catch (error) {
        console.error("Error in alive command:", error);
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
    return;
}

    if (command === "smile") {
        try {
            const steps = ["I", "AM", "DESIRE", "EXE!", "OBEY", "OR GET EXECUTED 😄"];
            // Initial message must be plain text (not extendedTextMessage)
            const response = await sock.sendMessage(chatId, {
                text: steps[0]
            });

            for (let i = 1; i < steps.length; i++) {
                await new Promise(resolve => setTimeout(resolve, 600)); // delay between edits
                await sock.sendMessage(chatId, {
                    text: steps[i],
                    edit: response.key
                });
            }

        } catch (error) {
            console.error("Error editing message:", error);
            await sock.sendMessage(chatId, {
                text: "❌ Failed to animate smile.",
            }, { quoted: msg });
        }
    }

    //🔹Send Basic Image
    if (command === "send-img") {
        await sock.sendMessage(chatId, { react: { text: "⌛", key: msg.key } });
        try {
            const url =
                "https://t3.ftcdn.net/jpg/07/66/87/68/360_F_766876856_XDPvm1sg90Ar5Hwf1jRRIHM4FNCXmhKj.jpg";
            const caption = "Hello, I'm sending an image";
            await sock.sendMessage(chatId, { image: { url }, caption }, { quoted: msg });
            await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
        } catch (error) {
            console.error("Error sending image:", error);
            await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
        }
    }

    // ==============================================
    // 🔹PRESENCE COMMANDS
    // ==============================================
    // ------------------ AUTOTYPE ON ------------------
    if (command === 'autotype-on') {
        const senderNumber = getSenderNumber(msg);
        const isOwner = senderNumber === ownerNumber;

        await sock.sendMessage(chatId, { react: { text: "👨‍💻", key: msg.key } });
        try {
            await managePresence(sock, chatId, 'composing', true);
            await sock.sendMessage(chatId, { text: `✍️ Typing indicator ON in this chat (will persist after restart)` }, { quoted: msg });
            await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
        } catch (error) {
            console.error('Error:', error);
            await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
        }
        return;
    }

// ------------------ AUTOTYPE OFF ------------------
if (command === 'autotype-off') {
    const senderNumber = getSenderNumber(msg);
    const isOwner = senderNumber === ownerNumber;

    await sock.sendMessage(chatId, { react: { text: "👨‍💻", key: msg.key } });
    try {
        await managePresence(sock, chatId, 'composing', false);
        await sock.sendMessage(chatId, { text: `✍️ Typing indicator OFF in this chat` }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
    } catch (error) {
        console.error('Error:', error);
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
    return;
}

// ------------------ AUTORECORD ON ------------------
if (command === 'autorecord-on') {
    const senderNumber = getSenderNumber(msg);
    const isOwner = senderNumber === ownerNumber;

    await sock.sendMessage(chatId, { react: { text: "🎙️", key: msg.key } });
    try {
        await managePresence(sock, chatId, 'recording', true);
        await sock.sendMessage(chatId, { text: `🎙️ Recording indicator ON in this chat (will persist after restart)` }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
    } catch (error) {
        console.error('Error:', error);
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
    return;
}

// ------------------ AUTORECORD OFF ------------------
if (command === 'autorecord-off') {
    const senderNumber = getSenderNumber(msg);
    const isOwner = senderNumber === ownerNumber;

    await sock.sendMessage(chatId, { react: { text: "🎙️", key: msg.key } });
    try {
        await managePresence(sock, chatId, 'recording', false);
        await sock.sendMessage(chatId, { text: `🎙️ Recording indicator OFF in this chat` }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
    } catch (error) {
        console.error('Error:', error);
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
    return;
}

// ------------------ PRESENCE STATUS ------------------
if (command === 'presence-status') {
    const senderNumber = getSenderNumber(msg);
    const isOwner = senderNumber === ownerNumber;
    let statusText = '📊 *Active Presence Indicators:*\n\n';
    
    for (const [presenceKey, _] of activePresenceChats) {
        const [chatId, type] = presenceKey.split('_');
        const typeEmoji = type === 'composing' ? '✍️' : '🎙️';
        statusText += `${typeEmoji} ${type} in ${chatId}\n`;
    }
    
    if (activePresenceChats.size === 0) {
        statusText += 'No active presence indicators';
    }
    
    await sock.sendMessage(chatId, { text: statusText }, { quoted: msg });
    return;
}


// ==============================================
// 🔹FUN COMMANDS
// ==============================================

// 👨‍💻 Savage 
if (command === 'savage') {
    const savages = [
        "You're like a software update. Whenever I see you, I think 'Not now.'",
        "If I had a nickel for every time you said something dumb, I’d be richer than Jeff Bezos.",
        "You’re like a cloud. When you go away, everything improves.",
        "You're the reason why the phrase 'don't make me laugh' was invented.",
        "You’re like a broken pencil: pointless."
    ];
    const savage = savages[Math.floor(Math.random() * savages.length)];
    await sock.sendMessage(chatId, { text: savage }, { quoted: msg });
}

// 👨‍💻 Truth or Dare Option
if (command === 't-or-d') {
    await sock.sendMessage(msg.key.remoteJid, {
        text: `Please choose *~truth* or *~dare* to continue.`,
        mentions: [msg.key.participant || msg.key.remoteJid]
    });
}

// 👨‍💻 Truth 
if (command === 'truth') {
    const truths = [
        "What's the most embarrassing thing you've ever done?",
        "Have you ever had a crush on someone in this group?",
        "What's a secret you've never told anyone?",
        "Who's your last Google search?",
        "Have you ever lied to your best friend?",
        "What's something illegal you've done?",
        "Who was your first love?",
        "What turns you on instantly?",
        "Have you ever stalked someone online?",
        "What's the weirdest dream you've ever had?"
    ];

    const randomTruth = truths[Math.floor(Math.random() * truths.length)];

    await sock.sendMessage(msg.key.remoteJid, {
        text: `*Truth:* ${randomTruth}`,
        mentions: [msg.key.participant || msg.key.remoteJid]
    });
}

// 👨‍💻 Dare
if (command === 'dare') {
    const dares = [
        "Send a voice note saying you love someone here.",
        "Say your crush's name backward.",
        "Act like a cat for the next 2 minutes.",
        "Type 'I’m sexy and I know it' and don’t explain.",
        "Change your name to 'I’m a cutie' for 10 minutes.",
        "Send your last pic from your gallery.",
        "DM your crush and send a screenshot.",
        "Call someone in the group and say 'I miss you'.",
        "Write a poem about your toilet.",
        "Tell the group your worst fear."
    ];

    const randomDare = dares[Math.floor(Math.random() * dares.length)];

    await sock.sendMessage(msg.key.remoteJid, {
        text: `*Dare:* ${randomDare}`,
        mentions: [msg.key.participant || msg.key.remoteJid]
    });
}

// 👨‍💻 Pickup
if (command === 'pickup') {
    const pickups = [
        "Are you Wi-Fi? Because I'm feeling a strong connection.",
        "Do you have a map? I just got lost in your eyes.",
        "Are you French? Because Eiffel for you.",
        "If beauty were time, you’d be eternity.",
        "Do you believe in love at first sight—or should I walk by again?",
        "Are you a magician? Because whenever I look at you, everyone else disappears.",
        "Are you made of copper and tellurium? Because you're Cu-Te.",
        "You're like sunshine on a rainy day.",
        "Do you have a Band-Aid? Because I just scraped my knee falling for you.",
        "Are you a parking ticket? Because you've got FINE written all over you."
    ];

    const line = pickups[Math.floor(Math.random() * pickups.length)];

    await sock.sendMessage(msg.key.remoteJid, {
        text: `*Pickup Line:* ${line}`,
        mentions: [msg.key.participant || msg.key.remoteJid]
    });
}

// 👨‍💻 Desire-eXe Information Command 
if (command === 'Des-info') {
    const botInfo = `
┏━━━━━━━【 *Bot Information* 】━━━━━━━┓
┃ *Bot Name*: Desire eXe Bot
┃ *Version*: 3.0.0
┃ *Creator*: Desire eXe
┃ *Description*: A powerful WhatsApp bot with over 100 fun, cool, and interactive commands.

┃ *Features*:
┃ ▶ Jokes, Fun, and Utility Commands
┃ ▶ Games and Challenges
┃ ▶ AI/ Text Generation
┃ ▶ Media Commands (Images, GIFs, Stickers)
┃ ▶ Group Interaction Commands (Polls, Warnings, and more)
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
    `;
    
    await sock.sendMessage(chatId, { text: botInfo });
    console.log('Bot information sent successfully.');
}


// 👨‍💻 Enable disappearing messages with options
if (command === 'dis-on') {
    if (!args[0]) {
        // Show options if no duration specified
        const optionsMessage = `💨 *Disappearing Messages*\n\nPlease choose a duration:\n\n• *24h* - 24 hours\n• *72h* - 72 hours  \n• *7d* - 7 days\n\nUsage: ${currentPrefix}dis-on <option>\nExample: ${currentPrefix}dis-on 24h`;
        await sock.sendMessage(chatId, { text: optionsMessage }, { quoted: msg });
        return;
    }

    const duration = args[0].toLowerCase();
    let seconds = 0;
    let durationText = '';

    switch(duration) {
        case '24h':
            seconds = 86400; // 24 hours
            durationText = '24 hours';
            break;
        case '72h':
            seconds = 259200; // 72 hours
            durationText = '72 hours';
            break;
        case '7d':
            seconds = 604800; // 7 days
            durationText = '7 days';
            break;
        default:
            await sock.sendMessage(chatId, { 
                text: `❌ Invalid option! Please use: *24h*, *72h*, or *7d*\n\nExample: ${currentPrefix}dis-on 24h` 
            }, { quoted: msg });
            return;
    }

    try {
        await sock.sendMessage(chatId, {
            disappearingMessagesInChat: seconds
        });
        await sock.sendMessage(chatId, { 
            text: `💨 Disappearing messages have been *enabled* (${durationText}).` 
        }, { quoted: msg });
    } catch (e) {
        console.error(e);
        await sock.sendMessage(chatId, { 
            text: "❌ Failed to enable disappearing messages." 
        }, { quoted: msg });
    }
}

// 👨‍💻 Disable disappearing messages
if (command === 'dis-off') {
    try {
        await sock.sendMessage(chatId, {
            disappearingMessagesInChat: 0   // 0 = Off
        });
        await sock.sendMessage(chatId, { 
            text: "🚫 Disappearing messages have been *disabled*." 
        }, { quoted: msg });
    } catch (e) {
        console.error(e);
        await sock.sendMessage(chatId, { 
            text: "❌ Failed to disable disappearing messages." 
        }, { quoted: msg });
    }
}



// 👨‍💻 Delete Message 
if (command === 'del' && msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
    try {
        const contextInfo = msg.message.extendedTextMessage.contextInfo;
        const quotedMsgId = contextInfo.stanzaId;
        const senderJid = contextInfo.participant || msg.key.remoteJid; 
        const quotedMessage = contextInfo.quotedMessage;

        await sock.sendMessage(chatId, {
            delete: {
                remoteJid: chatId,
                fromMe: false,
                id: quotedMsgId,
                participant: senderJid
            }
        });

        await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } });

    } catch (error) {
        console.error('❌ Failed to delete message:', error);
        await sock.sendMessage(chatId, {
            text: '❌ Could not delete the quoted message.'
        }, { quoted: msg });

        await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } });
    }
}

// 👨‍💻 Poll Message (Single Answer Only)
if (command === 'poll') {
    try {
        const from = msg.key.remoteJid;

        // Join args back into one string, then split by ','
        const input = args.join(" ").split(",").map(s => s.trim()).filter(s => s.length > 0);

        if (input.length < 2) {
            await sock.sendMessage(from, { text: "❌ Usage: \\poll Question, option1, option2, ..." });
            return;
        }

        const question = input[0]; // first part = poll question
        const options = input.slice(1); // rest = poll options

        await sock.sendMessage(from, {
            poll: {
                name: question,
                values: options,
                selectableCount: 1
            }
        });

    } catch (err) {
        console.error("Poll command error:", err);
        await sock.sendMessage(msg.key.remoteJid, { text: "❌ Failed to create poll." });
    }
}

// 👨‍💻 Poll Message (Multiple Answers)
if (command === 'mpoll') {
    try {
        const from = msg.key.remoteJid;

        // Join args back into one string, then split by ','
        const input = args.join(" ").split(",").map(s => s.trim()).filter(s => s.length > 0);

        if (input.length < 2) {
            await sock.sendMessage(from, { text: "❌ Usage: \\mpoll Question, option1, option2, ..." });
            return;
        }

        const question = input[0]; // first part = poll question
        const options = input.slice(1); // rest = poll options

        await sock.sendMessage(from, {
            poll: {
                name: question,
                values: options,
                selectableCount: options.length // ✅ multi-select allowed
            }
        });

    } catch (err) {
        console.error("Poll command error:", err);
        await sock.sendMessage(msg.key.remoteJid, { text: "❌ Failed to create poll." });
    }
}

// ==============================================
// 🔹OWNER COMMANDS
// ==============================================
// 👨‍💻 Desire-eXe Menu 
const getUptime = () => {
    const seconds = Math.floor(process.uptime());
    const days = Math.floor(seconds / (24 * 60 * 60));
    const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((seconds % (60 * 60)) / 60);
    const secs = seconds % 60;
    return `${days}d ${hours}h ${minutes}m ${secs}s`;
};

const getRAMUsage = () => {
    const used = process.memoryUsage().rss / 1024 / 1024;
    const total = os.totalmem() / 1024 / 1024;
    return `${used.toFixed(2)}MB / ${total.toFixed(2)}MB (${((used/total)*100).toFixed(1)}%)`;
};

const getPowerPercentage = () => {
    const percentages = [40, 42, 45, 48, 50, 52, 55, 58, 60, 63, 65, 68, 70, 72, 75, 78, 80, 82, 85, 88, 90, 92, 95, 98];
    const randomIndex = Math.floor(Math.random() * percentages.length);
    const percentage = percentages[randomIndex];
    
    const powerMessages = [
        `⚠️  𝓨𝓞𝓤'𝓥𝓔 𝓤𝓝𝓛𝓞𝓒𝓚𝓔𝓓 𝓞𝓝𝓛𝓨 ${percentage}% 𝓞𝓕 𝓜𝓨 𝓟𝓞𝓦𝓔𝓡…`,
        `⚡  ${percentage}% 𝓞𝓕 𝓜𝓨 𝓟𝓞𝓦𝓔𝓡 𝓡𝓔𝓥𝓔𝓐𝓛𝓔𝓓…`,
        `💀  ${percentage}% 𝓟𝓞𝓦𝓔𝓡 𝓤𝓝𝓛𝓔𝓐𝓢𝓗𝓔𝓓 - 𝓟𝓡𝓞𝓒𝓔𝓔𝓓 𝓦𝓘𝓣𝓗 𝓒𝓐𝓤𝓣𝓘𝓞𝓝`,
        `🔓  ${percentage}% 𝓞𝓕 𝓜𝓨 𝓓𝓐𝓡𝓚 𝓔𝓝𝓔𝓡𝓖𝓨 𝓐𝓒𝓒𝓔𝓢𝓢𝓘𝓑𝓛𝓔`,
        `🌑  ${percentage}% 𝓟𝓞𝓦𝓔𝓡 𝓒𝓞𝓡𝓡𝓤𝓟𝓣𝓘𝓞𝓝 𝓓𝓔𝓣𝓔𝓒𝓣𝓔𝓓`
    ];
    
    const randomMessage = powerMessages[Math.floor(Math.random() * powerMessages.length)];
    return randomMessage;
};

// Import your existing config
if (command === 'menu') {
    const filePath = path.join(__dirname, '../uploads/upload/Desire.png');
    const captionPath = path.join(__dirname, './Utils/menu.txt');
    const audioPath = path.join(__dirname, '../uploads/upload/DesireAura.mp3'); // Adjust path to your audio file
    
    await sock.sendMessage(chatId, { react: { text: "⌛", key: msg.key } });

    try {
        let caption = await fs.promises.readFile(captionPath, 'utf-8');
        
        // DEBUG: Let's see what's available
        console.log('=== DEBUG INFO ===');
        console.log('Config prefix:', config.prefix);
        console.log('Message pushName:', msg.pushName);
        console.log('Bot user ID:', sock.user?.id);
        
        let ownerName = "Desire-eXe V1.0";
        
        // Try multiple methods to get WhatsApp name
        try {
            // Method 1: Get bot's own contact info
            const botJid = sock.user.id;
            console.log('Bot JID:', botJid);
            
            const botContact = await sock.getContact(botJid);
            console.log('Bot contact:', botContact);
            console.log('Bot name:', botContact.name);
            console.log('Bot notify:', botContact.notify);
            
            ownerName = botContact.name || botContact.notify || msg.pushName || "Desire-eXe V1.0";
            
        } catch (error) {
            console.log('Bot contact fetch failed:', error.message);
            
            // Method 2: Try owner JID from config
            try {
                const ownerContact = await sock.getContact(config.OWNER_JID);
                console.log('Owner contact:', ownerContact);
                ownerName = ownerContact.name || ownerContact.notify || msg.pushName || "Desire Admin";
            } catch (error2) {
                console.log('Owner contact fetch failed:', error2.message);
                
                // Method 3: Use message sender's name
                ownerName = msg.pushName || "Desire-eXe V1.0";
            }
        }
        
        console.log('Final ownerName:', ownerName);
        console.log('Final prefix:', config.prefix);
        
        // Replace dynamic variables - FIXED REGEX
        caption = caption
            .replace(/\$\(uptime\)/g, getUptime())
            .replace(/\$\(RAM\)/g, getRAMUsage())
            .replace(/\$\(metadataname\)/g, ownerName)
            .replace(/\$\{global\.prefix\}/g, currentPrefix)
            .replace(/\$\{prefix\}/g, currentPrefix)
            .replace(/\$\(powerPercentage\)/g, getPowerPercentage());
        
        console.log('Final caption preview:', caption.substring(0, 200));
        
        // 1. First send the image with caption
        await sock.sendMessage(chatId, { image: { url: filePath }, caption }, { quoted: msg });
        
        // 2. Then send the audio file
        // Check if audio file exists
        if (fs.existsSync(audioPath)) {
            await sock.sendMessage(chatId, { 
                audio: { url: audioPath }, 
                mimetype: 'audio/mpeg',
                ptt: false // Set to true if you want push-to-talk style
            }, { quoted: msg });
            console.log('Audio sent successfully');
        } else {
            console.log('Audio file not found at:', audioPath);
            // Optional: Send a fallback message or just skip
        }
        
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
    } catch (error) {
        console.error('Error sending menu:', error);
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}
// 👨‍💻 Desire eXe - Owner VCard
if (command === "owner" || command === "contact") {
    const vcard = 
        'BEGIN:VCARD\n' +
        'VERSION:1.0\n' +
        'FN:Desire-eXe (Desire)\n' + 
        'ORG:Desire-eXe V1.0;\n' +         
        'TEL;type=CELL;type=VOICE;waid=2347017747337:+234 701 774 7337\n' + // Your WhatsApp number
        'END:VCARD';

    await sock.sendMessage(chatId, {
        contacts: {
            displayName: "Desire eXe Owner",
            contacts: [{ vcard }]
        }
    }, { quoted: msg });
}


// 👨‍💻 Shutdown Desire-eXe V1.0
if (command === 'shutdown') {
    const chatId = msg.key.remoteJid;
    const isGroup = chatId.endsWith('@g.us');
    const sender = isGroup ? msg.key.participant : chatId; 
    const isFromMe = msg.key.fromMe || false;

    if (!isFromMe) {
        await sock.sendMessage(chatId, {
            text: '🚫 You are not authorized to eXecute this command.',
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, {
        text: "⚠️ Are you sure you want to shutdown *Desire-eXe V1.0*?\nReply with *yes* or *no* within 30 seconds.",
    }, { quoted: msg });

    let responseReceived = false;
    let timeoutId;

    // Create a one-time listener for the response
    const responseHandler = async ({ messages }) => {
        const incoming = messages[0];
        if (!incoming.message || responseReceived) return;

        const responseChat = incoming.key.remoteJid;
        const responseSender = isGroup ? incoming.key.participant : incoming.key.remoteJid;
        const responseText = (incoming.message?.conversation?.toLowerCase() ||
                             incoming.message?.extendedTextMessage?.text?.toLowerCase() || '').trim();

        // Check if it's the right chat and sender
        if (responseChat === chatId && responseSender === sender) {
            if (responseText === 'yes') {
                responseReceived = true;
                clearTimeout(timeoutId);
                sock.ev.off('messages.upsert', responseHandler);
                await sock.sendMessage(chatId, {
                    text: "🛑 Shutting down *Desire-eXe V1.0*..."
                }, { quoted: incoming });
                console.log('🛑 Desire-eXe V1.0 shutdown initiated by owner');
                
                // Graceful shutdown for Koyeb
                await sock.end();
                process.exit(0);
                
            } else if (responseText === 'no') {
                responseReceived = true;
                clearTimeout(timeoutId);
                sock.ev.off('messages.upsert', responseHandler);
                await sock.sendMessage(chatId, {
                    text: "✅ Shutdown cancelled."
                }, { quoted: incoming });
            }
        }
    };

    // Add the listener
    sock.ev.on('messages.upsert', responseHandler);

    // ⚠️ CRITICAL: Add timeout to clean up the listener
    timeoutId = setTimeout(async () => {
        if (!responseReceived) {
            responseReceived = true;
            sock.ev.off('messages.upsert', responseHandler);
            await sock.sendMessage(chatId, {
                text: "⏰ Shutdown confirmation timed out. Command cancelled."
            });
            console.log('⏰ Shutdown confirmation timed out');
        }
    }, 30000); // 30 seconds timeout
}

	// RESTART Desire-eXe
if (command === 'restart') {
    const chatId = msg.key.remoteJid;
    const isFromMe = msg.key.fromMe || false;

    if (!isFromMe) {
        await sock.sendMessage(chatId, {
            text: '🚫 You are not authorized to eXecute this command.',
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, {
        text: "🔄 Restarting *Desire-eXe V1.0*...",
    }, { quoted: msg });

    console.log('🔄 Bot restart initiated by owner');
    
    // Graceful restart
    await sock.end();
    process.exit(1); // Use exit code 1 to signal restart (not normal shutdown)
}

// Activate Desire-eXe
if (command === 'Arise') {
    const videoPath = path.join(__dirname, '../uploads/DesireAura.mp4');

    await sock.sendMessage(chatId, { react: { text: "👨‍💻", key: msg.key } });

    try {
        const videoBuffer = await fs.promises.readFile(videoPath);

        await sock.sendMessage(chatId, {
            video: videoBuffer,
            caption: "_*Desire-eXe V1.0 is Ready and running under his eXecutor (Desire)*_",
            mimetype: 'video/mp4'
        }, { quoted: msg });

        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
    } catch (error) {
        console.error('Error sending .Arise video:', error);
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}


// Groups
if (command === 'groups' && chatId === ownerJid) {
    try {
        const groups = await sock.groupFetchAllParticipating();
        const groupList = Object.values(groups);
        let text = '*📋 Groups List:*\n\n';
        let count = 1;

        for (const group of groupList) {
            text += `${count++}. ${group.subject}\n🆔: ${group.id}\n👥 Members: ${group.participants.length}\n\n`;
        }

        // Handle long messages (split into chunks of 4000 chars)
        const chunks = text.match(/[\s\S]{1,4000}/g) || [];
        for (let chunk of chunks) {
            await sock.sendMessage(chatId, { text: chunk }, { quoted: msg });
        }

        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
    } catch (error) {
        console.error('❌ Error fetching groups:', error);
        await sock.sendMessage(chatId, { text: '⚠️ Failed to fetch group list.' }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// Save Status
if (command === 'save') {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

    if (!quoted) {
        await sock.sendMessage(msg.key.remoteJid, {
            text: '⚠️ Reply to a status (image/video) to save it.',
        }, { quoted: msg });
        return;
    }

    let mediaType, mediaKey;
    if (quoted.imageMessage) {
        mediaType = 'imageMessage';
        mediaKey = 'image';
    } else if (quoted.videoMessage) {
        mediaType = 'videoMessage';
        mediaKey = 'video';
    } else {
        await sock.sendMessage(msg.key.remoteJid, {
            text: '⚠️ Only image or video status can be saved.',
        }, { quoted: msg });
        return;
    }

    try {
        const mediaContent = quoted[mediaType];
        
        // Download the status media
        const stream = await downloadContentFromMessage(mediaContent, mediaKey);
        let buffer = Buffer.from([]);
        
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }

        if (buffer.length === 0) {
            throw new Error('Downloaded media is empty');
        }

        console.log(`✅ Downloaded status ${mediaType}: ${buffer.length} bytes`);

        // Send the status media back to owner
        if (mediaType === 'imageMessage') {
            await sock.sendMessage(ownerJid, {
                image: buffer,
                caption: `📸 Saved Status\n\n⏰ ${new Date().toLocaleString()}`
            });
        } else if (mediaType === 'videoMessage') {
            await sock.sendMessage(ownerJid, {
                video: buffer,
                caption: `🎥 Saved Status\n\n⏰ ${new Date().toLocaleString()}`
            });
        }

        // Send success reaction
        await sock.sendMessage(msg.key.remoteJid, {
            react: {
                text: "✅",
                key: msg.key
            }
        });

        console.log(`✅ Status ${mediaType} saved and sent to owner`);

    } catch (err) {
        console.error('Error saving status:', err);
        
        await sock.sendMessage(msg.key.remoteJid, {
            text: `❌ Failed to save status: ${err.message}`,
        }, { quoted: msg });

        await sock.sendMessage(msg.key.remoteJid, {
            react: {
                text: "❌",
                key: msg.key
            }
        });
    }
}

// 👨‍💻 Set Profile Picture Command (DM Only)
if (command === 'setpp') {

    const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quotedMsg?.imageMessage) {
        await sock.sendMessage(chatId, { 
            text: '⚠️ Reply to an image with \\setpp to change your profile picture.' 
        }, { quoted: msg });
        return;
    }

    try {
        const mediaBuffer = await downloadMediaMessage(
            { message: quotedMsg }, // pass full message object
            'buffer',
            {},
            { logger: P({ level: 'silent' }) }
        );

        // Update profile picture for DM (user's own profile)
        await sock.updateProfilePicture(chatId, mediaBuffer);
        await sock.sendMessage(chatId, { text: '✅ Profile picture updated successfully!' });
    } catch (err) {
        await sock.sendMessage(chatId, { text: `❌ Failed: ${err.message}` });
    }
}


// 📛 AutoBlock OFF
if (command === 'autoblock-off') {
    await sock.sendMessage(chatId, { react: { text: "🔓", key: msg.key } });
    try {
        config.AUTO_BLOCK_UNKNOWN = false;
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
        console.log(`Response: AutoBlock disabled`);
        await sock.sendMessage(chatId, { text: "❌ AutoBlock is now *OFF*" }, { quoted: msg });
    } catch (error) {
        console.error('Error disabling autoblock:', error);
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// 🔒 AutoBlock ON
if (command === 'autoblock-on') {
    await sock.sendMessage(chatId, { react: { text: "🔒", key: msg.key } });
    try {
        config.AUTO_BLOCK_UNKNOWN = true;
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
        console.log(`Response: AutoBlock enabled`);
        await sock.sendMessage(chatId, { text: "✅ AutoBlock is now *ON*" }, { quoted: msg });
    } catch (error) {
        console.error('Error enabling autoblock:', error);
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}



// Block in DMs
if (command === 'block') {
    try {
        if (msg.key.remoteJid.endsWith("@g.us")) {
            await sock.sendMessage(chatId, { text: "❌ This command only works in private chat (DM)." });
            return;
        }

        await sock.updateBlockStatus(chatId, "block"); // block the DM user
        await sock.sendMessage(chatId, { text: "✅ User has been blocked." });
    } catch (error) {
        console.error("Error in block command:", error);
        await sock.sendMessage(chatId, { text: "❌ Failed to block user." });
    }
}



// Send Spam Mesaage (Use with Caution)
if (command === 'sspam') {
  // Ensure message starts with the right prefix+command
  if (!messageBody.startsWith(prefix + 'sspam')) {
    // not our command
    return;
  }

  // remove the prefix+command and trim
  const argsStr = messageBody.slice((prefix + 'sspam').length).trim();

  // Expect format: <numbers> <count> <message>
  // We'll split on whitespace for the first two parts then treat rest as message
  const parts = argsStr.split(/\s+/);
  if (parts.length < 3) {
    await sock.sendMessage(chatId, {
      text: `❌ Invalid format.\n\n✅ Usage:\n${prefix}sspam +234xxxxx,+234yyyyyy <count> <message>`
    }, { quoted: msg });
    return;
  }

  const numbersPart = parts.shift(); // first token (may contain commas)
  const countStr = parts.shift();    // second token
  const spamMessage = parts.join(' '); // rest is the message

  // parse numbers, keep the + sign for international format
  const numbers = numbersPart.split(/[, \n]+/)
    .map(n => n.trim().replace(/[^\d+]/g, '')) // remove everything except digits and plus
    .filter(Boolean);

  const count = parseInt(countStr, 10);

  // validate
  if (!numbers.length) {
    await sock.sendMessage(chatId, { text: '❌ No valid numbers found.' }, { quoted: msg });
    return;
  }
  if (isNaN(count) || count < 1 || count > 99) {
    await sock.sendMessage(chatId, { text: '❌ Please provide a valid count (1 - 99)' }, { quoted: msg });
    return;
  }
  if (!spamMessage) {
    await sock.sendMessage(chatId, { text: '❌ Please provide a message to send.' }, { quoted: msg });
    return;
  }

  // send messages
  for (let raw of numbers) {
    // normalize JID: remove leading + if you want numbers without plus; whatsapp accepts phone@s.whatsapp.net
    const normalized = raw.startsWith('+') ? raw.slice(1) : raw;
    const jid = `${normalized}@s.whatsapp.net`;

    for (let i = 0; i < count; i++) {
      // small delay between messages to avoid rate-limits/flooding
      await sock.sendMessage(jid, { text: spamMessage });
      await delay(200); // 200ms between messages; increase if you see issues
    }

    // notify sender in the chat
    await sock.sendMessage(chatId, {
      text: `✅ Sent "${spamMessage}" x${count} to @${normalized}`,
      mentions: [jid]
    });
    await delay(300); // short pause before next number
  }

  await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
}

// Clone User's Profile Picture 
if (command === 'clone-pfp') {
  const isGroup = msg.key.remoteJid.endsWith('@g.us');
  const chatId = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
 
  if (isGroup) {
    const metadata = await sock.groupMetadata(chatId);
    const groupAdmins = metadata.participants.filter(p => p.admin).map(p => p.id);

    if (!groupAdmins.includes(sender)) {
      await sock.sendMessage(chatId, { text: '❌ Only group admins can use this in groups.' });
      return;
    }
  }

  const quoted = msg.message?.extendedTextMessage?.contextInfo?.participant;

  if (!quoted) {
    await sock.sendMessage(chatId, { text: '👤 Please *reply to* the person whose profile you want to clone.' });
    return;
  }

  try {
    const pfpUrl = await sock.profilePictureUrl(quoted, 'image');
    const res = await fetch(pfpUrl);
    const arrayBuffer = await res.arrayBuffer(); // ✅ This replaces .buffer()
    const buffer = Buffer.from(arrayBuffer);     // ✅ Convert to Node buffer

    await sock.updateProfilePicture(sock.user.id, buffer);

    await sock.sendMessage(chatId, {
  react: {
    text: '✅',
    key: msg.key
  }
});
  } catch (err) {
    console.error(err);
    await sock.sendMessage(chatId, { text: '❌ Failed to clone. They may have no profile picture or it\'s private.' });
  }
}

// Fun Facts
if (command === 'fact') {
  const facts = [
    "🔥 Honey never spoils.",
    "🌍 Octopuses have three hearts.",
    "🚀 A day on Venus is longer than a year.",
    // Add more fun facts here...
  ];
  const fact = facts[Math.floor(Math.random() * facts.length)];
  await sock.sendMessage(chatId, { text: fact }, { quoted: msg });
}

if (command === 'vv') {
    const sender = msg.key.participant || msg.key.remoteJid;
    const ownerJid = '234**********@s.whatsapp.net'; // YOUR_WHATSAPP_NUMBER@s.whatsapp.net(In This Format "234*********" without the "+"). 
    const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
    const quotedMsg = contextInfo?.quotedMessage;

    if (!quotedMsg) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Please reply to a view-once message.' });
        await sock.sendMessage(msg.key.remoteJid, {
            react: { text: '❌', key: msg.key }
        });
        return;
    }

    // Add processing reaction
    await sock.sendMessage(msg.key.remoteJid, {
        react: { text: '⏳', key: msg.key }
    });

    // Extract view-once message
    let mediaMsg = quotedMsg?.viewOnceMessage?.message || 
                   quotedMsg?.viewOnceMessageV2?.message;

    if (!mediaMsg) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'No view-once media found in the replied message.' });
        await sock.sendMessage(msg.key.remoteJid, {
            react: { text: '❌', key: msg.key }
        });
        return;
    }

    const mediaType = Object.keys(mediaMsg || {})[0];

    // Now including audioMessage for voice notes
    if (!['imageMessage', 'videoMessage', 'audioMessage'].includes(mediaType)) {
        await sock.sendMessage(msg.key.remoteJid, { 
            text: `Unsupported view-once media type: ${mediaType}. Only images, videos, and voice notes are supported.` 
        });
        await sock.sendMessage(msg.key.remoteJid, {
            react: { text: '❌', key: msg.key }
        });
        return;
    }

    try {
        // Get caption from the original media (for images/videos)
        const mediaContent = mediaMsg[mediaType];
        const originalCaption = mediaContent?.caption || '';
        
        // Download the media
        const buffer = await downloadMediaMessage(
            {
                key: {
                    remoteJid: msg.key.remoteJid,
                    id: contextInfo.stanzaId,
                    fromMe: contextInfo.participant ? (contextInfo.participant === sock.user.id) : false
                },
                message: { 
                    [mediaType]: mediaMsg[mediaType] 
                }
            },
            'buffer',
            {},
            {
                logger: sock.logger,
                reuploadRequest: sock.updateMediaMessage
            }
        );

        if (!buffer || buffer.length === 0) {
            throw new Error('Download returned empty buffer.');
        }

        // Handle different media types
        if (mediaType === 'imageMessage') {
            let finalCaption = `🔓 View-Once Image unlocked\n\n_Sent by: @${sender.split('@')[0]}_`;
            if (originalCaption) {
                finalCaption += `\n\n📝 Original Caption: ${originalCaption}`;
            }
            
            await sock.sendMessage(msg.key.remoteJid, {
                image: buffer,
                caption: finalCaption,
                mentions: [sender]
            });

        } else if (mediaType === 'videoMessage') {
            let finalCaption = `🔓 View-Once Video unlocked\n\n_Sent by: @${sender.split('@')[0]}_`;
            if (originalCaption) {
                finalCaption += `\n\n📝 Original Caption: ${originalCaption}`;
            }
            
            await sock.sendMessage(msg.key.remoteJid, {
                video: buffer,
                caption: finalCaption,
                mentions: [sender]
            });

        } else if (mediaType === 'audioMessage') {
            // For voice notes, check if it's PTT (Push-to-Talk)
            const isPTT = mediaContent?.ptt === true;
            
            await sock.sendMessage(msg.key.remoteJid, {
                audio: buffer,
                mimetype: 'audio/ogg; codecs=opus',
                ptt: isPTT, // Preserve the push-to-talk format
                caption: `🔓 View-Once Voice Note unlocked\n\n_Sent by: @${sender.split('@')[0]}_\n⏱️ Duration: ${mediaContent?.seconds || 'Unknown'} seconds`,
                mentions: [sender]
            });
        }

        // Success reaction
        await sock.sendMessage(msg.key.remoteJid, {
            react: { text: '✅', key: msg.key }
        });

        console.log(`✅ View-once ${mediaType} unlocked by ${sender}`);

    } catch (err) {
        console.error('Error processing view-once media:', err);
        await sock.sendMessage(msg.key.remoteJid, {
            text: `❌ Failed to unlock view-once media:\n${err.message}`
        });
        // Error reaction
        await sock.sendMessage(msg.key.remoteJid, {
            react: { text: '❌', key: msg.key }
        });
    }
}


// vv2 command - sends to specific number with argument
if (command === 'vv2') {
    const sender = msg.key.participant || msg.key.remoteJid;
    const ownerJid = '234**********@s.whatsapp.net'; // YOUR_WHATSAPP_NUMBER@s.whatsapp.net(In This Format "234*********" without the "+").
    
    // Check if phone number argument is provided
    if (!args[0]) {
        await sock.sendMessage(msg.key.remoteJid, { 
            text: '❌ Please provide a phone number.\n\nUsage: \\vv2 2348161262491' 
        });
        await sock.sendMessage(msg.key.remoteJid, {
            react: { text: '❌', key: msg.key }
        });
        return;
    }

    // Validate and format the phone number
    let phoneNumber = args[0].trim();
    
    // Remove any non-digit characters
    phoneNumber = phoneNumber.replace(/\D/g, '');
    
    // Validate phone number length (adjust based on your country)
    if (phoneNumber.length < 10 || phoneNumber.length > 15) {
        await sock.sendMessage(msg.key.remoteJid, { 
            text: '❌ Invalid phone number format. Please provide a valid phone number.' 
        });
        await sock.sendMessage(msg.key.remoteJid, {
            react: { text: '❌', key: msg.key }
        });
        return;
    }

    // Format as WhatsApp JID
    const targetJid = `${phoneNumber}@s.whatsapp.net`;

    const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
    const quotedMsg = contextInfo?.quotedMessage;

    if (!quotedMsg) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Please reply to a view-once message.' });
        await sock.sendMessage(msg.key.remoteJid, {
            react: { text: '❌', key: msg.key }
        });
        return;
    }

    // Add processing reaction
    await sock.sendMessage(msg.key.remoteJid, {
        react: { text: '⏳', key: msg.key }
    });

    // Enhanced view-once detection for ALL media types including voice notes
    let mediaMsg = null;
    let mediaType = null;

    // Check multiple possible view-once structures
    if (quotedMsg?.viewOnceMessage?.message) {
        mediaMsg = quotedMsg.viewOnceMessage.message;
        mediaType = Object.keys(mediaMsg)[0];
    } else if (quotedMsg?.viewOnceMessageV2?.message) {
        mediaMsg = quotedMsg.viewOnceMessageV2.message;
        mediaType = Object.keys(mediaMsg)[0];
    } 
    // Special handling for view-once voice notes
    else if (quotedMsg?.viewOnceMessage?.message?.audioMessage) {
        mediaMsg = { audioMessage: quotedMsg.viewOnceMessage.message.audioMessage };
        mediaType = 'audioMessage';
    } else if (quotedMsg?.viewOnceMessageV2?.message?.audioMessage) {
        mediaMsg = { audioMessage: quotedMsg.viewOnceMessageV2.message.audioMessage };
        mediaType = 'audioMessage';
    }
    // Check for direct view-once flags in audio messages
    else if (quotedMsg?.audioMessage?.viewOnce) {
        mediaMsg = { audioMessage: quotedMsg.audioMessage };
        mediaType = 'audioMessage';
    }

    console.log('🔍 Detected media type:', mediaType);
    console.log('🔍 Media message structure:', Object.keys(mediaMsg || {}));

    if (!mediaMsg || !mediaType) {
        await sock.sendMessage(msg.key.remoteJid, { 
            text: 'No view-once media found in the replied message.\n\nSupported types:\n• View-once images\n• View-once videos\n• View-once voice notes' 
        });
        await sock.sendMessage(msg.key.remoteJid, {
            react: { text: '❌', key: msg.key }
        });
        return;
    }

    // Now including audioMessage for voice notes
    if (!['imageMessage', 'videoMessage', 'audioMessage'].includes(mediaType)) {
        await sock.sendMessage(msg.key.remoteJid, { 
            text: `Unsupported view-once media type: ${mediaType}. Only images, videos, and voice notes are supported.` 
        });
        await sock.sendMessage(msg.key.remoteJid, {
            react: { text: '❌', key: msg.key }
        });
        return;
    }

    try {
        // Get caption from the original media (for images/videos)
        const mediaContent = mediaMsg[mediaType];
        const originalCaption = mediaContent?.caption || '';
        
        // Download the media
        const buffer = await downloadMediaMessage(
            {
                key: {
                    remoteJid: msg.key.remoteJid,
                    id: contextInfo.stanzaId,
                    fromMe: contextInfo.participant ? (contextInfo.participant === sock.user.id) : false
                },
                message: mediaMsg
            },
            'buffer',
            {},
            {
                logger: sock.logger,
                reuploadRequest: sock.updateMediaMessage
            }
        );

        if (!buffer || buffer.length === 0) {
            throw new Error('Download returned empty buffer.');
        }

        // Send to target number
        if (mediaType === 'imageMessage') {
            let targetCaption = `🔓 View-Once Image forwarded\n\n_Unlocked by: @${sender.split('@')[0]}_\n\n*By Desire-eXe`;
            if (originalCaption) {
                targetCaption += `\n\n📝 Original Caption: ${originalCaption}`;
            }
            
            await sock.sendMessage(targetJid, {
                image: buffer,
                caption: targetCaption,
                mentions: [sender]
            });

        } else if (mediaType === 'videoMessage') {
            let targetCaption = `🔓 View-Once Video forwarded\n\n_Unlocked by: @${sender.split('@')[0]}_`;
            if (originalCaption) {
                targetCaption += `\n\n📝 Original Caption: ${originalCaption}`;
            }
            
            await sock.sendMessage(targetJid, {
                video: buffer,
                caption: targetCaption,
                mentions: [sender]
            });

        } else if (mediaType === 'audioMessage') {
            // For voice notes
            const isPTT = mediaContent?.ptt === true;
            
            await sock.sendMessage(targetJid, {
                audio: buffer,
                mimetype: 'audio/ogg; codecs=opus',
                ptt: isPTT,
                caption: `🔓 View-Once Voice Note forwarded\n\n_Unlocked by: @${sender.split('@')[0]}_\n⏱️ Duration: ${mediaContent?.seconds || 'Unknown'} seconds`,
                mentions: [sender]
            });
        }

        // Send confirmation to original sender
        await sock.sendMessage(msg.key.remoteJid, {
            text: `✅ View-once ${mediaType.replace('Message', '').toLowerCase()} has been sent to ${phoneNumber}.`
        });

        // Success reaction
        await sock.sendMessage(msg.key.remoteJid, {
            react: { text: '✅', key: msg.key }
        });

        console.log(`✅ View-once ${mediaType} unlocked by ${sender} and sent to ${targetJid}`);

    } catch (err) {
        console.error('Error processing view-once media:', err);
        
        // Check if it's a "not registered on WhatsApp" error
        if (err.message?.includes('not registered') || err.message?.includes('404')) {
            await sock.sendMessage(msg.key.remoteJid, {
                text: `❌ Failed to send: The number ${phoneNumber} is not registered on WhatsApp.`
            });
        } else {
            await sock.sendMessage(msg.key.remoteJid, {
                text: `❌ Failed to unlock and forward view-once media:\n${err.message}`
            });
        }
        
        // Error reaction
        await sock.sendMessage(msg.key.remoteJid, {
            react: { text: '❌', key: msg.key }
        });
    }
}

// vv3 command - sends to tagged user's DM (group only)
if (command === 'vv3') {
    const sender = msg.key.participant || msg.key.remoteJid;
    
    // Check if command is used in a group
    if (!msg.key.remoteJid.endsWith('@g.us')) {
        await sock.sendMessage(msg.key.remoteJid, { 
            text: '❌ This command can only be used in groups.' 
        });
        await sock.sendMessage(msg.key.remoteJid, {
            react: { text: '❌', key: msg.key }
        });
        return;
    }

    const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
    const quotedMsg = contextInfo?.quotedMessage;
    const mentionedJids = contextInfo?.mentionedJid || [];

    // Check if message is replying to a view-once and has a mentioned user
    if (!quotedMsg) {
        await sock.sendMessage(msg.key.remoteJid, { 
            text: 'Please reply to a view-once message and mention a user.\n\nUsage: \\vv3 @username' 
        });
        await sock.sendMessage(msg.key.remoteJid, {
            react: { text: '❌', key: msg.key }
        });
        return;
    }

    if (mentionedJids.length === 0) {
        await sock.sendMessage(msg.key.remoteJid, { 
            text: 'Please mention a user to send the media to.\n\nUsage: \\vv3 @username' 
        });
        await sock.sendMessage(msg.key.remoteJid, {
            react: { text: '❌', key: msg.key }
        });
        return;
    }

    // Get the first mentioned user
    const targetJid = mentionedJids[0];

    // Add processing reaction
    await sock.sendMessage(msg.key.remoteJid, {
        react: { text: '⏳', key: msg.key }
    });

    // Enhanced view-once detection for ALL media types including voice notes
    let mediaMsg = null;
    let mediaType = null;

    // Check multiple possible view-once structures
    if (quotedMsg?.viewOnceMessage?.message) {
        mediaMsg = quotedMsg.viewOnceMessage.message;
        mediaType = Object.keys(mediaMsg)[0];
    } else if (quotedMsg?.viewOnceMessageV2?.message) {
        mediaMsg = quotedMsg.viewOnceMessageV2.message;
        mediaType = Object.keys(mediaMsg)[0];
    } 
    // Special handling for view-once voice notes
    else if (quotedMsg?.viewOnceMessage?.message?.audioMessage) {
        mediaMsg = { audioMessage: quotedMsg.viewOnceMessage.message.audioMessage };
        mediaType = 'audioMessage';
    } else if (quotedMsg?.viewOnceMessageV2?.message?.audioMessage) {
        mediaMsg = { audioMessage: quotedMsg.viewOnceMessageV2.message.audioMessage };
        mediaType = 'audioMessage';
    }
    // Check for direct view-once flags in audio messages
    else if (quotedMsg?.audioMessage?.viewOnce) {
        mediaMsg = { audioMessage: quotedMsg.audioMessage };
        mediaType = 'audioMessage';
    }

    console.log('🔍 Detected media type:', mediaType);
    console.log('🔍 Target user:', targetJid);

    if (!mediaMsg || !mediaType) {
        await sock.sendMessage(msg.key.remoteJid, { 
            text: 'No view-once media found in the replied message.\n\nSupported types:\n• View-once images\n• View-once videos\n• View-once voice notes' 
        });
        await sock.sendMessage(msg.key.remoteJid, {
            react: { text: '❌', key: msg.key }
        });
        return;
    }

    // Now including audioMessage for voice notes
    if (!['imageMessage', 'videoMessage', 'audioMessage'].includes(mediaType)) {
        await sock.sendMessage(msg.key.remoteJid, { 
            text: `Unsupported view-once media type: ${mediaType}. Only images, videos, and voice notes are supported.` 
        });
        await sock.sendMessage(msg.key.remoteJid, {
            react: { text: '❌', key: msg.key }
        });
        return;
    }

    try {
        // Get caption from the original media (for images/videos)
        const mediaContent = mediaMsg[mediaType];
        const originalCaption = mediaContent?.caption || '';
        
        // Download the media
        const buffer = await downloadMediaMessage(
            {
                key: {
                    remoteJid: msg.key.remoteJid,
                    id: contextInfo.stanzaId,
                    fromMe: contextInfo.participant ? (contextInfo.participant === sock.user.id) : false
                },
                message: mediaMsg
            },
            'buffer',
            {},
            {
                logger: sock.logger,
                reuploadRequest: sock.updateMediaMessage
            }
        );

        if (!buffer || buffer.length === 0) {
            throw new Error('Download returned empty buffer.');
        }

        // Get sender's name for the caption
        const senderName = sender.split('@')[0];
        const targetName = targetJid.split('@')[0];

        // Send to tagged user's DM
        if (mediaType === 'imageMessage') {
            let targetCaption = `🔓 View-Once Image forwarded from group\n\n_Unlocked by: ${senderName}_`;
            if (originalCaption) {
                targetCaption += `\n\n📝 Original Caption: ${originalCaption}`;
            }
            
            await sock.sendMessage(targetJid, {
                image: buffer,
                caption: targetCaption
            });

        } else if (mediaType === 'videoMessage') {
            let targetCaption = `🔓 View-Once Video forwarded from group\n\n_Unlocked by: ${senderName}_`;
            if (originalCaption) {
                targetCaption += `\n\n📝 Original Caption: ${originalCaption}`;
            }
            
            await sock.sendMessage(targetJid, {
                video: buffer,
                caption: targetCaption
            });

        } else if (mediaType === 'audioMessage') {
            // For voice notes
            const isPTT = mediaContent?.ptt === true;
            
            await sock.sendMessage(targetJid, {
                audio: buffer,
                mimetype: 'audio/ogg; codecs=opus',
                ptt: isPTT,
                caption: `🔓 View-Once Voice Note forwarded from group\n\n_Unlocked by: ${senderName}_\n⏱️ Duration: ${mediaContent?.seconds || 'Unknown'} seconds`
            });
        }

        // Send confirmation to group
        await sock.sendMessage(msg.key.remoteJid, {
            text: `✅ View-once ${mediaType.replace('Message', '').toLowerCase()} has been sent to @${targetName}'s DM.`,
            mentions: [targetJid]
        });

        // Success reaction
        await sock.sendMessage(msg.key.remoteJid, {
            react: { text: '✅', key: msg.key }
        });

        console.log(`✅ View-once ${mediaType} unlocked by ${sender} and sent to ${targetJid}`);

    } catch (err) {
        console.error('Error processing view-once media:', err);
        
        // Check if it's a "not registered on WhatsApp" error
        if (err.message?.includes('not registered') || err.message?.includes('404')) {
            await sock.sendMessage(msg.key.remoteJid, {
                text: `❌ Failed to send: The user is not registered on WhatsApp.`,
                mentions: [targetJid]
            });
        } else if (err.message?.includes('blocked')) {
            await sock.sendMessage(msg.key.remoteJid, {
                text: `❌ Failed to send: The user has blocked the bot or privacy settings prevent sending.`,
                mentions: [targetJid]
            });
        } else {
            await sock.sendMessage(msg.key.remoteJid, {
                text: `❌ Failed to unlock and forward view-once media:\n${err.message}`
            });
        }
        
        // Error reaction
        await sock.sendMessage(msg.key.remoteJid, {
            react: { text: '❌', key: msg.key }
        });
    }
}

	    // Desire-Mini-AI Bot
// Enable Chat
if (command === 'Desire') {
  chatSessions.enableChat(chatId);
  await sock.sendMessage(chatId, { text: '🧠 Chat mode activated! Talk to me now...' });
  return;
}

// Disable Chat
if (command === 'Desire-off') {
  chatSessions.disableChat(chatId);
  await sock.sendMessage(chatId, { text: '💤 Chat mode deactivated. Bye for now!' });
  return;
}


// ==============================================
// 🔹HACKING COMMANDS
// ==============================================

// ✅ Ping (simple 4 times)
if (command === "ping2") {
    await sock.sendMessage(chatId, { react: { text: "⚡", key: msg.key } });

    const target = args[0];
    if (!target) {
        await sock.sendMessage(chatId, { text: 'Please provide a domain or IP. Example: `~ping2 google.com`' }, { quoted: msg });
        return;
    }

    try {
        // OS check (Linux uses -c, Windows uses -n)
        const pingCmd = process.platform === "win32" ? `ping -n 4 ${target}` : `ping -c 4 ${target}`;
        const { stdout, stderr } = await execAsync(pingCmd);
        if (stderr) throw new Error(stderr);

        const pingResult = `*Ping Result for:* ${target}\n\`\`\`\n${stdout}\n\`\`\``;
        await sock.sendMessage(chatId, { text: pingResult }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
    } catch (err) {
        console.error('Ping error:', err);
        await sock.sendMessage(chatId, { text: `Failed to ping ${target}.` }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// ✅ Whois by IP
if (command === "whois-ip") {
    await sock.sendMessage(chatId, { react: { text: "🕵️", key: msg.key } });

    const ipAddress = args[0];
    if (!ipAddress) {
        await sock.sendMessage(chatId, { 
            text: `❌ Please provide an IP address. Example: \`${currentPrefix}whois 8.8.8.8\`` 
        }, { quoted: msg });
        return;
    }

    // Validate IP address format
    const ipRegex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipRegex.test(ipAddress)) {
        await sock.sendMessage(chatId, { 
            text: '❌ Invalid IP address format.' 
        }, { quoted: msg });
        return;
    }

    try {
        const response = await fetch(`https://ipinfo.io/${ipAddress}/json`);
        if (!response.ok) throw new Error(`IP lookup failed: ${response.status}`);
        const data = await response.json();

        // Check if IP info was found
        if (data.error) {
            await sock.sendMessage(chatId, { 
                text: `❌ Error: ${data.error.message || 'IP not found'}` 
            }, { quoted: msg });
            await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
            return;
        }

        const ipWhoisInfo = `*🕵️ IP Info for:* ${ipAddress}\n\n` +
            `📍 *Location:* ${data.city || 'N/A'}, ${data.region || 'N/A'}, ${data.country || 'N/A'}\n` +
            `🌐 *ISP/Organization:* ${data.org || 'N/A'}\n` +
            `📡 *Coordinates:* ${data.loc || 'N/A'}\n` +
            `🔧 *Hostname:* ${data.hostname || 'N/A'}\n` +
            `🏢 *Timezone:* ${data.timezone || 'N/A'}`;

        await sock.sendMessage(chatId, { text: ipWhoisInfo }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
    } catch (err) {
        console.error('IP WHOIS error:', err);
        await sock.sendMessage(chatId, { 
            text: `❌ Failed to perform IP lookup: ${err.message}` 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// ✅ Ping (IP or mention)
if (command === "ping") {
    await sock.sendMessage(chatId, { react: { text: "🏓", key: msg.key } });

    const target = args[0];
    if (!target) {
        await sock.sendMessage(chatId, { text: "Provide an IP or user. Example: " + currentPrefix + "ping 8.8.8.8` or" + currentPrefix + "ping @user" }, { quoted: msg });
        return;
    }

    const ipRegex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

    if (ipRegex.test(target)) {
        try {
            const pingCmd = process.platform === "win32" ? `ping -n 4 ${target}` : `ping -c 4 ${target}`;
            const { stdout, stderr } = await execAsync(pingCmd);
            if (stderr) throw new Error(stderr);

            const pingResult = `*Ping Result for IP:* ${target}\n\`\`\`\n${stdout}\n\`\`\``;
            await sock.sendMessage(chatId, { text: pingResult }, { quoted: msg });
            await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
        } catch (err) {
            await sock.sendMessage(chatId, { text: `Ping to ${target} failed. Reason: ${err.message}` }, { quoted: msg });
            await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
        }
    } else {
        // Just mention a user if it's not IP
        await sock.sendMessage(chatId, { text: `🏓 Pinging you, @${target}!`, mentions: [target] }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
    }
}

// ✅ IP Info
if (command === "ipinfo") {
    await sock.sendMessage(chatId, { react: { text: "🔍", key: msg.key } });

    const target = args[0];
    if (!target) {
        await sock.sendMessage(chatId, { text: `Provide IP. Example: \`${currentPrefix}ipinfo 8.8.8.8\`` }, { quoted: msg });
        return;
    }

    const ipRegex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipRegex.test(target)) {
        await sock.sendMessage(chatId, { text: 'Invalid IP address.' }, { quoted: msg });
        return;
    }

    try {
        const response = await fetch(`https://ipinfo.io/${target}/json`);
        if (!response.ok) {
            throw new Error(`API returned ${response.status}`);
        }
        const data = await response.json();

        // Check if IP info was found
        if (data.error) {
            await sock.sendMessage(chatId, { text: `Error: ${data.error.message || 'IP not found'}` }, { quoted: msg });
            await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
            return;
        }

        const ipInfoResult = `*IP Info for:* ${target}\n\n📍 *Location:* ${data.city}, ${data.region}, ${data.country}\n🌐 *ISP:* ${data.org || 'N/A'}\n📡 *Coordinates:* ${data.loc || 'N/A'}\n🔧 *Hostname:* ${data.hostname || "N/A"}\n🏢 *Timezone:* ${data.timezone || 'N/A'}`;
        
        await sock.sendMessage(chatId, { text: ipInfoResult }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
    } catch (err) {
        console.error('IP Info Error:', err);
        await sock.sendMessage(chatId, { text: `Failed to fetch IP info: ${err.message}` }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}
// ✅ Domain Info (DNS-based - Guaranteed Working)
if (command === "whois") {
    await sock.sendMessage(chatId, { react: { text: "🔍", key: msg.key } });

    const domain = args[0];
    if (!domain) {
        await sock.sendMessage(chatId, { 
            text: `❌ Provide domain. Example: \`${currentPrefix}whois google.com\`` 
        }, { quoted: msg });
        return;
    }

    try {
        const dns = require('dns');
        
        // Get multiple DNS records
        const [addresses, mxRecords, txtRecords, cnameRecords] = await Promise.all([
            dns.promises.resolve4(domain).catch(() => []),
            dns.promises.resolveMx(domain).catch(() => []),
            dns.promises.resolveTxt(domain).catch(() => []),
            dns.promises.resolveCname(domain).catch(() => [])
        ]);

        // Get IPv6 addresses if available
        const ipv6Addresses = await dns.promises.resolve6(domain).catch(() => []);
        
        const domainInfo = `*🔍 Domain Info for:* ${domain}\n\n` +
            `🌐 *IPv4 Addresses:* ${addresses.length > 0 ? addresses.join(', ') : 'None'}\n` +
            (ipv6Addresses.length > 0 ? `🔗 *IPv6 Addresses:* ${ipv6Addresses.join(', ')}\n` : '') +
            (mxRecords.length > 0 ? `📧 *Mail Servers:* ${mxRecords.map(mx => `${mx.exchange} (priority: ${mx.priority})`).join(', ')}\n` : '') +
            (cnameRecords.length > 0 ? `🔗 *CNAME Records:* ${cnameRecords.join(', ')}\n` : '') +
            (txtRecords.length > 0 ? `📝 *TXT Records:* ${txtRecords.flat().join(', ')}\n` : '') +
            `✅ *Status:* Active and resolving\n` +
            `⚡ *DNS Lookup:* Successful`;
            
        await sock.sendMessage(chatId, { text: domainInfo }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
        
    } catch (error) {
        await sock.sendMessage(chatId, { 
            text: `❌ Domain ${domain} not found or not resolving.\n\n` +
                  `💡 *Try domains like:*\n` +
                  `• google.com\n` +
                  `• github.com\n` +
                  `• facebook.com\n` +
                  `• amazon.com`
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}
// ✅ DNS Lookup
if (command === "dnslookup") {
    await sock.sendMessage(chatId, { react: { text: "🌐", key: msg.key } });

    const target = args[0];
    if (!target) {
        await sock.sendMessage(chatId, { text: "Provide a domain or IP. Example:" + currentPrefix + "dnslookup google.com" }, { quoted: msg });
        return;
    }

    dns.lookup(target, (err, address, family) => {
        if (err) {
            sock.sendMessage(chatId, { text: `Error: ${err.message}` }, { quoted: msg });
        } else {
            sock.sendMessage(chatId, { text: `DNS lookup result for ${target}:\nIP: ${address}\nFamily: IPv${family}` }, { quoted: msg });
        }
    });
}

//Sub domains
if (command === 'subenum') {
    // Get target domain
    const target = args[0];
    if (!target) {
        await sock.sendMessage(chatId, {
            text: `❌ Usage: \`${currentPrefix}subenum example.com\``
        }, { quoted: msg });
        return;
    }

    // Basic domain validation
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/;
    if (!domainRegex.test(target)) {
        await sock.sendMessage(chatId, {
            text: '❌ Invalid domain format.'
        }, { quoted: msg });
        return;
    }

    // React to command
    await sock.sendMessage(chatId, { react: { text: "🔍", key: msg.key } });

    await sock.sendMessage(chatId, {
        text: `🔎 Enumerating subdomains for *${target}* via crt.sh…`
    }, { quoted: msg });

    try {
        // Fetch from crt.sh with proper headers
        const res = await fetch(`https://crt.sh/?q=%25.${encodeURIComponent(target)}&output=json`);
        
        if (!res.ok) {
            throw new Error(`API returned ${res.status}`);
        }

        const certs = await res.json();

        // Check if we got valid data
        if (!Array.isArray(certs)) {
            throw new Error('Invalid response from crt.sh');
        }

        // Collect subdomains
        const subs = new Set();
        certs.forEach(cert => {
            // Handle both name_value and common_name fields
            const names = [];
            if (cert.name_value) names.push(...cert.name_value.split('\n'));
            if (cert.common_name) names.push(cert.common_name);
            
            names.forEach(name => {
                const cleanName = name.trim().toLowerCase();
                if (cleanName.endsWith(`.${target.toLowerCase()}`) || cleanName === target.toLowerCase()) {
                    subs.add(cleanName);
                }
            });
        });

        // Send results
        if (subs.size === 0) {
            await sock.sendMessage(chatId, {
                text: `❌ No subdomains found for *${target}*.`
            }, { quoted: msg });
            await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
        } else {
            const subdomainsList = Array.from(subs).sort();
            // Split into chunks if too long (WhatsApp message limit)
            if (subdomainsList.join('\n').length > 4000) {
                const chunkSize = 50;
                for (let i = 0; i < subdomainsList.length; i += chunkSize) {
                    const chunk = subdomainsList.slice(i, i + chunkSize);
                    await sock.sendMessage(chatId, {
                        text: `📊 Subdomains for *${target}* (${i+1}-${Math.min(i+chunkSize, subdomainsList.length)}/${subdomainsList.length}):\n\`\`\`\n${chunk.join('\n')}\n\`\`\``
                    });
                }
            } else {
                await sock.sendMessage(chatId, {
                    text: `✅ Found *${subs.size}* subdomains for *${target}*:\n\`\`\`\n${subdomainsList.join('\n')}\n\`\`\``
                }, { quoted: msg });
            }
            await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
        }

    } catch (err) {
        console.error('Subenum error:', err);
        await sock.sendMessage(chatId, {
            text: `❌ Failed to enumerate subdomains for *${target}*: ${err.message}`
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// OCR (Image to Text)
if (command === 'ocr') {
    // Check if message is a quoted image
    const quotedMessage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

    if (!quotedMessage?.imageMessage) {
        await sock.sendMessage(chatId, { 
            text: `❌ Please quote an image to extract text.\nExample: Reply to an image with ${currentPrefix}ocr` 
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "👨‍💻", key: msg.key } });

    try {
        // Download the image
        const buffer = await downloadMediaMessage(
            { 
                message: { 
                    ...quotedMessage,
                    key: msg.key 
                } 
            }, 
            'buffer', 
            {}
        );

        if (!buffer) {
            throw new Error('Failed to download image');
        }

        // Create uploads directory if it doesn't exist
        const uploadDir = path.join(__dirname, '../uploads/upload');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const inputFilePath = path.join(uploadDir, `ocr-${Date.now()}.jpg`);
        fs.writeFileSync(inputFilePath, buffer);

        // Perform OCR
        const { data: { text } } = await Tesseract.recognize(inputFilePath, 'eng', {
            logger: m => console.log('OCR Progress:', m)
        });

        // Clean up the file
        fs.unlinkSync(inputFilePath);

        if (!text || text.trim().length === 0) {
            await sock.sendMessage(chatId, { 
                text: "❌ No text detected in the image." 
            }, { quoted: msg });
            await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
            return;
        }

        // Send the extracted text
        const cleanText = text.trim();
        await sock.sendMessage(chatId, { 
            text: `📝 *Extracted Text:*\n\n${cleanText}` 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
        
        console.log(`✅ OCR Text extracted: ${cleanText.substring(0, 100)}...`);

    } catch (error) {
        console.error('❌ OCR Error:', error);
        
        // Clean up file if it exists
        try {
            const inputFilePath = path.join(__dirname, '../uploads/upload/ocr-*.jpg');
            const files = fs.readdirSync(path.dirname(inputFilePath));
            files.forEach(file => {
                if (file.startsWith('ocr-')) {
                    fs.unlinkSync(path.join(path.dirname(inputFilePath), file));
                }
            });
        } catch (cleanupError) {
            console.log('Cleanup failed:', cleanupError);
        }

        await sock.sendMessage(chatId, { 
            text: `❌ Failed to extract text: ${error.message}` 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}
   
// Screenshot Websites (API Only)
if (command === 'ssweb') {
    if (args.length < 1) {
        return await sock.sendMessage(chatId, {
            text: `❌ Provide a domain. Example: \`${currentPrefix}ssweb google.com\``,
            quoted: msg
        });
    }

    const domain = args.join(' ').trim();
    await sock.sendMessage(chatId, { react: { text: "👨‍💻", key: msg.key } });

    try {
        // Add protocol if missing and validate domain
        let url = domain;
        if (!domain.startsWith('http')) {
            url = `https://${domain}`;
        }

        // Validate URL format
        try {
            new URL(url);
        } catch {
            await sock.sendMessage(chatId, {
                text: '❌ Invalid domain format. Use: google.com or https://example.com'
            }, { quoted: msg });
            await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
            return;
        }

        // Multiple free screenshot APIs with fallbacks
        const apiUrls = [
            `https://s0.wp.com/mshots/v1/${encodeURIComponent(url)}?w=800`,
            `https://image.thum.io/get/width/800/crop/600/${encodeURIComponent(url)}`,
            `https://api.screenshotmachine.com/?key=YOUR_FREE_KEY&url=${encodeURIComponent(url)}&dimension=1024x768`, // Get free key from screenshotmachine.com
            `https://screenshot-api.herokuapp.com/?url=${encodeURIComponent(url)}&width=800`
        ];

        let success = false;
        for (const apiUrl of apiUrls) {
            try {
                // Test if the API responds
                const response = await fetch(apiUrl, { method: 'HEAD' });
                if (response.ok) {
                    await sock.sendMessage(chatId, { 
                        image: { url: apiUrl },
                        caption: `🖥️ Desktop screenshot of ${domain}`
                    }, { quoted: msg });
                    success = true;
                    break;
                }
            } catch (apiError) {
                console.log(`API failed: ${apiUrl}`);
                continue;
            }
        }

        if (success) {
            await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
        } else {
            throw new Error('All screenshot services failed');
        }

    } catch (error) {
        console.error('Screenshot error:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ Failed to capture screenshot. Try:\n• Another domain\n• Adding https://\n• Waiting a few minutes' 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// Screenshot Mobile (API Only)
if (command === 'ssmobile') {
    if (args.length < 1) {
        return await sock.sendMessage(chatId, {
            text: `❌ Provide a domain. Example: \`${currentPrefix}ssmobile google.com\``,
            quoted: msg
        });
    }

    const domain = args.join(' ').trim();
    await sock.sendMessage(chatId, { react: { text: "👨‍💻", key: msg.key } });

    try {
        // Add protocol if missing and validate domain
        let url = domain;
        if (!domain.startsWith('http')) {
            url = `https://${domain}`;
        }

        // Validate URL format
        try {
            new URL(url);
        } catch {
            await sock.sendMessage(chatId, {
                text: '❌ Invalid domain format. Use: google.com or https://example.com'
            }, { quoted: msg });
            await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
            return;
        }

        // Multiple free mobile screenshot APIs
        const mobileApis = [
            `https://image.thum.io/get/width/375/crop/667/${encodeURIComponent(url)}`,
            `https://s0.wp.com/mshots/v1/${encodeURIComponent(url)}?w=375&h=667`,
            `https://api.screenshotmachine.com/?key=YOUR_FREE_KEY&url=${encodeURIComponent(url)}&dimension=375x667`,
            `https://screenshot-api.herokuapp.com/?url=${encodeURIComponent(url)}&width=375&height=667`
        ];

        let success = false;
        for (const apiUrl of mobileApis) {
            try {
                // Test if the API responds
                const response = await fetch(apiUrl, { method: 'HEAD' });
                if (response.ok) {
                    await sock.sendMessage(chatId, { 
                        image: { url: apiUrl },
                        caption: `📱 Mobile screenshot of ${domain}`
                    }, { quoted: msg });
                    success = true;
                    break;
                }
            } catch (apiError) {
                console.log(`Mobile API failed: ${apiUrl}`);
                continue;
            }
        }

        if (success) {
            await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
        } else {
            throw new Error('All mobile screenshot services failed');
        }

    } catch (error) {
        console.error('Mobile screenshot error:', error);
        await sock.sendMessage(chatId, {
            text: `❌ Failed to capture mobile screenshot. Try:\n• Another domain\n• Using desktop version\n• Waiting a few minutes`
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}
// Get Github Username Info
if (command === 'github') {
    const username = args.join(' ').trim();

    if (!username) {
        await sock.sendMessage(chatId, { 
            text: `❌ Usage: \`${currentPrefix}github username\`` 
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "👨‍💻", key: msg.key } });

    try {
        const octokit = new Octokit();
        const { data } = await octokit.rest.users.getByUsername({ username });

        const profilePic = data.avatar_url;
        const response = `👤 *GitHub Info for ${data.login}:*\n\n` +
            `📛 Name: ${data.name || 'N/A'}\n` +
            `🧠 Bio: ${data.bio || 'N/A'}\n` +
            `📍 Location: ${data.location || 'N/A'}\n` +
            `🏢 Company: ${data.company || 'N/A'}\n` +
            `📦 Repositories: ${data.public_repos}\n` +
            `📰 Gists: ${data.public_gists}\n` +
            `👥 Followers: ${data.followers}\n` +
            `👣 Following: ${data.following}\n` +
            `🌐 Blog: ${data.blog || 'N/A'}\n` +
            `📅 Joined: ${new Date(data.created_at).toDateString()}`;

        await sock.sendMessage(chatId, {
            image: { url: profilePic },
            caption: response
        }, { quoted: msg });

        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

    } catch (error) {
        console.error('❌ GitHub error:', error);
        await sock.sendMessage(chatId, {
            text: `❌ GitHub user "${username}" not found.`
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// Github-Roasting
if (command === 'github-roasting') {
    const username = args.join(' ').trim();

    if (!username) {
        await sock.sendMessage(chatId, {
            text: `❌ Usage: \`${currentPrefix}github-roasting username\``
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "👨‍💻", key: msg.key } });

    try {
        const octokit = new Octokit();
        const { data } = await octokit.rest.users.getByUsername({ username });

        const profilePic = data.avatar_url;
        const profileData = `*📂 GitHub Stats for ${data.login}:*\n\n` +
            `• 🧑‍💻 Name: ${data.name || 'Unknown'}\n` +
            `• 🧠 Bio: ${data.bio || 'Empty brain detected'}\n` +
            `• 🏙️ Location: ${data.location || 'Nowhere'}\n` +
            `• 🏢 Company: ${data.company || 'Unemployed 😂'}\n` +
            `• 🔥 Repositories: ${data.public_repos}\n` +
            `• ✍️ Gists: ${data.public_gists}\n` +
            `• 👥 Followers: ${data.followers}\n` +
            `• 🤝 Following: ${data.following}\n` +
            `• 🌍 Blog: ${data.blog || 'No blog. No thoughts.'}\n` +
            `• 📅 Joined: ${new Date(data.created_at).toDateString()}`;

        // This function should return a roasted message
        const roast = await GeminiRoastingMessage(profileData);

        await sock.sendMessage(chatId, {
            image: { url: profilePic },
            caption: roast
        }, { quoted: msg });

        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

    } catch (error) {
        console.error('❌ GitHub Roasting Error:', error);
        await sock.sendMessage(chatId, {
            text: `❌ GitHub user "${username}" not found.`
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// Anime command with AniList API - FIXED
if (command === 'anime') {
    const searchQuery = args.join(' ').trim();

    if (!searchQuery) {
        await sock.sendMessage(chatId, {
            text: `❌ Usage: \`${currentPrefix}anime <anime_name>\`\n\nExample: \`${currentPrefix}anime Naruto\``
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "🔍", key: msg.key } });

    try {
        const result = await AnimeVideo(searchQuery);
        
        let responseMessage = `*🎬 ${result.title}*\n`;
        
        // Add anime metadata
        if (result.score) {
            responseMessage += `⭐ Score: ${result.score}/100\n`;
        }
        if (result.status) {
            responseMessage += `📊 Status: ${result.status}\n`;
        }
        if (result.year) {
            responseMessage += `📅 Year: ${result.year}\n`;
        }
        if (result.genres && result.genres.length > 0) {
            responseMessage += `🏷️ Genres: ${result.genres.join(', ')}\n`;
        }
        
        responseMessage += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        responseMessage += `*📺 Streaming Sites:*\n\n`;
        
        // Display streaming sites (limit to 5 to avoid long messages)
        result.episodes.slice(0, 5).forEach((site, index) => {
            responseMessage += `*${site.epNo}. ${site.epTitle}*\n`;
            responseMessage += `🔗 ${site.videoUrl}\n`;
            if (site.note) {
                responseMessage += `💡 ${site.note}\n`;
            }
            
            if (index < Math.min(result.episodes.length, 5) - 1) {
                responseMessage += `\n`;
            }
        });

        // Add footer
        responseMessage += `\n━━━━━━━━━━━━━━━━━━━━━━\n`;
        if (result.totalEpisodes) {
            responseMessage += `⭐ Total Episodes: ${result.totalEpisodes}`;
        } else {
            responseMessage += `⭐ Info: Use links above to watch episodes`;
        }

        // Send as text message (more reliable)
        await sock.sendMessage(chatId, {
            text: responseMessage
        }, { quoted: msg });

        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

    } catch (error) {
        console.error('Anime command error:', error);
        
        let errorMessage = `❌ ${error.message}`;
        
        if (error.message.includes('timeout')) {
            errorMessage = '❌ Request timeout. AniList service is busy. Please try again.';
        } else if (error.message.includes('network') || error.message.includes('ENOTFOUND')) {
            errorMessage = '❌ Network error. Please check your internet connection.';
        } else if (error.message.includes('No anime found')) {
            errorMessage = `❌ No anime found for "*${searchQuery}*"\n\n💡 Suggestions:\n• Check spelling\n• Use English titles\n• Try popular anime names`;
        }
        
        await sock.sendMessage(chatId, {
            text: errorMessage
        }, { quoted: msg });
        
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// Detik Search Article
if (command === 'detik-search') {
    const query = args.join(' ').trim();

    if (!query) {
        await sock.sendMessage(chatId, {
            text: `❌ Usage: \`${currentPrefix}detik-search berita hari ini\``
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "👨‍💻", key: msg.key } });

    try {
        const articles = await DetikNews(query);

        if (!articles || articles.length === 0) {
            await sock.sendMessage(chatId, {
                text: `❌ No articles found for "${query}".`
            }, { quoted: msg });
            await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
            return;
        }

        // Limit to 5 articles to avoid long messages
        const limitedArticles = articles.slice(0, 5);
        const responseText = limitedArticles
            .map((article, index) => `*${index + 1}. ${article.title}*\n🔗 ${article.url}`)
            .join('\n\n');

        await sock.sendMessage(chatId, { text: responseText }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

    } catch (error) {
        console.error('❌ Detik News Error:', error);
        await sock.sendMessage(chatId, {
            text: `❌ Failed to search Detik: ${error.message}`
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// Detik News Article
if (command === 'detik-article') {
    await sock.sendMessage(chatId, { react: { text: "👨‍💻", key: msg.key } });

    try {
        const articles = await DetikLatest();

        if (!articles || articles.length === 0) {
            await sock.sendMessage(chatId, { 
                text: '❌ No news articles found.' 
            }, { quoted: msg });
            await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
            return;
        }

        // Limit to 5 articles
        const limitedArticles = articles.slice(0, 5);
        const responseText = limitedArticles
            .map((article, index) => `*${index + 1}. ${article.title}*\n🔗 ${article.url}`)
            .join('\n\n');

        await sock.sendMessage(chatId, { text: responseText }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
        
    } catch (error) {
        console.error('❌ Detik Article Error:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ Failed to fetch Detik articles: ${error.message}` 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}
// ==============================================
// 🔹DOWNLOAD COMMANDS
// ==============================================

// Twitter Video to MP4
if (command === 'tw-mp4') {
    const url = args.join(' ').trim();

    if (!url || !url.startsWith('http')) {
        await sock.sendMessage(chatId, {
            text: `❌ Invalid or missing Twitter URL.\n\nExample: \`${currentPrefix}tw-mp4 https://twitter.com/...\``
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "👨‍💻", key: msg.key } });

    try {
        // Create uploads directory if it doesn't exist
        const uploadsDir = path.join(__dirname, "../uploads");
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const outputFilePath = path.join(uploadsDir, `twdl-video-${Date.now()}.mp4`);
        await TwitterVideo(url, outputFilePath);

        // Check if file was created
        if (!fs.existsSync(outputFilePath)) {
            throw new Error('Downloaded file not found');
        }

        await sock.sendMessage(chatId, {
            video: fs.readFileSync(outputFilePath),
            caption: "📥 Here's your Twitter video!"
        }, { quoted: msg });

        console.log(`✅ Twitter video sent: ${outputFilePath}`);
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

        // Clean up
        fs.unlinkSync(outputFilePath);

    } catch (error) {
        console.error('❌ Twitter Download Error:', error);
        await sock.sendMessage(chatId, {
            text: `❌ Failed to download Twitter video.\n\nError: ${error.message}`
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// Twitter Video to MP3
if (command === "twdl-mp3") {
    const url = args.join(' ').trim();

    if (!url || !url.startsWith('http')) {
        await sock.sendMessage(chatId, {
            text: `❌ Invalid or missing Twitter URL.\n\nExample: \`${currentPrefix}twdl-mp3 https://twitter.com/...\``
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "👨‍💻", key: msg.key } });

    try {
        const uploadsDir = path.join(__dirname, "../uploads");
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const outputFilePath = path.join(uploadsDir, `twdl-audio-${Date.now()}.mp3`);
        await TwitterAudio(url, outputFilePath);

        if (!fs.existsSync(outputFilePath)) {
            throw new Error('Downloaded file not found');
        }

        await sock.sendMessage(chatId, { 
            audio: fs.readFileSync(outputFilePath), 
            mimetype: 'audio/mp4' 
        }, { quoted: msg });
        
        console.log(`✅ Twitter audio sent: ${outputFilePath}`);
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

        fs.unlinkSync(outputFilePath);
    } catch (error) {
        console.error('❌ Twitter Audio Error:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ Failed to download Twitter audio: ${error.message}` 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// Instagram Video to MP4
if (command === "igdl-mp4") {
    const url = args.join(' ').trim();

    if (!url || !url.startsWith('http')) {
        await sock.sendMessage(chatId, {
            text: `❌ Invalid or missing Instagram URL.\n\nExample: \`${currentPrefix}igdl-mp4 https://instagram.com/...\``
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "👨‍💻", key: msg.key } });

    try {
        const uploadsDir = path.join(__dirname, "../uploads");
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const outputFilePath = path.join(uploadsDir, `igdl-video-${Date.now()}.mp4`);
        await InstagramVideo(url, outputFilePath);

        if (!fs.existsSync(outputFilePath)) {
            throw new Error('Downloaded file not found');
        }

        await sock.sendMessage(chatId, { 
            video: fs.readFileSync(outputFilePath), 
            caption: "📥 Here's your Instagram video!" 
        }, { quoted: msg });
        
        console.log(`✅ Instagram video sent: ${outputFilePath}`);
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

        fs.unlinkSync(outputFilePath);
    } catch (error) {
        console.error('❌ Instagram Video Error:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ Failed to download Instagram video: ${error.message}` 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// Instagram Video to MP3
if (command === "igdl-mp3") {
    const url = args.join(' ').trim();

    if (!url || !url.startsWith('http')) {
        await sock.sendMessage(chatId, {
            text: `❌ Invalid or missing Instagram URL.\n\nExample: \`${currentPrefix}igdl-mp3 https://instagram.com/...\``
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "👨‍💻", key: msg.key } });

    try {
        const uploadsDir = path.join(__dirname, "../uploads");
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const outputFilePath = path.join(uploadsDir, `igdl-audio-${Date.now()}.mp3`);
        await InstagramAudio(url, outputFilePath);

        if (!fs.existsSync(outputFilePath)) {
            throw new Error('Downloaded file not found');
        }

        await sock.sendMessage(chatId, { 
            audio: fs.readFileSync(outputFilePath), 
            mimetype: 'audio/mp4' 
        }, { quoted: msg });
        
        console.log(`✅ Instagram audio sent: ${outputFilePath}`);
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

        fs.unlinkSync(outputFilePath);
    } catch (error) {
        console.error('❌ Instagram Audio Error:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ Failed to download Instagram audio: ${error.message}` 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// TikTok Video to MP4
if (command === "tkdl-mp4") {
    const url = args.join(' ').trim();

    if (!url || !url.startsWith('http')) {
        await sock.sendMessage(chatId, {
            text: `❌ Invalid or missing TikTok URL.\n\nExample: \`${currentPrefix}tkdl-mp4 https://tiktok.com/...\``
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "👨‍💻", key: msg.key } });

    try {
        const uploadsDir = path.join(__dirname, "../uploads");
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const outputFilePath = path.join(uploadsDir, `tkdl-video-${Date.now()}.mp4`);
        await TikTokVideo(url, outputFilePath);

        if (!fs.existsSync(outputFilePath)) {
            throw new Error('Downloaded file not found');
        }

        await sock.sendMessage(chatId, { 
            video: fs.readFileSync(outputFilePath), 
            caption: "📥 Here's your TikTok video!" 
        }, { quoted: msg });
        
        console.log(`✅ TikTok video sent: ${outputFilePath}`);
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

        fs.unlinkSync(outputFilePath);
    } catch (error) {
        console.error('❌ TikTok Video Error:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ Failed to download TikTok video: ${error.message}` 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// TikTok Video to MP3
if (command === "tkdl-mp3") {
    const url = args.join(' ').trim();

    if (!url || !url.startsWith('http')) {
        await sock.sendMessage(chatId, {
            text: `❌ Invalid or missing TikTok URL.\n\nExample: \`${currentPrefix}tkdl-mp3 https://tiktok.com/...\``
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "👨‍💻", key: msg.key } });

    try {
        const uploadsDir = path.join(__dirname, "../uploads");
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const outputFilePath = path.join(uploadsDir, `tkdl-audio-${Date.now()}.mp3`);
        await TikTokAudio(url, outputFilePath);

        if (!fs.existsSync(outputFilePath)) {
            throw new Error('Downloaded file not found');
        }

        await sock.sendMessage(chatId, { 
            audio: fs.readFileSync(outputFilePath), 
            mimetype: 'audio/mp4' 
        }, { quoted: msg });
        
        console.log(`✅ TikTok audio sent: ${outputFilePath}`);
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

        fs.unlinkSync(outputFilePath);
    } catch (error) {
        console.error('❌ TikTok Audio Error:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ Failed to download TikTok audio: ${error.message}` 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// Vimeo Video to MP4
if (command === "vmdl-mp4") {
    const url = args.join(' ').trim();

    if (!url || !url.startsWith('http')) {
        await sock.sendMessage(chatId, {
            text: `❌ Invalid or missing Vimeo URL.\n\nExample: \`${currentPrefix}vmdl-mp4 https://vimeo.com/...\``
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "👨‍💻", key: msg.key } });

    try {
        const uploadsDir = path.join(__dirname, "../uploads");
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const outputFilePath = path.join(uploadsDir, `vmdl-video-${Date.now()}.mp4`);
        await VimeoVideo(url, outputFilePath);

        if (!fs.existsSync(outputFilePath)) {
            throw new Error('Downloaded file not found');
        }

        await sock.sendMessage(chatId, { 
            video: fs.readFileSync(outputFilePath), 
            caption: "📥 Here's your Vimeo video!" 
        }, { quoted: msg });
        
        console.log(`✅ Vimeo video sent: ${outputFilePath}`);
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

        fs.unlinkSync(outputFilePath);
    } catch (error) {
        console.error('❌ Vimeo Video Error:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ Failed to download Vimeo video: ${error.message}` 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// Vimeo Video to MP3
if (command === "vmdl-mp3") {
    const url = args.join(' ').trim();

    if (!url || !url.startsWith('http')) {
        await sock.sendMessage(chatId, {
            text: `❌ Invalid or missing Vimeo URL.\n\nExample: \`${currentPrefix}vmdl-mp3 https://vimeo.com/...\``
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "👨‍💻", key: msg.key } });

    try {
        const uploadsDir = path.join(__dirname, "../uploads");
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const outputFilePath = path.join(uploadsDir, `vmdl-audio-${Date.now()}.mp3`);
        await VimeoAudio(url, outputFilePath);

        if (!fs.existsSync(outputFilePath)) {
            throw new Error('Downloaded file not found');
        }

        await sock.sendMessage(chatId, { 
            audio: fs.readFileSync(outputFilePath), 
            mimetype: 'audio/mp4' 
        }, { quoted: msg });
        
        console.log(`✅ Vimeo audio sent: ${outputFilePath}`);
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

        fs.unlinkSync(outputFilePath);
    } catch (error) {
        console.error('❌ Vimeo Audio Error:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ Failed to download Vimeo audio: ${error.message}` 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// Facebook Video to MP4
if (command === "fb-mp4") {
    const url = args.join(' ').trim();

    if (!url || !url.startsWith('http')) {
        await sock.sendMessage(chatId, {
            text: `❌ Invalid or missing Facebook URL.\n\nExample: \`${currentPrefix}fbdl-mp4 https://facebook.com/...\``
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "👨‍💻", key: msg.key } });

    try {
        const uploadsDir = path.join(__dirname, "../uploads");
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const outputFilePath = path.join(uploadsDir, `fbdl-video-${Date.now()}.mp4`);
        await FacebookVideo(url, outputFilePath);

        if (!fs.existsSync(outputFilePath)) {
            throw new Error('Downloaded file not found');
        }

        await sock.sendMessage(chatId, { 
            video: fs.readFileSync(outputFilePath), 
            caption: "📥 Here's your Facebook video!" 
        }, { quoted: msg });
        
        console.log(`✅ Facebook video sent: ${outputFilePath}`);
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

        fs.unlinkSync(outputFilePath);
    } catch (error) {
        console.error('❌ Facebook Video Error:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ Failed to download Facebook video: ${error.message}` 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// Facebook Video to MP3
if (command === "fbdl-mp3") {
    const url = args.join(' ').trim();

    if (!url || !url.startsWith('http')) {
        await sock.sendMessage(chatId, {
            text: `❌ Invalid or missing Facebook URL.\n\nExample: \`${currentPrefix}fbdl-mp3 https://facebook.com/...\``
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "👨‍💻", key: msg.key } });

    try {
        const uploadsDir = path.join(__dirname, "../uploads");
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const outputFilePath = path.join(uploadsDir, `fbdl-audio-${Date.now()}.mp3`);
        await FacebookAudio(url, outputFilePath);

        if (!fs.existsSync(outputFilePath)) {
            throw new Error('Downloaded file not found');
        }

        await sock.sendMessage(chatId, { 
            audio: fs.readFileSync(outputFilePath), 
            mimetype: 'audio/mp4' 
        }, { quoted: msg });
        
        console.log(`✅ Facebook audio sent: ${outputFilePath}`);
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

        fs.unlinkSync(outputFilePath);
    } catch (error) {
        console.error('❌ Facebook Audio Error:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ Failed to download Facebook audio: ${error.message}` 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// Play Music - Koyeb Compatible Version
if (command === "play") {
    let query = args.join(" ");

    if (!query) {
        await sock.sendMessage(chatId, { text: "❌ Please provide a search query.\nExample: \\play song name" }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "👨‍💻", key: msg.key } });

    try {
        // Create upload directory
        const uploadDir = path.join(__dirname, "upload");
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        // Step 1: Search for video using play-dl
        console.log('🔍 Searching for:', query);
        const results = await playdl.search(query, { limit: 1 });
        if (!results || results.length === 0) {
            await sock.sendMessage(chatId, { text: "❌ Song not found. Try a different search term." }, { quoted: msg });
            return;
        }

        const video = results[0];
        const videoUrl = video.url;
        
        console.log('🎯 Found video:', video.title, 'URL:', videoUrl);

        // Step 2: Extract video details
        const videoDetails = {
            title: video.title,
            durationRaw: video.durationRaw,
            views: video.views,
            uploadedAt: video.uploadedAt,
            thumbnails: video.thumbnails,
            url: videoUrl
        };

        // Format duration
        const formatDuration = (durationRaw) => {
            if (!durationRaw) return "Unknown";
            const parts = durationRaw.split(':');
            if (parts.length === 2) {
                return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
            } else if (parts.length === 3) {
                return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}:${parts[2].padStart(2, '0')}`;
            }
            return durationRaw;
        };

        // Calculate time ago
        const getTimeAgo = (uploadedAt) => {
            if (!uploadedAt) return "Unknown";
            
            let uploadDate;
            try {
                uploadDate = new Date(uploadedAt);
                if (isNaN(uploadDate.getTime())) {
                    return "Unknown";
                }
            } catch (e) {
                return "Unknown";
            }
            
            const now = new Date();
            const diffTime = Math.abs(now - uploadDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays < 1) return "Today";
            if (diffDays === 1) return "1 day ago";
            if (diffDays < 7) return `${diffDays} days ago`;
            if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
            if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
            return `${Math.floor(diffDays / 365)} years ago`;
        };

        const formattedDuration = formatDuration(videoDetails.durationRaw);
        const timeAgo = getTimeAgo(videoDetails.uploadedAt);
        const views = videoDetails.views ? 
            (typeof videoDetails.views === 'number' ? 
                videoDetails.views.toLocaleString() : 
                videoDetails.views) 
            : "Unknown";

        // Step 3: Try to download and send thumbnail
        let thumbnailSent = false;
        try {
            if (video.thumbnails && video.thumbnails.length > 0) {
                const thumbnailUrl = video.thumbnails[video.thumbnails.length - 1].url;
                console.log('🖼️ Downloading thumbnail...');
                
                const thumbnailResponse = await axios.get(thumbnailUrl, { 
                    responseType: 'arraybuffer',
                    timeout: 10000 
                });
                const thumbnailBuffer = Buffer.from(thumbnailResponse.data, 'binary');
                
                const caption = `🎶 *DESIRE-EXE MUSIC PLAYER*\n\n` +
                    `🎵 *Title:* ${videoDetails.title}\n` +
                    `👀 *Views:* ${views}\n` +
                    `⏱️ *Duration:* ${formattedDuration}\n` +
                    `📅 *Uploaded:* ${timeAgo}\n` +
                    `🔗 *URL:* ${videoUrl}\n\n` +
                    `⬇️ *Downloading audio...*`;

                await sock.sendMessage(chatId, {
                    image: thumbnailBuffer,
                    caption: caption
                }, { quoted: msg });
                thumbnailSent = true;
                console.log('✅ Thumbnail sent');
            }
        } catch (thumbError) {
            console.log('❌ Thumbnail failed, sending text only:', thumbError.message);
        }

        // Send text version if thumbnail failed
        if (!thumbnailSent) {
            const caption = `🎶 *DESIRE-EXE MUSIC PLAYER*\n\n` +
                `🎵 *Title:* ${videoDetails.title}\n` +
                `👀 *Views:* ${views}\n` +
                `⏱️ *Duration:* ${formattedDuration}\n` +
                `📅 *Uploaded:* ${timeAgo}\n` +
                `🔗 *URL:* ${videoUrl}\n\n` +
                `⬇️ *Downloading audio...*`;

            await sock.sendMessage(chatId, { 
                text: caption 
            }, { quoted: msg });
        }

        await sock.sendMessage(chatId, { react: { text: "⬇️", key: msg.key } });

        // Step 4: Download audio using Koyeb-optimized method
        const outputPath = path.join(uploadDir, `audio-${Date.now()}.mp3`);
        
        console.log('📥 Downloading audio with yt-dlp...');
        
        // Koyeb-optimized download settings
        await ytExec(videoUrl, {
            extractAudio: true,
            audioFormat: 'mp3',
            audioQuality: 0,
            output: outputPath,
            noCheckCertificates: true,
            noWarnings: true,
            forceIpv4: true,
            userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            referer: 'https://www.youtube.com/',
            retries: 5,
            fragmentRetries: 5,
            timeout: '300000', // 5 minutes
            socketTimeout: '300000',
            noPart: true,
            noMtime: true,
            noOverwrites: true
        });

        // Check if file was created
        if (!fs.existsSync(outputPath)) {
            throw new Error('Download failed - no output file created');
        }

        const stats = fs.statSync(outputPath);
        console.log('✅ Download completed. File size:', stats.size, 'bytes');

        // Check file size (50MB limit)
        if (stats.size > 50 * 1024 * 1024) {
            fs.unlinkSync(outputPath);
            await sock.sendMessage(chatId, { text: "❌ File is too large to send (max 50MB)." }, { quoted: msg });
            return;
        }

        // Check if file is too small (likely corrupted)
        if (stats.size < 1024) {
            fs.unlinkSync(outputPath);
            throw new Error('Download failed - file too small (likely corrupted)');
        }

        await sock.sendMessage(chatId, { react: { text: "🎶", key: msg.key } });

        // Step 5: Send audio file
        console.log('📤 Sending audio file...');
        
        // Clean filename for sending
        const cleanFileName = `${videoDetails.title.substring(0, 50).replace(/[^\w\s.-]/gi, '')}.mp3`;
        
        await sock.sendMessage(chatId, {
            audio: fs.readFileSync(outputPath),
            mimetype: 'audio/mpeg',
            fileName: cleanFileName,
            ptt: false
        }, { quoted: msg });

        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
        console.log('🎉 Audio sent successfully!');

        // Cleanup
        try {
            fs.unlinkSync(outputPath);
            console.log('🧹 Cleaned up temporary file');
        } catch (cleanupError) {
            console.log('⚠️ Could not delete temp file:', cleanupError.message);
        }

    } catch (err) {
        console.error('❌ Play command error:', err);
        
        let errorMsg = "❌ Download failed: ";
        
        if (err.message.includes('Sign in to confirm')) {
            errorMsg = "❌ YouTube blocked the request. Try again in a few minutes or use a different video.";
        } else if (err.message.includes('timeout')) {
            errorMsg = "❌ Download timed out. Please try again.";
        } else if (err.message.includes('not found')) {
            errorMsg = "❌ Video not found or unavailable.";
        } else if (err.message.includes('too large')) {
            errorMsg = "❌ File is too large to send (max 50MB).";
        } else if (err.message.includes('Python')) {
            errorMsg = "❌ Server configuration error. Please contact administrator.";
        } else {
            errorMsg += err.message;
        }
        
        await sock.sendMessage(chatId, { text: errorMsg }, { quoted: msg });
        
        // Cleanup on error
        try {
            const uploadDir = path.join(__dirname, "upload");
            const files = fs.readdirSync(uploadDir);
            for (const file of files) {
                if (file.startsWith('audio-')) {
                    fs.unlinkSync(path.join(uploadDir, file));
                }
            }
        } catch (cleanupError) {
            console.log('Cleanup failed:', cleanupError.message);
        }
    }
}

if (command === "play") {
    let query = args.join(" ");

    if (!query) {
        await sock.sendMessage(chatId, { 
            text: `❌ Please provide a search query.\nExample: \\${currentPrefix}play song name` 
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "👨‍💻", key: msg.key } });

    try {
        // Create upload directory
        const uploadDir = path.join(__dirname, "../uploads");
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        // Step 1: Search for video using play-dl
        console.log('🔍 Searching for:', query);
        const results = await playdl.search(query, { limit: 1 });
        if (!results || results.length === 0) {
            await sock.sendMessage(chatId, { 
                text: "❌ Song not found. Try a different search term." 
            }, { quoted: msg });
            await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
            return;
        }

        const video = results[0];
        const videoUrl = video.url;
        
        console.log('🎯 Found video:', video.title, 'URL:', videoUrl);

        // Step 2: Get video info for thumbnail and upload date
        const videoInfo = await playdl.video_info(videoUrl);
        const videoDetails = videoInfo.video_details;

        // Get thumbnail URL
        const thumbnails = videoDetails.thumbnails || [];
        const thumbnailUrl = thumbnails.length > 0 ? 
            thumbnails[thumbnails.length - 1].url : 
            `https://img.youtube.com/vi/${videoDetails.id}/maxresdefault.jpg`;

        // Format duration
        const formatDuration = (durationRaw) => {
            if (!durationRaw) return "00:00";
            const parts = durationRaw.split(':');
            if (parts.length === 2) {
                return `00:${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
            } else if (parts.length === 3) {
                return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}:${parts[2].padStart(2, '0')}`;
            }
            return durationRaw;
        };

        // Calculate time ago
        const getTimeAgo = (uploadedAt) => {
            if (!uploadedAt) return "Unknown";
            const uploadDate = new Date(uploadedAt);
            const now = new Date();
            const diffTime = Math.abs(now - uploadDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays < 1) return "Today";
            if (diffDays === 1) return "1 day ago";
            if (diffDays < 7) return `${diffDays} days ago`;
            if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
            if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
            return `${Math.floor(diffDays / 365)} years ago`;
        };

        const formattedDuration = formatDuration(videoDetails.durationRaw);
        const timeAgo = getTimeAgo(videoDetails.uploadedAt);
        const views = videoDetails.views ? videoDetails.views.toLocaleString() : "Unknown";

        // Step 3: Send thumbnail as image with caption
        const caption = `🎶 *DESIRE-EXE MUSIC PLAYER*\n\n` +
            `📛 *Title:* ${videoDetails.title}\n` +
            `👀 *Views:* ${views}\n` +
            `⏱️ *Duration:* ${formattedDuration}\n` +
            `📅 *Uploaded:* ${timeAgo}\n` +
            `🔗 *URL:* ${videoUrl}\n\n` +
            `_Powered by Desire eXe_`;

        // Send thumbnail image with your caption
        await sock.sendMessage(chatId, { 
            image: { url: thumbnailUrl },
            caption: caption
        }, { quoted: msg });

        await sock.sendMessage(chatId, { react: { text: "⬇️", key: msg.key } });

        // Step 4: Download using yt-dlp
        const outputPath = path.join(uploadDir, `audio-${Date.now()}.mp3`);
        
        console.log('📥 Downloading audio with yt-dlp...');
        
        await ytExec(videoUrl, {
            extractAudio: true,
            audioFormat: 'mp3',
            audioQuality: 0,
            output: outputPath,
            noCheckCertificates: true,
            noWarnings: true,
            preferFreeFormats: true,
            addHeader: ['referer:youtube.com', 'user-agent:googlebot']
        });

        // Check if file was created
        if (!fs.existsSync(outputPath)) {
            throw new Error('Download failed - no output file created');
        }

        const stats = fs.statSync(outputPath);
        console.log('✅ Download completed. File size:', stats.size, 'bytes');

        // WhatsApp has ~16MB limit for audio files
        if (stats.size > 16 * 1024 * 1024) {
            fs.unlinkSync(outputPath);
            await sock.sendMessage(chatId, { 
                text: "❌ Audio file is too large for WhatsApp (max 16MB)." 
            }, { quoted: msg });
            await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
            return;
        }

        await sock.sendMessage(chatId, { react: { text: "🎶", key: msg.key } });

        // Step 5: Send audio file
        console.log('📤 Sending audio file...');
        await sock.sendMessage(chatId, {
            audio: fs.readFileSync(outputPath),
            mimetype: 'audio/mpeg',
            fileName: `${videoDetails.title.substring(0, 50).replace(/[^\w\s.-]/gi, '')}.mp3`
        }, { quoted: msg });

        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
        console.log('🎉 Audio sent successfully!');

        // Cleanup
        fs.unlinkSync(outputPath);

    } catch (err) {
        console.error('❌ Play command error:', err);
        
        let errorMsg = "❌ An error occurred while downloading: ";
        if (err.message.includes('Python')) {
            errorMsg += "Python/yt-dlp not configured properly.";
        } else if (err.message.includes('not found')) {
            errorMsg += "Song not found.";
        } else if (err.message.includes('too large')) {
            errorMsg += "File is too large for WhatsApp.";
        } else {
            errorMsg += err.message;
        }
        
        await sock.sendMessage(chatId, { text: errorMsg }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}
// Download Video
if (command === "video") {
    let query = args.join(" ");

    if (!query) {
        await sock.sendMessage(chatId, { 
            text: `❌ Please provide a search query.\nExample: \\${currentPrefix}video search term` 
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "👨‍💻", key: msg.key } });

    try {
        // Create upload directory
        const uploadDir = path.join(__dirname, "../uploads");
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        // Step 1: Search for video using play-dl
        console.log('🔍 Searching for video:', query);
        const results = await playdl.search(query, { limit: 1 });
        if (!results || results.length === 0) {
            await sock.sendMessage(chatId, { 
                text: "❌ Video not found. Try a different search term." 
            }, { quoted: msg });
            await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
            return;
        }

        const video = results[0];
        const videoUrl = video.url;
        
        console.log('🎯 Found video:', video.title, 'URL:', videoUrl);

        // Step 2: Get video info
        const videoInfo = await playdl.video_info(videoUrl);
        const videoDetails = videoInfo.video_details;

        // Get thumbnail URL
        const thumbnails = videoDetails.thumbnails || [];
        const thumbnailUrl = thumbnails.length > 0 ? 
            thumbnails[thumbnails.length - 1].url : 
            `https://img.youtube.com/vi/${videoDetails.id}/maxresdefault.jpg`;

        // Check video duration (avoid long videos that will be too large)
        const durationInSeconds = videoDetails.durationInSec || 0;
        if (durationInSeconds > 600) { // 10 minutes
            await sock.sendMessage(chatId, { 
                text: "❌ Video is too long (over 10 minutes). Try a shorter video." 
            }, { quoted: msg });
            await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
            return;
        }

        // Format duration
        const formatDuration = (durationRaw) => {
            if (!durationRaw) return "00:00";
            const parts = durationRaw.split(':');
            if (parts.length === 2) {
                return `00:${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
            } else if (parts.length === 3) {
                return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}:${parts[2].padStart(2, '0')}`;
            }
            return durationRaw;
        };

        // Calculate time ago
        const getTimeAgo = (uploadedAt) => {
            if (!uploadedAt) return "Unknown";
            const uploadDate = new Date(uploadedAt);
            const now = new Date();
            const diffTime = Math.abs(now - uploadDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays < 1) return "Today";
            if (diffDays === 1) return "1 day ago";
            if (diffDays < 7) return `${diffDays} days ago`;
            if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
            if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
            return `${Math.floor(diffDays / 365)} years ago`;
        };

        const formattedDuration = formatDuration(videoDetails.durationRaw);
        const timeAgo = getTimeAgo(videoDetails.uploadedAt);
        const views = videoDetails.views ? videoDetails.views.toLocaleString() : "Unknown";

        // Step 3: Send thumbnail as image with caption
        const caption = `🎥 *DESIRE-EXE VIDEO DOWNLOADER*\n\n` +
            `📛 *Title:* ${videoDetails.title}\n` +
            `👀 *Views:* ${views}\n` +
            `⏱️ *Duration:* ${formattedDuration}\n` +
            `📅 *Uploaded:* ${timeAgo}\n` +
            `🔗 *URL:* ${videoUrl}\n\n` +
            `_Powered by Desire-eXe_`;

        // Send thumbnail image with caption
        await sock.sendMessage(chatId, { 
            image: { url: thumbnailUrl },
            caption: caption
        }, { quoted: msg });

        await sock.sendMessage(chatId, { react: { text: "⬇️", key: msg.key } });

        // Step 4: Download video using yt-dlp with optimized format selection
        const outputPath = path.join(uploadDir, `video-${Date.now()}.mp4`);
        
        console.log('📥 Downloading video with yt-dlp...');
        
        // Optimized format selection for WhatsApp compatibility
        const formatOptions = [
            'best[height<=360][filesize<16M]',  // Best 360p under 16MB
            'best[height<=480][filesize<16M]',  // Best 480p under 16MB
            'best[height<=360]',                // Best 360p (any size)
            'best[height<=480]',                // Best 480p (any size)
            'best[height<=720][filesize<32M]',  // Best 720p under 32MB
            'best[height<=720]',                // Best 720p (any size)
            'worst[height>=144]',               // Smallest file, min 144p
            'best'                              // Best available
        ];

        let downloadSuccess = false;
        let lastError = null;
        let selectedFormat = '';

        for (const format of formatOptions) {
            try {
                console.log(`🔄 Trying format: ${format}`);
                
                // Clear any existing file
                if (fs.existsSync(outputPath)) {
                    fs.unlinkSync(outputPath);
                }
                
                await ytExec(videoUrl, {
                    format: format,
                    output: outputPath,
                    noCheckCertificates: true,
                    noWarnings: true,
                    preferFreeFormats: true,
                    addHeader: ['referer:youtube.com', 'user-agent:googlebot']
                });

                // Check if file was created and has content
                if (fs.existsSync(outputPath)) {
                    const stats = fs.statSync(outputPath);
                    if (stats.size > 0) {
                        console.log(`✅ Download completed with format: ${format}. File size:`, stats.size, 'bytes');
                        
                        selectedFormat = format;
                        downloadSuccess = true;
                        break;
                    } else {
                        // Delete empty file and try next format
                        fs.unlinkSync(outputPath);
                    }
                }
            } catch (formatError) {
                console.log(`❌ Format failed (${format}):`, formatError.message);
                lastError = formatError;
                // Continue to next format
            }
        }

        if (!downloadSuccess) {
            throw new Error(lastError?.message || 'All format options failed');
        }

        const stats = fs.statSync(outputPath);
        console.log('✅ Final video size:', stats.size, 'bytes');

        // WhatsApp has ~16MB limit for videos, but we'll try for larger files
        if (stats.size > 16 * 1024 * 1024) {
            console.log('⚠️ Video is large but will attempt to send...');
        }

        await sock.sendMessage(chatId, { react: { text: "🎥", key: msg.key } });

        // Step 5: Send video file with optimized settings
        console.log('📤 Sending video file...');
        try {
            await sock.sendMessage(chatId, {
                video: fs.readFileSync(outputPath),
                caption: `🎥 *${videoDetails.title}*\n\n` +
                        `💾 *Size:* ${(stats.size / (1024 * 1024)).toFixed(2)}MB\n` +
                        `⏱️ *Duration:* ${formattedDuration}\n\n`,
                fileName: `${videoDetails.title.substring(0, 40).replace(/[^\w\s.-]/gi, '')}.mp4`,
                mimetype: 'video/mp4'
            }, { quoted: msg });

            await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
            console.log('🎉 Video sent successfully!');
        } catch (sendError) {
            console.error('❌ Failed to send video:', sendError);
            
            if (sendError.message.includes('too large') || sendError.message.includes('size')) {
                await sock.sendMessage(chatId, { 
                    text: `❌ Video is too large (${(stats.size / (1024 * 1024)).toFixed(2)}MB). WhatsApp limit is ~16MB.\n\nTry a shorter video or use the audio command instead.` 
                }, { quoted: msg });
            } else {
                await sock.sendMessage(chatId, { 
                    text: "❌ Failed to send video. The file might be corrupted or too large." 
                }, { quoted: msg });
            }
            await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
        }

        // Cleanup
        if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
        }

    } catch (err) {
        console.error('❌ Video command error:', err);
        
        let errorMsg = "❌ Failed to download video: ";
        if (err.message.includes('Requested format is not available')) {
            errorMsg += "Video format not supported. Try a different video.";
        } else if (err.message.includes('Private video')) {
            errorMsg += "This video is private or unavailable.";
        } else if (err.message.includes('Sign in to confirm')) {
            errorMsg += "This video is age-restricted and cannot be downloaded.";
        } else if (err.message.includes('too long')) {
            errorMsg += "Video is too long. Try a video under 10 minutes.";
        } else if (err.message.includes('All format options failed')) {
            errorMsg += "Could not find a suitable video format. Try a different video.";
        } else {
            errorMsg += err.message;
        }
        
        await sock.sendMessage(chatId, { text: errorMsg }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}
	// Translation Command
if (command === 'tr') {
    const targetLang = args[0]?.toLowerCase();
    const text = args.slice(1).join(' ');

    if (!targetLang || !text) {
        await sock.sendMessage(chatId, { 
            text: `❌ *Usage:* \\${currentPrefix}tr <language_code> <text>\n\n*Common Languages:*\n• \\${currentPrefix}tr en Hello World (English)\n• \\${currentPrefix}tr es Hola Mundo (Spanish)\n• \\${currentPrefix}tr fr Bonjour (French)\n• \\${currentPrefix}tr de Hallo (German)\n• \\${currentPrefix}tr it Ciao (Italian)\n• \\${currentPrefix}tr pt Olá (Portuguese)\n• \\${currentPrefix}tr ru Привет (Russian)\n• \\${currentPrefix}tr ar مرحبا (Arabic)\n• \\${currentPrefix}tr hi नमस्ते (Hindi)\n• \\${currentPrefix}tr zh 你好 (Chinese)\n• \\${currentPrefix}tr ja こんにちは (Japanese)\n• \\${currentPrefix}tr ko 안녕하세요 (Korean)\n\n*Full list:* https://cloud.google.com/translate/docs/languages` 
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "🌐", key: msg.key } });

    try {
        const translatedText = await Translate(text, targetLang);
        
        const responseMessage = `🌐 *Translation*\n\n*Original:* ${text}\n*Target:* ${targetLang.toUpperCase()}\n\n*Translated:* ${translatedText}`;

        await sock.sendMessage(chatId, { text: responseMessage }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

    } catch (error) {
        console.error('Translation Error:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ Translation failed: ${error.message}\n\n💡 *Possible issues:*\n• Invalid language code\n• Text too long\n• Translation service unavailable` 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// Quick Translate to Common Languages
if (command === 'qtr') {
    const text = args.join(' ');

    if (!text) {
        await sock.sendMessage(chatId, { 
            text: `❌ *Usage:* \\${currentPrefix}qtr <text>\n\n*Translates to 5 common languages automatically*` 
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "⚡", key: msg.key } });

    try {
        const languages = [
            { code: 'es', name: 'Spanish' },
            { code: 'fr', name: 'French' },
            { code: 'de', name: 'German' },
            { code: 'pt', name: 'Portuguese' },
            { code: 'it', name: 'Italian' }
        ];

        let responseMessage = `⚡ *Quick Translations*\n\n*Original:* ${text}\n\n`;

        // Translate to all languages
        for (const lang of languages) {
            try {
                const translated = await Translate(text, lang.code);
                responseMessage += `*${lang.name} (${lang.code}):* ${translated}\n\n`;
            } catch (error) {
                responseMessage += `*${lang.name}:* ❌ Failed\n\n`;
            }
        }

        await sock.sendMessage(chatId, { text: responseMessage }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

    } catch (error) {
        console.error('Quick Translate Error:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ Quick translation failed. Try single translations instead.' 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// Detect Language
if (command === 'detectlang') {
    const text = args.join(' ');

    if (!text) {
        await sock.sendMessage(chatId, { 
            text: `❌ *Usage:* \\${currentPrefix}detectlang <text>\n\n*Detects the language of the provided text*` 
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "🔍", key: msg.key } });

    try {
        // Use translation API to detect language
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`;
        const response = await fetch(url);
        const data = await response.json();
        
        let detectedLang = 'Unknown';
        if (data && data[2]) {
            detectedLang = data[2]; // Language code
        }

        // Get language name
        const langNames = {
            'en': 'English', 'es': 'Spanish', 'fr': 'French', 'de': 'German',
            'it': 'Italian', 'pt': 'Portuguese', 'ru': 'Russian', 'zh': 'Chinese',
            'ja': 'Japanese', 'ko': 'Korean', 'ar': 'Arabic', 'hi': 'Hindi',
            'tr': 'Turkish', 'nl': 'Dutch', 'sv': 'Swedish', 'pl': 'Polish'
        };

        const langName = langNames[detectedLang] || detectedLang;

        const responseMessage = `🔍 *Language Detection*\n\n*Text:* ${text}\n\n*Detected Language:* ${langName} (${detectedLang.toUpperCase()})`;

        await sock.sendMessage(chatId, { text: responseMessage }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

    } catch (error) {
        console.error('Language Detection Error:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ Language detection failed.' 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// Translation with multiple targets
if (command === 'mtr') {
    const languages = args[0]?.split(',');
    const text = args.slice(1).join(' ');

    if (!languages || !text || languages.length === 0) {
        await sock.sendMessage(chatId, { 
            text: `❌ *Usage:* \\${currentPrefix}mtr <lang1,lang2,lang3> <text>\n\n*Example:* \\${currentPrefix}mtr es,fr,de Hello World\n*Translates to Spanish, French, and German*` 
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "🔄", key: msg.key } });

    try {
        let responseMessage = `🔄 *Multi-Language Translation*\n\n*Original:* ${text}\n\n`;

        for (const lang of languages.slice(0, 5)) { // Limit to 5 languages
            const cleanLang = lang.trim().toLowerCase();
            try {
                const translated = await Translate(text, cleanLang);
                responseMessage += `*${cleanLang.toUpperCase()}:* ${translated}\n\n`;
            } catch (error) {
                responseMessage += `*${cleanLang.toUpperCase()}:* ❌ Invalid language code\n\n`;
            }
        }

        await sock.sendMessage(chatId, { text: responseMessage }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

    } catch (error) {
        console.error('Multi-Translate Error:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ Multi-translation failed.' 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// File Search Commands
if (validFileTypes.includes(command)) {
    const query = args.join(" ").trim();

    if (!query) {
        await sock.sendMessage(chatId, { 
            text: `❌ *Usage:* \\${currentPrefix}${command} <search_query>\n\n*Examples:*\n\\${currentPrefix}${command} research paper\n\\${currentPrefix}${command} business plan template\n\\${currentPrefix}${command} programming tutorial` 
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "📁", key: msg.key } });

    try {
        const result = await FileSearch(query, command);
        await sock.sendMessage(chatId, { text: result }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
    } catch (err) {
        console.error(`❌ ${command.toUpperCase()} Search Error:`, err);
        await sock.sendMessage(chatId, { 
            text: `❌ Failed to search for ${command} files. Please try again later.` 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// Advanced file search
if (command === 'filesearch' || command === 'fsearch') {
    const fileType = args[0]?.toLowerCase();
    const searchQuery = args.slice(1).join(' ');

    if (!fileType || !searchQuery) {
        await sock.sendMessage(chatId, { 
            text: `❌ *Usage:* \\${currentPrefix}filesearch <file_type> <query>\n\n*Supported Types:* ${validFileTypes.join(', ')}\n\n*Examples:*\n\\${currentPrefix}filesearch pdf machine learning\n\\${currentPrefix}fsearch docx business proposal\n\\${currentPrefix}filesearch ppt marketing presentation` 
        }, { quoted: msg });
        return;
    }

    if (!validFileTypes.includes(fileType)) {
        await sock.sendMessage(chatId, { 
            text: `❌ Invalid file type: ${fileType}\n\n*Supported types:* ${validFileTypes.join(', ')}` 
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "🔍", key: msg.key } });

    try {
        const result = await FileSearch(searchQuery, fileType);
        await sock.sendMessage(chatId, { text: result }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
    } catch (err) {
        console.error('File Search Error:', err);
        await sock.sendMessage(chatId, { 
            text: `❌ File search failed: ${err.message}` 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// Generate QRCode
if (command === 'qrcode') {
    const text = args.join(" ").trim();

    if (!text) {
        await sock.sendMessage(chatId, { 
            text: `❌ Please provide text to generate a QR code.\n\nExample: \\${currentPrefix}qrcode Hello World` 
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "👨‍💻", key: msg.key } });

    try {
        // Create upload directory if it doesn't exist
        const uploadDir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const qrPath = path.join(uploadDir, `qrcode-${Date.now()}.png`);
        await QRCode.toFile(qrPath, text);

        await sock.sendMessage(chatId, {
            image: fs.readFileSync(qrPath),
            caption: `🔲 *QR Code Generated:*\n"${text}"`
        }, { quoted: msg });

        // Cleanup
        fs.unlinkSync(qrPath);

        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
    } catch (error) {
        console.error("❌ QR Code Error:", error);
        await sock.sendMessage(chatId, { 
            text: "❌ Failed to generate QR code." 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// Mathematics 
if (command === 'math') {
    const expression = args.join(" ").trim();

    if (!expression) {
        await sock.sendMessage(chatId, {
            text: `❌ Please provide a math expression.\n\n*Example:* \\${currentPrefix}math 2 + 3 * (4 - 1)`
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "👨‍💻", key: msg.key } });

    try {
        // Safe math evaluation
        const result = calculateExpression(expression);
        await sock.sendMessage(chatId, {
            text: `🧮 *Math Calculation*\n\n*Expression:* ${expression}\n*Result:* ${result}`
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
    } catch (error) {
        console.error('❌ Math Error:', error);
        await sock.sendMessage(chatId, { 
            text: "❌ Invalid math expression." 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

function calculateExpression(expression) {
    // Basic safe evaluation - replace with a proper math parser if needed
    const sanitized = expression.replace(/[^0-9+\-*/().]/g, '');
    return eval(sanitized);
}

// Count Words
if (command === 'words') {
    const text = args.join(" ").trim();

    if (!text) {
        await sock.sendMessage(chatId, {
            text: `❌ Please provide some text to analyze.\n\n*Example:* \\${currentPrefix}words Hello world!`
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "👨‍💻", key: msg.key } });

    try {
        const wordCount = text.split(/\s+/).length;
        const characterCount = text.length;
        const spaceCount = (text.match(/\s/g) || []).length;
        const symbolCount = (text.match(/[^\w\s]/g) || []).length;
        const paragraphCount = text.split(/\n+/).length;
        const numberCount = (text.match(/\d+/g) || []).length;

        const responseMessage =
            '*📝 Text Analysis*\n\n' +
            `📊 *Words:* ${wordCount}\n` +
            `🔤 *Characters:* ${characterCount}\n` +
            `␣ *Spaces:* ${spaceCount}\n` +
            `🔣 *Symbols:* ${symbolCount}\n` +
            `📑 *Paragraphs:* ${paragraphCount}\n` +
            `🔢 *Numbers:* ${numberCount}`;

        await sock.sendMessage(chatId, { text: responseMessage }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

    } catch (error) {
        console.error("❌ Word analysis error:", error);
        await sock.sendMessage(chatId, { 
            text: "❌ Error analyzing text." 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}
// SEO Check Command (Enhanced)
if (command === 'seo') {
    const domain = args[0];
    
    if (!domain) {
        await sock.sendMessage(chatId, { 
            text: `❌ *Usage:* \\${currentPrefix}seo <domain>\n\n*Examples:*\n\\${currentPrefix}seo google.com\n\\${currentPrefix}seo example.com\n\\${currentPrefix}seo github.com` 
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "🔍", key: msg.key } });

    try {
        const seoData = await CheckSEO(domain);
        
        let responseMessage = `🔍 *SEO Analysis for ${domain}*\n\n`;
        responseMessage += `📊 *SEO Score:* ${seoData.seoSuccessRate}\n`;
        responseMessage += `🔗 *Indexable:* ${seoData.isIndexable ? '✅ Yes' : '❌ No'}\n\n`;
        
        // Character count analysis
        const titleLength = seoData.title?.length || 0;
        const descLength = seoData.metaDescription?.length || 0;
        
        responseMessage += `*📝 Title (${titleLength}/60):*\n${seoData.title || '❌ Not set'}\n${titleLength > 60 ? '⚠️ *Too long!*' : titleLength > 0 ? '✅ *Good length*' : '❌ *Missing!*'}\n\n`;
        
        responseMessage += `*📄 Meta Description (${descLength}/160):*\n${seoData.metaDescription || '❌ Not set'}\n${descLength > 160 ? '⚠️ *Too long!*' : descLength > 0 ? '✅ *Good length*' : '❌ *Missing!*'}\n\n`;
        
        responseMessage += `*🏷️ Meta Keywords:*\n${seoData.metaKeywords || '❌ Not set'}\n\n`;
        responseMessage += `*📱 OG Title:*\n${seoData.ogTitle || '❌ Not set'}\n\n`;
        responseMessage += `*📱 OG Description:*\n${seoData.ogDescription || '❌ Not set'}\n\n`;
        responseMessage += `*🖼️ OG Image:*\n${seoData.ogImage || '❌ Not set'}\n\n`;
        responseMessage += `*🔗 Canonical URL:*\n${seoData.canonicalUrl || '❌ Not set'}\n\n`;
        
        // Quick assessment
        responseMessage += `💡 *Quick Assessment:*\n`;
        const score = parseFloat(seoData.seoSuccessRate) || 0;
        if (score > 70) {
            responseMessage += `✅ Good SEO foundation\n`;
        } else if (score > 40) {
            responseMessage += `⚠️ Needs improvement\n`;
        } else {
            responseMessage += `❌ Poor SEO setup\n`;
        }
        
        responseMessage += `\n💡 *Tips:*\n`;
        responseMessage += `• Title should be under 60 chars\n`;
        responseMessage += `• Meta description under 160 chars\n`;
        responseMessage += `• Add Open Graph tags for social media\n`;
        responseMessage += `• Ensure proper canonical URLs\n`;
        responseMessage += `• Use relevant, focused keywords`;

        await sock.sendMessage(chatId, { text: responseMessage }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

    } catch (error) {
        console.error('SEO Check Error:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ SEO check failed: ${error.message}\n\n💡 *Troubleshooting:*\n• Make sure domain is valid\n• Include protocol if needed (http/https)\n• Domain must be accessible\n• Try: ${domain.startsWith('http') ? domain : 'https://' + domain}` 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// Helper function to split long messages
function splitLongMessage(text, maxLength) {
    const parts = [];
    let currentPart = '';
    
    const sentences = text.split('\n');
    for (const sentence of sentences) {
        if ((currentPart + sentence).length > maxLength) {
            if (currentPart) parts.push(currentPart.trim());
            currentPart = sentence + '\n';
        } else {
            currentPart += sentence + '\n';
        }
    }
    
    if (currentPart) parts.push(currentPart.trim());
    return parts;
}

// Bible Chapter Command
if (command === 'bible') {
    const book = args[0];
    const chapter = args[1];

    if (!book || !chapter || isNaN(chapter)) {
        await sock.sendMessage(chatId, { 
            text: `❌ *Usage:* \\${currentPrefix}bible <book> <chapter>\n\n*Examples:*\n\\${currentPrefix}bible john 3\n\\${currentPrefix}bible psalms 23\n\\${currentPrefix}bible genesis 1\n\\${currentPrefix}bible matthew 5\n\n💡 *Tip:* Use \\${currentPrefix}biblebooks to see all books` 
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "📖", key: msg.key } });

    try {
        const { Bible } = require('./Bible'); // Fixed path
        const bibleText = await Bible(book, chapter);
        
        // Split long messages
        if (bibleText.length > 4000) {
            const parts = splitLongMessage(bibleText, 4000);
            for (let i = 0; i < parts.length; i++) {
                await sock.sendMessage(chatId, { 
                    text: `${parts[i]}${i < parts.length - 1 ? '\n\n_(Continued...)_' : ''}` 
                }, { quoted: i === 0 ? msg : undefined });
                if (i < parts.length - 1) await new Promise(resolve => setTimeout(resolve, 1000));
            }
        } else {
            await sock.sendMessage(chatId, { text: bibleText }, { quoted: msg });
        }
        
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

    } catch (error) {
        console.error('Bible Error:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ Failed to fetch Bible chapter: ${error.message}\n\n💡 Check book name and chapter number.` 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// Bible Verse Command
if (command === 'bibleverse') {
    const book = args[0];
    const chapter = args[1];
    const verse = args[2];

    if (!book || !chapter || !verse || isNaN(chapter) || isNaN(verse)) {
        await sock.sendMessage(chatId, { 
            text: `❌ *Usage:* \\${currentPrefix}bibleverse <book> <chapter> <verse>\n\n*Examples:*\n\\${currentPrefix}bibleverse john 3 16\n\\${currentPrefix}bibleverse psalms 23 1\n\\${currentPrefix}bibleverse romans 8 28` 
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "🎯", key: msg.key } });

    try {
        const { BibleVerse } = require('./Bible'); // Fixed path
        const verseText = await BibleVerse(book, chapter, verse);
        
        await sock.sendMessage(chatId, { text: verseText }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

    } catch (error) {
        console.error('Bible Verse Error:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ Failed to fetch Bible verse: ${error.message}` 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// Bible Search Command
if (command === 'biblesearch') {
    const query = args.join(' ');

    if (!query) {
        await sock.sendMessage(chatId, { 
            text: `❌ *Usage:* \\${currentPrefix}biblesearch <search_query>\n\n*Examples:*\n\\${currentPrefix}biblesearch love\n\\${currentPrefix}biblesearch faith hope\n\\${currentPrefix}biblesearch peace of God` 
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "🔍", key: msg.key } });

    try {
        const { BibleSearch } = require('./Bible'); // Fixed path
        const searchResults = await BibleSearch(query);
        
        await sock.sendMessage(chatId, { text: searchResults }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

    } catch (error) {
        console.error('Bible Search Error:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ Bible search failed: ${error.message}\n\n💡 Try different keywords or check spelling.` 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// Random Bible Verse Command
if (command === 'randomverse') {
    await sock.sendMessage(chatId, { react: { text: "🎲", key: msg.key } });

    try {
        const { RandomBibleVerse } = require('./Bible'); // Fixed path
        const randomVerse = await RandomBibleVerse();
        
        await sock.sendMessage(chatId, { text: randomVerse }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

    } catch (error) {
        console.error('Random Bible Error:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ Failed to fetch random Bible verse.' 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// Bible Books List Command
if (command === 'biblebooks') {
    const testament = args[0]?.toLowerCase();

    try {
        const { bibleBooks } = require('./Bible'); // Fixed path
        
        let responseMessage = '📖 *Bible Books*\n\n';

        if (!testament || testament === 'old') {
            responseMessage += '*Old Testament:*\n';
            bibleBooks.oldTestament.forEach((book, index) => {
                responseMessage += `${index + 1}. ${book}\n`;
            });
            responseMessage += '\n';
        }

        if (!testament || testament === 'new') {
            responseMessage += '*New Testament:*\n';
            bibleBooks.newTestament.forEach((book, index) => {
                responseMessage += `${index + 1}. ${book}\n`;
            });
        }

        responseMessage += `\n💡 *Usage:* \\${currentPrefix}bible <book_name> <chapter>`;

        await sock.sendMessage(chatId, { text: responseMessage }, { quoted: msg });

    } catch (error) {
        console.error('Bible Books Error:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ Failed to load Bible books list.' 
        }, { quoted: msg });
    }
}

// Popular Verses Command
if (command === 'popularverses') {
    const popularList = `🌟 *Popular Bible Verses*\n\n
*1. John 3:16*
"For God so loved the world that he gave his one and only Son..."

*2. Philippians 4:13*
"I can do all this through him who gives me strength."

*3. Jeremiah 29:11*
"For I know the plans I have for you," declares the LORD...

*4. Psalms 23:1*
"The LORD is my shepherd, I lack nothing."

*5. Romans 8:28*
"And we know that in all things God works for the good..."

*6. Proverbs 3:5-6*
"Trust in the LORD with all your heart..."

*7. Isaiah 41:10*
"So do not fear, for I am with you..."

💡 *Get any verse:* \\${currentPrefix}bibleverse book chapter verse`;

    await sock.sendMessage(chatId, { text: popularList }, { quoted: msg });
}
		
// Surah Command - Get entire surah
if (command === 'surah') {
    const surahId = args[0];

    if (!surahId || isNaN(surahId) || surahId < 1 || surahId > 114) {
        await sock.sendMessage(chatId, { 
            text: `❌ *Usage:* \\${currentPrefix}surah <surah_number>\n\n*Surah Numbers:* 1-114\n\n*Examples:*\n\\${currentPrefix}surah 1  (Al-Fatihah)\n\\${currentPrefix}surah 2  (Al-Baqarah)\n\\${currentPrefix}surah 36 (Ya-Sin)\n\\${currentPrefix}surah 112 (Al-Ikhlas)\n\n💡 *Tip:* Use \\${currentPrefix}surahlist to see all surah names and numbers` 
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "📖", key: msg.key } });

    try {
        const surahText = await Surah(surahId);
        
        // Split long messages (WhatsApp has character limits)
        if (surahText.length > 4000) {
            const parts = splitLongMessage(surahText, 4000);
            for (let i = 0; i < parts.length; i++) {
                await sock.sendMessage(chatId, { 
                    text: `${parts[i]}${i < parts.length - 1 ? '\n\n_(Continued...)_' : ''}` 
                }, { quoted: i === 0 ? msg : undefined });
                if (i < parts.length - 1) await new Promise(resolve => setTimeout(resolve, 1000));
            }
        } else {
            await sock.sendMessage(chatId, { text: surahText }, { quoted: msg });
        }
        
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

    } catch (error) {
        console.error('Surah Error:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ Failed to fetch surah: ${error.message}\n\n💡 Make sure the surah number is between 1-114.` 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}
// Ayah Command - Get specific verse
if (command === 'verse') {
    const surahId = args[0];
    const ayahId = args[1];

    if (!surahId || !ayahId || isNaN(surahId) || isNaN(ayahId) || surahId < 1 || surahId > 114) {
        await sock.sendMessage(chatId, { 
            text: `❌ *Usage:* \\${currentPrefix}verse <surah_number> <verse_number>\n\n*Examples:*\n\\${currentPrefix}verse 1 1  (Al-Fatihah:1)\n\\${currentPrefix}verse 2 255 (Ayat Kursi)\n\\${currentPrefix}verse 36 1  (Ya-Sin:1)\n\\${currentPrefix}verse 112 1 (Al-Ikhlas:1)` 
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "🎯", key: msg.key } });

    try {
        const ayahText = await SurahDetails(surahId, parseInt(ayahId));
        
        if (ayahText === 'Surah Not available' || !ayahText) {
            await sock.sendMessage(chatId, { 
                text: `❌ Ayah ${ayahId} not found in Surah ${surahId}\n\n💡 Check if the verse number exists in that surah.` 
            }, { quoted: msg });
            await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
            return;
        }

        await sock.sendMessage(chatId, { text: ayahText }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

    } catch (error) {
        console.error('Ayah Error:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ Failed to fetch ayah: ${error.message}` 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// Surah List Command
if (command === 'surahlist') {
    const page = parseInt(args[0]) || 1;
    const surahsPerPage = 15; // Increased for better display

    try {
        // Complete list of all 114 surahs
        const surahList = [
            { number: 1, latin: "Al-Fatihah", translation: "Pembukaan", verses: 7 },
            { number: 2, latin: "Al-Baqarah", translation: "Sapi Betina", verses: 286 },
            { number: 3, latin: "Ali 'Imran", translation: "Keluarga Imran", verses: 200 },
            { number: 4, latin: "An-Nisa", translation: "Wanita", verses: 176 },
            { number: 5, latin: "Al-Ma'idah", translation: "Hidangan", verses: 120 },
            { number: 6, latin: "Al-An'am", translation: "Binatang Ternak", verses: 165 },
            { number: 7, latin: "Al-A'raf", translation: "Tempat Tertinggi", verses: 206 },
            { number: 8, latin: "Al-Anfal", translation: "Rampasan Perang", verses: 75 },
            { number: 9, latin: "At-Taubah", translation: "Pengampunan", verses: 129 },
            { number: 10, latin: "Yunus", translation: "Yunus", verses: 109 },
            { number: 11, latin: "Hud", translation: "Hud", verses: 123 },
            { number: 12, latin: "Yusuf", translation: "Yusuf", verses: 111 },
            { number: 13, latin: "Ar-Ra'd", translation: "Guruh", verses: 43 },
            { number: 14, latin: "Ibrahim", translation: "Ibrahim", verses: 52 },
            { number: 15, latin: "Al-Hijr", translation: "Hijr", verses: 99 },
            { number: 16, latin: "An-Nahl", translation: "Lebah", verses: 128 },
            { number: 17, latin: "Al-Isra", translation: "Perjalanan Malam", verses: 111 },
            { number: 18, latin: "Al-Kahf", translation: "Gua", verses: 110 },
            { number: 19, latin: "Maryam", translation: "Maryam", verses: 98 },
            { number: 20, latin: "Taha", translation: "Taha", verses: 135 },
            { number: 21, latin: "Al-Anbiya", translation: "Para Nabi", verses: 112 },
            { number: 22, latin: "Al-Hajj", translation: "Haji", verses: 78 },
            { number: 23, latin: "Al-Mu'minun", translation: "Orang-Orang Mukmin", verses: 118 },
            { number: 24, latin: "An-Nur", translation: "Cahaya", verses: 64 },
            { number: 25, latin: "Al-Furqan", translation: "Pembeda", verses: 77 },
            { number: 26, latin: "Asy-Syu'ara", translation: "Penyair", verses: 227 },
            { number: 27, latin: "An-Naml", translation: "Semut", verses: 93 },
            { number: 28, latin: "Al-Qasas", translation: "Kisah-Kisah", verses: 88 },
            { number: 29, latin: "Al-'Ankabut", translation: "Laba-Laba", verses: 69 },
            { number: 30, latin: "Ar-Rum", translation: "Bangsa Romawi", verses: 60 },
            { number: 31, latin: "Luqman", translation: "Luqman", verses: 34 },
            { number: 32, latin: "As-Sajdah", translation: "Sajdah", verses: 30 },
            { number: 33, latin: "Al-Ahzab", translation: "Golongan yang Bersekutu", verses: 73 },
            { number: 34, latin: "Saba", translation: "Saba'", verses: 54 },
            { number: 35, latin: "Fatir", translation: "Pencipta", verses: 45 },
            { number: 36, latin: "Ya-Sin", translation: "Ya Sin", verses: 83 },
            { number: 37, latin: "As-Saffat", translation: "Barisan-Barisan", verses: 182 },
            { number: 38, latin: "Sad", translation: "Sad", verses: 88 },
            { number: 39, latin: "Az-Zumar", translation: "Rombongan", verses: 75 },
            { number: 40, latin: "Ghafir", translation: "Yang Mengampuni", verses: 85 },
            { number: 41, latin: "Fussilat", translation: "Yang Dijelaskan", verses: 54 },
            { number: 42, latin: "Asy-Syura", translation: "Musyawarah", verses: 53 },
            { number: 43, latin: "Az-Zukhruf", translation: "Perhiasan", verses: 89 },
            { number: 44, latin: "Ad-Dukhan", translation: "Kabut", verses: 59 },
            { number: 45, latin: "Al-Jasiyah", translation: "Yang Bertekuk Lutut", verses: 37 },
            { number: 46, latin: "Al-Ahqaf", translation: "Bukit-Bukit Pasir", verses: 35 },
            { number: 47, latin: "Muhammad", translation: "Muhammad", verses: 38 },
            { number: 48, latin: "Al-Fath", translation: "Kemenangan", verses: 29 },
            { number: 49, latin: "Al-Hujurat", translation: "Kamar-Kamar", verses: 18 },
            { number: 50, latin: "Qaf", translation: "Qaf", verses: 45 },
            { number: 51, latin: "Az-Zariyat", translation: "Angin yang Menerbangkan", verses: 60 },
            { number: 52, latin: "At-Tur", translation: "Bukit", verses: 49 },
            { number: 53, latin: "An-Najm", translation: "Bintang", verses: 62 },
            { number: 54, latin: "Al-Qamar", translation: "Bulan", verses: 55 },
            { number: 55, latin: "Ar-Rahman", translation: "Maha Pengasih", verses: 78 },
            { number: 56, latin: "Al-Waqi'ah", translation: "Hari Kiamat", verses: 96 },
            { number: 57, latin: "Al-Hadid", translation: "Besi", verses: 29 },
            { number: 58, latin: "Al-Mujadilah", translation: "Wanita yang Mengajukan Gugatan", verses: 22 },
            { number: 59, latin: "Al-Hasyr", translation: "Pengusiran", verses: 24 },
            { number: 60, latin: "Al-Mumtahanah", translation: "Wanita yang Diuji", verses: 13 },
            { number: 61, latin: "As-Saff", translation: "Barisan", verses: 14 },
            { number: 62, latin: "Al-Jumu'ah", translation: "Jumat", verses: 11 },
            { number: 63, latin: "Al-Munafiqun", translation: "Orang-Orang Munafik", verses: 11 },
            { number: 64, latin: "At-Tagabun", translation: "Hari Dinampakkan Kesalahan-Kesalahan", verses: 18 },
            { number: 65, latin: "At-Talaq", translation: "Talak", verses: 12 },
            { number: 66, latin: "At-Tahrim", translation: "Mengharamkan", verses: 12 },
            { number: 67, latin: "Al-Mulk", translation: "Kerajaan", verses: 30 },
            { number: 68, latin: "Al-Qalam", translation: "Pena", verses: 52 },
            { number: 69, latin: "Al-Haqqah", translation: "Hari Kiamat", verses: 52 },
            { number: 70, latin: "Al-Ma'arij", translation: "Tempat Naik", verses: 44 },
            { number: 71, latin: "Nuh", translation: "Nuh", verses: 28 },
            { number: 72, latin: "Al-Jinn", translation: "Jin", verses: 28 },
            { number: 73, latin: "Al-Muzzammil", translation: "Orang yang Berselimut", verses: 20 },
            { number: 74, latin: "Al-Muddassir", translation: "Orang yang Berkemul", verses: 56 },
            { number: 75, latin: "Al-Qiyamah", translation: "Hari Kiamat", verses: 40 },
            { number: 76, latin: "Al-Insan", translation: "Manusia", verses: 31 },
            { number: 77, latin: "Al-Mursalat", translation: "Malaikat yang Diutus", verses: 50 },
            { number: 78, latin: "An-Naba", translation: "Berita Besar", verses: 40 },
            { number: 79, latin: "An-Nazi'at", translation: "Malaikat yang Mencabut", verses: 46 },
            { number: 80, latin: "'Abasa", translation: "Ia Bermuka Masam", verses: 42 },
            { number: 81, latin: "At-Takwir", translation: "Menggulung", verses: 29 },
            { number: 82, latin: "Al-Infitar", translation: "Terbelah", verses: 19 },
            { number: 83, latin: "Al-Mutaffifin", translation: "Orang-Orang yang Curang", verses: 36 },
            { number: 84, latin: "Al-Insyiqaq", translation: "Terbelah", verses: 25 },
            { number: 85, latin: "Al-Buruj", translation: "Gugusan Bintang", verses: 22 },
            { number: 86, latin: "At-Tariq", translation: "Yang Datang di Malam Hari", verses: 17 },
            { number: 87, latin: "Al-A'la", translation: "Maha Tinggi", verses: 19 },
            { number: 88, latin: "Al-Gasyiyah", translation: "Hari Pembalasan", verses: 26 },
            { number: 89, latin: "Al-Fajr", translation: "Fajar", verses: 30 },
            { number: 90, latin: "Al-Balad", translation: "Negeri", verses: 20 },
            { number: 91, latin: "Asy-Syams", translation: "Matahari", verses: 15 },
            { number: 92, latin: "Al-Lail", translation: "Malam", verses: 21 },
            { number: 93, latin: "Ad-Duha", translation: "Duha", verses: 11 },
            { number: 94, latin: "Al-Insyirah", translation: "Kelapangan", verses: 8 },
            { number: 95, latin: "At-Tin", translation: "Buah Tin", verses: 8 },
            { number: 96, latin: "Al-'Alaq", translation: "Segumpal Darah", verses: 19 },
            { number: 97, latin: "Al-Qadr", translation: "Kemuliaan", verses: 5 },
            { number: 98, latin: "Al-Bayyinah", translation: "Bukti", verses: 8 },
            { number: 99, latin: "Az-Zalzalah", translation: "Kegoncangan", verses: 8 },
            { number: 100, latin: "Al-'Adiyat", translation: "Kuda yang Berlari Kencang", verses: 11 },
            { number: 101, latin: "Al-Qari'ah", translation: "Hari Kiamat", verses: 11 },
            { number: 102, latin: "At-Takasur", translation: "Bermegah-Megahan", verses: 8 },
            { number: 103, latin: "Al-Asr", translation: "Asar", verses: 3 },
            { number: 104, latin: "Al-Humazah", translation: "Pengumpat", verses: 9 },
            { number: 105, latin: "Al-Fil", translation: "Gajah", verses: 5 },
            { number: 106, latin: "Quraisy", translation: "Quraisy", verses: 4 },
            { number: 107, latin: "Al-Ma'un", translation: "Barang-Barang yang Berguna", verses: 7 },
            { number: 108, latin: "Al-Kausar", translation: "Nikmat yang Banyak", verses: 3 },
            { number: 109, latin: "Al-Kafirun", translation: "Orang-Orang kafir", verses: 6 },
            { number: 110, latin: "An-Nasr", translation: "Pertolongan", verses: 3 },
            { number: 111, latin: "Al-Lahab", translation: "Gejolak Api", verses: 5 },
            { number: 112, latin: "Al-Ikhlas", translation: "Ikhlas", verses: 4 },
            { number: 113, latin: "Al-Falaq", translation: "Subuh", verses: 5 },
            { number: 114, latin: "An-Nas", translation: "Manusia", verses: 6 }
        ];

        const startIndex = (page - 1) * surahsPerPage;
        const endIndex = startIndex + surahsPerPage;
        const pageSurahs = surahList.slice(startIndex, endIndex);

        if (pageSurahs.length === 0) {
            await sock.sendMessage(chatId, { 
                text: `❌ Page ${page} not found. There are only ${Math.ceil(surahList.length / surahsPerPage)} pages.` 
            }, { quoted: msg });
            return;
        }

        let responseMessage = `📖 *Surah List - Page ${page}/${Math.ceil(surahList.length / surahsPerPage)}*\n\n`;
        
        pageSurahs.forEach(surah => {
            responseMessage += `*${surah.number}.* ${surah.latin}\n`;
            responseMessage += `   ${surah.translation} (${surah.verses} verses)\n\n`;
        });

        responseMessage += `💡 *Usage:* \\${currentPrefix}surahlist ${page + 1} for next page\n`;
        responseMessage += `📚 *Total:* 114 surahs`;

        await sock.sendMessage(chatId, { text: responseMessage }, { quoted: msg });

    } catch (error) {
        console.error('Surah List Error:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ Failed to load surah list.' 
        }, { quoted: msg });
    }
}

// Random Ayah Command
if (command === 'randomverse') {
    await sock.sendMessage(chatId, { react: { text: "🎲", key: msg.key } });

    try {
        // Generate random surah (1-114)
        const randomSurah = Math.floor(Math.random() * 114) + 1;
        
        // Use popular verses to avoid API issues
        const popularAyahs = {
            1: [1, 2, 3, 4, 5, 6, 7], // Al-Fatihah
            2: [255], // Ayat Kursi
            36: [1, 2, 3], // Ya-Sin
            55: [1, 2, 3], // Ar-Rahman
            67: [1, 2, 3], // Al-Mulk
            112: [1, 2, 3, 4], // Al-Ikhlas
            113: [1, 2, 3, 4, 5], // Al-Falaq
            114: [1, 2, 3, 4, 5, 6] // An-Nas
        };

        let randomAyah;
        if (popularAyahs[randomSurah]) {
            const ayahs = popularAyahs[randomSurah];
            randomAyah = ayahs[Math.floor(Math.random() * ayahs.length)];
        } else {
            // Fallback to first verse
            randomAyah = 1;
        }

        const ayahText = await SurahDetails(randomSurah, randomAyah);
        
        if (!ayahText || ayahText === 'Surah Not available') {
            throw new Error('Verse not available');
        }

        const responseMessage = `🎲 *Random Ayah*\n\n${ayahText}\n\n💡 Use \\${currentPrefix}verse ${randomSurah} ${randomAyah} to get this verse again`;

        await sock.sendMessage(chatId, { text: responseMessage }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

    } catch (error) {
        console.error('Random Ayah Error:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ Failed to fetch random ayah. Please try again.' 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}
// Weather
if (command === 'weather') {
    const cityName = args.join(' ');

    if (!cityName) {
        await sock.sendMessage(chatId, { 
            text: `❌ *Usage:* \\${currentPrefix}weather <city_name>\n\n*Examples:*\n\\${currentPrefix}weather London\n\\${currentPrefix}weather New York\n\\${currentPrefix}weather Tokyo\n\\${currentPrefix}weather Jakarta` 
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "🌤️", key: msg.key } });

    try {
        const weatherData = await Weather(cityName);
        
        const responseMessage = `🌤️ *Weather in ${cityName}*\n\n` +
                               `🌡️ *Temperature:* ${weatherData.temperature}\n` +
                               `☁️ *Condition:* ${weatherData.condition}\n` +
                               `💨 *Wind:* ${weatherData.wind}\n` +
                               `💧 *Humidity:* ${weatherData.humidity}`;

        await sock.sendMessage(chatId, { text: responseMessage }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

    } catch (error) {
        console.error('Weather Error:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ Weather check failed: ${error.message}\n\n💡 *Possible issues:*\n• City name not found\n• Network connection issue\n• Try different city spelling` 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// Detailed Weather Command
if (command === 'weather-detail') {
    const cityName = args.join(' ');

    if (!cityName) {
        await sock.sendMessage(chatId, { 
            text: `❌ *Usage:* \\${currentPrefix}weather-detail <city_name>\n\n*Shows detailed weather forecast*` 
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "📊", key: msg.key } });

    try {
        // Get more detailed weather data using fetch instead of axios
        const detailUrl = `https://wttr.in/${encodeURIComponent(cityName)}?format=%t|%C|%w|%h|%p|%P|%u|%m&lang=id&m`;
        const response = await fetch(detailUrl);
        
        if (!response.ok) {
            throw new Error('Weather service unavailable');
        }
        
        const weatherData = await response.text();
        const weatherParts = weatherData.split('|');

        const responseMessage = `📊 *Detailed Weather - ${cityName}*\n\n` +
                               `🌡️ *Temperature:* ${weatherParts[0]?.trim() || 'N/A'}\n` +
                               `☁️ *Condition:* ${weatherParts[1]?.trim() || 'N/A'}\n` +
                               `💨 *Wind:* ${weatherParts[2]?.trim() || 'N/A'}\n` +
                               `💧 *Humidity:* ${weatherParts[3]?.trim() || 'N/A'}\n` +
                               `🌧️ *Precipitation:* ${weatherParts[4]?.trim() || 'N/A'}\n` +
                               `💨 *Pressure:* ${weatherParts[5]?.trim() || 'N/A'}\n` +
                               `👁️ *UV Index:* ${weatherParts[6]?.trim() || 'N/A'}\n` +
                               `🌙 *Moon Phase:* ${weatherParts[7]?.trim() || 'N/A'}`;

        await sock.sendMessage(chatId, { text: responseMessage }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

    } catch (error) {
        console.error('Detailed Weather Error:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ Detailed weather failed for ${cityName}` 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// Weather Forecast (3 days)
if (command === 'forecast') {
    const cityName = args.join(' ');

    if (!cityName) {
        await sock.sendMessage(chatId, { 
            text: `❌ *Usage:* \\${currentPrefix}forecast <city_name>\n\n*Shows 3-day weather forecast*` 
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "📅", key: msg.key } });

    try {
        const forecastUrl = `https://wttr.in/${encodeURIComponent(cityName)}?format="%l|%c|%t|%w|%h\n"&lang=id&m&period=3`;
        const response = await fetch(forecastUrl);
        
        if (!response.ok) {
            throw new Error('Forecast service unavailable');
        }
        
        const forecastData = await response.text();
        const forecasts = forecastData.trim().split('\n');
        
        let responseMessage = `📅 *3-Day Forecast - ${cityName}*\n\n`;
        
        const days = ['Today', 'Tomorrow', 'Day After Tomorrow'];
        
        forecasts.slice(0, 3).forEach((forecast, index) => {
            const parts = forecast.replace(/"/g, '').split('|');
            if (parts.length >= 5) {
                responseMessage += `*${days[index]}*\n` +
                                 `☁️ ${parts[1]?.trim() || 'N/A'}\n` +
                                 `🌡️ ${parts[2]?.trim() || 'N/A'}\n` +
                                 `💨 ${parts[3]?.trim() || 'N/A'}\n` +
                                 `💧 ${parts[4]?.trim() || 'N/A'}\n\n`;
            }
        });

        await sock.sendMessage(chatId, { text: responseMessage }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

    } catch (error) {
        console.error('Forecast Error:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ Forecast failed for ${cityName}` 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// Multiple Cities Weather Comparison
if (command === 'weather-compare') {
    const cities = args.join(' ').split(',').map(city => city.trim());

    if (cities.length < 2) {
        await sock.sendMessage(chatId, { 
            text: `❌ *Usage:* \\${currentPrefix}weather-compare <city1>,<city2>,<city3>\n\n*Example:* \\${currentPrefix}weather-compare London,Paris,Tokyo\n*Compares weather in multiple cities*` 
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "⚖️", key: msg.key } });

    try {
        let responseMessage = `⚖️ *Weather Comparison*\n\n`;
        
        for (const city of cities.slice(0, 5)) { // Limit to 5 cities
            try {
                const weatherData = await Weather(city);
                responseMessage += `*${city}*\n` +
                                 `🌡️ ${weatherData.temperature} | ☁️ ${weatherData.condition}\n` +
                                 `💨 ${weatherData.wind} | 💧 ${weatherData.humidity}\n\n`;
            } catch (error) {
                responseMessage += `*${city}*: ❌ Not found\n\n`;
            }
        }

        await sock.sendMessage(chatId, { text: responseMessage }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

    } catch (error) {
        console.error('Weather Compare Error:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ Weather comparison failed.' 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// Weather with ASCII Art (Fun)
if (command === 'weather-art') {
    const cityName = args.join(' ');

    if (!cityName) {
        await sock.sendMessage(chatId, { 
            text: `❌ *Usage:* \\${currentPrefix}weather-art <city_name>\n\n*Shows weather with ASCII art*` 
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "🎨", key: msg.key } });

    try {
        const artUrl = `https://wttr.in/${encodeURIComponent(cityName)}?lang=id&m`;
        const response = await fetch(artUrl);
        
        if (!response.ok) {
            throw new Error('Weather art service unavailable');
        }
        
        // Get ASCII art (first few lines)
        const asciiArt = (await response.text()).split('\n').slice(0, 10).join('\n');
        
        const responseMessage = `🎨 *Weather Art - ${cityName}*\n\n\`\`\`${asciiArt}\`\`\``;

        await sock.sendMessage(chatId, { text: responseMessage }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

    } catch (error) {
        console.error('Weather Art Error:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ Weather art failed for ${cityName}` 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// Wiki AI
if (command === 'wiki-ai') {
    const searchQuery = args.join(' ');
    if (!searchQuery) {
        await sock.sendMessage(chatId, { 
            text: `❌ *Usage:* \\${currentPrefix}wiki-ai <search_query>\n\n*Example:* \\${currentPrefix}wiki-ai Albert Einstein` 
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "👨‍💻", key: msg.key } });

    try {
        const responseMessage = await WikipediaAI(searchQuery);
        if (responseMessage) {
            await sock.sendMessage(chatId, { text: responseMessage }, { quoted: msg });
        }

        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
    } catch (error) {
        console.error('Wiki AI Error:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ Wikipedia AI search failed: ${error.message}` 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// Wiki Search
if (command === 'wiki-search') {
    const searchQuery = args.join(' ');
    if (!searchQuery) {
        await sock.sendMessage(chatId, { 
            text: `❌ *Usage:* \\${currentPrefix}wiki-search <search_query>\n\n*Example:* \\${currentPrefix}wiki-search quantum physics` 
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "🔍", key: msg.key } });

    try {
        const responseMessage = await WikipediaSearch(searchQuery);
        if (responseMessage) {
            await sock.sendMessage(chatId, { text: responseMessage }, { quoted: msg });
        }

        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
    } catch (error) {
        console.error('Wiki Search Error:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ Wikipedia search failed: ${error.message}` 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// Wiki Image
if (command === 'wiki-img') {
    const userQuery = args.join(' ');
    if (!userQuery) {
        await sock.sendMessage(chatId, { 
            text: `❌ *Usage:* \\${currentPrefix}wiki-img <search_query>\n\n*Example:* \\${currentPrefix}wiki-img Eiffel Tower` 
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "🖼️", key: msg.key } });

    try {
        const result = await WikipediaImage(userQuery);
        if (result && result.url) {
            await sock.sendMessage(chatId, { 
                image: { url: result.url }, 
                caption: result.caption 
            }, { quoted: msg });

            await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
        } else {
            await sock.sendMessage(chatId, { 
                text: '❌ No Wikipedia image found for that search.' 
            }, { quoted: msg });
            await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
        }
    } catch (error) {
        console.error('Wiki Image Error:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ Error fetching Wikipedia image.' 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// Text-to-Speech (TTS)
if (command === 'tts') {
    const textToConvert = args.join(' ');
    
    if (!textToConvert) {
        await sock.sendMessage(chatId, { 
            text: `❌ *Usage:* \\${currentPrefix}tts <text>\n\n*Example:* \\${currentPrefix}tts Hello world` 
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "👨‍💻", key: msg.key } });

    try {
        // Create uploads directory if it doesn't exist
        const uploadDir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const audioFilePath = path.join(uploadDir, `tts-${Date.now()}.mp3`);
        const gtts = new gTTS(textToConvert, 'en');

        gtts.save(audioFilePath, async function (err) {
            if (err) {
                console.error('Error saving audio:', err);
                await sock.sendMessage(chatId, { 
                    text: '❌ Failed to generate audio.' 
                }, { quoted: msg });
                await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
                return;
            }

            // Check if file was created
            if (!fs.existsSync(audioFilePath)) {
                await sock.sendMessage(chatId, { 
                    text: '❌ Audio file not created.' 
                }, { quoted: msg });
                await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
                return;
            }

            await sock.sendMessage(chatId, {
                audio: fs.readFileSync(audioFilePath),
                mimetype: 'audio/mpeg',
                ptt: true,
            }, { quoted: msg });

            // Cleanup
            fs.unlinkSync(audioFilePath);

            await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
        });
    } catch (error) {
        console.error('TTS Error:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ TTS failed.' 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// Text-to-Speech (TTS2) send to target 
if (command === 'tts2') {
    const joinedArgs = args.join(' ');

    if (!joinedArgs) {
        await sock.sendMessage(chatId, { 
            text: `❌ *Usage:* \\${currentPrefix}tts2 <message> <phone_number>\n\n*Example:* \\${currentPrefix}tts2 Hello 2348123456789` 
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "👨‍💻", key: msg.key } });

    try {
        const lastSpaceIndex = joinedArgs.lastIndexOf(' ');

        if (lastSpaceIndex === -1) {
            await sock.sendMessage(chatId, { 
                text: `❌ *Usage:* \\${currentPrefix}tts2 <message> <phone_number>\n\n*Example:* \\${currentPrefix}tts2 Hello 2348123456789` 
            });
            return;
        }

        const textToConvert = joinedArgs.substring(0, lastSpaceIndex).trim();
        const targetNumber = joinedArgs.substring(lastSpaceIndex + 1).trim();

        if (!textToConvert || !targetNumber) {
            await sock.sendMessage(chatId, {
                text: `❌ Please provide both a message and a phone number\n\n*Example:* \\${currentPrefix}tts2 Hello 2348123456789`,
            });
            return;
        }

        // Create uploads directory if it doesn't exist
        const uploadDir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const targetJid = `${targetNumber.replace('+', '')}@s.whatsapp.net`;
        const audioFilePath = path.join(uploadDir, `tts2-${Date.now()}.mp3`);
        const gtts = new gTTS(textToConvert, 'en');

        gtts.save(audioFilePath, async function (err) {
            if (err) {
                console.error('Error saving audio:', err);
                await sock.sendMessage(chatId, { 
                    text: '❌ Failed to generate audio.' 
                }, { quoted: msg });
                await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
                return;
            }

            // Check if file was created
            if (!fs.existsSync(audioFilePath)) {
                await sock.sendMessage(chatId, { 
                    text: '❌ Audio file not created.' 
                }, { quoted: msg });
                await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
                return;
            }

            await sock.sendMessage(targetJid, {
                audio: fs.readFileSync(audioFilePath),
                mimetype: 'audio/mpeg',
                ptt: true,
            });

            await sock.sendMessage(chatId, { 
                text: `✅ TTS sent to ${targetNumber}: "${textToConvert}"` 
            }, { quoted: msg });
            
            await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
            console.log(`✅ Sent TTS to ${targetJid}: "${textToConvert}"`);

            // Cleanup
            fs.unlinkSync(audioFilePath);
        });
    } catch (error) {
        console.error("TTS2 Error:", error);
        await sock.sendMessage(chatId, { 
            text: `❌ TTS2 failed: ${error.message}` 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// Convert Video to Audio
if (command === 'tomp3') {
    const chatId = msg.key.remoteJid;

    // Check if message is a reply to a video
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const videoMessage = quoted?.videoMessage || msg.message?.videoMessage;

    if (!videoMessage) {
        await sock.sendMessage(chatId, { 
            text: `❌ Reply to a video with \\${currentPrefix}tomp3 to convert it to MP3.\n\n*Usage:* Reply to a video message with \\${currentPrefix}tomp3` 
        }, { quoted: msg });
        return;
    }

    try {
        // Send processing message
        await sock.sendMessage(chatId, { react: { text: "👨‍💻", key: msg.key } });
        
        // Check video size first (Koyeb has memory limits)
        const videoSize = videoMessage.fileLength || 0;
        const maxSize = 50 * 1024 * 1024; // 50MB limit for Koyeb
        
        if (videoSize > maxSize) {
            await sock.sendMessage(chatId, { 
                text: `❌ Video is too large (${(videoSize / (1024 * 1024)).toFixed(1)}MB). Maximum size is 50MB.` 
            }, { quoted: msg });
            await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
            return;
        }

        // Download video
        await sock.sendMessage(chatId, { react: { text: "⬇️", key: msg.key } });
        
        const buffer = await downloadMediaMessage(
            { 
                message: { 
                    ...(quoted || msg.message),
                    key: msg.key 
                } 
            }, 
            'buffer', 
            {}
        );

        if (!buffer || buffer.length === 0) {
            throw new Error('Failed to download video or video is empty');
        }

        console.log(`✅ Downloaded video: ${buffer.length} bytes`);

        // Create temp directory
        const tempDir = path.join(__dirname, '../uploads/temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const timestamp = Date.now();
        const inputPath = path.join(tempDir, `input_${timestamp}.mp4`);
        const outputPath = path.join(tempDir, `output_${timestamp}.mp3`);

        // Write input file
        fs.writeFileSync(inputPath, buffer);
        console.log(`✅ Input file created: ${inputPath}`);

        await sock.sendMessage(chatId, { react: { text: "🔄", key: msg.key } });

        // Convert to MP3 using ffmpeg with Koyeb-optimized settings
        await new Promise((resolve, reject) => {
            const ffmpegProcess = ffmpeg(inputPath)
                .audioCodec('libmp3lame')
                .audioBitrate(128)
                .audioChannels(2)
                .audioFrequency(44100)
                .outputOptions([
                    '-preset ultrafast', // Faster processing for Koyeb
                    '-threads 1', // Use single thread to avoid overloading
                    '-max_muxing_queue_size 1024'
                ])
                .toFormat('mp3')
                .on('start', (commandLine) => {
                    console.log('🎬 FFmpeg started:', commandLine);
                })
                .on('progress', (progress) => {
                    if (progress.percent) {
                        console.log(`📊 Processing: ${progress.percent.toFixed(1)}% done`);
                    }
                })
                .on('end', async () => {
                    try {
                        console.log('✅ Conversion finished');
                        
                        // Check if output file exists and has content
                        if (!fs.existsSync(outputPath)) {
                            throw new Error('Output file was not created');
                        }
                        
                        const stats = fs.statSync(outputPath);
                        console.log(`✅ Output file size: ${stats.size} bytes`);
                        
                        if (stats.size === 0) {
                            throw new Error('Output file is empty');
                        }

                        if (stats.size > 16 * 1024 * 1024) {
                            console.log('⚠️ MP3 file is large, sending as document');
                            await sock.sendMessage(chatId, { 
                                document: fs.readFileSync(outputPath),
                                fileName: `converted_audio_${timestamp}.mp3`,
                                mimetype: 'audio/mpeg',
                                caption: '🎵 Converted Audio'
                            }, { quoted: msg });
                        } else {
                            // Send as audio
                            await sock.sendMessage(chatId, { 
                                audio: fs.readFileSync(outputPath), 
                                mimetype: 'audio/mpeg',
                                ptt: false
                            }, { quoted: msg });
                        }

                        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
                        console.log('🎉 Audio sent successfully!');
                        
                        // Cleanup
                        cleanupFiles(inputPath, outputPath);
                        resolve();
                        
                    } catch (error) {
                        console.error('❌ Error sending audio:', error);
                        await sock.sendMessage(chatId, { 
                            text: '❌ Error sending converted audio. File might be too large.' 
                        }, { quoted: msg });
                        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
                        cleanupFiles(inputPath, outputPath);
                        reject(error);
                    }
                })
                .on('error', async (err) => {
                    console.error('❌ FFmpeg error:', err);
                    await sock.sendMessage(chatId, { 
                        text: '❌ Conversion failed. The video might be corrupted or too large.' 
                    }, { quoted: msg });
                    await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
                    cleanupFiles(inputPath, outputPath);
                    reject(err);
                })
                .on('stderr', (stderrLine) => {
                    console.log('FFmpeg stderr:', stderrLine);
                });

            // Set timeout for conversion (5 minutes max for Koyeb)
            const timeout = setTimeout(() => {
                if (ffmpegProcess.ffmpegProc) {
                    ffmpegProcess.ffmpegProc.kill();
                    reject(new Error('Conversion timeout - video too long or complex'));
                }
            }, 5 * 60 * 1000); // 5 minutes

            ffmpegProcess.on('end', () => clearTimeout(timeout));
            ffmpegProcess.on('error', () => clearTimeout(timeout));
            
            ffmpegProcess.save(outputPath);
        });

    } catch (err) {
        console.error('❌ General error:', err);
        
        let errorMessage = '❌ Error processing video: ';
        if (err.message.includes('timeout')) {
            errorMessage += 'Conversion took too long. Try a shorter video.';
        } else if (err.message.includes('memory') || err.message.includes('large')) {
            errorMessage += 'Video is too large for processing. Maximum 50MB.';
        } else if (err.message.includes('FFmpeg') || err.message.includes('conversion')) {
            errorMessage += 'FFmpeg processing failed. The video might be corrupted.';
        } else {
            errorMessage += err.message;
        }
        
        await sock.sendMessage(chatId, { 
            text: errorMessage 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// Enhanced cleanup function
function cleanupFiles(...filePaths) {
    filePaths.forEach(filePath => {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`🧹 Cleaned up: ${filePath}`);
            }
        } catch (cleanupError) {
            console.log(`⚠️ Could not delete ${filePath}:`, cleanupError.message);
        }
    });
}	
	

// Set FFmpeg path for fluent-ffmpeg
ffmpeg.setFfmpegPath(ffmpegPath);

// Convert Audio to Different Format
if (command === 'toaudio') {
    const chatId = msg.key.remoteJid;

    // Check if message is a reply to a video or audio
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const mediaMessage = quoted?.videoMessage || quoted?.audioMessage || msg.message?.videoMessage || msg.message?.audioMessage;

    if (!mediaMessage) {
        await sock.sendMessage(chatId, { 
            text: `❌ Reply to a video or audio with \\${currentPrefix}toaudio to convert it.\n\n*Supported:* MP4 to MP3, Audio format conversion` 
        }, { quoted: msg });
        return;
    }

    try {
        await sock.sendMessage(chatId, { react: { text: "👨‍💻", key: msg.key } });
        
        // Check file size for Koyeb limits
        const mediaSize = mediaMessage.fileLength || 0;
        const maxSize = 25 * 1024 * 1024; // 25MB limit for Koyeb
        
        if (mediaSize > maxSize) {
            await sock.sendMessage(chatId, { 
                text: `❌ Media is too large (${(mediaSize / (1024 * 1024)).toFixed(1)}MB). Maximum size is 25MB.` 
            }, { quoted: msg });
            await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
            return;
        }

        // Download media
        const buffer = await downloadMediaMessage(
            { 
                message: { 
                    ...(quoted || msg.message),
                    key: msg.key 
                } 
            }, 
            'buffer', 
            {}
        );

        if (!buffer || buffer.length === 0) {
            throw new Error('Failed to download media or file is empty');
        }

        console.log(`✅ Downloaded media: ${buffer.length} bytes`);

        // Create temp directory
        const tempDir = path.join(__dirname, '../uploads/temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const timestamp = Date.now();
        const isVideo = mediaMessage.videoMessage;
        const inputPath = path.join(tempDir, `input_${timestamp}.${isVideo ? 'mp4' : 'mp3'}`);
        const outputPath = path.join(tempDir, `output_${timestamp}.mp3`);

        fs.writeFileSync(inputPath, buffer);
        console.log(`✅ Input file created: ${inputPath}`);

        await sock.sendMessage(chatId, { react: { text: "🔄", key: msg.key } });

        // Convert using ffmpeg with Koyeb-optimized settings
        await new Promise((resolve, reject) => {
            const ff = ffmpeg(inputPath)
                .audioCodec('libmp3lame')
                .audioBitrate(128)
                .audioChannels(2)
                .audioFrequency(44100)
                .outputOptions([
                    '-preset ultrafast', // Faster processing
                    '-threads 1', // Single thread to avoid overloading
                ])
                .toFormat('mp3')
                .on('start', (commandLine) => {
                    console.log('🎬 FFmpeg conversion started');
                })
                .on('progress', (progress) => {
                    if (progress.percent) {
                        console.log(`📊 Processing: ${progress.percent.toFixed(1)}%`);
                    }
                })
                .on('end', async () => {
                    try {
                        if (!fs.existsSync(outputPath)) {
                            throw new Error('Output file was not created');
                        }
                        
                        const stats = fs.statSync(outputPath);
                        console.log(`✅ Output file size: ${stats.size} bytes`);
                        
                        if (stats.size === 0) {
                            throw new Error('Output file is empty');
                        }

                        const audioBuffer = fs.readFileSync(outputPath);
                        
                        // Check if file is too large for WhatsApp
                        if (stats.size > 16 * 1024 * 1024) {
                            await sock.sendMessage(chatId, { 
                                document: audioBuffer,
                                fileName: `converted_audio_${timestamp}.mp3`,
                                mimetype: 'audio/mpeg',
                                caption: '🎵 Converted Audio (Sent as document due to size)'
                            }, { quoted: msg });
                        } else {
                            await sock.sendMessage(chatId, { 
                                audio: audioBuffer, 
                                mimetype: 'audio/mpeg',
                                ptt: false
                            }, { quoted: msg });
                        }

                        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
                        console.log('🎉 Audio conversion completed!');
                        
                        cleanupFiles(inputPath, outputPath);
                        resolve();
                        
                    } catch (error) {
                        console.error('❌ Error sending audio:', error);
                        await sock.sendMessage(chatId, { 
                            text: '❌ Error processing audio.' 
                        }, { quoted: msg });
                        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
                        cleanupFiles(inputPath, outputPath);
                        reject(error);
                    }
                })
                .on('error', async (err) => {
                    console.error('❌ FFmpeg error:', err);
                    await sock.sendMessage(chatId, { 
                        text: '❌ Conversion failed. The media might be corrupted.' 
                    }, { quoted: msg });
                    await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
                    cleanupFiles(inputPath, outputPath);
                    reject(err);
                });

            // Set timeout for conversion (3 minutes max)
            const timeout = setTimeout(() => {
                ff.kill();
                reject(new Error('Conversion timeout - media too long'));
            }, 3 * 60 * 1000);

            ff.on('end', () => clearTimeout(timeout));
            ff.on('error', () => clearTimeout(timeout));
            
            ff.save(outputPath);
        });

    } catch (err) {
        console.error('❌ Audio conversion error:', err);
        await sock.sendMessage(chatId, { 
            text: `❌ Error: ${err.message}` 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// Convert Sticker to Image 
if (command === 'toimg') {
    const isSticker = msg.message?.stickerMessage ||
        msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.stickerMessage;

    const targetMsg = msg.message?.stickerMessage ? msg :
        msg.message?.extendedTextMessage?.contextInfo?.quotedMessage ? {
            message: msg.message.extendedTextMessage.contextInfo.quotedMessage,
            key: {
                remoteJid: chatId,
                id: msg.message.extendedTextMessage.contextInfo.stanzaId,
                fromMe: false,
                participant: msg.message.extendedTextMessage.contextInfo.participant,
            }
        } : null;

    if (!isSticker || !targetMsg) {
        await sock.sendMessage(chatId, { 
            text: `❌ Reply to a sticker with \\${currentPrefix}to-img to convert it.\n\n*Supported:* All sticker formats to image` 
        }, { quoted: msg });
        return;
    }

    try {
        console.log("🔄 Downloading sticker media...");
        await sock.sendMessage(chatId, { react: { text: "⬇️", key: msg.key } });
        
        const media = await downloadMediaMessage(
            targetMsg,
            'buffer',
            {},
            { reuploadRequest: sock.updateMediaMessage }
        );
        console.log("✅ Sticker media downloaded.");

        await sock.sendMessage(chatId, { react: { text: "🖼️", key: msg.key } });
        
        await sock.sendMessage(chatId, {
            image: media,
            caption: '🖼️ Sticker successfully converted to image!',
        }, { quoted: msg });

        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
        console.log("🎉 Image sent successfully!");

    } catch (err) {
        console.error("❌ Error in sticker to image conversion:", err);
        await sock.sendMessage(chatId, {
            text: `❌ Failed to convert sticker: ${err.message}`
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}


// Convert Image/Video to Sticker
if (command === 'sticker') {
    const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
    const isQuotedImage = quoted?.imageMessage;
    const isQuotedVideo = quoted?.videoMessage;
    const isDirectImage = msg.message.imageMessage;
    const isDirectVideo = msg.message.videoMessage;

    const targetMedia = isQuotedImage || isQuotedVideo ? { message: quoted } : 
                       (isDirectImage || isDirectVideo ? msg : null);

    if (!targetMedia) {
        await sock.sendMessage(chatId, { 
            text: `❌ Reply to an image or video with \\${currentPrefix}sticker to convert it.\n\n*Supported:* Images, Videos (up to 10 seconds)` 
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "🛠️", key: msg.key } });
    console.log("🟡 Detected valid media for sticker conversion");

    try {
        // Check file size for videos
        const isVideo = isQuotedVideo || isDirectVideo;
        if (isVideo) {
            const videoSize = (isQuotedVideo || isDirectVideo).fileLength || 0;
            if (videoSize > 15 * 1024 * 1024) { // 15MB limit for videos
                await sock.sendMessage(chatId, { 
                    text: "❌ Video is too large for sticker conversion. Maximum 15MB." 
                }, { quoted: msg });
                await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
                return;
            }
        }

        await sock.sendMessage(chatId, { react: { text: "⬇️", key: msg.key } });
        
        const buffer = await downloadMediaMessage(
            targetMedia,
            'buffer',
            {},
            { reuploadRequest: sock.updateMediaMessage }
        );
        console.log("🟢 Media downloaded");

        const tempDir = path.join(__dirname, '../uploads/temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const timestamp = Date.now();
        const fileExtension = isVideo ? 'mp4' : 'jpg';
        const inputPath = path.join(tempDir, `sticker_input_${timestamp}.${fileExtension}`);
        const outputPath = path.join(tempDir, `sticker_output_${timestamp}.webp`);

        fs.writeFileSync(inputPath, buffer);
        console.log("🟢 Buffer saved to", inputPath);

        await sock.sendMessage(chatId, { react: { text: "🔧", key: msg.key } });

        // Use fluent-ffmpeg instead of exec for better reliability
        await new Promise((resolve, reject) => {
            let ff = ffmpeg(inputPath);

            if (isVideo) {
                // Video to WebP sticker (animated)
                ff = ff
                    .outputOptions([
                        '-vf', 'scale=512:512',
                        '-vcodec', 'libwebp',
                        '-lossless', '0',
                        '-q:v', '70',
                        '-preset', 'default',
                        '-loop', '0',
                        '-an',
                        '-t', '10', // Limit to 10 seconds
                        '-fps_mode', 'vfr'
                    ]);
                console.log("🟢 Converting video to animated sticker...");
            } else {
                // Image to WebP sticker (static)
                ff = ff
                    .outputOptions([
                       '-vf', 'scale=512:512',
                        '-vcodec', 'libwebp',
                        '-lossless', '1',
                        '-q:v', '80',
                        '-preset', 'default',
                        '-loop', '0',
                        '-an'
                    ]);
                console.log("🟢 Converting image to sticker...");
            }

            ff
                .on('start', (cmd) => console.log('FFmpeg command:', cmd))
                .on('end', async () => {
                    console.log("✅ FFmpeg completed.");
                    
                    try {
                        const sticker = fs.readFileSync(outputPath);
                        const fileSizeKB = sticker.length / 1024;
                        
                        if (fileSizeKB > 500) {
                            await sock.sendMessage(chatId, { 
                                text: "❌ Sticker file too large (>500KB). Try with a shorter video or smaller image." 
                            }, { quoted: msg });
                        } else {
                            await sock.sendMessage(chatId, { sticker }, { quoted: msg });
                            console.log("✅ Sticker sent successfully!");
                        }

                        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
                        
                    } catch (readErr) {
                        console.error("❌ Error reading output file:", readErr);
                        await sock.sendMessage(chatId, { 
                            text: "❌ Failed to create sticker from media." 
                        }, { quoted: msg });
                    }

                    // Cleanup
                    cleanupFiles(inputPath, outputPath);
                    resolve();
                })
                .on('error', async (err) => {
                    console.error("❌ FFmpeg Error:", err);
                    await sock.sendMessage(chatId, { 
                        text: "❌ Failed to convert media to sticker." 
                    }, { quoted: msg });
                    await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
                    
                    cleanupFiles(inputPath, outputPath);
                    reject(err);
                })
                .save(outputPath);
        });

    } catch (err) {
        console.error("❌ Download error:", err);
        await sock.sendMessage(chatId, { 
            text: "❌ Failed to download media." 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// Enhanced cleanup function
function cleanupFiles(...filePaths) {
    filePaths.forEach(filePath => {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`🧹 Cleaned up: ${filePath}`);
            }
        } catch (cleanupError) {
            console.log(`⚠️ Could not delete ${filePath}:`, cleanupError.message);
        }
    });
}

// Convert Sticker to Video 
if (command === 'tovid') {
    const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
    const isQuotedSticker = quoted?.stickerMessage;
    const isDirectSticker = msg.message.stickerMessage;

    const targetSticker = isQuotedSticker ? { message: quoted } : 
                         (isDirectSticker ? msg : null);

    if (!targetSticker) {
        await sock.sendMessage(chatId, { 
            text: `❌ Reply to a sticker with \\${currentPrefix}tovid to convert it to video.` 
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "🛠️", key: msg.key } });

    try {
        const buffer = await downloadMediaMessage(
            targetSticker,
            'buffer',
            {},
            { reuploadRequest: sock.updateMediaMessage }
        );

        const tempDir = path.join(__dirname, '../uploads/temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const timestamp = Date.now();
        const inputPath = path.join(tempDir, `input_${timestamp}.webp`);
        const outputPath = path.join(tempDir, `output_${timestamp}.mp4`);

        fs.writeFileSync(inputPath, buffer);

        // Method 1: Try direct FFmpeg conversion first
        const ffmpegCommand = `ffmpeg -y -i "${inputPath}" -c:v libx264 -pix_fmt yuv420p -crf 23 -preset medium -movflags +faststart "${outputPath}"`;
        
        exec(ffmpegCommand, async (error) => {
            if (!error && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
                // Success with direct conversion
                await sendVideo(outputPath);
            } else {
                // Method 2: Use Sharp to convert to PNG first, then to video
                await convertWithSharp(inputPath, outputPath);
            }
            
            // Cleanup
            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        });

        async function convertWithSharp(inputPath, outputPath) {
            try {
                // Get image metadata to check if it's animated
                const metadata = await sharp(inputPath).metadata();
                
                if (metadata.pages && metadata.pages > 1) {
                    // Animated WebP - extract frames
                    const framesDir = path.join(tempDir, `frames_${timestamp}`);
                    if (!fs.existsSync(framesDir)) {
                        fs.mkdirSync(framesDir, { recursive: true });
                    }

                    // Extract each frame
                    for (let i = 0; i < metadata.pages; i++) {
                        const framePath = path.join(framesDir, `frame_${i.toString().padStart(3, '0')}.png`);
                        await sharp(inputPath, { page: i })
                            .png()
                            .toFile(framePath);
                    }

                    // Convert frames to video
                    const frameCommand = `ffmpeg -y -framerate 10 -i "${framesDir}/frame_%03d.png" -c:v libx264 -pix_fmt yuv420p -crf 23 -preset medium "${outputPath}"`;
                    
                    exec(frameCommand, async (frameError) => {
                        if (!frameError && fs.existsSync(outputPath)) {
                            await sendVideo(outputPath);
                        } else {
                            await sock.sendMessage(chatId, { 
                                text: "❌ Failed to convert animated sticker." 
                            }, { quoted: msg });
                        }
                        // Cleanup frames directory
                        if (fs.existsSync(framesDir)) {
                            fs.rmSync(framesDir, { recursive: true, force: true });
                        }
                    });
                } else {
                    // Static WebP - convert directly
                    const pngPath = path.join(tempDir, `static_${timestamp}.png`);
                    await sharp(inputPath).png().toFile(pngPath);
                    
                    const staticCommand = `ffmpeg -y -loop 1 -i "${pngPath}" -t 3 -c:v libx264 -pix_fmt yuv420p -crf 23 -preset medium "${outputPath}"`;
                    
                    exec(staticCommand, async (staticError) => {
                        if (!staticError && fs.existsSync(outputPath)) {
                            await sendVideo(outputPath);
                        } else {
                            await sock.sendMessage(chatId, { 
                                text: "❌ Failed to convert static sticker." 
                            }, { quoted: msg });
                        }
                        if (fs.existsSync(pngPath)) fs.unlinkSync(pngPath);
                    });
                }
            } catch (sharpError) {
                console.error("Sharp conversion error:", sharpError);
                await sock.sendMessage(chatId, { 
                    text: "❌ Sticker conversion failed." 
                }, { quoted: msg });
            }
        }

        async function sendVideo(videoPath) {
            try {
                const videoBuffer = fs.readFileSync(videoPath);
                await sock.sendMessage(chatId, { 
                    video: videoBuffer,
                    caption: '✅ Sticker converted to video',
                    mimetype: 'video/mp4'
                }, { quoted: msg });
                await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
                
                // Cleanup output
                if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
            } catch (sendError) {
                console.error("Error sending video:", sendError);
                await sock.sendMessage(chatId, { 
                    text: "❌ Error sending converted video." 
                }, { quoted: msg });
            }
        }

    } catch (err) {
        console.error("❌ Error:", err);
        await sock.sendMessage(chatId, { 
            text: "❌ Failed to process sticker." 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}
// Main Gemini AI Chat
if (command === 'gemini') {
    const question = args.join(' ').trim();
    
    // Show usage if no question provided
    if (!question) {
        await sock.sendMessage(chatId, { 
            text: `❌ Please provide a question for Gemini AI.\n\n*Usage:* \\${currentPrefix}gemini <your question>\n\n*Examples:*\n\\${currentPrefix}gemini Explain quantum physics\n\\${currentPrefix}gemini Write a poem about nature` 
        }, { quoted: msg });
        return;
    }
    
    await sock.sendMessage(chatId, { react: { text: "👨‍💻", key: msg.key } });

    try {
        const responseMessage = await GeminiMessage(question);
        await sock.sendMessage(chatId, { text: responseMessage }, { quoted: msg });
        console.log(`Response: ${responseMessage}`);
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
    } catch (error) {
        console.error('Error sending message:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ Failed to get response from Gemini AI.\n\n*Error:* ${error.message}\n\nMake sure your API key is configured correctly.` 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// Test API Key
if (command === 'test-key') {
    // Show usage if help requested
    if (args[0] === 'help' || args[0] === '?') {
        await sock.sendMessage(chatId, { 
            text: `🔧 *Gemini API Key Test*\n\n*Usage:* \\${currentPrefix}test-key\n\n*Purpose:* Tests if your Gemini API key is working properly and shows available models.` 
        }, { quoted: msg });
        return;
    }
    
    try {
        const testUrls = [
            `https://generativelanguage.googleapis.com/v1/models?key=${config.GEMINI_API}`,
            `https://generativelanguage.googleapis.com/v1beta/models?key=${config.GEMINI_API}`
        ];
        
        let workingUrl = null;
        
        for (const testUrl of testUrls) {
            try {
                console.log(`Testing: ${testUrl}`);
                const response = await axios.get(testUrl);
                
                if (response.status === 200) {
                    const data = response.data;
                    workingUrl = testUrl;
                    await sock.sendMessage(chatId, {
                        text: `✅ API Key is WORKING!\n\nEndpoint: ${testUrl.split('?')[0]}\nAvailable models: ${data.models ? data.models.length : 'Unknown'}\n\nGemini AI is now ready! 🚀`
                    });
                    break;
                }
            } catch (error) {
                console.log(`❌ Endpoint failed: ${testUrl}`);
                continue;
            }
        }
        
        if (!workingUrl) {
            await sock.sendMessage(chatId, {
                text: `❌ API Key test failed on all endpoints.\n\n*Troubleshooting:*\n1. Check if your API key is valid\n2. Enable Gemini API in Google Cloud Console\n3. Set up billing properly\n4. Check API key permissions\n\nUse *\\${currentPrefix}test-key help* for usage info.`
            });
        }
        
    } catch (error) {
        await sock.sendMessage(chatId, {
            text: `❌ API Key test error: ${error.message}\n\nUse *\\${currentPrefix}test-key help* for usage information.`
        });
    }
}

// List Available Models
if (command === 'list-models') {
    // Show usage if help requested
    if (args[0] === 'help' || args[0] === '?') {
        await sock.sendMessage(chatId, { 
            text: `📋 *List Gemini Models*\n\n*Usage:* \\${currentPrefix}list-models\n\n*Purpose:* Finds and displays the working Gemini model for this bot.` 
        }, { quoted: msg });
        return;
    }
    
    try {
        await sock.sendMessage(chatId, { react: { text: "🔍", key: msg.key } });
        
        // Import the Gemini module properly
        const { findWorkingModel } = require('../controllers/Gemini');
        const modelName = await findWorkingModel();
        
        await sock.sendMessage(chatId, {
            text: `✅ Working model found: ${modelName}\n\nTry using *\\${currentPrefix}gemini* now! 🚀`
        });
        
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
    } catch (error) {
        await sock.sendMessage(chatId, {
            text: `❌ Error finding models: ${error.message}\n\n*Usage:* \\${currentPrefix}list-models\nCheck console for detailed model list.`
        });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// Gemini Roasting (Fun/Sarcastic Responses)
if (command === 'gemini-roasting') {
    const question = args.join(' ').trim();
    
    // Show usage if no question provided
    if (!question) {
        await sock.sendMessage(chatId, { 
            text: `❌ Please provide something for Gemini to roast.\n\n*Usage:* \\${currentPrefix}gemini-roasting <text to roast>\n\n*Examples:*\n\\${currentPrefix}gemini-roasting my coding skills\n\\${currentPrefix}gemini-roasting pineapple on pizza` 
        }, { quoted: msg });
        return;
    }
    
    await sock.sendMessage(chatId, { react: { text: "👨‍💻", key: msg.key } });

    try {
        const responseMessage = await GeminiRoastingMessage(question);
        await sock.sendMessage(chatId, { text: responseMessage }, { quoted: msg });
        console.log(`Response: ${responseMessage}`);
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
    } catch (error) {
        console.error('Error sending message:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ Failed to get roast from Gemini.\n\n*Error:* ${error.message}` 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// Gemini Image Analysis
if (command === 'gemini-img') {
    const quotedMessage = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
    const getPrompt = args.join(' ').trim();

    // Show usage if no image or prompt provided
    if (!quotedMessage?.imageMessage) {
        await sock.sendMessage(chatId, { 
            text: `❌ Reply to an image with \\${currentPrefix}gemini-img to analyze it.\n\n*Usage:* \\${currentPrefix}gemini-img [optional prompt]\n\n*Examples:*\n\\${currentPrefix}gemini-img (reply to image)\n\\${currentPrefix}gemini-img describe this image\n\\${currentPrefix}gemini-img what's in this photo?` 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "👨‍💻", key: msg.key } });

    const buffer = await downloadMediaMessage({ message: quotedMessage }, 'buffer');
    const inputFilePath = path.join(__dirname, '../uploads/input-image.jpg');
    fs.writeFileSync(inputFilePath, buffer);

    try {
        const analysisResult = await GeminiImage(inputFilePath, getPrompt);
        await sock.sendMessage(chatId, { text: analysisResult }, { quoted: msg });
        console.log(`Response: ${analysisResult}`);
    } catch (error) {
        await sock.sendMessage(chatId, { 
            text: `❌ Failed to analyze image: ${error.message}` 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    } finally {
        fs.unlinkSync(inputFilePath);
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
    }
}

// Gemini Roasting Image (Fun/Sarcastic Image Analysis)
if (command === 'gemini-roasting-img') {
    const quotedMessage = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
    const getPrompt = args.join(' ').trim();

    // Show usage if no image provided
    if (!quotedMessage?.imageMessage) {
        await sock.sendMessage(chatId, { 
            text: `❌ Reply to an image with \\${currentPrefix}gemini-roasting-img to roast it.\n\n*Usage:* \\${currentPrefix}gemini-roasting-img [optional prompt]\n\n*Examples:*\n\\${currentPrefix}gemini-roasting-img (reply to image)\n\\${currentPrefix}gemini-roasting-img roast this person's fashion\n\\${currentPrefix}gemini-roasting-img make fun of this meme` 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "👨‍💻", key: msg.key } });

    const buffer = await downloadMediaMessage({ message: quotedMessage }, 'buffer');
    const inputFilePath = path.join(__dirname, '../upload/input-image.jpg');
    fs.writeFileSync(inputFilePath, buffer);

    try {
        const analysisResult = await GeminiImageRoasting(inputFilePath, getPrompt);
        await sock.sendMessage(chatId, { text: analysisResult }, { quoted: msg });
        console.log(`Response: ${analysisResult}`);
    } catch (error) {
        await sock.sendMessage(chatId, { 
            text: `❌ Failed to roast image: ${error.message}` 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    } finally {
        fs.unlinkSync(inputFilePath);
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
    }
}

// ==============================================
// 🔹GROUP COMMANDS
// ==============================================

       
// Group Kicked User
if (command === 'eXe') {
    await sock.sendMessage(chatId, { react: { text: "👨‍💻", key: msg.key } });
    
    let usersToKick = [];
    
    // Check for mentioned users (@)
    const mentionedJid = msg.message.extendedTextMessage?.contextInfo?.mentionedJid;
    if (mentionedJid && mentionedJid.length > 0) {
        usersToKick = mentionedJid;
    }
    // Check for quoted/replied message
    else if (msg.message.extendedTextMessage?.contextInfo?.participant) {
        usersToKick = [msg.message.extendedTextMessage.contextInfo.participant];
    }
    
    if (usersToKick.length > 0) {
        try {
            await sock.groupParticipantsUpdate(chatId, usersToKick, "remove");
            await sock.sendMessage(chatId, { text: "User(s) Kicked!" }, { quoted: msg });
            await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
        } catch (error) {
            console.error('Error kicking user:', error);
            await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
        }
    } else {
        await sock.sendMessage(chatId, { text: "Please mention a user (@) or reply to a user's message to Kick." }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// Desire Leaves Group Chat
if (command === 'Desire-eXit') {
    await sock.sendMessage(chatId, { text: "*Desire-eXe is done eXecuting*" });
    await sock.groupLeave(chatId);
}

// ✅ Set Group Profile Picture
if (command === 'set-gcpp') {
    const chatId = msg.key.remoteJid;
    const isGroup = chatId.endsWith('@g.us');
    if (!isGroup) return;

    const metadata = await sock.groupMetadata(chatId);
    const admins = metadata.participants.filter(p => p.admin);
    const isAdmin = admins.some(p => p.id === msg.key.participant);

    if (!isAdmin) {
        await sock.sendMessage(chatId, { 
            text: '❌ Only admins can change the group profile picture.' 
        }, { quoted: msg });
        return;
    }

    const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quotedMsg?.imageMessage) {
        await sock.sendMessage(chatId, { 
            text: "⚠️ Reply to an image with " + currentPrefix + "setpfp to change the group profile picture."
        }, { quoted: msg });
        return;
    }

    try {
        // ✅ Proper media download
        const mediaBuffer = await downloadMediaMessage(
            { message: quotedMsg }, 
            'buffer',
            {},
            { logger: P({ level: 'silent' }) }
        );

        await sock.updateProfilePicture(chatId, mediaBuffer);
        await sock.sendMessage(chatId, { text: '✅ Group profile picture updated successfully!' });
    } catch (err) {
        await sock.sendMessage(chatId, { text: `❌ Failed: ${err.message}` });
    }
}

// ✅ Remove Group Profile Picture
if (command === 'removepp') {
    const chatId = msg.key.remoteJid;
    const isGroup = chatId.endsWith('@g.us');
    if (!isGroup) return;

    const metadata = await sock.groupMetadata(chatId);
    const admins = metadata.participants.filter(p => p.admin);
    const isAdmin = admins.some(p => p.id === msg.key.participant);

    if (!isAdmin) {
        await sock.sendMessage(chatId, { 
            text: '❌ Only admins can remove the group profile picture.' 
        }, { quoted: msg });
        return;
    }

    try {
        // Use reliable image URLs that won't give 404
        const defaultImages = [
            "https://i.imgur.com/7B6Q6ZQ.png", // Group icon
            "https://i.imgur.com/1s6Qz8v.png", // Grey placeholder
            "https://i.imgur.com/3Q6ZQ7u.png", // Green icon
            "https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" // WhatsApp logo
        ];

        let success = false;
        for (const imageUrl of defaultImages) {
            try {
                await sock.updateProfilePicture(chatId, { url: imageUrl });
                success = true;
                await sock.sendMessage(chatId, { text: "✅ Group profile picture set to default icon." });
                break;
            } catch (urlError) {
                console.log(`URL failed: ${imageUrl}, trying next...`);
                continue;
            }
        }

        if (!success) {
            throw new Error('All default image URLs failed');
        }
        
    } catch (err) {
        console.error("Remove PP error:", err);
        
        if (err.message.includes('404')) {
            await sock.sendMessage(chatId, { 
                text: '❌ Default image not found. Please try a different image URL.' 
            }, { quoted: msg });
        } else if (err.message.includes('429')) {
            await sock.sendMessage(chatId, { 
                text: '❌ Rate limited. Please wait 5-10 minutes.' 
            }, { quoted: msg });
        } else {
            await sock.sendMessage(chatId, { 
                text: `❌ Failed: ${err.message}` 
            }, { quoted: msg });
        }
    }
}

// Send A Kill Gif
if (command === 'kill') {
    try {
        // List of working kill-related GIFs
        const killGifs = [
            'https://media.giphy.com/media/l0Exk8EUz7gRgPRm8/giphy.gif', // Gun shooting
            'https://media.giphy.com/media/3o7aD2d7hy9ktXNDP2/giphy.gif', // Explosion
            'https://media.giphy.com/media/xT5LMHxhOfscxPfIfm/giphy.gif', // Knife throw
            'https://media.giphy.com/media/26uf759LlDftqZNVm/giphy.gif', // Bomb explosion
            'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif', // Sword slash
            'https://media.giphy.com/media/3o7abGQa0aRsohveX6/giphy.gif', // Fireball
            'https://media.giphy.com/media/26ufnwz3wDUli7GU0/giphy.gif', // Laser blast
            'https://media.giphy.com/media/l0HlN3skHzHz8m0q4/giphy.gif'  // Magic spell
        ];

        // Randomly select a GIF
        const randomGif = killGifs[Math.floor(Math.random() * killGifs.length)];

        // List of death messages
        const deathMessages = [
            'has been eliminated! 💀',
            'was sent to the shadow realm! 👻',
            'has met their doom! ☠️',
            'got rekt by the bot! 🤖',
            'has been defeated! 🎯',
            'is no more! 💥',
            'got owned! 🔥',
            'has been terminated! ⚡'
        ];

        // Randomly select a death message
        const randomMessage = deathMessages[Math.floor(Math.random() * deathMessages.length)];

        // Check if it's a reply to someone
        const quotedMsg = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
        const quotedUser = quotedMsg ? msg.message.extendedTextMessage.contextInfo.participant : null;

        let messageText = '';
        let mentions = [];

        if (quotedUser) {
            // If replying to someone, target that person
            const quotedName = quotedUser.split('@')[0];
            const senderName = msg.key.participant ? msg.key.participant.split('@')[0] : 'Someone';
            
            messageText = `🔫 @${senderName} killed @${quotedName}! ${randomMessage}`;
            mentions = [quotedUser, msg.key.participant].filter(Boolean);
        } else {
            // If no reply, just send a general kill message
            const senderName = msg.key.participant ? msg.key.participant.split('@')[0] : 'Anonymous';
            messageText = `🔫 @${senderName} is on a killing spree! ${randomMessage}`;
            mentions = msg.key.participant ? [msg.key.participant] : [];
        }

        // Send the kill message with GIF
        await sock.sendMessage(msg.key.remoteJid, {
            video: { url: randomGif },
            gifPlayback: true,
            caption: messageText,
            mentions: mentions
        });

    } catch (err) {
        console.error("Kill command error:", err);
        
        // Fallback: Send text-only message if GIF fails
        try {
            await sock.sendMessage(msg.key.remoteJid, {
                text: '💀 Someone just got eliminated! (GIF failed to load)'
            });
        } catch (fallbackError) {
            console.error("Fallback also failed:", fallbackError);
        }
    }
}

// List Admins
if (command === 'admins') {
  try {
    if (!msg.key.remoteJid.endsWith('@g.us')) {
      await sock.sendMessage(chatId, { text: '❌ This command only works in groups.' });
      return;
    }

    const metadata = await sock.groupMetadata(chatId);
    const admins = metadata.participants.filter(p => p.admin !== null);
    
    if (admins.length === 0) {
      await sock.sendMessage(chatId, { text: '👥 No admins found in this group.' });
      return;
    }

    let text = `*👑 Group Admins - ${metadata.subject}*\n\n`;
    admins.forEach((admin, i) => {
      const username = admin.id.split('@')[0];
      const adminType = admin.admin === 'superadmin' ? ' (Owner)' : ' (Admin)';
      text += `${i + 1}. @${username}${adminType}\n`;
    });

    text += `\n*Total:* ${admins.length} admin(s)`;

    await sock.sendMessage(chatId, {
      text,
      mentions: admins.map(a => a.id)
    });

  } catch (err) {
    console.error('Error in admins command:', err);
    await sock.sendMessage(chatId, { text: '❌ Failed to fetch admin list.' });
  }
}


// Tagging All Members
if (command === 'tagall') {
    
    try {
        const metadata = await sock.groupMetadata(chatId);
        const participants = metadata.participants;

        const mentions = participants.map(p => p.id);

        let message = `🔥 *TAG ALL MEMBERS* 🔥\n\n`;
        message += `📌 *Group:* ${metadata.subject}\n`;
        message += `👥 *Total Members:* ${participants.length}\n\n`;
        message += `━━━━━━━━━━━━━━━━━━━\n`;

        // Fancy list symbols instead of numbers
        const symbols = ["✨", "🔥", "⚡", "🌙", "🌟", "💎", "🚀", "🎯", "💥", "🎉"];

        message += participants
            .map((p, i) => `${symbols[i % symbols.length]} 𝙐𝙨𝙚𝙧 → @${p.id.split('@')[0]}`)
            .join('\n');

        message += `\n━━━━━━━━━━━━━━━━━━━\n✅ Done tagging all!`;

        await sock.sendMessage(chatId, {
            text: message,
            mentions: mentions
        });
    } catch (error) {
        console.error('Error in tagall command:', error);
        await sock.sendMessage(chatId, { text: '❌ Failed to tag all members.' });
    }
} else if (command === 'Tagall') {
    try {
        // Make sure it's a group
        if (!msg.key.remoteJid.endsWith('@g.us')) {
            await sock.sendMessage(chatId, { text: "❌ This command only works in groups." }, { quoted: msg });
            return;
        }

        // Fetch group metadata
        const groupMetadata = await sock.groupMetadata(chatId);
        const participants = groupMetadata.participants;

        // Optional: Custom text after tagall
        const text = args.length > 0 ? args.join(" ") : "📢 *Tagging all members:*";

        // Create numbered list format
        let memberList = '';
        participants.forEach((participant, index) => {
            const username = participant.id.split('@')[0];
            memberList += `${index + 1}). @${username}\n`;
        });

        // Send message with mentions
        await sock.sendMessage(chatId, {
            text: `${text}\n\n${memberList}`,
            mentions: participants.map(p => p.id)
        }, { quoted: msg });

    } catch (e) {
        console.error(e);
        await sock.sendMessage(chatId, { text: "❌ Failed to tag all members." }, { quoted: msg });
    }
}

// Warn A Memmber
if (command === 'warn') {
    try {
        const chatId = msg.key.remoteJid;
        const isGroup = chatId.endsWith('@g.us');
        
        if (!isGroup) {
            await sock.sendMessage(chatId, { 
                text: '❌ This command only works in groups.' 
            });
            return;
        }

        // Get the target user (either mentioned or replied to)
        let targetUser = null;
        let reason = args.join(' ').trim();

        // Check if it's a reply to a message
        if (msg.message.extendedTextMessage?.contextInfo?.participant) {
            targetUser = msg.message.extendedTextMessage.contextInfo.participant;
            
            // Extract reason from message text if it exists
            const messageText = msg.message.extendedTextMessage.text || '';
            if (messageText.startsWith('\\warn')) {
                reason = messageText.replace('\\warn', '').trim();
            }
        }
        
        // If no reply, check for mentioned users
        if (!targetUser && msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
            targetUser = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
        }

        // If still no target, check args for @mention
        if (!targetUser && args.length > 0) {
            const mentionMatch = args[0].match(/@(\d+)/);
            if (mentionMatch) {
                targetUser = `${mentionMatch[1]}@s.whatsapp.net`;
                reason = args.slice(1).join(' ').trim();
            }
        }

        if (!targetUser) {
            await sock.sendMessage(chatId, { 
                text: "❌ Please reply to a user or mention someone to warn.\n\nUsage:" + currentPrefix + "warn @user [reason]"
            }, { quoted: msg });
            return;
        }

        // Check if warner is admin
        const groupMetadata = await sock.groupMetadata(chatId);
        const admins = groupMetadata.participants.filter(p => p.admin);
        const isAdmin = admins.some(p => p.id === (msg.key.participant || msg.key.remoteJid));

        if (!isAdmin) {
            await sock.sendMessage(chatId, { 
                text: '❌ Only admins can warn users.' 
            }, { quoted: msg });
            return;
        }

        // Check if target is admin
        const targetIsAdmin = admins.some(p => p.id === targetUser);
        if (targetIsAdmin) {
            await sock.sendMessage(chatId, { 
                text: '❌ You cannot warn other admins.' 
            }, { quoted: msg });
            return;
        }

        // Initialize warnings system
        const warningsFile = './src/warnings.json';
        let warningsData = {};
        
        if (fs.existsSync(warningsFile)) {
            try {
                warningsData = JSON.parse(fs.readFileSync(warningsFile));
            } catch (e) {
                warningsData = {};
            }
        }

        if (!warningsData[chatId]) {
            warningsData[chatId] = {};
        }

        if (!warningsData[chatId][targetUser]) {
            warningsData[chatId][targetUser] = {
                count: 0,
                reasons: [],
                lastWarned: null
            };
        }

        // Update warnings
        warningsData[chatId][targetUser].count++;
        warningsData[chatId][targetUser].reasons.push(reason || 'No reason provided');
        warningsData[chatId][targetUser].lastWarned = new Date().toISOString();

        // Save warnings data
        fs.writeFileSync(warningsFile, JSON.stringify(warningsData, null, 2));

        const warnCount = warningsData[chatId][targetUser].count;
        const targetName = targetUser.split('@')[0];
        const warnerName = (msg.key.participant || msg.key.remoteJid).split('@')[0];

        // Create warning message
        let warningMessage = `⚠️ *WARNING* ⚠️\n\n`;
        warningMessage += `👤 User: @${targetName}\n`;
        warningMessage += `🔢 Warning: ${warnCount}/3\n`;
        warningMessage += `📝 Reason: ${reason || 'No reason provided'}\n`;
        warningMessage += `🛡️ Warned by: @${warnerName}\n\n`;

if (warnCount >= 3) {
    warningMessage += `🚨 *FINAL WARNING!* User has been removed for exceeding 3 warnings!`;

    // Auto-kick after 3 warnings
    await sock.groupParticipantsUpdate(chatId, [targetUser], 'remove');
} else if (warnCount === 2) {
    warningMessage += `⚠ *Second warning!* One more and actions will be taken!`;
} else {
    warningMessage += `ℹ Be careful! Further violations will lead to more warnings.`;
}


        // Send warning message
        await sock.sendMessage(chatId, {
            text: warningMessage,
            mentions: [targetUser, (msg.key.participant || msg.key.remoteJid)]
        }, { quoted: msg });

    } catch (err) {
        console.error("Warn command error:", err);
        await sock.sendMessage(msg.key.remoteJid, {
            text: `❌ Failed to warn user: ${err.message}`
        }, { quoted: msg });
    }
}

// List All Warnings For A Member
if (command === 'warnings') {
    try {
        const chatId = msg.key.remoteJid;
        const isGroup = chatId.endsWith('@g.us');
        
        if (!isGroup) {
            await sock.sendMessage(chatId, { 
                text: '⚠️ This command only works in groups.' 
            });
            return;
        }

        // Get target user
        let targetUser = null;

        // Check reply
        if (msg.message.extendedTextMessage?.contextInfo?.participant) {
            targetUser = msg.message.extendedTextMessage.contextInfo.participant;
        }
        // Check mention
        else if (msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
            targetUser = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
        }
        // Check args
        else if (args.length > 0) {
            const mentionMatch = args[0].match(/@(\d+)/);
            if (mentionMatch) {
                targetUser = `${mentionMatch[1]}@s.whatsapp.net`;
            }
        }
        // Default to sender
        else {
            targetUser = msg.key.participant || msg.key.remoteJid;
        }

        // Load warnings data
        const warningsFile = './src/warnings.json';
        let warningsData = {};
        
        if (fs.existsSync(warningsFile)) {
            try {
                warningsData = JSON.parse(fs.readFileSync(warningsFile));
            } catch (e) {
                warningsData = {};
            }
        }

        const userWarnings = warningsData[chatId]?.[targetUser];
        const targetName = targetUser.split('@')[0];

        if (!userWarnings || userWarnings.count === 0) {
            await sock.sendMessage(chatId, {
                text: `✅ @${targetName} has no warnings in this group.`,
                mentions: [targetUser]
            }, { quoted: msg });
            return;
        }

        let warningsMessage = `📋 *Warnings for @${targetName}*\n\n`;
        warningsMessage += `🔢 Total Warnings: ${userWarnings.count}/3\n`;
        warningsMessage += `🕒 Last Warned: ${new Date(userWarnings.lastWarned).toLocaleString()}\n\n`;
        warningsMessage += `📝 Warning Reasons:\n`;

        userWarnings.reasons.forEach((reason, index) => {
            warningsMessage += `${index + 1}. ${reason}\n`;
        });

        if (userWarnings.count >= 3) {
            warningsMessage += `\n🚨 *USER HAS MAX WARNINGS!* Consider taking action.`;
        }

        await sock.sendMessage(chatId, {
            text: warningsMessage,
            mentions: [targetUser]
        }, { quoted: msg });

    } catch (err) {
        console.error("Warnings command error:", err);
        await sock.sendMessage(msg.key.remoteJid, {
            text: `❌ Failed to check warnings: ${err.message}`
        });
    }
}


// Clear All Warnings For A Member
if (command === 'clearwarns') {
    try {
        const chatId = msg.key.remoteJid;
        const isGroup = chatId.endsWith('@g.us');
        
        if (!isGroup) return;

        // Check if user is admin
        const groupMetadata = await sock.groupMetadata(chatId);
        const admins = groupMetadata.participants.filter(p => p.admin);
        const isAdmin = admins.some(p => p.id === (msg.key.participant || msg.key.remoteJid));

        if (!isAdmin) {
            await sock.sendMessage(chatId, { 
                text: '❌ Only admins can clear warnings.' 
            });
            return;
        }

        let targetUser = null;

        if (msg.message.extendedTextMessage?.contextInfo?.participant) {
            targetUser = msg.message.extendedTextMessage.contextInfo.participant;
        }
        else if (msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
            targetUser = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
        }
        else if (args.length > 0) {
            const mentionMatch = args[0].match(/@(\d+)/);
            if (mentionMatch) {
                targetUser = `${mentionMatch[1]}@s.whatsapp.net`;
            }
        }

        if (!targetUser) {
            await sock.sendMessage(chatId, { 
                text: '❌ Please reply to or mention a user to clear their warnings.' 
            }, { quoted: msg });
            return;
        }

        // Load and clear warnings
        const warningsFile = './src/warnings.json';
        let warningsData = {};
        
        if (fs.existsSync(warningsFile)) {
            try {
                warningsData = JSON.parse(fs.readFileSync(warningsFile));
            } catch (e) {
                warningsData = {};
            }
        }

        if (warningsData[chatId]?.[targetUser]) {
            delete warningsData[chatId][targetUser];
            fs.writeFileSync(warningsFile, JSON.stringify(warningsData, null, 2));
            
            await sock.sendMessage(chatId, {
                text: `✅ All warnings cleared for @${targetUser.split('@')[0]}`,
                mentions: [targetUser]
            }, { quoted: msg });
        } else {
            await sock.sendMessage(chatId, {
                text: `✅ @${targetUser.split('@')[0]} has no warnings to clear.`,
                mentions: [targetUser]
            }, { quoted: msg });
        }

    } catch (err) {
        console.error("Clear warns error:", err);
        await sock.sendMessage(msg.key.remoteJid, {
            text: `❌ Failed to clear warnings: ${err.message}`
        });
    }
}
// Remove one Warning For A Member
if (command === 'unwarn') { 
    const chatId = msg.key.remoteJid;
    const isGroup = chatId.endsWith('@g.us');
    
    if (!isGroup) {
        await sock.sendMessage(chatId, { text: '⚠️ This command only works in groups.' });
        return;
    }

    // Get target user (mentioned or replied to)
    let targetUser = null;

    // Check if it's a reply
    if (msg.message.extendedTextMessage?.contextInfo?.participant) {
        targetUser = msg.message.extendedTextMessage.contextInfo.participant;
    }
    // Check if user is mentioned
    else if (msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
        targetUser = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
    }
    // Check args for @mention
    else if (args.length > 0) {
        const mentionMatch = args[0].match(/@(\d+)/);
        if (mentionMatch) {
            targetUser = `${mentionMatch[1]}@s.whatsapp.net`;
        }
    }

    if (!targetUser) {
        await sock.sendMessage(chatId, { 
            text: '⚠️ Please reply to a user or mention someone to unwarn.\nUsage: ~unwarn @user' 
        }, { quoted: msg });
        return;
    }

    // Check if user is admin
    const groupMetadata = await sock.groupMetadata(chatId);
    const admins = groupMetadata.participants.filter(p => p.admin);
    const isAdmin = admins.some(p => p.id === (msg.key.participant || msg.key.remoteJid));

    if (!isAdmin) {
        await sock.sendMessage(chatId, { 
            text: '❌ Only admins can remove warnings.' 
        }, { quoted: msg });
        return;
    }

    // Load warnings data
    const warningsFile = './src/warnings.json';
    let warningsData = {};
    
    if (fs.existsSync(warningsFile)) {
        try {
            warningsData = JSON.parse(fs.readFileSync(warningsFile));
        } catch (e) {
            warningsData = {};
        }
    }

    if (!warningsData[chatId]) warningsData[chatId] = {};
    if (!warningsData[chatId][targetUser]) {
        warningsData[chatId][targetUser] = {
            count: 0,
            reasons: [],
            lastWarned: null
        };
    }

    const currentWarnings = warningsData[chatId][targetUser].count;

    if (currentWarnings > 0) {
        // Decrease warning count
        warningsData[chatId][targetUser].count--;
        
        // Remove the last reason
        if (warningsData[chatId][targetUser].reasons.length > 0) {
            warningsData[chatId][targetUser].reasons.pop();
        }
        
        // Save updated warnings
        fs.writeFileSync(warningsFile, JSON.stringify(warningsData, null, 2));

        const newCount = warningsData[chatId][targetUser].count;
        await sock.sendMessage(chatId, {
            text: `✅ Removed a warning for @${targetUser.split('@')[0]} (${newCount}/3).`,
            mentions: [targetUser]
        }, { quoted: msg });
    } else {
        await sock.sendMessage(chatId, {
            text: `ℹ️ @${targetUser.split('@')[0]} has no warnings to remove.`,
            mentions: [targetUser]
        }, { quoted: msg });
    }
}

// Kick all Non-Admins (Use With Caution)
if (command === 'nuke') {
    const chatId = msg.key.remoteJid;
    const isGroup = chatId.endsWith('@g.us');
    
    if (!isGroup) {
        await sock.sendMessage(chatId, { text: '❌ This command only works in groups.' });
        return;
    }

    // Check if user is admin
    const metadata = await sock.groupMetadata(chatId);
    const sender = msg.key.participant || msg.key.remoteJid;
    const admins = metadata.participants.filter(p => p.admin);
    const isSenderAdmin = admins.some(a => a.id === sender);

    if (!isSenderAdmin) {
        await sock.sendMessage(chatId, { 
            text: '❌ You must be an admin to use this command.' 
        }, { quoted: msg });
        return;
    }

    // Check for confirmation
    const needsConfirmation = !args.includes('-y') && !args.includes('--yes');
    
    if (needsConfirmation) {
        const nonAdmins = metadata.participants.filter(p => !p.admin);
        
        if (nonAdmins.length === 0) {
            await sock.sendMessage(chatId, { 
                text: 'ℹ️ Everyone in this group is already an admin.' 
            }, { quoted: msg });
            return;
        }

        await sock.sendMessage(chatId, {
            text: `💣 *NUKE COMMAND CONFIRMATION*\n\n` +
                  `⚠️ This will remove ALL ${nonAdmins.length} non-admin members!\n\n` +
                  `🔴 *This action cannot be undone!*\n\n` +
                  `To proceed, use: \\nuke -y\n` +
                  `To cancel, ignore this message.`
        }, { quoted: msg });
        return;
    }

    // Proceed with nuke
    const nonAdmins = metadata.participants.filter(p => !p.admin).map(p => p.id);
    
    if (nonAdmins.length === 0) {
        await sock.sendMessage(chatId, { 
            text: 'ℹ️ Everyone in this group is already an admin.' 
        }, { quoted: msg });
        return;
    }

    // Send countdown message
    await sock.sendMessage(chatId, { 
        text: `💣 NUKING ${nonAdmins.length} NON-ADMINS IN 3 SECONDS...\n🚨 SAY YOUR GOODBYES!` 
    });

    // 3 second countdown
    await new Promise(resolve => setTimeout(resolve, 3000));

    let successCount = 0;
    let failCount = 0;

    // Remove non-admins in batches to avoid rate limits
    for (let i = 0; i < nonAdmins.length; i++) {
        const user = nonAdmins[i];
        try {
            await sock.groupParticipantsUpdate(chatId, [user], 'remove');
            successCount++;
            
            // Small delay between removals to avoid rate limits
            if (i < nonAdmins.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        } catch (err) {
            console.log(`Failed to remove ${user}: ${err.message}`);
            failCount++;
        }
    }

    // Send result
    let resultText = `💥 *NUKE COMPLETE*\n\n`;
    resultText += `✅ Successfully removed: ${successCount} members\n`;
    
    if (failCount > 0) {
        resultText += `❌ Failed to remove: ${failCount} members\n`;
        resultText += `(They might be admins now or have protection)`;
    }
    
    resultText += `\n\n🏠 Group population: ${metadata.participants.length - nonAdmins.length} members`;

    await sock.sendMessage(chatId, { text: resultText });
}

// Reset Group chat's Link
if (command === 'revoke-link') {
    const code = await sock.groupRevokeInvite(msg.key.remoteJid);
    await sock.sendMessage(msg.key.remoteJid, { text: `✅ Group invite link has been revoked.\nNew link: https://chat.whatsapp.com/${code}` });
}

// Group Chat Information
if (command === 'ginfo') {
    try {
        const chatId = msg.key.remoteJid;
        const metadata = await sock.groupMetadata(chatId);

        const groupName = metadata.subject || "Unnamed Group";
        const groupMembers = metadata.participants.length;
        const groupDesc = metadata.desc || "No description set.";
        const creationDate = new Date(metadata.creation * 1000).toLocaleDateString();
        
        // Find the superadmin (founder)
        const superAdmin = metadata.participants.find(p => p.admin === 'superadmin');
        const groupOwner = superAdmin ? `@${superAdmin.id.split('@')[0]}` : "Unknown";
        
        const admins = metadata.participants.filter(p => p.admin).length;
        const regularMembers = groupMembers - admins;

        // Try to get group profile picture
        let groupImage = null;
        try {
            groupImage = await sock.profilePictureUrl(chatId, 'image');
        } catch (e) {
            console.log("No group profile picture found");
        }

        const info = `📊 *GROUP INFORMATION* 📊

🏷️ *Name:* ${groupName}
👑 *Founder:* ${groupOwner}
📅 *Established:* ${creationDate}

📈 *Population:* ${groupMembers}
   ├─ 💎 Admins: ${admins}
   ├─ 👥 Members: ${regularMembers}
   └─ 📊 Admin Ratio: ${Math.round((admins / groupMembers) * 100)}%

📖 *About:*
"${groupDesc}"

🆔 *ID:* ${chatId.split('@')[0]}`;

        // Send with image if available, otherwise text only
        if (groupImage) {
            await sock.sendMessage(chatId, {
                image: { url: groupImage },
                caption: info,
                mentions: superAdmin ? [superAdmin.id] : []
            }, { quoted: msg });
        } else {
            await sock.sendMessage(chatId, { 
                text: info,
                mentions: superAdmin ? [superAdmin.id] : []
            }, { quoted: msg });
        }

    } catch (e) {
        console.error("Error fetching group info:", e);
        await sock.sendMessage(chatId, { text: "❌ Failed to fetch group information." }, { quoted: msg });
    }
}
// Tag
if (command === 'Tag') {
    const text = args.join(" ") || "👋 Hello everyone!";
    try {
        const metadata = await sock.groupMetadata(chatId);
        const mentions = metadata.participants.map(p => p.id);

        let message = `📢 *Broadcast Message* 📢\n\n${text}\n\n━━━━━━━━━━━━━━\n`;
        message += mentions
            .map((m, i) => `👨‍💻 @${m.split("@")[0]}`)
            .join("\n");

        await sock.sendMessage(chatId, {
            text: message,
            mentions: mentions
        });
    } catch (error) {
        console.error("Error in ~tag command:", error);
        await sock.sendMessage(chatId, { text: "❌ Failed to tag members." });
    }
}

// Invisible Tag
if (command === 'tag') {
    const text = args.join(" ") || "👀 Hidden message to all!";
    try {
        const metadata = await sock.groupMetadata(chatId);
        const mentions = metadata.participants.map(p => p.id);

        await sock.sendMessage(chatId, {
            text: text,
            mentions: mentions
        });
    } catch (error) {
        console.error("Error in ~hidetag command:", error);
        await sock.sendMessage(chatId, { text: "❌ Failed to hide tag." });
    }
}

// Block from Group chats 
if (command === 'block2') {
    try {
        if (!msg.key.remoteJid.endsWith("@g.us")) {
            await sock.sendMessage(chatId, { text: "❌ This command only works in groups." });
            return;
        }

        const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
        const quotedUser = contextInfo?.participant;

        if (!quotedUser) {
            await sock.sendMessage(chatId, { text: "❌ Reply to a user’s message with ~block2 to block them." });
            return;
        }

        await sock.updateBlockStatus(quotedUser, "block"); // block that user
        await sock.sendMessage(chatId, {
            text: `✅ User @${quotedUser.split("@")[0]} has been blocked.`,
            mentions: [quotedUser]
        });
    } catch (error) {
        console.error("Error in block2 command:", error);
        await sock.sendMessage(chatId, { text: "❌ Failed to block user." });
    }
}


// Unblock from Group chats 
if (command === 'unblock') {
    try {
        if (!msg.key.remoteJid.endsWith("@g.us")) {
            await sock.sendMessage(chatId, { text: "❌ This command only works in groups." });
            return;
        }

        const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
        const quotedUser = contextInfo?.participant;

        if (!quotedUser) {
            await sock.sendMessage(chatId, { text: "❌ Reply to a user’s message with ~unblock2 to unblock them." });
            return;
        }

        await sock.updateBlockStatus(quotedUser, "unblock"); // unblock that user
        await sock.sendMessage(chatId, {
            text: `✅ User @${quotedUser.split("@")[0]} has been unblocked.`,
            mentions: [quotedUser]
        });
    } catch (error) {
        console.error("Error in unblock2 command:", error);
        await sock.sendMessage(chatId, { text: "❌ Failed to unblock user." });
    }
}

// Detect Horny Members
if (command === 'detect-h') {
    await sock.sendMessage(chatId, { react: { text: "🔍", key: msg.key } });
    try {
        const metadata = await sock.groupMetadata(chatId);
        const participants = metadata.participants;

        if (!metadata || !participants || participants.length === 0) {
            throw new Error("No group participants found.");
        }

        // Randomly select one member
        const randomIndex = Math.floor(Math.random() * participants.length);
        const target = participants[randomIndex];
        const targetId = target.id;

        // Respond with a horny detection message
        const hornyLines = [
            "*You're acting way too down bad today...*",
            "*Suspicious levels of horniness detected!*",
            "*Caught in 4K being horny.*",
            "*Horny radar just pinged... and it's YOU.*",
            "*Your mind is 80% NSFW today, chill!*"
        ];

        const line = hornyLines[Math.floor(Math.random() * hornyLines.length)];

        await sock.sendMessage(chatId, {
            text: `@${targetId.split('@')[0]} ${line}`,
            mentions: [targetId]
        });

        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

    } catch (err) {
        console.error("Error in ~detecthorny:", err);
        await sock.sendMessage(chatId, {
            text: "Failed to scan horny levels. Try again later.",
        });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
} 

// Send Information about A Member (Also works in DMs)
if (command === 'detect') {
  const chatId = msg.key.remoteJid;

  let targetUser = null;
  
  if (msg.message.extendedTextMessage?.contextInfo?.participant) {
    targetUser = msg.message.extendedTextMessage.contextInfo.participant;
  }
  else if (msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]) {
    targetUser = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
  }

  if (!targetUser) {
    await sock.sendMessage(chatId, { 
      text: "🕵️‍♂️ *Detective Mode*\n\nI need a target to investigate!\n\nReply to user or:" + currentPrefix + "whois-gc @suspect" 
    }, { quoted: msg });
    return;
  }

  await sock.sendMessage(chatId, { react: { text: "🔎", key: msg.key } });

  try {
    const [profilePic, whatsAppInfo, groupMetadata] = await Promise.all([
      sock.profilePictureUrl(targetUser, 'image').catch(() => null),
      sock.onWhatsApp(targetUser).catch(() => null),
      sock.groupMetadata(chatId).catch(() => null)
    ]);

    let userName = "Unknown Identity";
    const number = targetUser.split('@')[0];
    
    if (whatsAppInfo?.[0]?.exists) {
      userName = whatsAppInfo[0].name || `User ${number}`;
    }

    // Investigate group role
    let clearanceLevel = "🕵️ Civilian";
    if (groupMetadata) {
      const userInGroup = groupMetadata.participants.find(p => p.id === targetUser);
      if (userInGroup) {
        clearanceLevel = userInGroup.admin ? "🦸‍♂️ High Command" : "👤 Operative";
      } else {
        clearanceLevel = "🚫 Not in organization";
      }
    }

    const caption = `🕵️‍♂️ *INVESTIGATION REPORT* 🕵️‍♂️
━━━━━━━━━━━━━━━━━━━━

🎭 *ALIAS:* ${userName}
📱 *CONTACT:* +${number}
🔐 *CLEARANCE:* ${clearanceLevel}
📸 *PHOTO ON FILE:* ${profilePic ? "YES" : "CLASSIFIED"}

━━━━━━━━━━━━━━━━━━━━
🆔 CASE #: ${targetUser.split('@')[0]}

*Further investigation required...*`;

    if (profilePic) {
      await sock.sendMessage(chatId, { 
        image: { url: profilePic }, 
        caption: caption
      }, { quoted: msg });
    } else {
      await sock.sendMessage(chatId, { 
        text: caption 
      }, { quoted: msg });
    }

    await sock.sendMessage(chatId, { react: { text: "📋", key: msg.key } });

  } catch (err) {
    console.error("Whois error:", err);
    await sock.sendMessage(chatId, { 
      text: "🚫 Investigation failed. Target is using advanced privacy measures." 
    }, { quoted: msg });
  }
}

// 📜 Promote Member
if (command === "promote") {
    const chatId = msg.key.remoteJid;
    const isGroup = chatId.endsWith("@g.us");

    if (!isGroup) {
        await sock.sendMessage(chatId, { text: "🎭 *Oops!* This command only works in groups, darling! 💫" });
        return;
    }

    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
    const quotedJid = msg.message?.extendedTextMessage?.contextInfo?.participant;
    const senderJid = msg.key.participant || msg.key.remoteJid;

    const targetJids = mentionedJid && mentionedJid.length > 0
        ? mentionedJid
        : quotedJid
        ? [quotedJid]
        : [];

    await sock.sendMessage(chatId, { react: { text: "⏳", key: msg.key } });

    if (targetJids.length > 0) {
        try {
            await sock.groupParticipantsUpdate(chatId, targetJids, "promote");

            const promotedUser = targetJids.map(jid => `@${jid.split('@')[0]}`).join(", ");
            const promoter = `@${senderJid.split('@')[0]}`;

            const caption = `✨ _*PROMOTION CELEBRATION*_ ✨

🎯 *User:* ${promotedUser}

📈 *Status:* 🚀 _PROMOTED TO ADMIN_

👑 *By:* ${promoter}

💫 _*Congratulations! New powers unlocked!*_ 🎊`;

            await sock.sendMessage(
                chatId,
                { text: caption, mentions: [...targetJids, senderJid] },
                { quoted: msg }
            );

            await sock.sendMessage(chatId, { react: { text: "🎉", key: msg.key } });
        } catch (error) {
            console.error("Error promoting user:", error);
            await sock.sendMessage(chatId, { text: "❌ *Failed to promote user(s).* Maybe I don't have admin rights? 👀" }, { quoted: msg });
            await sock.sendMessage(chatId, { react: { text: "😔", key: msg.key } });
        }
    } else {
        await sock.sendMessage(chatId, { text: "🤔 *How to use:* Mention or reply to user\n💡 *Example:* .promote @user" }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "⚠️", key: msg.key } });
    }
}

// 📜 Demote Member
if (command === "demote") {
    const chatId = msg.key.remoteJid;
    const isGroup = chatId.endsWith("@g.us");

    if (!isGroup) {
        await sock.sendMessage(chatId, { text: "🎭 *Oops!* This command only works in groups, darling! 💫" });
        return;
    }

    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
    const quotedJid = msg.message?.extendedTextMessage?.contextInfo?.participant;
    const senderJid = msg.key.participant || msg.key.remoteJid;

    const targetJids = mentionedJid && mentionedJid.length > 0
        ? mentionedJid
        : quotedJid
        ? [quotedJid]
        : [];

    await sock.sendMessage(chatId, { react: { text: "⏳", key: msg.key } });

    if (targetJids.length > 0) {
        try {
            await sock.groupParticipantsUpdate(chatId, targetJids, "demote");

            const demotedUser = targetJids.map(jid => `@${jid.split('@')[0]}`).join(", ");
            const demoter = `@${senderJid.split('@')[0]}`;

            const caption = `📉 _*ADMIN DEMOTION*_ 📉

🎯 *User:* ${demotedUser}

📉 *Status:* 🔻 _DEMOTED FROM ADMIN_

👑 *By:* ${demoter}

💼 _*Admin privileges have been removed.*_ 🤷‍♂️`;

            await sock.sendMessage(
                chatId,
                { text: caption, mentions: [...targetJids, senderJid] },
                { quoted: msg }
            );

            await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
        } catch (error) {
            console.error("Error demoting user:", error);
            await sock.sendMessage(chatId, { text: "❌ *Failed to demote user(s).* Maybe I don't have admin rights? 👀" }, { quoted: msg });
            await sock.sendMessage(chatId, { react: { text: "😔", key: msg.key } });
        }
    } else {
        await sock.sendMessage(chatId, { text: "🤔 *How to use:* Mention or reply to user\n💡 *Example:* .demote @user" }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "⚠️", key: msg.key } });
    }
}

// Change Group Name
if (command === "gc-name") {
    const newName = args.join(" ");
    await sock.sendMessage(chatId, { react: { text: "⌛", key: msg.key } });
    if (newName) {
        try {
            await sock.groupUpdateSubject(chatId, newName);
            await sock.sendMessage(chatId, { text: "Group name changed!" }, { quoted: msg });
            await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
        } catch (error) {
            console.error("Error changing group name:", error);
            await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
        }
    } else {
        await sock.sendMessage(chatId, { text: "Please enter a new group name." }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// Change Group Description
if (command === "gc-desc") {
    const newDesc = args.join(" ");
    await sock.sendMessage(chatId, { react: { text: "⌛", key: msg.key } });
    if (newDesc) {
        try {
            await sock.groupUpdateDescription(chatId, newDesc);
            await sock.sendMessage(chatId, { text: "Group description changed!" }, { quoted: msg });
            await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
        } catch (error) {
            console.error("Error changing group description:", error);
            await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
        }
    } else {
        await sock.sendMessage(chatId, { text: "Please enter a new group description." }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}


        // Lock Group Chat
        if (command === 'mute') {
            await sock.sendMessage(chatId, { react: { text: "⌛", key: msg.key } });
            try {
                await sock.groupSettingUpdate(chatId, "announcement");
                await sock.sendMessage(chatId, { text: "Chat locked! Only admins can send messages." }, { quoted: msg });
                await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
            } catch (error) {
                console.error('Error closing chat:', error);
                await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
            }
        }

        // Unlock Chat Group
        if (command === 'unmute') {
            await sock.sendMessage(chatId, { react: { text: "⌛", key: msg.key } });
            try {
                await sock.groupSettingUpdate(chatId, "not_announcement");
                await sock.sendMessage(chatId, { text: "Chat unlocked! Everyone can send messages." }, { quoted: msg });
                await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
            } catch (error) {
                console.error('Error opening chat:', error);
                await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
            }
        }

// Group chat invite ( Can Also Send To Multiple Users) 
if (command === 'inv') {
    const chatId = msg.key.remoteJid;

    if (args.length === 0) {
        await sock.sendMessage(chatId, { 
            text: "📌 Usage: " + currentPrefix + "inv +2347017747337 +234812345678\n📌 Add multiple numbers separated by spaces"
        }, { quoted: msg });
        return;
    }

    // Extract all valid numbers
    const numbers = [];
    for (const arg of args) {
        const match = arg.match(/(\+?\d+)/);
        if (match) {
            const cleanNum = match[1].replace(/\D/g, '');
            if (cleanNum.length >= 10) {
                numbers.push(cleanNum);
            }
        }
    }

    if (numbers.length === 0) {
        await sock.sendMessage(chatId, { 
            text: '❌ No valid phone numbers found.' 
        }, { quoted: msg });
        return;
    }

    try {
        const groupMetadata = await sock.groupMetadata(chatId);
        const inviteCode = await sock.groupInviteCode(chatId);
        const inviteLink = `https://chat.whatsapp.com/${inviteCode}`;

        // Group info
        const groupInfo = `👋 *You've been invited to join ${groupMetadata.subject}!*

👥 Members: ${groupMetadata.participants.length}
📝 ${groupMetadata.desc || 'Join our community!'}
🔗 ${inviteLink}

Tap the link to join! 🎉`;

        // Try to get group image
        let hasImage = false;
        try {
            await sock.profilePictureUrl(chatId, 'image');
            hasImage = true;
        } catch {
            hasImage = false;
        }

        const results = [];
        const mentions = [];

        for (const number of numbers) {
            const jid = `${number}@s.whatsapp.net`;
            try {
                if (hasImage) {
                    await sock.sendMessage(jid, {
                        image: { url: await sock.profilePictureUrl(chatId, 'image') },
                        caption: groupInfo
                    });
                } else {
                    await sock.sendMessage(jid, { text: groupInfo });
                }
                results.push(`✅ @${number}`);
                mentions.push(jid);
            } catch {
                results.push(`❌ @${number}`);
            }
            await delay(800); // Prevent flooding
        }

        await sock.sendMessage(chatId, {
            text: `📤 Invite Results:\n\n${results.join('\n')}\n\n🔗 ${inviteLink}`,
            mentions: mentions
        }, { quoted: msg });

    } catch (err) {
        console.error("Invite error:", err);
        await sock.sendMessage(chatId, {
            text: `❌ Error: ${err.message}`
        }, { quoted: msg });
    }
}

// Toggle Welcome Message 
const isGroup = chatId.endsWith('@g.us');

if (command === 'welcome-on') {
  const welcomeFile = './src/welcome.json';
  if (!fs.existsSync(welcomeFile)) fs.writeFileSync(welcomeFile, JSON.stringify({}));
  const welcomeData = JSON.parse(fs.readFileSync(welcomeFile));

  if (!isGroup) {
    await sock.sendMessage(chatId, { text: "⚠️ This command only works in groups." });
    return;
  }

  if (!welcomeData[chatId]) {
    welcomeData[chatId] = { enabled: false, message: "👋 Welcome @user!" };
  }

  welcomeData[chatId].enabled = true;
  fs.writeFileSync(welcomeFile, JSON.stringify(welcomeData, null, 2));
  await sock.sendMessage(chatId, { text: "✅ Welcome message enabled!" });
}

if (command === 'welcome-off') {
    const welcomeFile = './src/welcome.json';
  if (!fs.existsSync(welcomeFile)) fs.writeFileSync(welcomeFile, JSON.stringify({}));
  const welcomeData = JSON.parse(fs.readFileSync(welcomeFile));

  if (!isGroup) {
    await sock.sendMessage(chatId, { text: "⚠️ This command only works in groups." });
    return;
  }

  welcomeData[chatId].enabled = false;
  fs.writeFileSync(welcomeFile, JSON.stringify(welcomeData, null, 2));
  await sock.sendMessage(chatId, { text: "✅ Welcome message diabled!" });
}


//set Welcome Message
if (command === 'welcome-set') {
  const newMsg = args.join(" ");
  if (!newMsg) {
    await sock.sendMessage(chatId, { text: "⚠️ Usage: " + currentPrefix + "welcome-set <message>" });
    return;
  }

  const welcomeFile = './src/welcome.json';
  if (!fs.existsSync(welcomeFile)) fs.writeFileSync(welcomeFile, JSON.stringify({}));
  const welcomeData = JSON.parse(fs.readFileSync(welcomeFile));

  if (!welcomeData[chatId]) {
    welcomeData[chatId] = { enabled: true, message: "👋 Welcome @user!" };
  }

  welcomeData[chatId].message = newMsg;
  fs.writeFileSync(welcomeFile, JSON.stringify(welcomeData, null, 2));
  await sock.sendMessage(chatId, { text: `✍️ Welcome message updated:\n${newMsg}` });
}

//Toggle GoodBye Message
if (command === 'goodbye') {
  const chatId = msg.key.remoteJid;
  const isGroup = chatId.endsWith('@g.us');
  if (!isGroup) {
    await sock.sendMessage(chatId, { text: '❌ This command only works in groups.' });
    return;
  }

  const settingsFile = './src/group_settings.json';
  if (!fs.existsSync(settingsFile)) {
    fs.writeFileSync(settingsFile, '{}');
  }

  let settings;
  try {
    settings = JSON.parse(fs.readFileSync(settingsFile));
    if (typeof settings !== 'object' || Array.isArray(settings)) {
      settings = {}; // ✅ force object if file got corrupted
    }
  } catch {
    settings = {}; // fallback
  }

  const arg = args[0]?.toLowerCase();
  if (arg === 'on') {
    if (!settings[chatId]) settings[chatId] = {};
    settings[chatId].goodbyeEnabled = true;
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
    await sock.sendMessage(chatId, { text: '✅ Goodbye message enabled for this group.' });
  } else if (arg === 'off') {
    if (!settings[chatId]) settings[chatId] = {};
    settings[chatId].goodbyeEnabled = false;
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
    await sock.sendMessage(chatId, { text: '🚫 Goodbye message disabled for this group.' });
  } else {
    await sock.sendMessage(chatId, { text: "Usage: " + currentPrefix + "goodbye on / ~goodbye off" });
  }
}

// Promote/Demote Message Configuration Commands
if (command === 'promote-on') {
  const promoteFile = './src/promote.json';
  if (!fs.existsSync(promoteFile)) fs.writeFileSync(promoteFile, JSON.stringify({}));
  const promoteData = JSON.parse(fs.readFileSync(promoteFile));

  if (!isGroup) {
    await sock.sendMessage(chatId, { text: "❌ This command only works in groups." });
    return;
  }

  if (!promoteData[chatId]) {
    promoteData[chatId] = { enabled: false, message: "👑 @user has been promoted to admin!" };
  }

  promoteData[chatId].enabled = true;
  fs.writeFileSync(promoteFile, JSON.stringify(promoteData, null, 2));
  await sock.sendMessage(chatId, { text: "✅ Promote notifications enabled!" });
}

if (command === 'promote-off') {
  const promoteFile = './src/promote.json';
  if (!fs.existsSync(promoteFile)) fs.writeFileSync(promoteFile, JSON.stringify({}));
  const promoteData = JSON.parse(fs.readFileSync(promoteFile));

  if (!isGroup) {
    await sock.sendMessage(chatId, { text: "❌ This command only works in groups." });
    return;
  }

  if (!promoteData[chatId]) {
    promoteData[chatId] = { enabled: true, message: "👑 @user has been promoted to admin!" };
  }

  promoteData[chatId].enabled = false;
  fs.writeFileSync(promoteFile, JSON.stringify(promoteData, null, 2));
  await sock.sendMessage(chatId, { text: "❌ Promote notifications disabled!" });
}

if (command === 'set-promote') {
  const newMsg = args.join(" ");
  if (!newMsg) {
    await sock.sendMessage(chatId, { text: "❌ Usage: " + currentPrefix + "set-promote <message>\nYou can use @user to mention the promoted user" });
    return;
  }

  const promoteFile = './src/promote.json';
  if (!fs.existsSync(promoteFile)) fs.writeFileSync(promoteFile, JSON.stringify({}));
  const promoteData = JSON.parse(fs.readFileSync(promoteFile));

  if (!promoteData[chatId]) {
    promoteData[chatId] = { enabled: true, message: "👑 @user has been promoted to admin!" };
  }

  promoteData[chatId].message = newMsg;
  fs.writeFileSync(promoteFile, JSON.stringify(promoteData, null, 2));
  await sock.sendMessage(chatId, { text: `✍️ Promote message updated:\n${newMsg}` });
}

if (command === 'demote-on') {
  const demoteFile = './src/demote.json';
  if (!fs.existsSync(demoteFile)) fs.writeFileSync(demoteFile, JSON.stringify({}));
  const demoteData = JSON.parse(fs.readFileSync(demoteFile));

  if (!isGroup) {
    await sock.sendMessage(chatId, { text: "❌ This command only works in groups." });
    return;
  }

  if (!demoteData[chatId]) {
    demoteData[chatId] = { enabled: false, message: "🔻 @user has been demoted from admin!" };
  }

  demoteData[chatId].enabled = true;
  fs.writeFileSync(demoteFile, JSON.stringify(demoteData, null, 2));
  await sock.sendMessage(chatId, { text: "✅ Demote notifications enabled!" });
}

if (command === 'demote-off') {
  const demoteFile = './src/demote.json';
  if (!fs.existsSync(demoteFile)) fs.writeFileSync(demoteFile, JSON.stringify({}));
  const demoteData = JSON.parse(fs.readFileSync(demoteFile));

  if (!isGroup) {
    await sock.sendMessage(chatId, { text: "❌ This command only works in groups." });
    return;
  }

  if (!demoteData[chatId]) {
    demoteData[chatId] = { enabled: true, message: "🔻 @user has been demoted from admin!" };
  }

  demoteData[chatId].enabled = false;
  fs.writeFileSync(demoteFile, JSON.stringify(demoteData, null, 2));
  await sock.sendMessage(chatId, { text: "❌ Demote notifications disabled!" });
}

if (command === 'set-demote') {
  const newMsg = args.join(" ");
  if (!newMsg) {
    await sock.sendMessage(chatId, { text: "❌ Usage: " + currentPrefix + "set-demote <message>\nYou can use @user to mention the demoted user" });
    return;
  }

  const demoteFile = './src/demote.json';
  if (!fs.existsSync(demoteFile)) fs.writeFileSync(demoteFile, JSON.stringify({}));
  const demoteData = JSON.parse(fs.readFileSync(demoteFile));

  if (!demoteData[chatId]) {
    demoteData[chatId] = { enabled: true, message: "🔻 @user has been demoted from admin!" };
  }

  demoteData[chatId].message = newMsg;
  fs.writeFileSync(demoteFile, JSON.stringify(demoteData, null, 2));
  await sock.sendMessage(chatId, { text: `✍️ Demote message updated:\n${newMsg}` });
}

// Anti-Status Mention without Deletion
if (command === 'antimention') {
    const chatId = msg.key.remoteJid;
    const isGroup = chatId.endsWith('@g.us');
    
    if (!isGroup) {
        await sock.sendMessage(chatId, { text: '❌ This command only works in groups.' });
        return;
    }

    const configFile = './src/antimention.json';
    if (!fs.existsSync(configFile)) {
        fs.writeFileSync(configFile, '{}');
    }

    let config;
    try {
        config = JSON.parse(fs.readFileSync(configFile));
        if (typeof config !== 'object' || Array.isArray(config)) {
            config = {}; // ✅ force object if file got corrupted
        }
    } catch {
        config = {}; // fallback
    }

    const arg = args[0]?.toLowerCase();
    if (arg === 'on') {
        if (!config[chatId]) config[chatId] = {};
        config[chatId].enabled = true;
        fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
       await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
    } else if (arg === 'off') {
        if (!config[chatId]) config[chatId] = {};
        config[chatId].enabled = false;
        fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
        await sock.sendMessage(chatId, { text: '🚫 Anti-mention protection disabled for this group.' });
    } else {
       await sock.sendMessage(chatId, { text: `Usage: ${prefix}antimention on / ${prefix}antimention off\n\n📝 When enabled, the bot will delete @everyone mentions and warn users automatically.` });
    }
}

        
      // Anti Link Actived
if (command === 'antilink-on') {
    await sock.sendMessage(chatId, { react: { text: "⌛", key: msg.key } });
    try {
        if (!isGroup) {
            await sock.sendMessage(chatId, { text: "❌ This command only works in groups." });
            return;
        }

        const antilinkFile = './src/antilink.json';
        if (!fs.existsSync(antilinkFile)) fs.writeFileSync(antilinkFile, JSON.stringify({}));
        const antilinkData = JSON.parse(fs.readFileSync(antilinkFile));

        // Initialize if doesn't exist
        if (!antilinkData[chatId]) {
            antilinkData[chatId] = { enabled: false };
        }

        antilinkData[chatId].enabled = true;
        fs.writeFileSync(antilinkFile, JSON.stringify(antilinkData, null, 2));

        const responseMessage = `✅ Anti-link activated for this group`;
        await sock.sendMessage(chatId, { text: responseMessage }, { quoted: msg });
        console.log(`Response: ${responseMessage}`);

        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
    } catch (error) {
        console.error('Error sending message:', error);
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// Anti Link Non-Actived (Group Specific)
if (command === 'antilink-off') {
    await sock.sendMessage(chatId, { react: { text: "⌛", key: msg.key } });
    try {
        if (!isGroup) {
            await sock.sendMessage(chatId, { text: "❌ This command only works in groups." });
            return;
        }

        const antilinkFile = './src/antilink.json';
        if (!fs.existsSync(antilinkFile)) fs.writeFileSync(antilinkFile, JSON.stringify({}));
        const antilinkData = JSON.parse(fs.readFileSync(antilinkFile));

        // Initialize if doesn't exist
        if (!antilinkData[chatId]) {
            antilinkData[chatId] = { enabled: true };
        }

        antilinkData[chatId].enabled = false;
        fs.writeFileSync(antilinkFile, JSON.stringify(antilinkData, null, 2));

        const responseMessage = `❌ Anti-link deactivated for this group`;
        await sock.sendMessage(chatId, { text: responseMessage }, { quoted: msg });
        console.log(`Response: ${responseMessage}`);

        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
    } catch (error) {
        console.error('Error sending message:', error);
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

if (command === 'antilink-status') {
    await sock.sendMessage(chatId, { react: { text: "⌛", key: msg.key } });
    try {
        const antilinkFile = './src/antilink.json';
        if (!fs.existsSync(antilinkFile)) {
            await sock.sendMessage(chatId, { text: "❌ Anti-link system not configured for this group." });
            return;
        }

        const antilinkData = JSON.parse(fs.readFileSync(antilinkFile));
        const isEnabled = antilinkData[chatId] && antilinkData[chatId].enabled;
        const status = isEnabled ? "🟢 ENABLED" : "🔴 DISABLED";
        
        await sock.sendMessage(chatId, { 
            text: "🔗 *Anti-Link Status*\n\nStatus: " + status + "\n\nUse " + currentPrefix + "*antilink-on* to enable\nUse *" + currentPrefix + "antilink-off* to disable"
        });
        
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
    } catch (error) {
        console.error('Error:', error);
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}
		// Badwords Actived
        if (command === 'antibadwords-on') {
            await sock.sendMessage(chatId, { react: { text: "⌛", key: msg.key } });
            try {
                config.ANTI_BADWORDS = true;
        
                fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
        
                const responseMessage = "Antibadwords Activated";
                await sock.sendMessage(chatId, { text: responseMessage }, { quoted: msg });
                console.log(`Response: ${responseMessage}`);
        
                await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
            } catch (error) {
                console.error('Error sending message:', error);
                await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
            }
        }
        
        // Badwords Deactivated
        if ( command === 'antibadwords-off') {
            await sock.sendMessage(chatId, { react: { text: "⌛", key: msg.key } });
            try {
                config.ANTI_BADWORDS = false;
        
                fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
        
                const responseMessage = "Badwords Deactivated";
                await sock.sendMessage(chatId, { text: responseMessage }, { quoted: msg });
                console.log(`Response: ${responseMessage}`);
        
                await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
            } catch (error) {
                console.error('Error sending message:', error);
                await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
            }
        }
		
		// Public Mode
        if (command === 'public') {
            await sock.sendMessage(chatId, { react: { text: "⌛", key: msg.key } });
            try {
                config.SELF_BOT_MESSAGE = false;
                fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
                console.log(`Response: Self Bot Use Deactivated`);
                await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
            } catch (error) {
                console.error('Error sending message:', error);
                await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
            }
        }
		
		// Private Mode
        if (command === 'private') {
                    await sock.sendMessage(chatId, { react: { text: "⌛", key: msg.key } });
            try {
                config.SELF_BOT_MESSAGE = true;
                fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
                console.log(`Response: Self Bot Use Activated`);
                await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
            } catch (error) {
                console.error('Error sending message:', error);
                await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
            }
        }
    } 
}

module.exports = Message;



























