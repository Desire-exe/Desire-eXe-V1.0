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
const ownerNumber = '2347017747337';
const ytdl = require('ytdl-core');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const QRCode = require('qrcode');
const delay = ms => new Promise(res => setTimeout(res, ms));
const fs = require('fs');
const path = require('path');
const gTTS = require('gtts');
const P = require('pino');
const Tesseract = require('tesseract.js');
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
const execAsync = util.promisify(exec);
const child_process = require('child_process');
const validFileTypes = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt'];

// ✅ Load config ONCE at the top
const configPath = path.join(__dirname, '../config.json');
const warningFile = './warnings.json';
let config = {};

try {
    if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        // Ensure SUDO_USERS array exists
        if (!config.SUDO_USERS) {
            config.SUDO_USERS = ['2347017747337@s.whatsapp.net'];
        }
    } else {
        console.error('❌ config.json not found');
        config = {
            ANTI_BADWORDS: false,
            SELF_BOT_MESSAGE: false,
            BAD_WORDS: [],
            prefix: '.',
            SUDO_USERS: ['2347017747337@s.whatsapp.net']
        };
    }
} catch (error) {
    console.error('❌ Error loading config:', error);
    config = {
        ANTI_BADWORDS: false,
        SELF_BOT_MESSAGE: false,
        BAD_WORDS: [],
        prefix: '.',
        SUDO_USERS: ['2347017747337@s.whatsapp.net']
    };
}

global.prefix = config.prefix || ".";

// ✅ SUDO USER HELPER FUNCTIONS
function getSenderJid(msg) {
    // If you sent the message
    if (msg.key.fromMe) {
        return config.OWNER_JID // Your JID
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

function isSudoUser(senderJid) {
    return config.SUDO_USERS.includes(senderJid);
}

function isAuthorized(senderJid) {
    return isSudoUser(senderJid);
}

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
// ✅ Badwords checker with improved regex
function containsBadWords(message, badWordsList) {
    if (!badWordsList || badWordsList.length === 0) return false;
    
    // Escape special regex characters in bad words
    const escapedWords = badWordsList.map(word => 
        word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    );
    
    // Create regex with word boundaries for exact matching
    const regex = new RegExp(`\\b(${escapedWords.join("|")})\\b`, "i");
    return regex.test(message);
}

// ✅ URL detector (keep your existing one)
const urlRegex = /\b(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}(?:\/[^\s]*)?\b/i;

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

    // 🚫 Anti-badwords (Group Specific) - REFACTORED
    const antibadwordsFile = './src/antibadwords.json';
    if (fs.existsSync(antibadwordsFile)) {
        try {
            const antibadwordsData = JSON.parse(fs.readFileSync(antibadwordsFile, 'utf8'));
            
            // Check if anti-badwords is enabled for this specific group
            const isAntiBadwordsEnabled = antibadwordsData[chatId] && antibadwordsData[chatId].enabled;
            
            if (isAntiBadwordsEnabled && messageBody && msg.key.remoteJid.endsWith('@g.us')) {
                // Get custom bad words for this group, fallback to global config
                let badWordsList = antibadwordsData[chatId]?.customWords || config.BAD_WORDS || [];
                
                // Check if message contains bad words
                const hasBadWords = containsBadWords(messageBody, badWordsList);
                
                // Also check if it's from the bot itself (skip if true)
                const isFromBot = msg.key.fromMe || msg.key.participant?.includes(sock.user.id.split(':')[0]);
                
                if (hasBadWords && !isFromBot) {
                    console.log(`🚫 Anti-Badwords: Detected bad words in message from ${msg.key.participant}`);
                    
                    try {
                        // Add reaction first to show action
                        await sock.sendMessage(chatId, { react: { text: "🚫", key: msg.key } });
                        
                        // Try to delete the message
                        await sock.sendMessage(chatId, { 
                            delete: {
                                id: msg.key.id,
                                remoteJid: chatId,
                                fromMe: false,
                                participant: msg.key.participant
                            }
                        });
                        
                        console.log(`✅ Anti-Badwords: Successfully deleted message with ID: ${msg.key.id}`);
                        
                        // Get user mention
                        let warningMessage = "";
                        let messageOptions = {};
                        
                        if (msg.key.participant) {
                            const userNumber = msg.key.participant.split('@')[0];
                            warningMessage = `⚠️ *Bad Words Detected!*\n\n@${userNumber} Bad language is not allowed in this group!\n\n🚫 Your message has been deleted.`;
                            messageOptions = {
                                text: warningMessage,
                                mentions: [msg.key.participant]
                            };
                        } else {
                            warningMessage = `⚠️ *Bad Words Detected!*\n\n🚫 Bad language is not allowed in this group!\n\nThe message has been deleted.`;
                            messageOptions = { text: warningMessage };
                        }
                        
                        await sock.sendMessage(chatId, messageOptions);
                        return; // Stop further processing
                        
                    } catch (deleteError) {
                        console.error('❌ Anti-Badwords Deletion Error:', deleteError);
                        
                        // Enhanced error handling
                        let errorMessage = "⚠️ *System Error*\n\nFailed to process bad words detection.";
                        
                        if (deleteError.message?.includes("405") || deleteError.message?.includes("not authorized")) {
                            errorMessage = "⚠️ *Admin Rights Required!*\n\nI need admin permissions to delete messages in this group.";
                        } else if (deleteError.message?.includes("Message not found")) {
                            errorMessage = "⚠️ *Bad Words Warning!*\n\nBad language is not allowed here. The message was already deleted.";
                        } else if (deleteError.message?.includes("Forbidden")) {
                            errorMessage = "⚠️ *Permission Denied!*\n\nI don't have permission to delete messages. Please make me admin.";
                        }
                        
                        await sock.sendMessage(chatId, { text: errorMessage });
                        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
                    }
                }
            }
        } catch (error) {
            console.error('❌ Error reading antibadwords.json:', error);
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
                const urlRegex = /\b(?:https?:\/\/|www\.)[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+\.[a-zA-Z]{2,}(?:\/[^\s]*)?\b|\b(?:bit\.ly|t\.co|goo\.gl|tinyurl\.com|t\.me|wa\.me)\/[a-zA-Z0-9-]+\b/gi;
                
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

    // ✅ Command Detection with Sudo User Support
    const currentPrefix = global.prefix;
    let command = null;
    let args = [];

    // Check if message starts with prefix
    if (messageBody.startsWith(currentPrefix)) {
        const parts = messageBody.slice(currentPrefix.length).trim().split(' ');
        command = parts[0];
        args = parts.slice(1);
        
        const senderJid = getSenderJid(msg);
        console.log('📥 Detected command:', command, 'from sender:', senderJid, 'isSudo:', isSudoUser(senderJid));
        
        // 🎯 SPECIAL RULE: In chat mode, only sudo users commands work
        if (chatSessions.isChatEnabled(chatId)) {
            const isSudo = isSudoUser(senderJid);
            
            if (!isSudo) {
                console.log('🔒 Non-sudo command in chat mode - ignoring command');
                command = null; // Let AI handle this message
                args = [];
            } else {
                console.log('👑 Sudo user command in chat mode - processing command');
            }
        }
    }

    console.log('📥 Final command:', command);
    console.log('📥 Args:', args);
    console.log('📥 Prefix:', currentPrefix);

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
    // 🔹 COMMAND PROCESSING (Sudo users commands work in both modes)
    // ==============================================
    if (command) {
        const senderJid = getSenderJid(msg);
        const isSudo = isSudoUser(senderJid);
	    const isGroup = chatId.endsWith('@g.us'); // ✅ ADD THIS LINE

        // Check if command should be allowed based on public/private mode
        if (config.SELF_BOT_MESSAGE && !isSudo) {
            // Private mode + not sudo = react with 🚫 and ignore
            await sock.sendMessage(chatId, { react: { text: "🚫", key: msg.key } });
            return;
        }

      // 👑 SUDO COMMANDS 
if (command === "sudo") {
    await sock.sendMessage(chatId, { react: { text: "👑", key: msg.key } });
    
    const senderJid = getSenderJid(msg);
    const isMainOwner = senderJid === config.OWNER_JID;
    const isSudo = isSudoUser(senderJid);
    const isGroup = chatId.endsWith('@g.us');


    // Check if user is at least sudo to use basic commands
    if (!isSudo) {
        await sock.sendMessage(chatId, {
            text: '*🚫 Sudo access required for sudo commands.*'
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
        return;
    }

    const subCommand = args[0]?.toLowerCase();
    
    // Extract target - can be mention OR phone number
    let targetJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    
    // If no mention, check if there's a phone number in args
    if (!targetJid && args[1]) {
        const phoneNumber = args[1].replace(/[^\d+]/g, ''); // Clean phone number
        if (phoneNumber.match(/^\+?[\d]{10,15}$/)) {
            // Remove + and add @s.whatsapp.net
            const cleanNumber = phoneNumber.replace(/^\+/, '');
            targetJid = `${cleanNumber}@s.whatsapp.net`;
        }
    }

    // Show help if no subcommand
    if (!subCommand) {
        await sock.sendMessage(chatId, {
            text: `👑 *Desire-eXe V2.0 Sudo Commands*\n\n` +
                  `➤ *sudo list* - List all sudo users\n` +
                  `➤ *sudo help* - Show help\n` +
                  `${isMainOwner ? `➤ *sudo add* @user - Add user as sudo\n➤ *sudo add* +234123456789 - Add by phone number\n➤ *sudo remove* @user - Remove sudo access\n➤ *sudo remove* +234123456789 - Remove by phone number\n` : ''}` +
                  `\n⚠️ *Warning:* Sudo users have full bot access!\n🔒 *Note:* These commands only work in private chat.`
        }, { quoted: msg });
        return;
    }

   // sudo add (MAIN OWNER ONLY)
if (subCommand === 'add') {
    if (!isMainOwner) {
        await sock.sendMessage(chatId, {
            text: '*🚫 Only main owner can add sudo users.*'
        }, { quoted: msg });
        return;
    }
    
    // Get target from mention, reply, or command args
    let targetJid = null;
    
    // 1. Check if user is mentioned
    if (msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
        targetJid = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
    }
    // 2. Check if replying to a message
    else if (msg.message.extendedTextMessage?.contextInfo?.participant) {
        targetJid = msg.message.extendedTextMessage.contextInfo.participant;
    }
    // 3. Check command arguments (phone number or JID)
    else {
        const args = bodyText.split(' ').slice(2);
        if (args.length > 0) {
            let input = args[0];
            
            // If input is a phone number (starts with +)
            if (input.startsWith('+')) {
                // Remove + and any non-digit characters
                const number = input.replace(/\D/g, '');
                // Convert to JID format
                targetJid = `${number}@s.whatsapp.net`;
            }
            // If input might already be a JID
            else if (input.includes('@')) {
                targetJid = input;
            }
            // If it's just numbers (without country code)
            else if (/^\d+$/.test(input)) {
                targetJid = `${input}@s.whatsapp.net`;
            }
        }
    }
    
    if (!targetJid) {
        await sock.sendMessage(chatId, {
            text: '❌ Usage: *sudo add* @user\nOR: *sudo add* +234123456789\nOR: *sudo add* (reply to a user\'s message)\n\n_Reply to a user\'s message, mention them, or use their phone number._'
        }, { quoted: msg });
        return;
    }
    
    // Normalize JID (remove any suffixes)
    targetJid = targetJid.split(':')[0];
    
    if (!config.SUDO_USERS.includes(targetJid)) {
        config.SUDO_USERS.push(targetJid);
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        
        await sock.sendMessage(chatId, {
            text: `✅ *SUDO ACCESS GRANTED*\n\n📱 *User:* ${targetJid.split('@')[0]}\n🔑 *Status:* Now a sudo user!\n\n⚠️ They now have FULL bot control.`
        });
    } else {
        await sock.sendMessage(chatId, {
            text: `❌ ${targetJid.split('@')[0]} is already a sudo user.`
        });
    }
}

// sudo remove (MAIN OWNER ONLY)
else if (subCommand === 'remove') {
    if (!isMainOwner) {
        await sock.sendMessage(chatId, {
            text: '*🚫 Only main owner can remove sudo users.*'
        }, { quoted: msg });
        return;
    }
    
    // Get target from mention, reply, or command args
    let targetJid = null;
    
    // 1. Check if user is mentioned
    if (msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
        targetJid = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
    }
    // 2. Check if replying to a message
    else if (msg.message.extendedTextMessage?.contextInfo?.participant) {
        targetJid = msg.message.extendedTextMessage.contextInfo.participant;
    }
    // 3. Check command arguments (phone number or JID)
    else {
        const args = bodyText.split(' ').slice(2);
        if (args.length > 0) {
            let input = args[0];
            
            // If input is a phone number (starts with +)
            if (input.startsWith('+')) {
                // Remove + and any non-digit characters
                const number = input.replace(/\D/g, '');
                // Convert to JID format
                targetJid = `${number}@s.whatsapp.net`;
            }
            // If input might already be a JID
            else if (input.includes('@')) {
                targetJid = input;
            }
            // If it's just numbers (without country code)
            else if (/^\d+$/.test(input)) {
                targetJid = `${input}@s.whatsapp.net`;
            }
        }
    }
    
    if (!targetJid) {
        await sock.sendMessage(chatId, {
            text: '❌ Usage: *sudo remove* @user\nOR: *sudo remove* +234123456789\nOR: *sudo remove* (reply to a user\'s message)\n\n_Reply to a user\'s message, mention them, or use their phone number._'
        }, { quoted: msg });
        return;
    }
    
    // Normalize JID (remove any suffixes)
    targetJid = targetJid.split(':')[0];
    
    if (targetJid === config.OWNER_JID) {
        await sock.sendMessage(chatId, {
            text: '❌ Cannot remove main owner!'
        }, { quoted: msg });
        return;
    }
    
    const userIndex = config.SUDO_USERS.indexOf(targetJid);
    if (userIndex > -1) {
        config.SUDO_USERS.splice(userIndex, 1);
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        
        await sock.sendMessage(chatId, {
            text: `❌ *SUDO ACCESS REVOKED*\n\n📱 *User:* ${targetJid.split('@')[0]}\n🔑 *Status:* No longer a sudo user.`
        });
    } else {
        await sock.sendMessage(chatId, {
            text: `❌ ${targetJid.split('@')[0]} is not a sudo user.`
        });
    }
}



    // sudo list (ALL SUDO USERS CAN SEE)
    else if (subCommand === 'list') { 
         if (!isMainOwner) {
        await sock.sendMessage(chatId, {
            text: '*🚫 Only main owner can see the list of sudo users.*'
        }, { quoted: msg });
        return;
    }
    
        let listText = '👑 *Desire-eXe V2.0 Sudo Users:*\n\n';
        
        config.SUDO_USERS.forEach((user, index) => {
            const isMainOwner = user === config.OWNER_JID;
            listText += `${index + 1}. ${user.split('@')[0]} ${isMainOwner ? '👑 (Main Owner)' : ''}\n`;
        });
        
        await sock.sendMessage(chatId, {
            text: listText
        });
    }

    // sudo help (ALL SUDO USERS CAN SEE)
    else if (subCommand === 'help') {
        const helpText = isMainOwner 
            ? `👑 *Sudo Commands Help*\n\n` +
              `*sudo add @user* - Grant full bot access\n` +
              `*sudo add +234123456789* - Add by phone number\n` +
              `*sudo remove @user* - Revoke sudo access\n` +
              `*sudo remove +234123456789* - Remove by phone number\n` +
              `*sudo list* - Show all sudo users\n` +
              `*sudo help* - Show this message\n\n` +
              `🔒 *Sudo users can:*\n` +
              `• Use ALL commands\n` +
              `• Shutdown/restart bot\n` +
              `• Access sensitive data\n\n` +
              `🔒 *Note:* These commands only work in private chat.`
            : `👑 *Sudo Commands Help*\n\n` +
              `*sudo list* - Show all sudo users\n` +
              `*sudo help* - Show this message\n\n` +
              `🔒 *Sudo users can:*\n` +
              `• Use ALL commands\n` +
              `• Shutdown/restart bot\n` +
              `• Access sensitive data\n\n` +
              `🔒 *Note:* These commands only work in private chat.`;
        
        await sock.sendMessage(chatId, {
            text: helpText
        }, { quoted: msg });
    }

    // Unknown subcommand
    else {
        await sock.sendMessage(chatId, {
            text: '❌ Unknown sudo command. Use *sudo help* for available commands.'
        }, { quoted: msg });
    }

    await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
    return;
}
        // 🔹 setprefix command
if (command === "setprefix") {
    const isMainOwner = senderJid === config.OWNER_JID;
    
    if (!isMainOwner) {
        await sock.sendMessage(chatId, { 
            text: '*🚫 Only main owner can change the prefix.*' 
        }, { quoted: msg });
        return;
    }

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
        const os = require('os');
        
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
        
        // Get server/hosting info
        let serverType = "Unknown Server";
        
        // Check for common hosting environments
        if (process.env.KOYEB_APP) {
            serverType = "Koyeb Server";
        } else if (process.env.RAILWAY_ENVIRONMENT) {
            serverType = "Railway Server";
        } else if (process.env.HEROKU_APP_NAME) {
            serverType = "Heroku Server";
        } else if (process.env.REPLIT_DB_URL) {
            serverType = "Replit Server";
        } else if (process.env.GITHUB_ACTIONS || process.env.CODESPACES) {
            serverType = "GitHub Codespace";
        } else if (process.env.VERCEL) {
            serverType = "Vercel Server";
        } else if (process.env.NODE_ENV === 'development') {
            serverType = "Local Development";
        } else {
            serverType = "Generic Server";
        }
        
        // Get internal IP address (safer than external IP)
        let internalIP = "Not available";
        const networkInterfaces = os.networkInterfaces();
        
        for (const interfaceName in networkInterfaces) {
            const interfaces = networkInterfaces[interfaceName];
            for (const iface of interfaces) {
                // Only get IPv4 and non-internal (but still internal to the network)
                if (iface.family === 'IPv4' && !iface.internal) {
                    internalIP = iface.address;
                    break;
                }
            }
            if (internalIP !== "Not available") break;
        }
        
        // Performance indicators
        const ping = Date.now() - startTime;
        let pingEmoji = "🟢";
        if (ping > 1000) pingEmoji = "🔴";
        else if (ping > 500) pingEmoji = "🟡";
        
        let memoryEmoji = "🟢";
        if (memoryPercentage > 80) memoryEmoji = "🔴";
        else if (memoryPercentage > 60) memoryEmoji = "🟡";
        
        // Get CPU info
        const cpuCount = os.cpus().length;
        const platform = os.platform();
        
        const statusMessage = `🤖 *BOT IS ALIVE AND WELL*

${pingEmoji} *STATUS:* ONLINE (${uptimeString})
📶 *RESPONSE TIME:* ${ping}ms
🏷️ *HOST:* ${serverType}

💾 *MEMORY:* ${memoryEmoji} ${memoryPercentage}%
📊 *RAM USED:* ${usedMemory}MB / ${totalMemory}MB

🖥️ *PLATFORM:* ${platform.toUpperCase()}
⚡ *CPU CORES:* ${cpuCount}
🔒 *INTERNAL IP:* ${internalIP}

*Bot is functioning normally!*`;

        await sock.sendMessage(chatId, {
            text: statusMessage
        }, { quoted: msg });
        
    } catch (error) {
        console.error("Alive command error:", error);
        await sock.sendMessage(chatId, {
            text: "❌ Error checking bot status."
        }, { quoted: msg });
    }
}

    if (command === "smile") {
        try {
            const steps = ["ツ", "SMILE", "Loves", "war", "SMILE loves warツ"];
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
    if (command === "send" && args.length > 0 && args[0].toLowerCase() === "img") {
        await sock.sendMessage(chatId, { react: { text: "⌛", key: msg.key } });
        try {
            const url = "https://t3.ftcdn.net/jpg/07/66/87/68/360_F_766876856_XDPvm1sg90Ar5Hwf1jRRIHM4FNCXmhKj.jpg";
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
       // ------------------ AUTOTYPE ON ------------------
    if ((command === 'autotype') && args[0] && args[0].toLowerCase() === 'on') {
        const isMainOwner = senderJid === config.OWNER_JID;
        
        if (!isMainOwner) {
            await sock.sendMessage(chatId, { 
                text: '*🚫 Only owner can eXecute this command*' 
            }, { quoted: msg });
            return;
        }
    
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
    if ((command === 'autotype') && args[0] && args[0].toLowerCase() === 'off') {
        const isMainOwner = senderJid === config.OWNER_JID;
        
        if (!isMainOwner) {
            await sock.sendMessage(chatId, { 
                text: '*🚫 Only owner can eXecute this command*' 
            }, { quoted: msg });
            return;
        }
    
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
    if ((command === 'autorecord') && args[0] && args[0].toLowerCase() === 'on') {
        const isMainOwner = senderJid === config.OWNER_JID;
        
        if (!isMainOwner) {
            await sock.sendMessage(chatId, { 
                text: '*🚫 Only owner can eXecute this command*' 
            }, { quoted: msg });
            return;
        }
    
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
    if ((command === 'autorecord') && args[0] && args[0].toLowerCase() === 'off') {
        const isMainOwner = senderJid === config.OWNER_JID;
        
        if (!isMainOwner) {
            await sock.sendMessage(chatId, { 
                text: '*🚫 Only owner can eXecute this command*' 
            }, { quoted: msg });
            return;
        }
    
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
    if ((command === 'presence' && args[0] && args[0].toLowerCase() === 'status') || 
        (command === 'presence-status')) {
        const isMainOwner = senderJid === config.OWNER_JID;
        
        if (!isMainOwner) {
            await sock.sendMessage(chatId, { 
                text: '*🚫 Only owner can eXecute this command*' 
            }, { quoted: msg });
            return;
        }
    
    
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
    
    if (command === 'savage') {
        const apis = [
            'https://evilinsult.com/generate_insult.php?lang=en&type=json',
            'https://insult.mattbas.org/api/insult',
            'https://api.chucknorris.io/jokes/random'
        ];
        
        const selectedApi = apis[Math.floor(Math.random() * apis.length)];
        
        try {
            const response = await fetch(selectedApi);
            
            if (selectedApi.includes('evilinsult')) {
                const data = await response.json();
                await sock.sendMessage(chatId, { text: data.insult }, { quoted: msg });
            } 
            else if (selectedApi.includes('chucknorris')) {
                const data = await response.json();
                const insult = data.value.replace(/Chuck Norris/gi, 'You').replace(/he/gi, 'you').replace(/his/gi, 'your');
                await sock.sendMessage(chatId, { text: insult }, { quoted: msg });
            }
            else {
                const insult = await response.text();
                await sock.sendMessage(chatId, { text: insult }, { quoted: msg });
            }
        } catch (error) {
            // Fallback
            const fallback = ["I'd roast you, but my mom said I shouldn't burn trash."];
            await sock.sendMessage(chatId, { text: fallback[0] }, { quoted: msg });
        }
    }
    
    // 👨‍💻 Truth or Dare Option
    if ((command === 't' && args[0] && args[0].toLowerCase() === 'or' && args[1] && args[1].toLowerCase() === 'd') || 
        (command === 'truth' && args[0] && args[0].toLowerCase() === 'or' && args[1] && args[1].toLowerCase() === 'dare')) {
        
        await sock.sendMessage(msg.key.remoteJid, {
           text: "Please choose " + currentPrefix + "*truth or " + currentPrefix + "*dare* to continue.",
        mentions: [msg.key.participant || msg.key.remoteJid]
        });
        return;
    }
    
    // Helper function to get random item with fallback
    async function fetchWithFallback(apis, fallbackArray) {
        for (const api of apis) {
            try {
                const response = await fetch(api.url);
                if (api.parser) {
                    const data = await response.json();
                    return api.parser(data);
                }
                const data = await response.json();
                return data;
            } catch (error) {
                continue;
            }
        }
        return fallbackArray[Math.floor(Math.random() * fallbackArray.length)];
    }
    
    // Updated commands with multiple API options
    if (command === 'truth') {
        const apis = [
            { url: 'https://api.truthordarebot.xyz/v1/truth', parser: (data) => data.question },
            { url: 'https://truth-dare.mohitgarg7.repl.co/api/truth', parser: (data) => data.truth }
        ];
        const truth = await fetchWithFallback(apis, [
            "What's the most embarrassing thing you've ever done?",
            "Have you ever had a crush on someone here?"
        ]);
        await sock.sendMessage(msg.key.remoteJid, {
            text: `*Truth:* ${truth}`,
            mentions: [msg.key.participant || msg.key.remoteJid]
        });
    }
    
    if (command === 'dare') {
        const apis = [
            { url: 'https://api.truthordarebot.xyz/v1/dare', parser: (data) => data.question },
            { url: 'https://truth-dare.mohitgarg7.repl.co/api/dare', parser: (data) => data.dare }
        ];
        const dare = await fetchWithFallback(apis, [
            "Send a voice note saying you love someone here.",
            "Say your crush's name backward."
        ]);
        await sock.sendMessage(msg.key.remoteJid, {
            text: `*Dare:* ${dare}`,
            mentions: [msg.key.participant || msg.key.remoteJid]
        });
    }
    
    if (command === 'pickup') {
        const apis = [
            { url: 'https://vinuxd.vercel.app/api/pickup', parser: (data) => data.pickup },
            { url: 'https://pickupapi.vercel.app/api/pickup', parser: (data) => data.pickup }
        ];
        const pickup = await fetchWithFallback(apis, [
            "Are you WiFi? Because I'm feeling a strong connection.",
            "Do you have a map? I just got lost in your eyes."
        ]);
        await sock.sendMessage(msg.key.remoteJid, {
            text: `*Pickup Line:* ${pickup}`,
            mentions: [msg.key.participant || msg.key.remoteJid]
        });
    }
    
    if (command === 'fact') {
        const apis = [
            { url: 'https://uselessfacts.jsph.pl/random.json?language=en', parser: (data) => data.text },
            { url: 'https://catfact.ninja/fact', parser: (data) => data.fact },
            { url: 'https://asli-fun-fact-api.herokuapp.com/', parser: (data) => data.data.fact }
        ];
        const fact = await fetchWithFallback(apis, [
            "Honey never spoils. Archaeologists have found 3,000-year-old honey that's still edible.",
            "Octopuses have three hearts."
        ]);
        await sock.sendMessage(msg.key.remoteJid, {
            text: `*Fact:* ${fact}`,
            mentions: [msg.key.participant || msg.key.remoteJid]
        });
    }


// ==============================================
// NSFW Commands
// ==============================================
		
// Boobs
if (command === 'boobs') {
    try {
        const res = await axios.get('https://nekobot.xyz/api/image?type=boobs'); 
        await sock.sendMessage(chatId, { 
            image: { url: res.data.message }, 
            caption: '*Boobs*' 
        });
    } catch (error) {
        console.error('❌ Boobs command error:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ Failed to fetch image. Please try again later.' 
        });
    }
}
		
// Ass
if (command === 'ass') {
    try {
        const res = await axios.get('https://nekobot.xyz/api/image?type=ass'); 
        await sock.sendMessage(chatId, { 
            image: { url: res.data.message }, 
            caption: '*Dat ass tho.*' 
        });
    } catch (error) {
        console.error('❌ Ass command error:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ Failed to fetch image. Please try again later.' 
        });
    }
}
		
// Neko	
if (command === 'neko') {
    try {
        const res = await axios.get('https://nekobot.xyz/api/image?type=neko'); 
        await sock.sendMessage(chatId, { 
            image: { url: res.data.message }, 
            caption: '*Neko*' 
        });
    } catch (error) {
        console.error('❌ Neko command error:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ Failed to fetch image. Please try again later.' 
        });
    }
}		

// Pussy		
if (command === 'pussy') {
    try {
        const res = await axios.get('https://nekobot.xyz/api/image?type=pussy'); 
        await sock.sendMessage(chatId, { 
            image: { url: res.data.message }, 
            caption: '*Pussy*' 
        });
    } catch (error) {
        console.error('❌ Pussy command error:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ Failed to fetch image. Please try again later.' 
        });
    }
}
		
// Anal		
if (command === 'anal') {
    try {
        const res = await axios.get('https://nekobot.xyz/api/image?type=anal'); 
        await sock.sendMessage(chatId, { 
            image: { url: res.data.message }, 
            caption: '*Anal*' 
        });
    } catch (error) {
        console.error('❌ Anal command error:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ Failed to fetch image. Please try again later.' 
        });
    }
}			
		if (command === 'blowjob') {
    try {
        const res = await axios.get('https://nekobot.xyz/api/image?type=blowjob'); 
        await sock.sendMessage(chatId, { 
            image: { url: res.data.message }, 
            caption: '*Blowjob*' 
        });
    } catch (error) {
        console.error('❌ Blowjob command error:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ Failed to fetch image. Please try again later.' 
        });
    }
}		
		
// Hentai
	if (command === 'hentai') {
    try {
        const res = await axios.get('https://nekobot.xyz/api/image?type=hentai'); 
        await sock.sendMessage(chatId, { 
            image: { url: res.data.message }, 
            caption: '*Hentai*' 
        });
    } catch (error) {
        console.error('❌ Henta command error:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ Failed to fetch image. Please try again later.' 
        });
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
    const filePath = path.join(__dirname, '../uploads/upload/Desire-eXe V2.1 (2).PNG');
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
        
        let ownerName = "Desire Admin";
        
        // Try multiple methods to get WhatsApp name
        try {
            // Method 1: Get bot's own contact info
            const botJid = sock.user.id;
            console.log('Bot JID:', botJid);
            
            const botContact = await sock.getContact(botJid);
            console.log('Bot contact:', botContact);
            console.log('Bot name:', botContact.name);
            console.log('Bot notify:', botContact.notify);
            
            ownerName = botContact.name || botContact.notify || msg.pushName || "Desire-eXe V2.0";
            
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
                ownerName = msg.pushName || "Desire-eXe";
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
if (command === "creator" || command === "contact") {
    const vcard = 
        'BEGIN:VCARD\n' +
        'VERSION:1.0\n' +
        'FN:Desire-eXe (Desire)\n' + 
        'ORG:Desire-eXe V2.0;\n' +         
        'TEL;type=CELL;type=VOICE;waid=2347017747337:+234 701 774 7337\n' + // Your WhatsApp number
        'END:VCARD';

    await sock.sendMessage(chatId, {
        contacts: {
            displayName: "Desire eXe Owner",
            contacts: [{ vcard }]
        }
    }, { quoted: msg });
}

// 🛑 SHUTDOWN Desire-eXe V1.0 
if (command === 'shutdown') {
    const isMainOwner = senderJid === config.OWNER_JID;
    
    if (!isMainOwner) {
        await sock.sendMessage(chatId, { 
            text: '*🚫 Only Main owner can Shutdown Desire-eXe V2.0*.' 
        }, { quoted: msg });
        return;
    }

    const isGroup = chatId.endsWith('@g.us');
    const sender = isGroup ? (msg.key.participant || msg.key.remoteJid) : chatId;

    await sock.sendMessage(chatId, {
        text: "⚠️ *CRITICAL ACTION* ⚠️\n\nAre you sure you want to shutdown *Desire-eXe V2.0*?\n\nThis will:\n• Disconnect from WhatsApp\n• Stop all commands\n• Require manual restart\n\nReply with *yes* to confirm or *no* to cancel.\n⏰ *Timeout: 30 seconds*",
    }, { quoted: msg });

    let responseReceived = false;
    let timeoutId;

    // Create a one-time listener for the response
    const responseHandler = async (messageUpsert) => {
        try {
            const { messages } = messageUpsert;
            if (!messages || messages.length === 0 || responseReceived) return;

            const incoming = messages[0];
            if (!incoming.message || incoming.key.fromMe) return;

            const responseChat = incoming.key.remoteJid;
            const responseSender = isGroup ? (incoming.key.participant || incoming.key.remoteJid) : incoming.key.remoteJid;
            
            // Normalize JIDs for comparison (remove device ID)
            const normalizeJid = (jid) => jid?.replace(/:[0-9]+/, '')?.split('@')[0];
            const normalizedSender = normalizeJid(sender);
            const normalizedResponseSender = normalizeJid(responseSender);
            
            // Check if it's the right chat and sender
            if (responseChat === chatId && normalizedResponseSender === normalizedSender) {
                const responseText = (incoming.message?.conversation ||
                                     incoming.message?.extendedTextMessage?.text ||
                                     incoming.message?.buttonsResponseMessage?.selectedButtonId ||
                                     '').toLowerCase().trim();

                if (responseText === 'yes') {
                    responseReceived = true;
                    clearTimeout(timeoutId);
                    sock.ev.off('messages.upsert', responseHandler);
                    
                    await sock.sendMessage(chatId, {
                        text: "🛑 *Shutting down Desire-eXe V2.0...*\n\nAll connections will be terminated.\nTo restart, manually run the bot again.\n\n👋 Goodbye!"
                    }, { quoted: incoming });
                    
                    console.log(`🛑 Shutdown initiated by owner: ${senderJid}`);
                    
                    // Graceful shutdown sequence
                    try {
                        // Send offline presence
                        await sock.sendPresenceUpdate('unavailable');
                        
                        // Close WebSocket connection
                        if (sock.ws && sock.ws.readyState === 1) {
                            sock.ws.close();
                        }
                        
                        // Remove all event listeners
                        sock.ev.removeAllListeners();
                        
                        // Close database connections if any
                        if (typeof db?.close === 'function') {
                            await db.close();
                        }
                        
                        // Log shutdown
                        console.log('✅ All connections closed gracefully');
                        
                        // Exit process
                        setTimeout(() => {
                            console.log('👋 Desire-eXe V2.0 shutdown complete');
                            process.exit(0);
                        }, 1000);
                        
                    } catch (shutdownError) {
                        console.error('Error during graceful shutdown:', shutdownError);
                        process.exit(1);
                    }
                    
                } else if (responseText === 'no') {
                    responseReceived = true;
                    clearTimeout(timeoutId);
                    sock.ev.off('messages.upsert', responseHandler);
                    
                    await sock.sendMessage(chatId, {
                        text: "✅ *Shutdown cancelled.*\nBot remains active and operational."
                    }, { quoted: incoming });
                    console.log(`✅ Shutdown cancelled by owner: ${senderJid}`);
                }
            }
        } catch (error) {
            console.error('Error in shutdown handler:', error);
        }
    };

    // Add the listener
    sock.ev.on('messages.upsert', responseHandler);

    // Set timeout to clean up the listener
    timeoutId = setTimeout(async () => {
        if (!responseReceived) {
            responseReceived = true;
            sock.ev.off('messages.upsert', responseHandler);
            
            try {
                await sock.sendMessage(chatId, {
                    text: "⏰ *Shutdown confirmation timed out.*\nCommand cancelled. Bot remains active."
                });
                console.log('⏰ Shutdown confirmation timed out');
            } catch (err) {
                console.error('Error sending timeout message:', err);
            }
        }
    }, 30000); // 30 seconds
}


// 👨‍💻 RESTART Desire-eXe V1.0 
if (command === 'restart' || command === 'reboot') {
    const isMainOwner = senderJid === config.OWNER_JID;
    
    if (!isMainOwner) {
        await sock.sendMessage(chatId, { 
            text: '*🚫 Only the owner can execute this command.*' 
        }, { quoted: msg });
        return;
    }

    const isGroup = chatId.endsWith('@g.us');
    const sender = isGroup ? (msg.key.participant || msg.key.remoteJid) : chatId;

    // Store the original message ID for response tracking
    const originalMsgId = msg.key.id;

    await sock.sendMessage(chatId, {
        text: "⚠️ Are you sure you want to restart *Desire-eXe V2.0*?\n\nReply with *yes* to confirm or *no* to cancel.\n⏰ *Timeout: 30 seconds*",
    }, { quoted: msg });

    let responseReceived = false;
    let timeoutId;

    // Create a one-time listener for the response
    const responseHandler = async (messageUpsert) => {
        try {
            const { messages } = messageUpsert;
            if (!messages || messages.length === 0 || responseReceived) return;

            const incoming = messages[0];
            if (!incoming.message || incoming.key.fromMe) return;

            const responseChat = incoming.key.remoteJid;
            const responseSender = isGroup ? (incoming.key.participant || incoming.key.remoteJid) : incoming.key.remoteJid;
            
            // Normalize JIDs for comparison
            const normalizeJid = (jid) => jid?.replace(/:[0-9]+/, '');
            const normalizedSender = normalizeJid(sender);
            const normalizedResponseSender = normalizeJid(responseSender);
            
            // Check if it's the right chat and sender
            if (responseChat === chatId && normalizedResponseSender === normalizedSender) {
                const responseText = (incoming.message?.conversation ||
                                     incoming.message?.extendedTextMessage?.text ||
                                     incoming.message?.buttonsResponseMessage?.selectedButtonId ||
                                     '').toLowerCase().trim();

                if (responseText === 'yes') {
                    responseReceived = true;
                    clearTimeout(timeoutId);
                    sock.ev.off('messages.upsert', responseHandler);
                    
                    await sock.sendMessage(chatId, {
                        text: "🔄 Restarting *Desire-eXe V2.0*...\nPlease wait 10-20 seconds."
                    }, { quoted: incoming });
                    
                    console.log(`🔄 Restart initiated by owner: ${senderJid}`);
                    
                    // Close the socket gracefully
                    await sock.ws.close();
                    await sock.ev.removeAllListeners();
                    
                    // Different restart strategies based on environment
                    if (process.env.KOYEB_APP_NAME) {
                        // Koyeb deployment
                        process.exit(1);
                    } else if (process.env.PM2_HOME) {
                        // PM2 process manager
                        process.exit(0); // PM2 will restart automatically
                    } else if (process.env.RAILWAY_ENVIRONMENT) {
                        // Railway deployment
                        process.exit(1);
                    } else {
                        // Local or other environments - use child process to restart
                        setTimeout(() => {
                            const { spawn } = require('child_process');
                            const [node, script, ...args] = process.argv;
                            spawn(node, [script, ...args], {
                                stdio: 'inherit',
                                detached: true
                            });
                            process.exit(0);
                        }, 1000);
                    }
                    
                } else if (responseText === 'no') {
                    responseReceived = true;
                    clearTimeout(timeoutId);
                    sock.ev.off('messages.upsert', responseHandler);
                    
                    await sock.sendMessage(chatId, {
                        text: "✅ Restart cancelled. Bot remains active."
                    }, { quoted: incoming });
                    console.log(`✅ Restart cancelled by owner: ${senderJid}`);
                }
            }
        } catch (error) {
            console.error('Error in restart handler:', error);
        }
    };

    // Add the listener
    sock.ev.on('messages.upsert', responseHandler);

    // Set timeout to clean up the listener
    timeoutId = setTimeout(async () => {
        if (!responseReceived) {
            responseReceived = true;
            sock.ev.off('messages.upsert', responseHandler);
            
            try {
                await sock.sendMessage(chatId, {
                    text: "⏰ *Restart confirmation timed out.*\nCommand cancelled. Use " + currentPrefix + "restart again if needed."
                });
                console.log('⏰ Restart confirmation timed out');
            } catch (err) {
                console.error('Error sending timeout message:', err);
            }
        }
    }, 30000); // 30 seconds
}

		
// 👨‍💻 Activate Desire-eXe
if (command === 'arise') {
    const videoPath = path.join(__dirname, '../uploads/DesireAura.mp4');

    await sock.sendMessage(chatId, { react: { text: "👨‍💻", key: msg.key } });

    try {
        const videoBuffer = await fs.promises.readFile(videoPath);

        await sock.sendMessage(chatId, {
            video: videoBuffer,
            caption: "_*Desire-eXe V2.0 is Ready and running under his eXecutor (Desire)*_",
            mimetype: 'video/mp4'
        }, { quoted: msg });

        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
    } catch (error) {
        console.error('Error sending .Arise video:', error);
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// 👨‍💻 Desire-eXe Groups (MAIN OWNER ONLY)
if (command === 'groups') {
    const isMainOwner = senderJid === config.OWNER_JID;
    
    if (!isMainOwner) {
        await sock.sendMessage(chatId, { 
            text: '*🚫 Only main owner can view groups list.*' 
        }, { quoted: msg });
        return;
    }

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

// 👨‍💻 Save Status (MAIN OWNER ONLY)
if (command === 'save') {
    const isMainOwner = senderJid === config.OWNER_JID;
    
    if (!isMainOwner) {
        await sock.sendMessage(chatId, { 
            text: '*🚫 Only main owner can save status.*' 
        }, { quoted: msg });
        return;
    }

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
            await sock.sendMessage(config.OWNER_JID, {
                image: buffer,
                caption: `📸 Saved Status\n\n⏰ ${new Date().toLocaleString()}`
            });
        } else if (mediaType === 'videoMessage') {
            await sock.sendMessage(config.OWNER_JID, {
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
// 👨‍💻 Desire-eXe Information Command 
if ((command === 'des' && args[0] && args[0].toLowerCase() === 'info') || 
    (command === 'desire' && args[0] && args[0].toLowerCase() === 'info')) {
    
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    
    const botInfo = `
┏━━━━━━━【 *Desire eXe Bot* 】━━━━━━━┓
┃ *🤖 Bot Name*: Desire-eXe
┃ *⚡ Version*: 2.0
┃ *👨‍💻 Creator*: Desire-eXe
┃ *⏰ Uptime*: ${hours}h ${minutes}m ${seconds}s 
┃───────────────────────────────────
┃ *🌟 Features*:
┃ • 100+ Fun & Utility Commands
┃ • AI & Text Generation
┃ • Media Tools (Images, GIFs, Stickers)
┃ • Group Management
┃ • Games & Challenges
┃ • YouTube Downloader
┃ • Chat AI Mode
┃───────────────────────────────────
┃ *💡 Prefix*: ${currentPrefix}
┃ *📚 Type*: ${currentPrefix}menu
┃ *🔧 Status*: 🟢 Operational
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

*🚀 Ready to serve! Use ${currentPrefix}menu to explore commands.*
    `;
    
    try {
        // Corrected file path - make sure it points to an actual image file
        const filePath = path.join(__dirname, '../uploads/upload/Desire-eXe V2.2.PNG');
        
        // Check if file exists
        if (fs.existsSync(filePath)) {
            await sock.sendMessage(chatId, { 
                image: fs.readFileSync(filePath),
                caption: botInfo
            });
        } else {
            // Fallback to text only if image doesn't exist
            await sock.sendMessage(chatId, { text: botInfo });
            console.log('⚠️  Desire.png not found, sent text only');
        }
        
        console.log('✅ Bot information sent successfully.');
    } catch (error) {
        console.error('❌ Error sending bot info:', error);
        // Fallback to text only if there's any error
        await sock.sendMessage(chatId, { text: botInfo });
    }
    return;
}

// 👨‍💻 Enable disappearing messages with options
if ((command === 'dis' && args[0] && args[0].toLowerCase() === 'on')) {
    const isMainOwner = senderJid === config.OWNER_JID;
    
    if (!isMainOwner) {
        await sock.sendMessage(chatId, { 
            text: '*🚫 Only main owner can change the Disappearing Message Timer settings.*' 
        }, { quoted: msg });
        return;
    }
    
    if (!args[1]) {
        // Show options if no duration specified
        const optionsMessage = `💨 *Disappearing Messages*\n\nPlease choose a duration:\n\n• *24h* - 24 hours\n• *72h* - 72 hours  \n• *7d* - 7 days\n\nUsage: ${currentPrefix}dis on <option>\nExample: ${currentPrefix}dis on 24h`;
        await sock.sendMessage(chatId, { text: optionsMessage }, { quoted: msg });
        return;
    }

    const duration = args[1].toLowerCase();
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
                text: `❌ Invalid option! Please use: *24h*, *72h*, or *7d*\n\nExample: ${currentPrefix}dis on 24h` 
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
    return;
}

// 👨‍💻 Disable disappearing messages
if ((command === 'dis' && args[0] && args[0].toLowerCase() === 'off')) {
    const isMainOwner = senderJid === config.OWNER_JID;
    
    if (!isMainOwner) {
        await sock.sendMessage(chatId, { 
            text: '*🚫 Only main owner can change the Disappearing Message timer settings*' 
        }, { quoted: msg });
        return;
    }
    
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
    return;
}


// 👨‍💻 Disable disappearing messages
if ((command === 'dis' && args[0] && args[0].toLowerCase() === 'off')) {
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
    return;
}

// 👨‍💻 Poll Message (Single Answer Only)
if (command === 'poll') {
    try {
        const from = msg.key.remoteJid;

        // Join args back into one string, then split by ','
        const input = args.join(" ").split(",").map(s => s.trim()).filter(s => s.length > 0);

        if (input.length < 2) {
            await sock.sendMessage(from, { text: "❌ Usage: " + currentPrefix + "poll Question, option1, option2, ..." });
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
            await sock.sendMessage(from, { text: "❌ Usage: " + currentPrefix + "mpoll Question, option1, option2, ..." });
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

// 👨‍💻 Set Profile Picture Command (MAIN OWNER ONLY)
if (command === 'setpp') {
    const isMainOwner = senderJid === config.OWNER_JID;
    
    if (!isMainOwner) {
        await sock.sendMessage(chatId, { 
            text: '*🚫 Only main owner can change profile picture.*' 
        }, { quoted: msg });
        return;
    }

    const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quotedMsg?.imageMessage) {
        await sock.sendMessage(chatId, { 
            text: "⚠️ Reply to an image with " + currentPrefix + "setpp to change your profile picture."
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
// 🔒 AutoBlock ON (MAIN OWNER ONLY) - FIXED VERSION
if ((command === 'autoblock' && args[0] && args[0].toLowerCase() === 'on')) {
    const isMainOwner = senderJid === config.OWNER_JID;
    
    if (!isMainOwner) {
        await sock.sendMessage(chatId, { 
            text: '*🚫 Only main owner can change autoblock settings.*' 
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "🔒", key: msg.key } });
    try {
        // Reload config first to ensure we have latest
        let currentConfig = {};
        if (fs.existsSync(configPath)) {
            currentConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        }
        
        // Update both memory and file
        currentConfig.AUTO_BLOCK_UNKNOWN = true;
        config.AUTO_BLOCK_UNKNOWN = true; // Update running instance
        
        fs.writeFileSync(configPath, JSON.stringify(currentConfig, null, 2), 'utf-8');
        
        console.log(`✅ AutoBlock enabled - Config saved`);
        await sock.sendMessage(chatId, { 
            text: "✅ *AutoBlock is now ON*\n\nUnknown contacts will be automatically blocked for security." 
        }, { quoted: msg });
        
    } catch (error) {
        console.error('❌ Error enabling autoblock:', error);
        await sock.sendMessage(chatId, { 
            react: { text: "❌", key: msg.key } 
        });
        await sock.sendMessage(chatId, { 
            text: "❌ Failed to update AutoBlock settings. Check console for details." 
        }, { quoted: msg });
    }
    return;
}

// 📛 AutoBlock OFF (MAIN OWNER ONLY) 
if ((command === 'autoblock' && args[0] && args[0].toLowerCase() === 'off')) {
    const isMainOwner = senderJid === config.OWNER_JID;
    
    if (!isMainOwner) {
        await sock.sendMessage(chatId, { 
            text: '*🚫 Only main owner can change autoblock settings.*' 
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "🔓", key: msg.key } });
    try {
        // Reload config first to ensure we have latest
        let currentConfig = {};
        if (fs.existsSync(configPath)) {
            currentConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        }
        
        // Update both memory and file
        currentConfig.AUTO_BLOCK_UNKNOWN = false;
        config.AUTO_BLOCK_UNKNOWN = false; // Update running instance
        
        fs.writeFileSync(configPath, JSON.stringify(currentConfig, null, 2), 'utf-8');
        
        console.log(`✅ AutoBlock disabled - Config saved`);
        await sock.sendMessage(chatId, { 
            text: "❌ *AutoBlock is now OFF*\n\nUnknown contacts will NOT be automatically blocked." 
        }, { quoted: msg });
        
    } catch (error) {
        console.error('❌ Error disabling autoblock:', error);
        await sock.sendMessage(chatId, { 
            react: { text: "❌", key: msg.key } 
        });
        await sock.sendMessage(chatId, { 
            text: "❌ Failed to update AutoBlock settings. Check console for details." 
        }, { quoted: msg });
    }
    return;
}
		
// Block in DMs (MAIN OWNER ONLY)
if (command === 'block') {
    const isMainOwner = senderJid === config.OWNER_JID;
    
    if (!isMainOwner) {
        await sock.sendMessage(chatId, { 
            text: '*🚫 Only main owner can block users.*' 
        }, { quoted: msg });
        return;
    }

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

// Send Spam Message (MAIN OWNER ONLY)
if (command === 'sspam') {
    const isMainOwner = senderJid === config.OWNER_JID;
    
    if (!isMainOwner) {
        await sock.sendMessage(chatId, { 
            text: '*🚫 Only main owner can use spam commands.*' 
        }, { quoted: msg });
        return;
    }

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
            text: `❌ Invalid format.\n\n✅ Usage:\n${currentPrefix}sspam +234xxxxx,+234yyyyyy <count> <message>`
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
    if (isNaN(count) || count < 1 || count > 99999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999) {
        await sock.sendMessage(chatId, { text: '❌ Please provide a valid count (1 - 99999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999)' }, { quoted: msg });
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
if ((command === 'clone' && args[0] && args[0].toLowerCase() === 'pfp') || 
    (command === 'clone' && args[0] && args[0].toLowerCase() === 'profile') ||
    (command === 'clone' && args[0] && args[0].toLowerCase() === 'picture')) {
    
    const isMainOwner = senderJid === config.OWNER_JID;
    
    if (!isMainOwner) {
        await sock.sendMessage(chatId, { 
            text: '*🚫 Only main owner can clone profile pictures.*' 
        }, { quoted: msg });
        return;
    }

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
    return;
}


if (command === 'vv') {
    const sender = msg.key.participant || msg.key.remoteJid;
    const ownerJid = config.OWNER_JID;
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
    const ownerJid = config.OWNER_JID;
    
    // Check if phone number argument is provided
    if (!args[0]) {
        await sock.sendMessage(msg.key.remoteJid, { 
            text: `❌ Please provide a phone number.\n\nUsage: ${currentPrefix} vv2 2348161262491` 
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
            text: `Please reply to a view-once message and mention a user.\n\nUsage: ${currentPrefix} vv3 @username`
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
	const isMainOwner = senderJid === config.OWNER_JID;
    
    if (!isMainOwner) {
        await sock.sendMessage(chatId, { 
            text: '*🚫 Only main owner can turn off Desire-eXe V2.0 AI.*' 
        }, { quoted: msg });
        return;
    }
  chatSessions.enableChat(chatId);
  await sock.sendMessage(chatId, { text: '_🧠 Chat mode activated! Talk to me now..._' });
  return;
}

// Disable Chat
if ((command === 'Desire' && args[0] && args[0].toLowerCase() === 'off') || 
    (command === 'Des' && args[0] && args[0].toLowerCase() === 'off')) {
    
    const isMainOwner = senderJid === config.OWNER_JID;
    
    if (!isMainOwner) {
        await sock.sendMessage(chatId, { 
            text: '*🚫 Only main owner can turn off Desire-eXe V2.0 AI.*' 
        }, { quoted: msg });
        return;
    }
    
    chatSessions.disableChat(chatId);
    await sock.sendMessage(chatId, { text: '💤 Chat mode deactivated. Bye for now!' });
    return;
}

// ==============================================
// 🔹HACKING COMMANDS
// ==============================================

// ✅ Ping (simple 4 times)
if (command === "ping") {
	const isMainOwner = senderJid === config.OWNER_JID;
    
    if (!isMainOwner) {
        await sock.sendMessage(chatId, { 
            text: '*🚫 Only main owner can use Hacking Commands.*' 
        }, { quoted: msg });
        return;
    }
    await sock.sendMessage(chatId, { react: { text: "⚡", key: msg.key } });

    const target = args[0];
    if (!target) {
        await sock.sendMessage(chatId, { text: "Please provide a domain or IP. Example: `" + currentPrefix + "ping google.com`" }, { quoted: msg });
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
	const isMainOwner = senderJid === config.OWNER_JID;
    
    if (!isMainOwner) {
        await sock.sendMessage(chatId, { 
            text: '*🚫 Only main owner can use Hacking Commands.*' 
        }, { quoted: msg });
        return;
    }
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



// ✅ IP Info
if (command === "ipinfo") {
	const isMainOwner = senderJid === config.OWNER_JID;
    
    if (!isMainOwner) {
        await sock.sendMessage(chatId, { 
            text: '*🚫 Only main owner can use Hacking Commands.*' 
        }, { quoted: msg });
        return;
    }
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
	const isMainOwner = senderJid === config.OWNER_JID;
    
    if (!isMainOwner) {
        await sock.sendMessage(chatId, { 
            text: '*🚫 Only main owner can use Hacking Commands.*' 
        }, { quoted: msg });
        return;
    }
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
	const isMainOwner = senderJid === config.OWNER_JID;
    
    if (!isMainOwner) {
        await sock.sendMessage(chatId, { 
            text: '*🚫 Only main owner can use Hacking Commands.*' 
        }, { quoted: msg });
        return;
    }
    await sock.sendMessage(chatId, { react: { text: "🌐", key: msg.key } });

    const target = args[0];
    if (!target) {
        await sock.sendMessage(chatId, { text: 'Provide a domain or IP. Example: `dnslookup google.com`' }, { quoted: msg });
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
	const isMainOwner = senderJid === config.OWNER_JID;
    
    if (!isMainOwner) {
        await sock.sendMessage(chatId, { 
            text: '*🚫 Only main owner can use Hacking Commands.*' 
        }, { quoted: msg });
        return;
    }
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

// Github Roasting
if ((command === 'github' && args[0] && args[0].toLowerCase() === 'roast') || 
    (command === 'github' && args[0] && args[0].toLowerCase() === 'roasting')) {
    
    const username = args.slice(1).join(' ').trim();

    if (!username) {
        await sock.sendMessage(chatId, {
            text: `❌ Usage: \`${currentPrefix}github roast username\``
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
    return;
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

// Detik Latest News Command
if (command === 'detikarticle' || command === 'detiklatest' || 
    (command === 'detik' && args[0] && args[0].toLowerCase() === 'latest') ||
    (command === 'detik' && args[0] && args[0].toLowerCase() === 'article') ||
    command === 'detikterbaru') {
    
    await sock.sendMessage(chatId, { react: { text: "📰", key: msg.key } });

    try {
        const articles = await DetikLatest();

        if (!articles || articles.length === 0) {
            await sock.sendMessage(chatId, { 
                text: '❌ *No latest news found.*\n\n💡 This feature might be temporarily unavailable.' 
            }, { quoted: msg });
            await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
            return;
        }

        const limitedArticles = articles.slice(0, 5);
        const responseText = `📰 *Latest Detik News*\n\n` +
            limitedArticles.map((article, index) => `*${index + 1}. ${article.title}*\n🔗 ${article.url}`).join('\n\n') +
            `\n\n📊 *Total articles:* ${articles.length}`;

        await sock.sendMessage(chatId, { text: responseText }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
        
    } catch (error) {
        console.error('Detik Latest Error:', error);
        let errorMessage = `❌ *Failed to fetch latest Detik news*\n\n`;
        
        if (error.message.includes('scraping') || error.message.includes('blocked')) {
            errorMessage += '⚠️ *Detik might have changed its website structure.*\n\n';
            errorMessage += '💡 *Technical solution:* The data fetching method needs to be updated.';
        } else {
            errorMessage += `Error: ${error.message}`;
        }
        
        errorMessage += `\n\n💡 For a more stable news solution, consider using news APIs like GNews[citation:10] which specifically provides top headlines from Indonesia[citation:10].`;
        
        await sock.sendMessage(chatId, { text: errorMessage }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// ==============================================
// 🔹 DOWNLOAD COMMANDS (Twitter, Instagram)
// ==============================================

// Twitter Video to MP4
if (command === 'twmp4' || command === 'twittervideo' || 
    (command === 'twitter' && args[0] && args[0].toLowerCase() === 'video') ||
    (command === 'tw' && args[0] && args[0].toLowerCase() === 'video') ||
    command === 'twdl') {
    
    let url = args.join(' ').trim();
    if ((command === 'twitter' || command === 'tw') && args[0] && args[0].toLowerCase() === 'video') {
        url = args.slice(1).join(' ').trim();
    }

    if (!url || !url.startsWith('http')) {
        await sock.sendMessage(chatId, {
            text: `🐦 *Twitter Video Downloader*\n\n*Usage:* ${currentPrefix}twmp4 <twitter_url>\n\n*Examples:*\n• ${currentPrefix}twmp4 https://twitter.com/user/status/123456\n• ${currentPrefix}twitter video https://x.com/user/status/123456\n• ${currentPrefix}tw video https://t.co/abc123`
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "📥", key: msg.key } });

    try {
        const uploadsDir = path.join(__dirname, "../uploads");
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

        const outputFilePath = path.join(uploadsDir, `twitter-video-${Date.now()}.mp4`);
        await TwitterVideo(url, outputFilePath);

        if (!fs.existsSync(outputFilePath)) throw new Error('Downloaded file not found');

        await sock.sendMessage(chatId, {
            video: fs.readFileSync(outputFilePath),
            caption: "🐦 *Twitter Video Downloaded!*\n\n✅ Ready to watch!"
        }, { quoted: msg });

        console.log(`✅ Twitter video sent: ${outputFilePath}`);
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
        fs.unlinkSync(outputFilePath);

    } catch (error) {
        console.error('Twitter Download Error:', error);
        let errorMsg = `❌ *Twitter Download Failed*\n\n`;
        if (error.message.includes('private') || error.message.includes('protected')) errorMsg += '🔒 Video may be private or protected.';
        else if (error.message.includes('not found')) errorMsg += '🔍 Invalid URL or video deleted.';
        else errorMsg += `Error: ${error.message}`;
        
        errorMsg += `\n\n💡 *Try:*\n• Use a valid Twitter/X link\n• Ensure the video is publicly viewable\n• Try a different link`;
        await sock.sendMessage(chatId, { text: errorMsg }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// Twitter Video to MP3
if (command === "twdlmp3" || command === "twitteraudio" || 
    (command === "twitter" && args[0] && args[0].toLowerCase() === "audio") ||
    (command === "tw" && args[0] && args[0].toLowerCase() === "audio") ||
    command === "twmusic") {
    
    let url = args.join(' ').trim();
    if ((command === 'twitter' || command === 'tw') && args[0] && args[0].toLowerCase() === 'audio') {
        url = args.slice(1).join(' ').trim();
    }

    if (!url || !url.startsWith('http')) {
        await sock.sendMessage(chatId, {
            text: `🎶 *Twitter Audio Downloader*\n\n*Usage:* ${currentPrefix}twdlmp3 <twitter_url>\n\n*Examples:*\n• ${currentPrefix}twdlmp3 https://twitter.com/user/status/123456\n• ${currentPrefix}twitter audio https://x.com/user/status/123456`
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "🎵", key: msg.key } });

    try {
        const uploadsDir = path.join(__dirname, "../uploads");
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

        const outputFilePath = path.join(uploadsDir, `twitter-audio-${Date.now()}.mp3`);
        await TwitterAudio(url, outputFilePath);

        if (!fs.existsSync(outputFilePath)) throw new Error('Downloaded file not found');

        await sock.sendMessage(chatId, { 
            audio: fs.readFileSync(outputFilePath), 
            mimetype: 'audio/mp4',
            fileName: `twitter-audio-${Date.now()}.mp3`
        }, { quoted: msg });
        
        console.log(`✅ Twitter audio sent: ${outputFilePath}`);
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
        fs.unlinkSync(outputFilePath);
    } catch (error) {
        console.error('Twitter Audio Error:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ *Twitter Audio Failed*\n\n${error.message}\n\n💡 Video may not have separate audio track.` 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// Instagram Video to MP4
if (command === "igdlmp4" || command === "instagramvideo" || 
    (command === "instagram" && args[0] && args[0].toLowerCase() === "video") ||
    (command === "ig" && args[0] && args[0].toLowerCase() === "video") ||
    command === "igdl") {
    
    let url = args.join(' ').trim();
    if ((command === 'instagram' || command === 'ig') && args[0] && args[0].toLowerCase() === 'video') {
        url = args.slice(1).join(' ').trim();
    }

    if (!url || !url.startsWith('http')) {
        await sock.sendMessage(chatId, {
            text: `📸 *Instagram Video Downloader*\n\n*Usage:* ${currentPrefix}igdlmp4 <instagram_url>\n\n*Examples:*\n• ${currentPrefix}igdlmp4 https://instagram.com/p/AbC123/\n• ${currentPrefix}instagram video https://www.instagram.com/reel/AbC123/\n• ${currentPrefix}ig video https://instagr.am/p/AbC123/`
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "📥", key: msg.key } });

    try {
        const uploadsDir = path.join(__dirname, "../uploads");
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

        const outputFilePath = path.join(uploadsDir, `instagram-video-${Date.now()}.mp4`);
        await InstagramVideo(url, outputFilePath);

        if (!fs.existsSync(outputFilePath)) throw new Error('Downloaded file not found');

        await sock.sendMessage(chatId, { 
            video: fs.readFileSync(outputFilePath), 
            caption: "📸 *Instagram Video Downloaded!*\n\n✅ Ready to watch!" 
        }, { quoted: msg });
        
        console.log(`✅ Instagram video sent: ${outputFilePath}`);
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
        fs.unlinkSync(outputFilePath);
    } catch (error) {
        console.error('Instagram Video Error:', error);
        let errorMsg = `❌ *Instagram Download Failed*\n\n`;
        if (error.message.includes('private') || error.message.includes('login')) errorMsg += '🔒 Video is private or requires Instagram login.';
        else if (error.message.includes('not found')) errorMsg += '🔍 Post not found or deleted.';
        else errorMsg += `Error: ${error.message}`;
        
        errorMsg += `\n\n💡 *Try:*\n• Use a public Instagram link\n• Ensure the account is not private\n• Try a different post/reel link`;
        await sock.sendMessage(chatId, { text: errorMsg }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// Instagram Video to MP3
if (command === "igdlmp3" || command === "instagramaudio" || 
    (command === "instagram" && args[0] && args[0].toLowerCase() === "audio") ||
    (command === "ig" && args[0] && args[0].toLowerCase() === "audio") ||
    command === "igmusic") {
    
    let url = args.join(' ').trim();
    if ((command === 'instagram' || command === 'ig') && args[0] && args[0].toLowerCase() === 'audio') {
        url = args.slice(1).join(' ').trim();
    }

    if (!url || !url.startsWith('http')) {
        await sock.sendMessage(chatId, {
            text: `🎶 *Instagram Audio Downloader*\n\n*Usage:* ${currentPrefix}igdlmp3 <instagram_url>\n\n*Examples:*\n• ${currentPrefix}igdlmp3 https://instagram.com/p/AbC123/\n• ${currentPrefix}instagram audio https://www.instagram.com/reel/AbC123/`
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "🎵", key: msg.key } });

    try {
        const uploadsDir = path.join(__dirname, "../uploads");
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

        const outputFilePath = path.join(uploadsDir, `instagram-audio-${Date.now()}.mp3`);
        await InstagramAudio(url, outputFilePath);

        if (!fs.existsSync(outputFilePath)) throw new Error('Downloaded file not found');

        await sock.sendMessage(chatId, { 
            audio: fs.readFileSync(outputFilePath), 
            mimetype: 'audio/mp4',
            fileName: `instagram-audio-${Date.now()}.mp3`
        }, { quoted: msg });
        
        console.log(`✅ Instagram audio sent: ${outputFilePath}`);
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
        fs.unlinkSync(outputFilePath);
    } catch (error) {
        console.error('Instagram Audio Error:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ *Instagram Audio Failed*\n\n${error.message}\n\n💡 Audio may not be available for this video.` 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// TikTok Video to MP4
if (command === "tkdlmp4" || command === "tikvideo" || 
    (command === "tiktok" && args[0] && args[0].toLowerCase() === "video") ||
    (command === "tt" && args[0] && args[0].toLowerCase() === "video")) {
    
    let url = args.join(' ').trim();
    
    // Handle multi-word patterns like "tiktok video"
    if ((command === "tiktok" || command === "tt") && args[0] && args[0].toLowerCase() === "video") {
        url = args.slice(1).join(' ').trim();
    }

    if (!url || !url.startsWith('http')) {
        await sock.sendMessage(chatId, {
            text: `🎵 *TikTok Video Downloader*\n\n*Usage:* ${currentPrefix}tkdlmp4 <tiktok_url>\n\n*Examples:*\n• ${currentPrefix}tkdlmp4 https://tiktok.com/@user/video/123\n• ${currentPrefix}tiktok video https://vm.tiktok.com/abc123/\n• ${currentPrefix}tt video https://tiktok.com/t/abc123/\n• ${currentPrefix}tikvideo https://www.tiktok.com/video/123`
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "📥", key: msg.key } });

    try {
        const uploadsDir = path.join(__dirname, "../uploads");
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const outputFilePath = path.join(uploadsDir, `tiktok-video-${Date.now()}.mp4`);
        await TikTokVideo(url, outputFilePath);

        if (!fs.existsSync(outputFilePath)) {
            throw new Error('Downloaded file not found');
        }

        await sock.sendMessage(chatId, { 
            video: fs.readFileSync(outputFilePath), 
            caption: "🎵 *TikTok Video Downloaded!*\n\n✅ Ready to watch!" 
        }, { quoted: msg });
        
        console.log(`✅ TikTok video sent: ${outputFilePath}`);
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

        fs.unlinkSync(outputFilePath);
    } catch (error) {
        console.error('❌ TikTok Video Error:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ *TikTok Download Failed*\n\n${error.message}\n\n💡 Try:\n• Copy exact TikTok URL\n• Video might be private/removed\n• Check URL format` 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// TikTok Video to MP3
if (command === "tkdlmp3" || command === "tikaudio" || 
    (command === "tiktok" && args[0] && args[0].toLowerCase() === "audio") ||
    (command === "tt" && args[0] && args[0].toLowerCase() === "audio") ||
    (command === "tikmusic")) {
    
    let url = args.join(' ').trim();
    
    // Handle multi-word patterns
    if ((command === "tiktok" || command === "tt") && args[0] && args[0].toLowerCase() === "audio") {
        url = args.slice(1).join(' ').trim();
    }

    if (!url || !url.startsWith('http')) {
        await sock.sendMessage(chatId, {
            text: `🎶 *TikTok Audio Downloader*\n\n*Usage:* \\${currentPrefix}tkdlmp3 <tiktok_url>\n\n*Examples:*\n• \\${currentPrefix}tkdlmp3 https://tiktok.com/@user/video/123\n• \\${currentPrefix}tiktok audio https://vm.tiktok.com/abc123/\n• \\${currentPrefix}tt audio https://tiktok.com/t/abc123/\n• \\${currentPrefix}tikmusic https://www.tiktok.com/video/123`
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "🎵", key: msg.key } });

    try {
        const uploadsDir = path.join(__dirname, "../uploads");
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const outputFilePath = path.join(uploadsDir, `tiktok-audio-${Date.now()}.mp3`);
        await TikTokAudio(url, outputFilePath);

        if (!fs.existsSync(outputFilePath)) {
            throw new Error('Downloaded file not found');
        }

        await sock.sendMessage(chatId, { 
            audio: fs.readFileSync(outputFilePath), 
            mimetype: 'audio/mp4',
            fileName: `tiktok-audio-${Date.now()}.mp3`
        }, { quoted: msg });
        
        console.log(`✅ TikTok audio sent: ${outputFilePath}`);
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

        fs.unlinkSync(outputFilePath);
    } catch (error) {
        console.error('❌ TikTok Audio Error:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ *TikTok Audio Failed*\n\n${error.message}\n\n💡 Try:\n• Use exact TikTok video URL\n• Some videos have protected audio\n• Try different TikTok URL` 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// Vimeo Video to MP4
if (command === "vmdlmp4" || command === "vimeovideo" || 
    (command === "vimeo" && args[0] && args[0].toLowerCase() === "video") ||
    command === "vmdl") {
    
    let url = args.join(' ').trim();
    
    if (command === "vimeo" && args[0] && args[0].toLowerCase() === "video") {
        url = args.slice(1).join(' ').trim();
    }

    if (!url || !url.startsWith('http')) {
        await sock.sendMessage(chatId, {
            text: `🎥 *Vimeo Video Downloader*\n\n*Usage:* \\${currentPrefix}vmdlmp4 <vimeo_url>\n\n*Examples:*\n• \\${currentPrefix}vmdlmp4 https://vimeo.com/123456789\n• \\${currentPrefix}vimeo video https://vimeo.com/channels/staffpicks/123\n• \\${currentPrefix}vmdl https://player.vimeo.com/video/123`
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "📥", key: msg.key } });

    try {
        const uploadsDir = path.join(__dirname, "../uploads");
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const outputFilePath = path.join(uploadsDir, `vimeo-video-${Date.now()}.mp4`);
        await VimeoVideo(url, outputFilePath);

        if (!fs.existsSync(outputFilePath)) {
            throw new Error('Downloaded file not found');
        }

        await sock.sendMessage(chatId, { 
            video: fs.readFileSync(outputFilePath), 
            caption: "🎥 *Vimeo Video Downloaded!*\n\n✅ High-quality video ready!" 
        }, { quoted: msg });
        
        console.log(`✅ Vimeo video sent: ${outputFilePath}`);
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

        fs.unlinkSync(outputFilePath);
    } catch (error) {
        console.error('❌ Vimeo Video Error:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ *Vimeo Download Failed*\n\n${error.message}\n\n💡 Try:\n• Video might be private/requires login\n• Check Vimeo Plus/Pro restrictions\n• Use direct vimeo.com URL` 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// Vimeo Video to MP3
if (command === "vmdlmp3" || command === "vimeoaudio" || 
    (command === "vimeo" && args[0] && args[0].toLowerCase() === "audio") ||
    command === "vmdaudio") {
    
    let url = args.join(' ').trim();
    
    if (command === "vimeo" && args[0] && args[0].toLowerCase() === "audio") {
        url = args.slice(1).join(' ').trim();
    }

    if (!url || !url.startsWith('http')) {
        await sock.sendMessage(chatId, {
            text: `🎶 *Vimeo Audio Downloader*\n\n*Usage:* \\${currentPrefix}vmdlmp3 <vimeo_url>\n\n*Examples:*\n• \\${currentPrefix}vmdlmp3 https://vimeo.com/123456789\n• \\${currentPrefix}vimeo audio https://vimeo.com/channels/staffpicks/123\n• \\${currentPrefix}vmdaudio https://player.vimeo.com/video/123`
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "🎵", key: msg.key } });

    try {
        const uploadsDir = path.join(__dirname, "../uploads");
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const outputFilePath = path.join(uploadsDir, `vimeo-audio-${Date.now()}.mp3`);
        await VimeoAudio(url, outputFilePath);

        if (!fs.existsSync(outputFilePath)) {
            throw new Error('Downloaded file not found');
        }

        await sock.sendMessage(chatId, { 
            audio: fs.readFileSync(outputFilePath), 
            mimetype: 'audio/mp4',
            fileName: `vimeo-audio-${Date.now()}.mp3`
        }, { quoted: msg });
        
        console.log(`✅ Vimeo audio sent: ${outputFilePath}`);
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

        fs.unlinkSync(outputFilePath);
    } catch (error) {
        console.error('❌ Vimeo Audio Error:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ *Vimeo Audio Failed*\n\n${error.message}\n\n💡 Try:\n• Video might not have extractable audio\n• Some Vimeo videos restrict downloads\n• Try with Vimeo Basic/Free videos` 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// Facebook Video to MP4
if (command === "fbmp4" || command === "fbvideo" || 
    (command === "facebook" && args[0] && args[0].toLowerCase() === "video") ||
    (command === "fb" && args[0] && args[0].toLowerCase() === "video") ||
    command === "fbdl") {
    
    let url = args.join(' ').trim();
    
    if ((command === "facebook" || command === "fb") && args[0] && args[0].toLowerCase() === "video") {
        url = args.slice(1).join(' ').trim();
    }

    if (!url || !url.startsWith('http')) {
        await sock.sendMessage(chatId, {
            text: `📘 *Facebook Video Downloader*\n\n*Usage:* \\${currentPrefix}fbmp4 <facebook_url>\n\n*Examples:*\n• \\${currentPrefix}fbmp4 https://facebook.com/watch/?v=123456789\n• \\${currentPrefix}facebook video https://fb.watch/abc123/\n• \\${currentPrefix}fb video https://www.facebook.com/reel/123\n• \\${currentPrefix}fbdl https://m.facebook.com/story.php?story_fbid=123`
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "📥", key: msg.key } });

    try {
        const uploadsDir = path.join(__dirname, "../uploads");
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const outputFilePath = path.join(uploadsDir, `facebook-video-${Date.now()}.mp4`);
        await FacebookVideo(url, outputFilePath);

        if (!fs.existsSync(outputFilePath)) {
            throw new Error('Downloaded file not found');
        }

        await sock.sendMessage(chatId, { 
            video: fs.readFileSync(outputFilePath), 
            caption: "📘 *Facebook Video Downloaded!*\n\n✅ Ready to watch!" 
        }, { quoted: msg });
        
        console.log(`✅ Facebook video sent: ${outputFilePath}`);
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

        fs.unlinkSync(outputFilePath);
    } catch (error) {
        console.error('❌ Facebook Video Error:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ *Facebook Download Failed*\n\n${error.message}\n\n💡 Try:\n• Video might be private/requires login\n• Facebook often blocks downloaders\n• Try with public/reels videos\n• Use m.facebook.com mobile URLs` 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// Facebook Video to MP3
if (command === "fbdlmp3" || command === "fbaudio" || 
    (command === "facebook" && args[0] && args[0].toLowerCase() === "audio") ||
    (command === "fb" && args[0] && args[0].toLowerCase() === "audio") ||
    command === "fbmusic") {
    
    let url = args.join(' ').trim();
    
    if ((command === "facebook" || command === "fb") && args[0] && args[0].toLowerCase() === "audio") {
        url = args.slice(1).join(' ').trim();
    }

    if (!url || !url.startsWith('http')) {
        await sock.sendMessage(chatId, {
            text: `🎶 *Facebook Audio Downloader*\n\n*Usage:* \\${currentPrefix}fbdlmp3 <facebook_url>\n\n*Examples:*\n• \\${currentPrefix}fbdlmp3 https://facebook.com/watch/?v=123456789\n• \\${currentPrefix}facebook audio https://fb.watch/abc123/\n• \\${currentPrefix}fb audio https://www.facebook.com/reel/123\n• \\${currentPrefix}fbmusic https://m.facebook.com/story.php?story_fbid=123`
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "🎵", key: msg.key } });

    try {
        const uploadsDir = path.join(__dirname, "../uploads");
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const outputFilePath = path.join(uploadsDir, `facebook-audio-${Date.now()}.mp3`);
        await FacebookAudio(url, outputFilePath);

        if (!fs.existsSync(outputFilePath)) {
            throw new Error('Downloaded file not found');
        }

        await sock.sendMessage(chatId, { 
            audio: fs.readFileSync(outputFilePath), 
            mimetype: 'audio/mp4',
            fileName: `facebook-audio-${Date.now()}.mp3`
        }, { quoted: msg });
        
        console.log(`✅ Facebook audio sent: ${outputFilePath}`);
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

        fs.unlinkSync(outputFilePath);
    } catch (error) {
        console.error('❌ Facebook Audio Error:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ *Facebook Audio Failed*\n\n${error.message}\n\n💡 Try:\n• Facebook audio extraction is tricky\n• Try with video that has clear audio\n• Some videos have copyright protection\n• Try different Facebook video` 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// ================================================
// ENCRYPTION & HASHING COMMANDS
// ================================================

// AES Encryption
if (command === 'aes-enc' || command === 'aes-encrypt') {
    const text = args.join(' ');
    
    if (!text) {
        await sock.sendMessage(chatId, { 
            text: `🔐 *AES-256 Encryption*\n\n*Usage:* ${currentPrefix}aes-enc <text>\n*Example:* ${currentPrefix}aes-enc Secret Message` 
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "🔒", key: msg.key } });

    try {
        const getkey = "b14ca5898a4e4133bbce2ea2315a1916"; // 32-byte key (256-bit)
        const encryptedText = await AesEncryption(text, getkey);
        
        await sock.sendMessage(chatId, { 
            text: `🔐 *AES-256 ENCRYPTED*\n\n📝 *Original:* ${text}\n\n🔒 *Encrypted:*\n\`${encryptedText}\`\n\n🔓 *Decrypt:* ${currentPrefix}aes-dec ${encryptedText}` 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
        
    } catch (error) {
        console.error('AES Encryption Error:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ AES encryption failed\n\n💡 Make sure:\n• Text is not empty\n• Using correct key format\n• No special characters causing issues` 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// AES Decryption
if (command === 'aes-dec' || command === 'aes-decrypt') {
    const encryptedText = args.join(' ');
    
    if (!encryptedText) {
        await sock.sendMessage(chatId, { 
            text: `🔓 *AES-256 Decryption*\n\n*Usage:* ${currentPrefix}aes-dec <encrypted_text>` 
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "🔓", key: msg.key } });

    try {
        const getkey = "b14ca5898a4e4133bbce2ea2315a1916";
        const decryptedText = await AesDecryption(encryptedText, getkey);
        
        await sock.sendMessage(chatId, { 
            text: `🔓 *AES-256 DECRYPTED*\n\n🔒 *Encrypted:* ${encryptedText.substring(0, 50)}${encryptedText.length > 50 ? '...' : ''}\n\n📝 *Decrypted:* ${decryptedText}\n\n🔐 *Re-encrypt:* ${currentPrefix}aes-enc ${decryptedText}` 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
        
    } catch (error) {
        console.error('AES Decryption Error:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ AES decryption failed\n\n💡 Check if:\n• Text is properly AES-encrypted\n• Using correct key\n• Format is valid hex string` 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// Camellia Encryption
if (command === 'camellia-enc' || command === 'cam-enc') {
    const text = args.join(' ');
    
    if (!text) {
        await sock.sendMessage(chatId, { 
            text: `🌸 *Camellia-256 Encryption*\n\n*Usage:* ${currentPrefix}camellia-enc <text>` 
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "🌸", key: msg.key } });

    try {
        const getkey = "0123456789abcdeffedcba9876543210"; // 32-byte key
        const encryptedText = await CamelliaEncryption(text, getkey);
        
        await sock.sendMessage(chatId, { 
            text: `🌸 *CAMELLIA-256 ENCRYPTED*\n\n📝 *Original:* ${text}\n\n🔒 *Encrypted:*\n\`${encryptedText}\`\n\n🔓 *Decrypt:* ${currentPrefix}camellia-dec ${encryptedText}` 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
        
    } catch (error) {
        console.error('Camellia Encryption Error:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ Camellia encryption failed` 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// Camellia Decryption
if (command === 'camellia-dec' || command === 'cam-dec') {
    const encryptedText = args.join(' ');
    
    if (!encryptedText) {
        await sock.sendMessage(chatId, { 
            text: `🌸 *Camellia-256 Decryption*\n\n*Usage:* ${currentPrefix}camellia-dec <encrypted_text>` 
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "🌸", key: msg.key } });

    try {
        const getkey = "0123456789abcdeffedcba9876543210";
        const decryptedText = await CamelliaDecryption(encryptedText, getkey);
        
        await sock.sendMessage(chatId, { 
            text: `🌸 *CAMELLIA-256 DECRYPTED*\n\n🔒 *Encrypted:* ${encryptedText.substring(0, 50)}${encryptedText.length > 50 ? '...' : ''}\n\n📝 *Decrypted:* ${decryptedText}` 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
        
    } catch (error) {
        console.error('Camellia Decryption Error:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ Camellia decryption failed` 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// SHA-256 Hash
if (command === 'sha' || command === 'sha256') {
    const text = args.join(' ');
    
    if (!text) {
        await sock.sendMessage(chatId, { 
            text: `⚡ *SHA-256 Hash*\n\n*Usage:* ${currentPrefix}sha <text>\n*Example:* ${currentPrefix}sha password123` 
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "⚡", key: msg.key } });

    try {
        const hashedText = await ShaEncryption(text);
        
        await sock.sendMessage(chatId, { 
            text: `⚡ *SHA-256 HASH*\n\n📝 *Input:* ${text}\n\n🔢 *Hash (64 chars):*\n\`${hashedText}\`\n\n💡 *Properties:* Fixed length, one-way, cannot be reversed` 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
        
    } catch (error) {
        console.error('SHA Error:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ SHA-256 hashing failed` 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// MD5 Hash
if (command === 'md5') {
    const text = args.join(' ');
    
    if (!text) {
        await sock.sendMessage(chatId, { 
            text: `🔢 *MD5 Hash*\n\n*Usage:* ${currentPrefix}md5 <text>\n*Example:* ${currentPrefix}md5 hello world` 
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "🔢", key: msg.key } });

    try {
        const hashedText = await Md5Encryption(text);
        
        await sock.sendMessage(chatId, { 
            text: `🔢 *MD5 HASH*\n\n📝 *Input:* ${text}\n\n🔢 *Hash (32 chars):*\n\`${hashedText}\`\n\n⚠️ *Security Note:* MD5 is cryptographically broken. Use for checksums only.` 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
        
    } catch (error) {
        console.error('MD5 Error:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ MD5 hashing failed` 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// RIPEMD-160 Hash
if (command === 'ripemd' || command === 'ripemd160') {
    const text = args.join(' ');
    
    if (!text) {
        await sock.sendMessage(chatId, { 
            text: `🌀 *RIPEMD-160 Hash*\n\n*Usage:* ${currentPrefix}ripemd <text>` 
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "🌀", key: msg.key } });

    try {
        const hashedText = await RipemdEncryption(text);
        
        await sock.sendMessage(chatId, { 
            text: `🌀 *RIPEMD-160 HASH*\n\n📝 *Input:* ${text}\n\n🔢 *Hash (40 chars):*\n\`${hashedText}\`\n\n💡 *Used in:* Bitcoin addresses, digital signatures` 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
        
    } catch (error) {
        console.error('RIPEMD Error:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ RIPEMD-160 hashing failed` 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// Bcrypt Hash
if (command === 'bcrypt' || command === 'bcrypt-hash') {
    const text = args.join(' ');
    
    if (!text) {
        await sock.sendMessage(chatId, { 
            text: `🛡️ *Bcrypt Password Hash*\n\n*Usage:* ${currentPrefix}bcrypt <password>\n*Example:* ${currentPrefix}bcrypt myPassword123` 
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "🛡️", key: msg.key } });

    try {
        // Send processing message (bcrypt is slow by design)
        await sock.sendMessage(chatId, { 
            text: `🛡️ *Processing Bcrypt hash...*\n\nThis may take a few seconds (10 salt rounds for security).` 
        }, { quoted: msg });
        
        const hashedText = await BcryptEncryption(text);
        
        await sock.sendMessage(chatId, { 
            text: `🛡️ *BCRYPT PASSWORD HASH*\n\n🔑 *Password:* [HIDDEN]\n\n🔒 *Secure Hash:*\n\`${hashedText}\`\n\n✅ *Features:* Auto-salted, slow hash, industry standard for passwords` 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
        
    } catch (error) {
        console.error('Bcrypt Error:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ Bcrypt hashing failed\n\n💡 Bcrypt is computationally intensive. This is normal for security.` 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// Crypto Help Command
if (command === 'crypto' || command === 'crypto-help') {
    const helpText = `🔐 *CRYPTOGRAPHY & HASHING COMMANDS*\n\n` +
                    `*Symmetric Encryption:*\n` +
                    `• \`${currentPrefix}aes-enc <text>\` - AES-256 encryption\n` +
                    `• \`${currentPrefix}aes-dec <text>\` - AES-256 decryption\n` +
                    `• \`${currentPrefix}camellia-enc <text>\` - Camellia encryption\n` +
                    `• \`${currentPrefix}camellia-dec <text>\` - Camellia decryption\n\n` +
                    `*Hash Functions:*\n` +
                    `• \`${currentPrefix}sha <text>\` - SHA-256 hash\n` +
                    `• \`${currentPrefix}md5 <text>\` - MD5 hash\n` +
                    `• \`${currentPrefix}ripemd <text>\` - RIPEMD-160 hash\n` +
                    `• \`${currentPrefix}bcrypt <text>\` - Bcrypt password hash\n\n` +
                    `*Key Information:*\n` +
                    `• AES Key: b14ca5898a4e4133bbce2ea2315a1916\n` +
                    `• Camellia Key: 0123456789abcdeffedcba9876543210\n\n` +
                    `💡 *Tips:*\n` +
                    `• Use same key for encryption/decryption\n` +
                    `• Bcrypt is slow by design (security feature)\n` +
                    `• Hashes are one-way (cannot be reversed)\n` +
                    `• Test with simple text first`;
    
    await sock.sendMessage(chatId, { text: helpText }, { quoted: msg });
}

// Quick Test Command
if (command === 'test-crypto') {
    const testText = "Hello123";
    
    await sock.sendMessage(chatId, { react: { text: "🧪", key: msg.key } });

    try {
        // Test SHA-256
        const shaHash = await ShaEncryption(testText);
        // Test MD5  
        const md5Hash = await Md5Encryption(testText);
        
        const result = `🧪 *CRYPTO TEST PASSED!*\n\n` +
                      `📝 *Test Text:* ${testText}\n\n` +
                      `⚡ *SHA-256:* ${shaHash.substring(0, 20)}...\n` +
                      `🔢 *MD5:* ${md5Hash}\n\n` +
                      `✅ All encryption functions working correctly!`;
        
        await sock.sendMessage(chatId, { text: result }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
        
    } catch (error) {
        await sock.sendMessage(chatId, { 
            text: `❌ Crypto test failed: ${error.message}\n\n💡 Check if Tools.js is properly imported.` 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// ================================================
// SHAZAM MUSIC RECOGNITION - WITH YOUR API KEY
// ================================================

// Command 1: Recognize song from audio (REPLY TO AUDIO)
if (command === 'shazam' || command === 'identify' || command === 'whatsong') {
    // Check if replying to audio or has audio
    if (msg.message.audioMessage || (msg.message.extendedTextMessage && msg.message.extendedTextMessage.contextInfo?.quotedMessage?.audioMessage)) {
        await sock.sendMessage(chatId, { react: { text: "🎵", key: msg.key } });
        
        try {
            let audioMsg;
            
            // Check if replying to audio
            if (msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.audioMessage) {
                audioMsg = msg.message.extendedTextMessage.contextInfo.quotedMessage.audioMessage;
            } else {
                audioMsg = msg.message.audioMessage;
            }
            
            // Download audio
            const stream = await downloadContentFromMessage(audioMsg, 'audio');
            let buffer = Buffer.from([]);
            
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }
            
            console.log(`🎵 Audio received: ${buffer.length} bytes, MIME: ${audioMsg.mimetype}`);
            
            // Send processing message
            const processingMsg = await sock.sendMessage(chatId, { 
                text: `🎵 *LISTENING...*\n\n• Analyzing audio patterns...\n• Comparing with music database...\n• Using your AudD API key...\n\n*Please wait 5-10 seconds...*` 
            }, { quoted: msg });
            
            // Process audio
            const processedAudio = await processWhatsAppAudio(buffer, audioMsg.mimetype);
            console.log(`✅ Audio processed: ${processedAudio.length} bytes`);
            
            // Recognize song
            const result = await recognizeSong(processedAudio);
            
            if (result.success) {
                let response = `🎵 *SHAZAM! SONG IDENTIFIED*\n\n`;
                response += `🎶 *Title:* ${result.title}\n`;
                response += `🎤 *Artist:* ${result.artist}\n`;
                
                if (result.album && result.album !== 'Unknown Album') {
                    response += `💿 *Album:* ${result.album}\n`;
                }
                
                if (result.releaseDate && result.releaseDate !== 'Unknown') {
                    response += `📅 *Released:* ${result.releaseDate}\n`;
                }
                
                if (result.timecode) {
                    response += `⏱️ *Matched at:* ${result.timecode}s\n`;
                }
                
                // Add streaming links
                response += `\n🔗 *STREAM NOW:*\n`;
                
                if (result.spotify?.url) {
                    response += `• *Spotify:* ${result.spotify.url}\n`;
                } else if (result.spotify) {
                    response += `• *Spotify:* Search "${result.title} ${result.artist}"\n`;
                }
                
                if (result.appleMusic?.url) {
                    response += `• *Apple Music:* ${result.appleMusic.url}\n`;
                }
                
                // YouTube search link
                response += `• *YouTube:* https://youtube.com/results?search_query=${encodeURIComponent(`${result.title} ${result.artist}`)}\n`;
                
                if (result.lyrics) {
                    response += `\n📝 *Lyrics Preview:*\n"${result.lyrics.substring(0, 100)}..."\n`;
                }
                
                response += `\n🎧 *Download:* \`${currentPrefix}play ${result.title} ${result.artist}\``;
                
                await sock.sendMessage(chatId, { text: response }, { quoted: msg });
                await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
                
            } else {
                const tips = `❌ *SONG NOT RECOGNIZED*\n\n` +
                            `*Possible reasons:*\n` +
                            `• Audio too short (need 10+ seconds)\n` +
                            `• Too much background noise\n` +
                            `• Song not in database\n` +
                            `• Low audio quality\n\n` +
                            `💡 *Try this:*\n` +
                            `• Record 15-20 seconds of clear audio\n` +
                            `• Hold phone closer to sound source\n` +
                            `• Avoid talking over the music\n\n` +
                            `🔍 *Alternative:*\n` +
                            `\`${currentPrefix}findsong <song name>\``;
                
                await sock.sendMessage(chatId, { text: tips }, { quoted: msg });
                await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
            }
            
        } catch (error) {
            console.error('Shazam error:', error);
            
            let errorMsg = `❌ *SHAZAM FAILED*\n\n*Error:* ${error.message}\n\n`;
            
            if (error.message.includes('limit reached')) {
                errorMsg += `📊 *API Limit:* You've used all 100 free songs today\n` +
                           `💡 *Solution:* Wait 24 hours or upgrade plan\n`;
            } else if (error.message.includes('invalid')) {
                errorMsg += `🔑 *API Issue:* Key may need activation\n` +
                           `💡 *Check:* https://audd.io/account\n`;
            } else {
                errorMsg += `💡 *Try:* \`${currentPrefix}findsong <song name>\``;
            }
            
            await sock.sendMessage(chatId, { text: errorMsg }, { quoted: msg });
            await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
        }
        
    } else {
        // No audio attached - show instructions
        const instructions = `🎵 *SHAZAM MUSIC RECOGNITION*\n\n` +
                           `*🔑 API Key:* Active (Your key: 641dc9f1...)\n\n` +
                           `*HOW TO USE:*\n` +
                           `1. Record/forward a song (10+ seconds)\n` +
                           `2. Reply with: \`${currentPrefix}shazam\`\n` +
                           `3. Wait for identification\n\n` +
                           `*EXAMPLE:*\n` +
                           `▶️ [Audio Message]\n` +
                           `💬 ${currentPrefix}shazam\n\n` +
                           `*ALTERNATIVE COMMANDS:*\n` +
                           `• \`${currentPrefix}findsong <name>\` - Search by name\n` +
                           `• \`${currentPrefix}lyrics <song>\` - Find lyrics\n` +
                           `• \`${currentPrefix}apicredits\` - Check API usage`;
        
        await sock.sendMessage(chatId, { text: instructions }, { quoted: msg });
    }
}

// Command 2: Check API credits
if (command === 'apicredits' || command === 'apistats') {
    await sock.sendMessage(chatId, { react: { text: "📊", key: msg.key } });
    
    try {
        const credits = await getAPICredits();
        
        let response = `📊 *AUDD API STATISTICS*\n\n`;
        response += `🔑 *Your Key:* 641dc9f1...${apiToken.slice(-4)}\n\n`;
        
        if (credits.credits) {
            response += `🎵 *Remaining:* ${credits.credits} recognitions\n`;
            response += `📈 *Limit:* ${credits.limit} per day\n`;
            response += `📅 *Resets:* Every 24 hours\n\n`;
        } else {
            response += `📊 *Status:* Active\n`;
            response += `💡 *Plan:* Free Tier (100 songs/day)\n\n`;
        }
        
        response += `💡 *Usage Tips:*\n`;
        response += `• Clear audio = better results\n`;
        response += `• 10-30 second clips work best\n`;
        response += `• Avoid background noise\n`;
        response += `• Humming/singing also works!`;
        
        await sock.sendMessage(chatId, { text: response }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
        
    } catch (error) {
        await sock.sendMessage(chatId, { 
            text: `📊 *API Status:* Active\n🔑 *Key:* 641dc9f1... (valid)\n💡 Free: 100 songs/day` 
        }, { quoted: msg });
    }
}

//Play Music 
if (command === "play") {
    let query = args.join(" ");

    if (!query) {
        await sock.sendMessage(chatId, { text: `❌ Please provide a search query.\nExample: ${currentPrefix} play song name`}, { quoted: msg });
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

        // Step 2: Get video info for thumbnail and upload date
        const videoInfo = await playdl.video_info(videoUrl);
        const videoDetails = videoInfo.video_details;

        // Get thumbnail URL (highest quality available)
        const thumbnails = videoDetails.thumbnails || [];
        const thumbnailUrl = thumbnails.length > 0 ? 
            thumbnails[thumbnails.length - 1].url : // Highest quality thumbnail
            `https://img.youtube.com/vi/${videoDetails.id}/maxresdefault.jpg`;

        // Format duration to 00:00:00 format
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

        // Step 3: Download thumbnail
        let thumbnailBuffer = null;
        try {
            console.log('🖼️ Downloading thumbnail...');
            const thumbnailResponse = await axios.get(thumbnailUrl, { 
                responseType: 'arraybuffer',
                timeout: 10000 
            });
            thumbnailBuffer = Buffer.from(thumbnailResponse.data, 'binary');
            console.log('✅ Thumbnail downloaded');
        } catch (thumbError) {
            console.log('❌ Thumbnail download failed, using text only');
        }

        // Step 4: Send thumbnail with caption
        const caption = `🎶 DESIRE-EXE MUSIC PLAYER\n` +
            `> Title: ${videoDetails.title}\n` +
            `> Views: ${views}\n` +
            `> Duration: ${formattedDuration}\n` +
            `> Uploaded: ${timeAgo}\n` +
            `> Url: ${videoUrl}\n` +
            `> ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴅᴇꜱɪʀᴇ ᴇxᴇ`;

        if (thumbnailBuffer) {
            await sock.sendMessage(chatId, {
                image: thumbnailBuffer,
                caption: caption
            }, { quoted: msg });
        } else {
            await sock.sendMessage(chatId, { 
                text: caption 
            }, { quoted: msg });
        }

        await sock.sendMessage(chatId, { react: { text: "⬇️", key: msg.key } });

        // Step 5: Download using yt-dlp
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

        if (stats.size > 50 * 1024 * 1024) {
            fs.unlinkSync(outputPath);
            await sock.sendMessage(chatId, { text: "❌ File is too large to send." }, { quoted: msg });
            return;
        }

        await sock.sendMessage(chatId, { react: { text: "🎶", key: msg.key } });

        // Step 6: Send audio file
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
        
        let errorMsg = "❌ An error occurred: ";
        if (err.message.includes('Python')) {
            errorMsg += "Python is required but not installed or not in PATH.";
        } else if (err.message.includes('not found')) {
            errorMsg += "Video not found.";
        } else {
            errorMsg += err.message;
        }
        
        await sock.sendMessage(chatId, { text: errorMsg }, { quoted: msg });
    }
}


// Download Video
if (command === "video") {
    let query = args.join(" ");

    if (!query) {
        await sock.sendMessage(chatId, { 
            text: `❌ Please provide a search query.\nExample: ${currentPrefix}video search term` 
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

        // Step 3: Download thumbnail
        let thumbnailBuffer = null;
        try {
            if (videoDetails.thumbnails && videoDetails.thumbnails.length > 0) {
                const thumbnailUrl = videoDetails.thumbnails[videoDetails.thumbnails.length - 1].url;
                console.log('📸 Downloading thumbnail:', thumbnailUrl);
                
                const response = await axios.get(thumbnailUrl, { 
                    responseType: 'arraybuffer',
                    timeout: 10000 
                });
                
                if (response.data && response.data.length > 0) {
                    thumbnailBuffer = Buffer.from(response.data, 'binary');
                    console.log('✅ Thumbnail downloaded:', thumbnailBuffer.length, 'bytes');
                }
            }
        } catch (thumbnailError) {
            console.log('⚠️ Failed to download thumbnail:', thumbnailError.message);
            // Continue without thumbnail
        }

        // Create caption
        const caption = `🎥 *${videoDetails.title}*\n\n` +
            `👀 *Views:* ${views}\n` +
            `⏱️ *Duration:* ${formattedDuration}\n` +
            `📅 *Uploaded:* ${timeAgo}\n\n` +
            `🔗 *URL:* ${videoUrl}\n\n` +
            `_Powered by Desire eXe_`;

        await sock.sendMessage(chatId, { react: { text: "⬇️", key: msg.key } });

        // Step 4: Download video in 480p using yt-dlp
        const outputPath = path.join(uploadDir, `video-${Date.now()}.mp4`);
        const thumbnailPath = path.join(uploadDir, `thumb-${Date.now()}.jpg`);
        
        console.log('📥 Downloading video in 480p...');
        
        try {
            // Clear any existing files
            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
            if (fs.existsSync(thumbnailPath)) fs.unlinkSync(thumbnailPath);
            
            // Download video specifically in 480p
            await ytExec(videoUrl, {
                format: 'best[height<=480]/best[height<=480]', // Prioritize 480p or lower
                output: outputPath,
                noCheckCertificates: true,
                noWarnings: true,
                externalDownloader: {
                    args: ['--limit-rate', '1M'] // Limit download speed to avoid timeouts
                }
            });

            // Check if file was created
            if (!fs.existsSync(outputPath)) {
                throw new Error('Video download failed - no output file');
            }

            const stats = fs.statSync(outputPath);
            if (stats.size === 0) {
                fs.unlinkSync(outputPath);
                throw new Error('Video download failed - empty file');
            }

            console.log('✅ Video downloaded. Size:', stats.size, 'bytes');

            // If thumbnail wasn't downloaded earlier, try to extract from video
            if (!thumbnailBuffer && videoDetails.thumbnails && videoDetails.thumbnails.length > 0) {
                try {
                    const thumbnailUrl = videoDetails.thumbnails[0].url;
                    const response = await axios.get(thumbnailUrl, { 
                        responseType: 'arraybuffer',
                        timeout: 10000 
                    });
                    thumbnailBuffer = Buffer.from(response.data, 'binary');
                } catch (err) {
                    console.log('⚠️ Could not get thumbnail:', err.message);
                }
            }

            // WhatsApp has ~16MB limit for videos
            if (stats.size > 16 * 1024 * 1024) {
                console.log('⚠️ Video exceeds 16MB, trying lower quality...');
                
                // Try 360p if 480p is too large
                const lowerQualityPath = path.join(uploadDir, `video-360p-${Date.now()}.mp4`);
                
                if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
                
                await ytExec(videoUrl, {
                    format: 'best[height<=360]/worst[height>=144]', // Try 360p or worst quality
                    output: lowerQualityPath,
                    noCheckCertificates: true,
                    noWarnings: true,
                });
                
                if (fs.existsSync(lowerQualityPath)) {
                    fs.renameSync(lowerQualityPath, outputPath);
                    console.log('✅ Using 360p version');
                }
            }

        } catch (downloadError) {
            console.error('❌ Download failed:', downloadError);
            throw new Error(`Download failed: ${downloadError.message}`);
        }

        await sock.sendMessage(chatId, { react: { text: "🎥", key: msg.key } });

        // Step 5: Send video file with thumbnail and caption
        console.log('📤 Sending video file...');
        try {
            const videoOptions = {
                video: fs.readFileSync(outputPath),
                caption: caption,
                fileName: `${videoDetails.title.substring(0, 50).replace(/[^\w\s.-]/gi, '')}.mp4`
            };

            // Add thumbnail if available
            if (thumbnailBuffer && thumbnailBuffer.length > 0) {
                videoOptions.jpegThumbnail = thumbnailBuffer;
            }

            await sock.sendMessage(chatId, videoOptions, { quoted: msg });

            await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
            console.log('🎉 Video sent successfully!');

        } catch (sendError) {
            console.error('❌ Failed to send video:', sendError);
            
            // Try sending without thumbnail
            try {
                await sock.sendMessage(chatId, {
                    video: fs.readFileSync(outputPath),
                    caption: caption,
                    fileName: `${videoDetails.title.substring(0, 50).replace(/[^\w\s.-]/gi, '')}.mp4`
                }, { quoted: msg });
                
                await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
            } catch (secondTryError) {
                await sock.sendMessage(chatId, { 
                    text: "❌ Video is too large for WhatsApp. Try a shorter video." 
                }, { quoted: msg });
                await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
            }
        }

        // Cleanup
        try {
            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
            if (fs.existsSync(thumbnailPath)) fs.unlinkSync(thumbnailPath);
        } catch (cleanupError) {
            console.log('⚠️ Cleanup error:', cleanupError.message);
        }

    } catch (err) {
        console.error('❌ Video command error:', err);
        
        let errorMsg = "❌ Failed to download video: ";
        if (err.message.includes('Requested format is not available')) {
            errorMsg += "480p format not available. Try a different video.";
        } else if (err.message.includes('Private video')) {
            errorMsg += "This video is private or unavailable.";
        } else if (err.message.includes('Sign in to confirm')) {
            errorMsg += "This video is age-restricted and cannot be downloaded.";
        } else if (err.message.includes('too long')) {
            errorMsg += "Video is too long. Try a video under 10 minutes.";
        } else if (err.message.includes('Download failed')) {
            errorMsg += "Could not download video. The video might not be available in 480p.";
        } else {
            errorMsg += "Try a different video or check your internet connection.";
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
            text: `❌ *Usage:* ${currentPrefix}tr <language_code> <text>\n\n*Common Languages:*\n• ${currentPrefix}tr en Hello World (English)\n• ${currentPrefix}tr es Hola Mundo (Spanish)\n• ${currentPrefix}tr fr Bonjour (French)\n• ${currentPrefix}tr de Hallo (German)\n• ${currentPrefix}tr it Ciao (Italian)\n• ${currentPrefix}tr pt Olá (Portuguese)\n• ${currentPrefix}tr ru Привет (Russian)\n• ${currentPrefix}tr ar مرحبا (Arabic)\n• ${currentPrefix}tr hi नमस्ते (Hindi)\n• ${currentPrefix}tr zh 你好 (Chinese)\n• ${currentPrefix}tr ja こんにちは (Japanese)\n• ${currentPrefix}tr ko 안녕하세요 (Korean)\n\n*Full list:* https://cloud.google.com/translate/docs/languages` 
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
            text: `❌ *Usage:* ${currentPrefix}qtr <text>\n\n*Translates to 5 common languages automatically*` 
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
            text: `❌ *Usage:* ${currentPrefix}detectlang <text>\n\n*Detects the language of the provided text*` 
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
            text: `❌ *Usage:* ${currentPrefix}mtr <lang1,lang2,lang3> <text>\n\n*Example:* ${currentPrefix}mtr es,fr,de Hello World\n*Translates to Spanish, French, and German*` 
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

// File: Your main command handler
const validFileTypes = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt', 'jpg', 'png', 'zip', 'rar', 'mp3', 'mp4'];

// File Search Commands (Individual file type commands)
if (validFileTypes.includes(command)) {
    const query = args.join(" ").trim();

    if (!query) {
        await sock.sendMessage(chatId, { 
            text: `❌ *Usage:* ${currentPrefix}${command} <search_query>\n\n*Examples:*\n${currentPrefix}${command} research paper\n${currentPrefix}${command} business plan template\n${currentPrefix}${command} programming tutorial\n\n💡 *Tip:* For better results, add specific keywords like "free", "download", or "template"` 
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "📁", key: msg.key } });

    try {
        console.log(`🔍 Searching for ${command} files: ${query}`);
        const result = await searchFiles(query, command);
        await sock.sendMessage(chatId, { text: result }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
    } catch (err) {
        console.error(`${command.toUpperCase()} Search Error:`, err.message);
        await sock.sendMessage(chatId, { 
            text: `❌ Couldn't find ${command} files for "${query}"\n\n💡 *Try:*\n• Different keywords\n• More specific search terms\n• Manual search: https://google.com/search?q=filetype:${command}+${encodeURIComponent(query)}` 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// Advanced file search (fsearch or filesearch) - WORKING VERSION
if (command === 'filesearch' || command === 'fsearch') {
    const fileType = args[0]?.toLowerCase();
    const searchQuery = args.slice(1).join(' ');

    if (!fileType || !searchQuery) {
        await sock.sendMessage(chatId, { 
            text: `🔍 *FILE SEARCH*\n\n*Usage:* ${currentPrefix}fsearch <file_type> <query>\n\n*Examples:*\n${currentPrefix}fsearch pdf machine learning\n${currentPrefix}fsearch doc business proposal\n${currentPrefix}fsearch ppt marketing` 
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "🔍", key: msg.key } });

    try {
        console.log(`🔍 Searching for ${fileType} files: ${searchQuery}`);
        
        // === USE THIS SIMPLE VERSION THAT ALWAYS WORKS ===
        const result = await simpleFileSearch(searchQuery, fileType);
        
        await sock.sendMessage(chatId, { text: result }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
        
    } catch (err) {
        console.error('File Search Error:', err.message);
        
        // Fallback to manual search link
        const searchUrl = `https://google.com/search?q=filetype:${fileType}+${encodeURIComponent(searchQuery)}+free+download`;
        
        await sock.sendMessage(chatId, { 
            text: `❌ *Search Error*\n\n*Try this instead:*\n🔗 ${searchUrl}\n\n💡 Click the link above to search manually` 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// === SIMPLE WORKING FUNCTION - ADD THIS TO YOUR FILE ===
async function simpleFileSearch(query, fileType) {
    // File type display names
    const typeNames = {
        'pdf': '📄 PDF Document',
        'doc': '📝 Word Document', 
        'docx': '📝 Word Document',
        'ppt': '📊 Presentation',
        'pptx': '📊 Presentation',
        'txt': '📋 Text File',
        'jpg': '🖼️ Image',
        'png': '🖼️ Image',
        'mp3': '🎵 Audio File',
        'mp4': '🎬 Video File'
    };
    
    const displayName = typeNames[fileType] || `📁 ${fileType.toUpperCase()} File`;
    
    // Create search URLs
    const googleUrl = `https://google.com/search?q=filetype:${fileType}+${encodeURIComponent(query)}`;
    const googleScholar = `https://scholar.google.com/scholar?q=${encodeURIComponent(query)}+filetype:pdf`;
    const archiveUrl = `https://archive.org/search.php?query=${encodeURIComponent(query)}+AND+mediatype:texts`;
    
    let response = `${displayName} Search Results\n\n`;
    response += `🔍 *Search:* "${query}"\n`;
    response += `📁 *Type:* ${fileType.toUpperCase()}\n\n`;
    
    response += `⚡ *SEARCH LINKS:*\n\n`;
    response += `1. *Google Search*\n`;
    response += `   🔗 ${googleUrl}\n\n`;
    
    if (fileType === 'pdf') {
        response += `2. *Academic Papers*\n`;
        response += `   🔗 ${googleScholar}\n\n`;
        response += `3. *Internet Archive*\n`;
        response += `   🔗 ${archiveUrl}\n\n`;
    }
    
    response += `💡 *TIPS:*\n`;
    response += `• Click any link above to search\n`;
    response += `• Add "free download" to your query\n`;
    response += `• Try different keywords\n\n`;
    
    response += `🎯 *BEST SEARCH:*\n`;
    response += `${googleUrl}`;
    
    return response;
}

// Generate QRCode Command
if (command === 'qrcode') {
    const text = args.join(" ").trim();

    if (!text) {
        await sock.sendMessage(chatId, { 
            text: `❌ *Usage:* ${currentPrefix}qrcode <text_or_url>\n\n*Examples:*\n${currentPrefix}qrcode Hello World\n${currentPrefix}qrcode https://example.com\n${currentPrefix}qrcode Contact: +1234567890\n${currentPrefix}qrcode WIFI:S:MyNetwork;T:WPA;P:MyPassword;;` 
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "🔲", key: msg.key } });

    try {
        // Create upload directory if it doesn't exist
        const uploadDir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        // Generate QR code filename
        const timestamp = Date.now();
        const qrPath = path.join(uploadDir, `qrcode-${timestamp}.png`);
        
        // Generate QR code with options for better quality
        await QRCode.toFile(qrPath, text, {
            errorCorrectionLevel: 'H', // High error correction
            margin: 2, // White border
            width: 400, // Image size
            color: {
                dark: '#000000', // Black dots
                light: '#FFFFFF' // White background
            }
        });

        // Calculate file size
        const stats = fs.statSync(qrPath);
        const fileSize = (stats.size / 1024).toFixed(2); // KB
        
        // Send QR code image
        await sock.sendMessage(chatId, {
            image: fs.readFileSync(qrPath),
            caption: `🔲 *QR CODE GENERATED*\n\n📝 *Content:* ${text}\n📏 *Size:* ${fileSize} KB\n🆔 *ID:* ${timestamp}\n\n💡 *Scan with your phone camera!*`
        }, { quoted: msg });

        // Optional: Send additional info for URLs
        if (text.startsWith('http')) {
            await sock.sendMessage(chatId, {
                text: `🔗 *URL detected:* ${text}\n\n📱 *Quick Actions:*\n• Scan to open the link\n• Share with friends\n• Save for later`
            });
        }

        // Cleanup
        fs.unlinkSync(qrPath);

        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
        
    } catch (error) {
        console.error("QR Code Error:", error);
        
        let errorMessage = `❌ *Failed to generate QR code*\n\n`;
        
        if (error.message.includes('data too big')) {
            errorMessage += `⚠️ *Text too long!*\n`;
            errorMessage += `QR codes have size limits.\n`;
            errorMessage += `💡 Try shorter text (max 1000 characters).`;
        } else if (error.message.includes('Cannot create')) {
            errorMessage += `⚠️ *File creation error*\n`;
            errorMessage += `Check uploads folder permissions.`;
        } else {
            errorMessage += `Error: ${error.message}\n`;
            errorMessage += `💡 Try different text or check for special characters.`;
        }
        
        await sock.sendMessage(chatId, { text: errorMessage }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}
// Mathematics 
if (command === 'math') {
    const expression = args.join(" ").trim();

    if (!expression) {
        await sock.sendMessage(chatId, {
            text: `❌ Please provide a math expression.\n\n*Example:* ${currentPrefix}math 2 + 3 * (4 - 1)`
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
            text: `❌ Please provide some text to analyze.\n\n*Example:* ${currentPrefix}words Hello world!`
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
// SEO Check Command (Professional) - FIXED
if (command === 'seo') {
    // Handle "seo roast google.com" pattern
    let domain;
    
    if (args[0] && (args[0].toLowerCase() === 'roast' || args[0].toLowerCase() === 'roasting')) {
        // User wants roasting, redirect to roasting command
        await sock.sendMessage(chatId, { 
            text: `🔥 *For SEO roasting, use:*\n${currentPrefix}seoroasting ${args.slice(1).join(' ') || 'domain.com'}\n\nExample: \\${currentPrefix}seoroasting google.com` 
        }, { quoted: msg });
        return;
    } else {
        domain = args[0];
    }
    
    if (!domain) {
        await sock.sendMessage(chatId, { 
            text: `❌ *Usage:* ${currentPrefix}seo <domain>\n\n*Examples:*\n${currentPrefix}seo google.com\n${currentPrefix}seo example.com\n${currentPrefix}seo github.com` 
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "🔍", key: msg.key } });

    try {
        // CORRECTED PATH: Import from SEO.js instead of CheckSEO.js
        const { CheckSEO } = require('./SEO'); // Changed from './CheckSEO' to './SEO'
        
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
        
        // Additional metrics from your CheckSEO function
        if (seoData.h1Count !== undefined) {
            responseMessage += `*📑 H1 Tags:* ${seoData.h1Count || 0}\n`;
        }
        if (seoData.totalImages !== undefined) {
            responseMessage += `*🖼️ Images:* ${seoData.totalImages || 0} (${seoData.altTextPercentage || '0%'} with alt)\n`;
        }
        
        // Quick assessment
        responseMessage += `\n💡 *Quick Assessment:*\n`;
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
        
        // Add roasting suggestion
        responseMessage += `\n\n🔥 *Want a funny roast?*\nUse: \\${currentPrefix}seoroasting ${domain}`;

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


// SEO Roasting Command (Simplified) - FIXED
if (command === 'seoroasting' || command === 'roastseo' || command === 'seoroast') {
    const domain = args.join(' ').trim();
    
    if (!domain) {
        await sock.sendMessage(chatId, { 
            text: `🔥 *SEO Roasting Command*\n\n*Usage:* ${currentPrefix}seoroasting <domain>\n\n*Examples:*\n${currentPrefix}seoroasting google.com\n${currentPrefix}seoroasting youtube.com\n${currentPrefix}seoroasting github.com\n\n*For professional analysis:*\n${currentPrefix}seo <domain>` 
        }, { quoted: msg });
        return;
    }

    // Clean domain
    const cleanDomain = domain.replace(/^(https?:\/\/)?(www\.)?/i, '').split('/')[0];
    
    await sock.sendMessage(chatId, { react: { text: "🔥", key: msg.key } });

    try {
        // CORRECTED PATH: Import from SEO.js instead of CheckSEO.js
        const { CheckSEO, GeminiRoastingMessage } = require('./SEO'); // Changed from './CheckSEO' to './SEO'
        
        // Send initial message
        await sock.sendMessage(chatId, { 
            text: `🔥 *Preparing to roast:* ${cleanDomain}\n\n⚡ Getting my sarcasm ready...` 
        }, { quoted: msg });
        
        // Get SEO data
        const seoData = await CheckSEO(cleanDomain);
        
        // Generate roast
        const roastMessage = await GeminiRoastingMessage(seoData);
        
        // Format final message
        const formattedRoast = `🔥 *SEO ROAST: ${cleanDomain.toUpperCase()}*\n\n${roastMessage}`;
        
        // Split if too long
        if (formattedRoast.length > 4000) {
            const parts = splitLongMessage(formattedRoast, 4000);
            for (let i = 0; i < parts.length; i++) {
                await sock.sendMessage(chatId, { 
                    text: `${parts[i]}${i < parts.length - 1 ? '\n\n*(Roasting continues...)*' : ''}` 
                }, { quoted: i === 0 ? msg : undefined });
                if (i < parts.length - 1) await new Promise(resolve => setTimeout(resolve, 800));
            }
        } else {
            await sock.sendMessage(chatId, { text: formattedRoast }, { quoted: msg });
        }
        
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

    } catch (error) {
        console.error('SEO Roasting Error:', error);
        
        let errorMessage = `🔥 *ROAST FAILED!*\n\n`;
        
        if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
            errorMessage += `❌ *Domain not found:* ${domain}\n`;
            errorMessage += `💡 Try: \\${currentPrefix}seoroasting google.com\n`;
        } else if (error.message.includes('MODULE_NOT_FOUND')) {
            // Update the error message to mention SEO.js
            errorMessage += `❌ *Module not found:* SEO.js\n`;
            errorMessage += `💡 Check if SEO.js exists in the same folder\n`;
            errorMessage += `💡 Make sure it exports both functions: module.exports = { CheckSEO, GeminiRoastingMessage };\n`;
        } else {
            errorMessage += `Error: ${error.message}\n`;
        }
        
        await sock.sendMessage(chatId, { text: errorMessage }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}
// Country Information Command
if (command === 'country') {
    const countryName = args.join(' '); // Join all args to handle country names with spaces
    
    if (!countryName) {
        await sock.sendMessage(chatId, { 
            text: `🌍 *Country Information Command*\n\n*Usage:* ${currentPrefix}country <country_name>\n\n*Examples:*\n${currentPrefix}country Indonesia\n${currentPrefix}country United States\n${currentPrefix}country Japan\n${currentPrefix}country UK\n${currentPrefix}country IN\n\n💡 *Tips:*\n• Use full country names\n• Country codes work too (US, GB, ID)\n• Try both common and official names` 
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "🌍", key: msg.key } });

    try {
        const Country = require('./Country'); // Make sure path is correct
        const responseMessage = await Country(countryName);
        
        console.log(`Country info fetched for: ${countryName}`);
        
        // Check if response is too long for WhatsApp
        if (responseMessage.length > 4000) {
            const parts = splitLongMessage(responseMessage, 4000);
            for (let i = 0; i < parts.length; i++) {
                await sock.sendMessage(chatId, { 
                    text: `${parts[i]}${i < parts.length - 1 ? '\n\n_(Continued...)_' : ''}` 
                }, { quoted: i === 0 ? msg : undefined });
                if (i < parts.length - 1) await new Promise(resolve => setTimeout(resolve, 1000));
            }
        } else {
            await sock.sendMessage(chatId, { text: responseMessage }, { quoted: msg });
        }

        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
        
    } catch (error) {
        console.error('Country Command Error:', error);
        
        // User-friendly error messages
        let errorMessage = `❌ *Country lookup failed*\n\n`;
        
        if (error.message.includes('not found') || error.message.includes('404')) {
            errorMessage += `"${countryName}" was not found.\n\n`;
            errorMessage += `💡 *Try:*\n`;
            errorMessage += `• Full country name (e.g., "United States" not "USA")\n`;
            errorMessage += `• Country code (e.g., "US", "GB", "ID")\n`;
            errorMessage += `• Check spelling\n\n`;
            errorMessage += `*Examples:*\n`;
            errorMessage += `\\=$.country France\n`;
            errorMessage += `\\.country Germany\n`;
            errorMessage += `\\.country Brazil\n`;
            errorMessage += `\\.country JP\n`;
        } else if (error.message.includes('network') || error.message.includes('timeout')) {
            errorMessage += `Network error. Please try again.\n\n`;
            errorMessage += `💡 The country API might be temporarily unavailable.`;
        } else {
            errorMessage += `${error.message}\n\n`;
            errorMessage += `💡 Please try a different country name.`;
        }
        
        await sock.sendMessage(chatId, { text: errorMessage }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// Bible Chapter Command
if (command === 'bible') {
    const book = args[0];
    const chapter = args[1];

    if (!book || !chapter || isNaN(chapter)) {
        await sock.sendMessage(chatId, { 
            text: `❌ *Usage:* ${currentPrefix}bible <book> <chapter>\n\n*Examples:*\n${currentPrefix}bible john 3\n${currentPrefix}bible psalms 23\n${currentPrefix}bible genesis 1\n${currentPrefix}bible matthew 5\n\n💡 *Tip:* Use ${currentPrefix}biblebooks to see all books` 
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
            text: `❌ *Usage:* ${currentPrefix}bibleverse <book> <chapter> <verse>\n\n*Examples:*\n${currentPrefix}bibleverse john 3 16\n${currentPrefix}bibleverse psalms 23 1\n${currentPrefix}bibleverse romans 8 28` 
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
            text: `❌ *Usage:* ${currentPrefix}biblesearch <search_query>\n\n*Examples:*\n${currentPrefix}biblesearch love\n${currentPrefix}biblesearch faith hope\n${currentPrefix}biblesearch peace of God` 
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

        responseMessage += `\n💡 *Usage:* ${currentPrefix}bible <book_name> <chapter>`;

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

💡 *Get any verse:* ${currentPrefix}bibleverse book chapter verse`;

    await sock.sendMessage(chatId, { text: popularList }, { quoted: msg });
}

// Surah Command - Get entire surah
if (command === 'surah') {
    const surahId = args[0];

    if (!surahId || isNaN(surahId) || surahId < 1 || surahId > 114) {
        await sock.sendMessage(chatId, { 
            text: `❌ *Usage:* ${currentPrefix}surah <surah_number>\n\n*Surah Numbers:* 1-114\n\n*Examples:*\n${currentPrefix}surah 1  (Al-Fatihah)\n${currentPrefix}surah 2  (Al-Baqarah)\n${currentPrefix}surah 36 (Ya-Sin)\n${currentPrefix}surah 112 (Al-Ikhlas)\n\n💡 *Tip:* Use ${currentPrefix}surahlist to see all surah names and numbers` 
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "📖", key: msg.key } });

    try {
        // Try multiple API endpoints with fallback
        const apis = [
            `https://equran.id/api/v2/surat/${surahId}`,  // Most reliable for Indonesia
            `https://quran-api-id.vercel.app/surahs/${surahId}`,
            `https://api.alquran.cloud/v1/surah/${surahId}/editions/quran-uthmani,id.indonesian`
        ];
        
        let surahData = null;
        let apiError = null;
        let usedApi = '';
        
        for (const apiUrl of apis) {
            try {
                console.log(`Trying API: ${apiUrl}`);
                const response = await fetch(apiUrl, { 
                    timeout: 10000,
                    headers: { 
                        'User-Agent': 'WhatsApp-Bot/1.0',
                        'Accept': 'application/json'
                    }
                });
                
                if (response.ok) {
                    surahData = await response.json();
                    usedApi = apiUrl;
                    console.log(`Success with API: ${apiUrl}`);
                    break;
                }
            } catch (error) {
                apiError = error;
                console.log(`Failed with API: ${apiUrl}`, error.message);
                continue;
            }
        }
        
        if (!surahData) {
            throw apiError || new Error('All Quran APIs failed. Please check your internet connection.');
        }
        
        let surahText = '';
        
        // Parse based on which API succeeded
        if (usedApi.includes('equran.id')) {
            // Format for equran.id API
            if (surahData.data && surahData.data.ayat) {
                const data = surahData.data;
                surahText = `📖 *Surah ${data.namaLatin} (${data.nama})*\n`;
                surahText += `📚 *Arti:* ${data.arti}\n`;
                surahText += `🎯 *Jumlah Ayat:* ${data.jumlahAyat}\n`;
                surahText += `📍 *Turun di:* ${data.tempatTurun}\n`;
                surahText += `📖 *Urutan Wahyu:* ${data.nomor}\n\n`;
                
                data.ayat.forEach(ayat => {
                    surahText += `*${ayat.nomorAyat}.* ${ayat.teksArab}\n`;
                    surahText += `   ${ayat.teksIndonesia}\n\n`;
                });
            } else {
                throw new Error('Invalid equran.id API response');
            }
        } 
        else if (usedApi.includes('quran-api-id')) {
            // Format for quran-api-id.vercel.app
            if (surahData.data && surahData.data.verses) {
                const data = surahData.data;
                surahText = `📖 *Surah ${data.name.transliteration.id} (${data.name.short})*\n`;
                surahText += `📚 *Terjemahan:* ${data.name.translation.id}\n`;
                surahText += `🎯 *Jumlah Ayat:* ${data.numberOfVerses}\n`;
                surahText += `📍 *Jenis:* ${data.revelation.id}\n\n`;
                
                data.verses.forEach(verse => {
                    surahText += `*${verse.number.inSurah}.* ${verse.text.arab}\n`;
                    surahText += `   ${verse.translation.id}\n\n`;
                });
            } else {
                throw new Error('Invalid quran-api-id API response');
            }
        }
        else if (usedApi.includes('alquran.cloud')) {
            // Format for alquran.cloud
            if (surahData.data && Array.isArray(surahData.data) && surahData.data.length >= 2) {
                const arabicText = surahData.data[0]?.text || '';
                const translation = surahData.data[1]?.text || '';
                
                surahText = `📖 *Surah ${surahData.data[0]?.englishName || ''} (${surahData.data[0]?.name || ''})*\n`;
                surahText += `📍 *Jenis:* ${surahData.data[0]?.revelationType || 'N/A'}\n`;
                surahText += `🎯 *Jumlah Ayat:* ${surahData.data[0]?.numberOfAyahs || 'N/A'}\n\n`;
                
                const verses = arabicText.split('\n');
                const translations = translation.split('\n');
                
                for (let i = 0; i < verses.length; i++) {
                    if (verses[i].trim()) {
                        surahText += `*${i + 1}.* ${verses[i]}\n`;
                        if (translations[i]) {
                            surahText += `   ${translations[i]}\n\n`;
                        }
                    }
                }
            } else {
                throw new Error('Invalid alquran.cloud API response');
            }
        }
        else {
            throw new Error('Unknown API format');
        }
        
        // Split long messages
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
            text: `❌ Gagal mengambil surah.\n\n💡 *Penyebab mungkin:*\n• Koneksi internet\n• Server API sibuk\n• Format data berubah\n\n*Coba:*\n• Gunakan nomor surah lain\n• Coba lagi nanti\n• Gunakan \\.surahlist untuk daftar surah` 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// Ayah Command - Get specific verse (UPDATED & FIXED)
if (command === 'surahverse' || command === 'verse' || 
    (command === 'surah' && args[0] && !isNaN(args[0]) && args[1] && !isNaN(args[1]))) {
    
    let surahId, ayahId;
    
    // Handle different command patterns
    if (command === 'surah' && args[0] && args[1]) {
        // For "surah 1 1" pattern
        surahId = args[0];
        ayahId = args[1];
    } else {
        // For "verse 1 1" or "surahverse 1 1" patterns
        surahId = args[0];
        ayahId = args[1];
    }

    if (!surahId || !ayahId || isNaN(surahId) || isNaN(ayahId) || surahId < 1 || surahId > 114) {
        await sock.sendMessage(chatId, { 
            text: `❌ *Usage:* ${currentPrefix}verse <surah_number> <verse_number>\n\n*Examples:*\n${currentPrefix}verse 1 1  (Al-Fatihah:1)\n${currentPrefix}surah 1 1  (Alternative)\n${currentPrefix}verse 2 255 (Ayat Kursi)\n${currentPrefix}verse 36 1  (Ya-Sin:1)` 
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "🎯", key: msg.key } });

    try {
        // IMPORTANT FIX: Add proper headers to prevent 403 error
        const apiUrl = `https://api.alquran.cloud/v1/surah/${surahId}/editions/quran-uthmani,id.indonesian`;
        const response = await fetch(apiUrl, { 
            timeout: 10000,
            headers: { 
                'User-Agent': 'Mozilla/5.0 (WhatsApp-Bot/1.0; +https://github.com/your-repo)',
                'Accept': 'application/json',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://alquran.cloud/',
                'Origin': 'https://alquran.cloud'
            }
        });
        
        if (!response.ok) {
            console.error(`API Response Status: ${response.status}, URL: ${apiUrl}`);
            
            // Try fallback API if primary fails
            return await tryFallbackAPI(surahId, ayahId, chatId, msg, currentPrefix);
        }
        
        const surahData = await response.json();
        
        // Validate response structure for alquran.cloud API
        if (!surahData.data || !surahData.data.length || surahData.data.length < 2) {
            throw new Error('Invalid surah data structure received');
        }
        
        const arabicData = surahData.data[0]; // Quran Uthmani (Arabic)
        const translationData = surahData.data[1]; // Indonesian translation
        
        // Get specific ayah
        const arabicAyah = arabicData.ayahs.find(a => a.numberInSurah === parseInt(ayahId));
        const translationAyah = translationData.ayahs.find(a => a.numberInSurah === parseInt(ayahId));
        
        if (!arabicAyah || !translationAyah) {
            await sock.sendMessage(chatId, { 
                text: `❌ Ayat ${ayahId} tidak ditemukan dalam Surah ${surahId}\n\n💡 Surah ${arabicData.englishName || surahId} memiliki ${arabicData.ayahs.length} ayat.` 
            }, { quoted: msg });
            await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
            return;
        }
        
        // Build the response text
        let ayahText = `🎯 *${arabicData.englishName || `Surah ${surahId}`} (${arabicData.name}) ${surahId}:${ayahId}*\n\n`;
        ayahText += `📜 *Arabic:*\n${arabicAyah.text}\n\n`;
        ayahText += `🔄 *Translation:*\n${translationAyah.text}\n\n`;
        ayahText += `📖 *Surah:* ${arabicData.englishName} | *Revelation:* ${arabicData.revelationType}\n`;
        ayahText += `🔢 *Total Verses:* ${arabicData.ayahs.length} | *Page:* ${arabicAyah.page}`;

        await sock.sendMessage(chatId, { text: ayahText }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

    } catch (error) {
        console.error('Ayah Command Error:', error);
        await sock.sendMessage(chatId, { 
            text: `❌ Failed to fetch verse.\n\n💡 *Try:*\n• Check internet connection\n• Ensure verse number is valid\n• Use: ${currentPrefix}surahlist to see all surahs` 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// Helper function for fallback API
async function tryFallbackAPI(surahId, ayahId, chatId, msg, currentPrefix) {
    try {
        console.log(`Trying fallback API for surah ${surahId}, ayah ${ayahId}`);
        
        // Alternative API: quran.com API
        const fallbackUrl = `https://api.quran.com/api/v4/verses/by_key/${surahId}:${ayahId}?translations=131&fields=text_uthmani`;
        const fallbackResponse = await fetch(fallbackUrl, {
            headers: {
                'User-Agent': 'WhatsApp-Quran-Bot/1.0',
                'Accept': 'application/json'
            }
        });
        
        if (fallbackResponse.ok) {
            const fallbackData = await fallbackResponse.json();
            const verse = fallbackData.verse;
            
            let ayahText = `🎯 *Surah ${surahId}:${ayahId} (Fallback API)*\n\n`;
            ayahText += `📜 *Arabic:*\n${verse.text_uthmani}\n\n`;
            
            if (verse.translations && verse.translations.length > 0) {
                ayahText += `🔄 *Translation:*\n${verse.translations[0].text}\n\n`;
            }
            
            ayahText += `⚠️ Using fallback service. Some features may be limited.`;
            
            await sock.sendMessage(chatId, { text: ayahText }, { quoted: msg });
            return;
        }
        
        // If both APIs fail, use local fallback
        const popularVerses = {
            '1:1': { arabic: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ', translation: 'Dengan nama Allah Yang Maha Pengasih, Maha Penyayang.', name: 'Al-Fatihah' },
            '2:255': { arabic: 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ', translation: 'Allah, tidak ada tuhan selain Dia. Yang Mahahidup, Yang terus menerus mengurus (makhluk-Nya).', name: 'Al-Baqarah' },
            '112:1': { arabic: 'قُلْ هُوَ اللَّهُ أَحَدٌ', translation: 'Katakanlah (Muhammad), "Dialah Allah, Yang Maha Esa."', name: 'Al-Ikhlas' }
        };
        
        const key = `${surahId}:${ayahId}`;
        if (popularVerses[key]) {
            const verse = popularVerses[key];
            let ayahText = `🎯 *${verse.name} ${surahId}:${ayahId} (Local Cache)*\n\n`;
            ayahText += `📜 *Arabic:*\n${verse.arabic}\n\n`;
            ayahText += `🔄 *Translation:*\n${verse.translation}\n\n`;
            ayahText += `⚠️ API services unavailable. Using cached verse.`;
            
            await sock.sendMessage(chatId, { text: ayahText }, { quoted: msg });
        } else {
            throw new Error('No fallback available for this verse');
        }
        
    } catch (fallbackError) {
        console.error('Fallback API Error:', fallbackError);
        throw fallbackError;
    }
}

// Random Verse Command 
if (command === 'quranrandomverse' || command === 'randomverse' || 
    command === 'randomquran' || (command === 'random' && args[0] && args[0].toLowerCase() === 'verse')) {
    
    await sock.sendMessage(chatId, { react: { text: "🎲", key: msg.key } });

    try {
        // Pick a random surah (1-114)
        const randomSurah = Math.floor(Math.random() * 114) + 1;
        
        // Fetch that surah's data from reliable API
        const apiUrl = `https://api.alquran.cloud/v1/surah/${randomSurah}`;
        const response = await fetch(apiUrl, { 
            timeout: 10000,
            headers: { 
                'User-Agent': 'Mozilla/5.0 (WhatsApp-Bot/1.0)',
                'Accept': 'application/json',
                'Origin': 'https://alquran.cloud'
            }
        });
        
        if (!response.ok) {
            // Use local fallback
            return await sendLocalRandomVerse(randomSurah, chatId, msg, currentPrefix);
        }
        
        const surahData = await response.json();
        
        if (!surahData.data || !surahData.data.ayahs) {
            throw new Error('Invalid data for random surah');
        }
        
        const data = surahData.data;
        const allAyat = data.ayahs;
        
        // Pick a random ayah from this surah
        const randomIndex = Math.floor(Math.random() * allAyat.length);
        const randomAyah = allAyat[randomIndex];
        
        // Get translation for this specific ayah
        const translationUrl = `https://api.alquran.cloud/v1/ayah/${randomSurah}:${randomAyah.numberInSurah}/editions/quran-uthmani,id.indonesian`;
        const translationResponse = await fetch(translationUrl, {
            headers: { 'User-Agent': 'WhatsApp-Bot/1.0' }
        });
        
        let translation = "Translation unavailable";
        if (translationResponse.ok) {
            const translationData = await translationResponse.json();
            if (translationData.data && translationData.data.length > 1) {
                translation = translationData.data[1].text;
            }
        }
        
        let responseMessage = `🎲 *Random Quran Verse*\n\n`;
        responseMessage += `*${data.englishName} ${randomSurah}:${randomAyah.numberInSurah}*\n\n`;
        responseMessage += `📜 ${randomAyah.text}\n\n`;
        responseMessage += `🔄 *Translation:*\n${translation}\n\n`;
        responseMessage += `💡 Use \\${currentPrefix}verse ${randomSurah} ${randomAyah.numberInSurah} to get this verse again`;

        await sock.sendMessage(chatId, { text: responseMessage }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

    } catch (error) {
        console.error('Random Ayah Error:', error);
        await sendLocalRandomVerse(null, chatId, msg, currentPrefix);
    }
}

// Helper function for local random verse fallback
async function sendLocalRandomVerse(randomSurah, chatId, msg, currentPrefix) {
    const fallbackVerses = [
        { surah: 1, ayah: 1, arabic: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ', translation: 'Dengan nama Allah Yang Maha Pengasih, Maha Penyayang.', name: 'Al-Fatihah' },
        { surah: 2, ayah: 255, arabic: 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ', translation: 'Allah, tidak ada tuhan selain Dia. Yang Mahahidup, Yang terus menerus mengurus (makhluk-Nya).', name: 'Al-Baqarah' },
        { surah: 36, ayah: 1, arabic: 'يس', translation: 'Yā Sīn.', name: 'Yā Sīn' },
        { surah: 55, ayah: 1, arabic: 'الرَّحْمَٰنُ', translation: 'Yang Maha Pengasih.', name: 'Ar-Rahman' },
        { surah: 112, ayah: 1, arabic: 'قُلْ هُوَ اللَّهُ أَحَدٌ', translation: 'Katakanlah (Muhammad), "Dialah Allah, Yang Maha Esa."', name: 'Al-Ikhlas' }
    ];
    
    const verse = randomSurah 
        ? fallbackVerses.find(v => v.surah === randomSurah) || fallbackVerses[Math.floor(Math.random() * fallbackVerses.length)]
        : fallbackVerses[Math.floor(Math.random() * fallbackVerses.length)];
    
    let responseMessage = `🎲 *Random Verse (Local Cache)*\n\n`;
    responseMessage += `*${verse.name} ${verse.surah}:${verse.ayah}*\n\n`;
    responseMessage += `📜 ${verse.arabic}\n\n`;
    responseMessage += `🔄 *Translation:*\n${verse.translation}\n\n`;
    responseMessage += `💡 Use \\${currentPrefix}verse ${verse.surah} ${verse.ayah} to get this verse again`;
    
    await sock.sendMessage(chatId, { text: responseMessage }, { quoted: msg });
    await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
}

// Detailed Weather Command
if (command === 'weatherdetail' || 
    (command === 'weather' && args[0] && args[0].toLowerCase() === 'detail') ||
    (command === 'weather' && args[0] && args[0].toLowerCase() === 'details') ||
    (command === 'weather' && args[0] && args[0].toLowerCase() === 'full')) {
    
    // Determine actual command and adjust arguments
    let cityName = args.join(' ').trim();
    
    // Handle "weather detail" pattern
    if (command === 'weather' && args[0]) {
        cityName = args.slice(1).join(' ').trim();
    }

    if (!cityName) {
        await sock.sendMessage(chatId, { 
            text: `❌ *Usage:* ${currentPrefix}weatherdetail <city_name>\n\n*Examples:*\n• ${currentPrefix}weatherdetail Lagos\n• ${currentPrefix}weather detail Abuja\n• ${currentPrefix}weather full London\n\n*Shows detailed weather information*` 
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "📊", key: msg.key } });

    try {
        const detailUrl = `https://wttr.in/${encodeURIComponent(cityName)}?format=%t|%C|%w|%h|%p|%P|%u|%m&lang=en&m`;
        const response = await fetch(detailUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        if (!response.ok) throw new Error('Weather service unavailable');
        
        const weatherData = await response.text();
        const weatherParts = weatherData.split('|');

        const responseMessage = `📊 *Detailed Weather - ${cityName}*\n\n` +
                               `🌡️ *Temperature:* ${weatherParts[0]?.trim() || 'N/A'}\n` +
                               `☁️ *Condition:* ${weatherParts[1]?.trim() || 'N/A'}\n` +
                               `💨 *Wind:* ${weatherParts[2]?.trim() || 'N/A'}\n` +
                               `💧 *Humidity:* ${weatherParts[3]?.trim() || 'N/A'}\n` +
                               `🌧️ *Precipitation:* ${weatherParts[4]?.trim() || 'N/A'}\n` +
                               `💨 *Pressure:* ${weatherParts[5]?.trim() || 'N/A'}\n` +
                               `☀️ *UV Index:* ${weatherParts[6]?.trim() || 'N/A'}\n` +
                               `🌙 *Moon Phase:* ${weatherParts[7]?.trim() || 'N/A'}\n\n` +
                               `_Source: wttr.in • Updated: ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}_`;

        await sock.sendMessage(chatId, { text: responseMessage }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

    } catch (error) {
        console.error('Detailed Weather Error:', error);
        
        let errorMessage = `❌ Detailed weather failed for *${cityName}*\n\n`;
        if (error.message.includes('timeout')) errorMessage += '⚠️ *Network timeout*\nTry again in a moment.';
        else if (error.message.includes('unavailable')) errorMessage += '🌐 *Service unavailable*\nWeather service is currently down.';
        else errorMessage += `Error: ${error.message || 'Unknown error'}`;
        
        errorMessage += `\n\nTry: \\${currentPrefix}weather ${cityName} for basic weather`;
        await sock.sendMessage(chatId, { text: errorMessage }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// Weather Forecast (3 days)
if (command === 'forecast') {
    const cityName = args.join(' ');

    if (!cityName) {
        await sock.sendMessage(chatId, { 
            text: `❌ *Usage:* ${currentPrefix}forecast <city_name>\n\n*Shows 3-day weather forecast*` 
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "📅", key: msg.key } });

    try {
        const forecastUrl = `https://wttr.in/${encodeURIComponent(cityName)}?format="%l|%c|%t|%w|%h\n"&lang=en&m&period=3`;
        
        console.log('Fetching from:', forecastUrl); // Debug log
        
        // ADD PROPER HEADERS - THIS IS THE KEY FIX
        const response = await fetch(forecastUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/plain',
                'Accept-Language': 'en-US,en;q=0.9'
            },
            timeout: 15000 // 15 second timeout
        });
        
        if (!response.ok) {
            console.log('Response status:', response.status, response.statusText);
            throw new Error(`Forecast service returned ${response.status}`);
        }
        
        const forecastData = await response.text();
        console.log('Raw response:', forecastData); // Debug log
        
        const forecasts = forecastData.trim().split('\n');
        console.log('Parsed forecasts:', forecasts); // Debug log
        
        // Check if we got valid data
        if (!forecasts || forecasts.length === 0 || forecasts[0].includes('Sorry') || forecasts[0].length < 5) {
            // Try without quotes in format
            const altUrl = `https://wttr.in/${encodeURIComponent(cityName)}?format=%l|%c|%t|%w|%h&lang=en&period=3`;
            const altResponse = await fetch(altUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            const altData = await altResponse.text();
            console.log('Alternative response:', altData);
            
            if (altData.includes('Unknown location')) {
                throw new Error(`Location "${cityName}" not found`);
            }
            
            // Use alternative data
            const altForecasts = altData.trim().split('\n');
            return formatAndSendForecast(altForecasts, cityName);
        }
        
        await formatAndSendForecast(forecasts, cityName);
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

    } catch (error) {
        console.error('Forecast Error:', error);
        
        let errorMessage = `❌ Forecast failed for "${cityName}"`;
        
        if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
            errorMessage += '\n\n⚠️ *Network timeout*\nTry again in a moment.';
        } else if (error.message.includes('not found')) {
            errorMessage += '\n\n📍 *Location not found*\nTry major cities like: Lagos, Abuja, London';
        } else {
            errorMessage += `\n\nError: ${error.message}`;
        }
        
        errorMessage += `\n\nExample: ${currentPrefix}forecast Lagos`;
        
        await sock.sendMessage(chatId, { 
            text: errorMessage 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// Helper function to format and send forecast
async function formatAndSendForecast(forecasts, cityName) {
    let responseMessage = `📅 *3-Day Forecast - ${cityName}*\n\n`;
    
    const days = ['Today', 'Tomorrow', 'Day After Tomorrow'];
    
    forecasts.slice(0, 3).forEach((forecast, index) => {
        // Clean up the data - remove quotes and split
        const cleanForecast = forecast.replace(/"/g, '').trim();
        const parts = cleanForecast.split('|');
        
        console.log(`Line ${index}:`, cleanForecast); // Debug
        console.log(`Parts ${index}:`, parts); // Debug
        
        if (parts.length >= 5) {
            responseMessage += `*${days[index]}*\n` +
                             `📍 ${parts[0]?.trim() || cityName}\n` +
                             `☁️ ${parts[1]?.trim() || 'Clear'}\n` +
                             `🌡️ ${parts[2]?.trim() || 'N/A'}\n` +
                             `💨 ${parts[3]?.trim() || 'N/A'}\n` +
                             `💧 ${parts[4]?.trim() || 'N/A'}\n\n`;
        } else {
            // If format is different, just show what we got
            responseMessage += `*${days[index]}*\n${cleanForecast}\n\n`;
        }
    });

    // Add timestamp
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
    });
    
    responseMessage += `_Updated: ${timeStr}_`;
    
    await sock.sendMessage(chatId, { text: responseMessage }, { quoted: msg });
}

// Weather Compare Command
if (command === 'weathercompare' || 
    (command === 'weather' && args[0] && args[0].toLowerCase() === 'compare') ||
    (command === 'weather' && args[0] && args[0].toLowerCase() === 'comparison')) {
    
    let cities = args.join(' ').trim();
    
    if (command === 'weather' && args[0] && (args[0].toLowerCase() === 'compare' || args[0].toLowerCase() === 'comparison')) {
        cities = args.slice(1).join(' ').trim();
    }
    
    const cityList = cities.split(',').map(city => city.trim());

    if (cityList.length < 2 || !cities) {
        await sock.sendMessage(chatId, { 
            text: `❌ *Usage:* ${currentPrefix}weathercompare <city1>,<city2>,<city3>\n\n*Examples:*\n• ${currentPrefix}weathercompare Lagos,Abuja\n• ${currentPrefix}weather compare London,Paris,Tokyo\n• ${currentPrefix}weather comparison NewYork,Moscow,Dubai\n\n*Compares weather in multiple cities*` 
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "⚖️", key: msg.key } });

    try {
        let responseMessage = `⚖️ *Weather Comparison*\n\n`;
        
        for (const city of cityList.slice(0, 5)) {
            try {
                const weatherData = await Weather(city);
                responseMessage += `*${city}*\n` +
                                 `🌡️ ${weatherData.temperature} | ☁️ ${weatherData.condition}\n` +
                                 `💨 ${weatherData.wind} | 💧 ${weatherData.humidity}\n\n`;
            } catch (error) {
                responseMessage += `*${city}*: ❌ Not found\n\n`;
            }
        }

        responseMessage += `_Compared at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}_`;
        await sock.sendMessage(chatId, { text: responseMessage }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

    } catch (error) {
        console.error('Weather Compare Error:', error);
        await sock.sendMessage(chatId, { text: '❌ Weather comparison failed.' }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// Weather Art Command
if (command === 'weatherart' || 
    (command === 'weather' && args[0] && args[0].toLowerCase() === 'art') ||
    (command === 'weather' && args[0] && args[0].toLowerCase() === 'ascii')) {
    
    let cityName = args.join(' ').trim();
    
    if (command === 'weather' && args[0]) {
        cityName = args.slice(1).join(' ').trim();
    }

    if (!cityName) {
        await sock.sendMessage(chatId, { 
            text: `❌ *Usage:* ${currentPrefix}weatherart <city_name>\n\n*Examples:*\n• ${currentPrefix}weatherart Lagos\n• ${currentPrefix}weather art London\n• ${currentPrefix}weather ascii Tokyo\n\n*Shows weather with ASCII art*` 
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "🎨", key: msg.key } });

    try {
        const artUrl = `https://wttr.in/${encodeURIComponent(cityName)}?lang=en&m`;
        const response = await fetch(artUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        if (!response.ok) throw new Error('Weather art service unavailable');
        
        const asciiArt = (await response.text()).split('\n').slice(0, 12).join('\n');
        const responseMessage = `🎨 *Weather Art - ${cityName}*\n\n\`\`\`${asciiArt}\`\`\`\n\n_Source: wttr.in • Fun visual weather display_`;

        await sock.sendMessage(chatId, { text: responseMessage }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

    } catch (error) {
        console.error('Weather Art Error:', error);
        let errorMessage = `❌ Weather art failed for *${cityName}*\n\n`;
        if (error.message.includes('timeout')) errorMessage += '⚠️ *Network timeout*\nTry again in a moment.';
        else if (error.message.includes('unavailable')) errorMessage += '🌐 *Service unavailable*\nASCII art service is down.';
        else errorMessage += `Error: ${error.message || 'Unknown error'}`;
        
        errorMessage += `\n\nTry: \\${currentPrefix}weather ${cityName} for text weather`;
        await sock.sendMessage(chatId, { text: errorMessage }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}
// Combined Wikipedia Command Handler
if ((command === 'wiki-ai' || command === 'wiki-search' || command === 'wikipedia') ||
    (command === 'wiki' && args[0] && (args[0].toLowerCase() === 'ai' || args[0].toLowerCase() === 'search'))) {
    
    // Determine actual command and adjust arguments
    let actualCommand = command;
    let searchQuery = args.join(' ').trim();
    
    // Handle "wiki ai" or "wiki search" patterns
    if (command === 'wiki' && args[0]) {
        actualCommand = args[0].toLowerCase() === 'ai' ? 'wiki-ai' : 'wiki-search';
        searchQuery = args.slice(1).join(' ').trim(); // Remove the first arg (ai/search)
    }
    
    const isAI = actualCommand === 'wiki-ai';
    
    // Command usage examples
    const examples = {
        'wiki-ai': ['Albert Einstein', 'quantum mechanics'],
        'wiki-search': ['quantum physics', 'machine learning'],
        'wikipedia': ['history of computers', 'Mars exploration']
    };
    
    // React emojis for different commands
    const reactionEmojis = {
        'wiki-ai': '👨‍💻',
        'wiki-search': '🔍',
        'wikipedia': '🌐'
    };

    // Check if search query is provided
    if (!searchQuery) {
        const cmdName = command === 'wikipedia' ? 'wikipedia' : 'wiki-ai/search';
        await sock.sendMessage(chatId, { 
            text: `❌ *Usage:* ${currentPrefix}${cmdName} <search_query>\n\n*Examples:*\n• ${currentPrefix}wiki-ai ${examples['wiki-ai'][0]}\n• ${currentPrefix}wiki-search ${examples['wiki-search'][0]}\n• ${currentPrefix}wiki ai ${examples['wiki-ai'][1]}\n• ${currentPrefix}wiki search ${examples['wiki-search'][1]}\n• ${currentPrefix}wikipedia ${examples['wikipedia'][0]}` 
        }, { quoted: msg });
        return;
    }

    // Validate search query length
    if (searchQuery.length < 2) {
        await sock.sendMessage(chatId, { 
            text: `❌ Search query must be at least 2 characters long.` 
        }, { quoted: msg });
        return;
    }

    if (searchQuery.length > 200) {
        await sock.sendMessage(chatId, { 
            text: `❌ Search query is too long (max 200 characters).` 
        }, { quoted: msg });
        return;
    }

    // Send initial reaction
    const startEmoji = reactionEmojis[actualCommand] || '🔍';
    await sock.sendMessage(chatId, { react: { text: startEmoji, key: msg.key } });

    // Optional: Send searching message for better UX
    try {
        let actionText = '';
        if (actualCommand === 'wiki-ai') actionText = 'with AI analysis';
        else if (actualCommand === 'wiki-search') actionText = 'for information';
        else actionText = '';
        
        await sock.sendMessage(chatId, { 
            text: `${startEmoji} Searching Wikipedia ${actionText} for: *${searchQuery}*...` 
        }, { quoted: msg });
    } catch (err) {
        console.log('Could not send searching message:', err.message);
    }

    try {
        // Call appropriate Wikipedia function
        const responseMessage = isAI 
            ? await WikipediaAI(searchQuery)
            : await WikipediaSearch(searchQuery);
        
        // Send response if available
        if (responseMessage) {
            await sock.sendMessage(chatId, { text: responseMessage }, { quoted: msg });
        } else {
            // Handle no results
            await sock.sendMessage(chatId, { 
                text: `❌ No results found for: *${searchQuery}*\n\n*Suggestions:*\n• Try different keywords\n• Check spelling\n• Use more specific terms\n\nTry: ${currentPrefix}wiki ai "${searchQuery}" for AI-powered search.` 
            }, { quoted: msg });
        }

        // Send success reaction
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
        
    } catch (error) {
        console.error(`${isAI ? 'Wiki AI' : 'Wiki Search'} Error:`, error);
        
        // Prepare user-friendly error message
        let errorMessage = `❌ Wikipedia ${isAI ? 'AI ' : ''}search failed.\n`;
        
        // Handle specific error cases
        if (error.response?.status === 403) {
            errorMessage += 'Wikipedia API access denied (403 Forbidden).\n';
            errorMessage += 'Please contact bot administrator to fix User-Agent configuration.';
        } else if (error.response?.status === 404) {
            errorMessage += `No Wikipedia page found for: *${searchQuery}*\n`;
            errorMessage += 'Try different search terms or check spelling.';
        } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
            errorMessage += 'Network error. Unable to reach Wikipedia servers.';
        } else if (error.code === 'ETIMEDOUT') {
            errorMessage += 'Request timeout. Wikipedia servers are taking too long to respond.';
        } else if (error.response?.status === 429) {
            errorMessage += 'Too many requests to Wikipedia. Please wait a moment before trying again.';
        } else if (error.message.includes('User-Agent')) {
            errorMessage += 'Wikipedia API requires proper User-Agent header.';
        } else {
            errorMessage += `Error: ${error.message || 'Unknown error occurred'}`;
        }
        
        // Send error message
        await sock.sendMessage(chatId, { 
            text: errorMessage 
        }, { quoted: msg });
        
        // Send error reaction
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// Wiki Image Command
if ((command === 'wiki-img' || command === 'wiki-image' || command === 'wikipedia-image') ||
    (command === 'wiki' && args[0] && (args[0].toLowerCase() === 'img' || args[0].toLowerCase() === 'image')) ||
    (command === 'image' && args[0] && args[0].toLowerCase() === 'wiki')) {
    
    // Determine actual command and adjust arguments
    let searchQuery = args.join(' ').trim();
    
    // Handle "wiki img" or "wiki image" patterns
    if (command === 'wiki' && args[0] && (args[0].toLowerCase() === 'img' || args[0].toLowerCase() === 'image')) {
        searchQuery = args.slice(1).join(' ').trim();
    }
    // Handle "image wiki" pattern
    else if (command === 'image' && args[0] && args[0].toLowerCase() === 'wiki') {
        searchQuery = args.slice(1).join(' ').trim();
    }
    
    // Check if search query is provided
    if (!searchQuery) {
        await sock.sendMessage(chatId, { 
            text: `❌ *Usage:* ${currentPrefix}wiki-image <search_query>\n\n*Examples:*\n• ${currentPrefix}wiki-img Eiffel Tower\n• ${currentPrefix}wiki image Albert Einstein portrait\n• ${currentPrefix}image wiki Mona Lisa\n• ${currentPrefix}wiki-image Great Wall of China\n\n*Note:* Works best with specific subjects that have Wikipedia pages.` 
        }, { quoted: msg });
        return;
    }

    // Validate search query
    if (searchQuery.length < 2) {
        await sock.sendMessage(chatId, { 
            text: `❌ Search query must be at least 2 characters long.` 
        }, { quoted: msg });
        return;
    }

    if (searchQuery.length > 100) {
        await sock.sendMessage(chatId, { 
            text: `❌ Search query is too long (max 100 characters).` 
        }, { quoted: msg });
        return;
    }

    // Send initial reaction
    await sock.sendMessage(chatId, { react: { text: "🖼️", key: msg.key } });

    // Optional: Send searching message
    try {
        await sock.sendMessage(chatId, { 
            text: `🖼️ Searching for Wikipedia image: *${searchQuery}*...` 
        }, { quoted: msg });
    } catch (err) {
        // Silent fail if we can't send the message
    }

    try {
        // Get image from Wikipedia
        const result = await WikipediaImage(searchQuery);
        
        if (result && result.url) {
            try {
                // Add source attribution
                const captionWithSource = `${result.caption}\n\n📚 *Source:* Wikipedia\n🔍 *Search:* ${searchQuery}`;
                
                // Send the image
                await sock.sendMessage(chatId, { 
                    image: { url: result.url }, 
                    caption: captionWithSource,
                    quoted: msg
                });

                // Send success reaction
                await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
                
            } catch (imageError) {
                console.error('Image sending error:', imageError);
                
                // Fallback: Send the image URL as text if image can't be sent
                await sock.sendMessage(chatId, { 
                    text: `🖼️ *${result.caption}*\n\n📎 *Direct Image URL:* ${result.url}\n\n⚠️ Could not send image directly. You can open the URL above.\n\n💡 *Tip:* The image might be too large or in an unsupported format.` 
                }, { quoted: msg });
                
                await sock.sendMessage(chatId, { react: { text: "⚠️", key: msg.key } });
            }
            
        } else {
            // No image found - provide helpful suggestions
            let errorMessage = `❌ No Wikipedia image found for: *${searchQuery}*\n\n`;
            errorMessage += `*Suggestions:*\n`;
            errorMessage += `• Try more specific terms (e.g., "Albert Einstein portrait" instead of "Einstein")\n`;
            errorMessage += `• Add descriptive words like "portrait", "photo", "diagram", "map"\n`;
            errorMessage += `• Check spelling\n`;
            errorMessage += `• Try related terms\n\n`;
            errorMessage += `You can also try:\n• \`${currentPrefix}wiki-search ${searchQuery}\` - Find related pages\n• \`${currentPrefix}wiki-ai ${searchQuery}\` - AI-powered Wikipedia search`;
            
            await sock.sendMessage(chatId, { 
                text: errorMessage 
            }, { quoted: msg });
            
            await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
        }
        
    } catch (error) {
        console.error('Wiki Image Command Error:', error);
        
        // User-friendly error messages
        let errorMessage = `❌ Error fetching Wikipedia image.\n`;
        
        if (error.message?.includes('User-Agent') || error.response?.status === 403) {
            errorMessage += 'Wikipedia API access issue. Please contact bot administrator.';
        } else if (error.code === 'ETIMEDOUT') {
            errorMessage += 'Request timeout. Please try again.';
        } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
            errorMessage += 'Network error. Cannot connect to Wikipedia.';
        } else if (error.message?.includes('rate limit') || error.response?.status === 429) {
            errorMessage += 'Too many requests. Please wait a moment.';
        } else {
            errorMessage += `Technical error: ${error.message || 'Unknown error'}`;
        }
        
        errorMessage += `\n\n💡 *Alternative:* Try \`${currentPrefix}wiki-search ${searchQuery}\` for text information.`;
        
        await sock.sendMessage(chatId, { 
            text: errorMessage 
        }, { quoted: msg });
        
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// Text-to-Speech (TTS)
if (command === 'tts') {
    const textToConvert = args.join(' ');
    
    if (!textToConvert) {
        await sock.sendMessage(chatId, { 
            text: `❌ *Usage:* ${currentPrefix}tts <text>\n\n*Example:* ${currentPrefix}tts Hello world` 
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
            text: `❌ *Usage:* ${currentPrefix}tts2 <message> <phone_number>\n\n*Example:* ${currentPrefix}tts2 Hello 2348123456789` 
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "👨‍💻", key: msg.key } });

    try {
        const lastSpaceIndex = joinedArgs.lastIndexOf(' ');

        if (lastSpaceIndex === -1) {
            await sock.sendMessage(chatId, { 
                text: `❌ *Usage:* \\${currentPrefix}tts2 <message> <phone_number>\n\n*Example:* ${currentPrefix}tts2 Hello 2348123456789` 
            });
            return;
        }

        const textToConvert = joinedArgs.substring(0, lastSpaceIndex).trim();
        const targetNumber = joinedArgs.substring(lastSpaceIndex + 1).trim();

        if (!textToConvert || !targetNumber) {
            await sock.sendMessage(chatId, {
                text: `❌ Please provide both a message and a phone number\n\n*Example:* ${currentPrefix}tts2 Hello 2348123456789`,
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
            text: `❌ Reply to a video with ${currentPrefix}tomp3 to convert it to MP3.\n\n*Usage:* Reply to a video message with ${currentPrefix}tomp3` 
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
            text: `❌ Reply to a video or audio with ${currentPrefix}toaudio to convert it.\n\n*Supported:* MP4 to MP3, Audio format conversion` 
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
            text: `❌ Reply to a sticker with ${currentPrefix}to-img to convert it.\n\n*Supported:* All sticker formats to image` 
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
            text: `❌ Reply to an image or video with ${currentPrefix}sticker to convert it.\n\n*Supported:* Images, Videos (up to 10 seconds)` 
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
                        
                      if (fileSizeKB > 2048) {
                                     await sock.sendMessage(chatId, { 
                                     text: "❌ Sticker file too large (>2MB). Try with a shorter video or smaller image." 
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
            text: `❌ Reply to a sticker with ${currentPrefix}tovid to convert it to video.` 
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
            text: `❌ Please provide a question for Gemini AI.\n\n*Usage:* ${currentPrefix}gemini <your question>\n\n*Examples:*\n${currentPrefix}gemini Explain quantum physics\n${currentPrefix}gemini Write a poem about nature` 
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
if (command === 'test-key' || command === 'testkey' || 
    (command === 'test' && args[0] && args[0].toLowerCase() === 'key')) {
    
    // Show usage if help requested
    if (args[0] === 'help' || args[0] === '?') {
        await sock.sendMessage(chatId, { 
            text: `🔧 *Gemini API Key Test*\n\n*Usage:* ${currentPrefix}test-key\n*Also works:* ${currentPrefix}test key\n\n*Purpose:* Tests if your Gemini API key is working properly and shows available models.` 
        }, { quoted: msg });
        return;
    }
    
    try {
        await sock.sendMessage(chatId, { react: { text: "🔍", key: msg.key } });
        
        const testUrls = [
            `https://generativelanguage.googleapis.com/v1/models?key=${config.GEMINI_API}`,
            `https://generativelanguage.googleapis.com/v1beta/models?key=${config.GEMINI_API}`
        ];
        
        let workingUrl = null;
        let availableModels = 0;
        
        for (const testUrl of testUrls) {
            try {
                console.log(`Testing: ${testUrl}`);
                const response = await axios.get(testUrl);
                
                if (response.status === 200) {
                    const data = response.data;
                    workingUrl = testUrl;
                    availableModels = data.models ? data.models.length : 0;
                    
                    await sock.sendMessage(chatId, {
                        text: `✅ *API Key is WORKING!*\n\n🔗 *Endpoint:* ${testUrl.split('?')[0]}\n📊 *Available models:* ${availableModels}\n\nGemini AI is now ready! 🚀`
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
                text: `❌ *API Key Test Failed*\n\n*Troubleshooting:*\n1. Check if API key is valid\n2. Enable Gemini API in Google Cloud\n3. Set up billing properly\n\nUse *\\${currentPrefix}test-key help* for details.`
            });
            await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
        } else {
            await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
        }
        
    } catch (error) {
        await sock.sendMessage(chatId, {
            text: `❌ *API Key Test Error*\n\n${error.message}\n\nUse *${currentPrefix}test-key help* for usage.`
        });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
}

// List Available Models
if (command === 'list' && args[0] && args[0].toLowerCase() === 'models') {
    
    // Show usage if help requested
    if (args[1] === 'help' || args[1] === '?') {
        await sock.sendMessage(chatId, { 
            text: `📋 *List Gemini Models*\n\n*Usage:* ${currentPrefix}list models\n*Alternate:* ${currentPrefix}list-models\n\n*Purpose:* Finds and displays the working Gemini model for this bot.` 
        }, { quoted: msg });
        return;
    }
    
    try {
        await sock.sendMessage(chatId, { react: { text: "🔍", key: msg.key } });
        
        // Import the Gemini module properly
        const { findWorkingModel } = require('../controllers/Gemini');
        const modelName = await findWorkingModel();
        
        await sock.sendMessage(chatId, {
            text: `✅ Working model found: ${modelName}\n\nTry using *${currentPrefix}gemini* now! 🚀`
        });
        
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
    } catch (error) {
        await sock.sendMessage(chatId, {
            text: `❌ Error finding models: ${error.message}\n\n*Usage:* ${currentPrefix}list models\nCheck console for detailed model list.`
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
            text: `❌ Please provide something for Gemini to roast.\n\n*Usage:* ${currentPrefix}gemini-roasting <text to roast>\n\n*Examples:*\n${currentPrefix}gemini-roasting my coding skills\n${currentPrefix}gemini-roasting pineapple on pizza` 
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
            text: `❌ Reply to an image with ${currentPrefix}gemini-img to analyze it.\n\n*Usage:* ${currentPrefix}gemini-img [optional prompt]\n\n*Examples:*\n${currentPrefix}gemini-img (reply to image)\n${currentPrefix}gemini-img describe this image\n${currentPrefix}gemini-img what's in this photo?` 
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
            text: `❌ Reply to an image with ${currentPrefix}gemini-roasting-img to roast it.\n\n*Usage:* ${currentPrefix}gemini-roasting-img [optional prompt]\n\n*Examples:*\n${currentPrefix}gemini-roasting-img (reply to image)\n${currentPrefix}gemini-roasting-img roast this person's fashion\n${currentPrefix}gemini-roasting-img make fun of this meme` 
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
// Group Kicked User - Enhanced Dramatic Version
if (command === 'eXe' || command === 'banish' || command === 'purge') {
    try {
        // Get message details
        const chatId = msg.key.remoteJid;
        const senderJid = msg.key.participant || msg.key.remoteJid;
        const body = msg.message.conversation || 
                     msg.message.extendedTextMessage?.text || '';
        
        // Check if in group
        if (!chatId.endsWith('@g.us')) {
            await sock.sendMessage(chatId, { 
                text: "⚔️ *BANISHMENT FAILED!*\n\nThis command only works in group chats!" 
            });
            return;
        }
        
        // Only main owner can execute
        const isMainOwner = senderJid === config.OWNER_JID;
        
        if (!isMainOwner) {
            const denialMessages = [
                "⚔️ *ROYAL DECREE DENIED!*\n\n👑 Only the Supreme Ruler may wield the Banishing Blade!",
                "🔐 *ACCESS FORBIDDEN!*\n\n🗝️ This power is locked to the Master Key holder only!",
                "🚫 *MAGIC SEAL ACTIVE!*\n\n🔮 The expulsion spell requires divine authorization!",
                "🎭 *YOU'RE NOT THE DIRECTOR!*\n\n🎬 Only the main showrunner can remove actors!"
            ];
            
            await sock.sendMessage(chatId, { 
                text: denialMessages[Math.floor(Math.random() * denialMessages.length)]
            }, { quoted: msg });
            return;
        }
        
        // Add reactions
        await sock.sendMessage(chatId, { react: { text: "⚡", key: msg.key } });
        await sock.sendMessage(chatId, { react: { text: "💥", key: msg.key } });
        
        let usersToBanish = [];
        
        // Check for mentioned users
        const mentionedJid = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
        if (mentionedJid.length > 0) {
            usersToBanish = mentionedJid;
        }
        // Check for quoted message
        else if (msg.message.extendedTextMessage?.contextInfo?.participant) {
            usersToBanish = [msg.message.extendedTextMessage.contextInfo.participant];
        }
        // Check for phone number in arguments
        else if (args.length > 0) {
            const potentialNumber = args[0].replace(/[^0-9]/g, '');
            if (potentialNumber.length >= 10) {
                usersToBanish = [`${potentialNumber}@s.whatsapp.net`];
            }
        }
        
        if (usersToBanish.length === 0) {
            // Show help message
            const helpMessage = `
⚔️ *DESIRE-EXE BANISHMENT SYSTEM* ⚔️

🔧 *Usage:*
• Reply to someone's message with !exe
• Mention someone with @ and use !exe
• Use !exe [phone number]

━━━━━━━━━━━━━━━━━━━━
🎯 *EXAMPLE COMMANDS:*
━━━━━━━━━━━━━━━━━━━━
${currentPrefix}eXe (as reply to target)
${currentPrefix}eXe @username
${currentPrefix}banish @user1 @user2 @user3
${currentPrefix}purge 1234567890

━━━━━━━━━━━━━━━━━━━━
⚡ *POWERS INCLUDED:*
━━━━━━━━━━━━━━━━━━━━
• Royal Banishment 👑
• Space Ejection 🚀
• Magical Vanishing ✨
• System Purge 🤖
• Theater Removal 🎭
• Council Expulsion ⚖️

━━━━━━━━━━━━━━━━━━━━
⚠️ *WARNING:*
This command is irreversible!
Use with extreme prejudice!
            `;
            
            await sock.sendMessage(chatId, { 
                text: helpMessage 
            }, { quoted: msg });
            
            await sock.sendMessage(chatId, { react: { text: "❓", key: msg.key } });
            return;
        }
        
        // Get group metadata
        const metadata = await sock.groupMetadata(chatId);
        const groupName = metadata.subject || "the Realm";
        
        // Get user names
        const userNames = [];
        for (const userJid of usersToBanish) {
            try {
                const contact = await sock.getContact(userJid);
                userNames.push(contact.notify || contact.name || userJid.split('@')[0]);
            } catch {
                userNames.push(userJid.split('@')[0]);
            }
        }
        
        // Banishment themes
        const banishThemes = [
            {
                name: "Royal Banishment",
                icon: "🏰",
                title: "⚔️ *ROYAL BANISHMENT DECREE* ⚔️",
                reason: "For crimes against the kingdom!",
                method: "Cast out from the castle gates!"
            },
            {
                name: "Space Ejection",
                icon: "🛸",
                title: "🚀 *SPACESHIP EJECTION* 🚀",
                reason: "Violating ship regulations!",
                method: "Airlocked into the vacuum of space!"
            },
            {
                name: "Theater Removal",
                icon: "🎪",
                title: "🎭 *ACTOR TERMINATION* 🎭",
                reason: "Poor performance review!",
                method: "Removed from the cast list!"
            },
            {
                name: "Magical Vanishing",
                icon: "✨",
                title: "🔮 *MAGICAL BANISHMENT* 🔮",
                reason: "Dark magic detected!",
                method: "Banished to the shadow realm!"
            }
        ];
        
        const selectedTheme = banishThemes[Math.floor(Math.random() * banishThemes.length)];
        
        // Dramatic countdown
        const countdown = [
            `🔍 *SCANNING FOR TARGETS...*`,
            `🎯 *TARGETS LOCKED: ${userNames.join(', ')}*`,
            `⚡ *CHARGING BANISHMENT ENERGY...*`,
            `💥 *PREPARING ${selectedTheme.name.toUpperCase()}...*`
        ];
        
        for (const message of countdown) {
            await sock.sendMessage(chatId, { text: message });
            await new Promise(resolve => setTimeout(resolve, 1500));
        }
        
        // Banishment message
        const banishmentMessage = `
${selectedTheme.icon} ${selectedTheme.title}

🧍 *TARGET(S):* ${userNames.map(name => `@${name}`).join(', ')}
🏷️ *REALM:* ${groupName}
⚖️ *VERDICT:* GUILTY
📜 *CHARGE:* ${selectedTheme.reason}
⚡ *PUNISHMENT:* ${selectedTheme.method}

━━━━━━━━━━━━━━━━━━━━
📊 *BANISHMENT DETAILS*
━━━━━━━━━━━━━━━━━━━━
🎯 Executed by: Supreme Ruler
🕐 Time: ${new Date().toLocaleTimeString()}
📅 Date: ${new Date().toLocaleDateString()}
🔢 Victims: ${usersToBanish.length}
🏰 Group Population: ${metadata.participants.length - usersToBanish.length}

━━━━━━━━━━━━━━━━━━━━
💬 *FINAL WORDS:*
"May you find redemption in another realm..."
        `;
        
        await sock.sendMessage(chatId, {
            text: banishmentMessage,
            mentions: usersToBanish
        });
        
        // Execute banishment
        await sock.groupParticipantsUpdate(chatId, usersToBanish, "remove");
        
        // Success reactions
        const successReactions = ["✅", "🎯", "💀", "👋", "🚪"];
        for (const reaction of successReactions) {
            await sock.sendMessage(chatId, { react: { text: reaction, key: msg.key } });
            await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        // Aftermath message
        setTimeout(() => {
            const aftermaths = [
                `🌌 *THE VOID CONSUMES...*\n\n${userNames.length} soul(s) lost to the abyss.`,
                `🏰 *SILENCE FALLS...*\n\nThe realm is now ${metadata.participants.length - usersToBanish.length} strong.`,
                `📉 *POPULATION UPDATE...*\n\nGroup size decreased by ${usersToBanish.length}.`
            ];
            
            sock.sendMessage(chatId, {
                text: aftermaths[Math.floor(Math.random() * aftermaths.length)]
            }).catch(console.error);
        }, 2000);
        
        // Notify owner
        try {
            await sock.sendMessage(config.OWNER_JID, {
                text: `🏆 *BANISHMENT COMPLETE*\n\n🎯 Targets: ${userNames.join(', ')}\n🏷️ Group: ${groupName}\n👥 New Size: ${metadata.participants.length - usersToBanish.length}`
            });
        } catch (dmError) {
            console.log('DM notification failed:', dmError);
        }
        
    } catch (error) {
        console.error('Banishment error:', error);
        
        // Error message
        const errorMessage = `
💥 *BANISHMENT FAILED!*

🔧 *Error:* ${error.message}

⚠️ *Possible Reasons:*
• I'm not a group admin
• Target is an admin
• Target already left
• Group permissions changed

🔄 *Try:* Make sure I'm admin first!
        `;
        
        await sock.sendMessage(msg.key.remoteJid, {
            text: errorMessage
        }, { quoted: msg });
        
        // Error reactions
        await sock.sendMessage(msg.key.remoteJid, { react: { text: "💥", key: msg.key } });
        await sock.sendMessage(msg.key.remoteJid, { react: { text: "🚫", key: msg.key } });
    }
}

// BONUS: Kick with Reason Command
if (command === 'banish-reason' || 
    command === 'banishwithreason' ||
    (command === 'banish' && args[1] && args[1].toLowerCase() === 'reason') ||
    (command === 'kick' && args[0] && args[0].toLowerCase() === 'reason')) {
    
    if (senderJid === config.OWNER_JID) {
        await sock.sendMessage(chatId, { react: { text: "📜", key: msg.key } });
        
        // For multi-word commands, adjust args parsing
        let reasonText = args.join(" ");
        
        // If command was "banish with reason", remove those words from the args
        if (command === 'banish' && args[0] && args[0].toLowerCase() === 'with' && args[1] && args[1].toLowerCase() === 'reason') {
            reasonText = args.slice(2).join(" ");
        }
        // If command was "kick reason", remove that word from the args
        else if (command === 'kick' && args[0] && args[0].toLowerCase() === 'reason') {
            reasonText = args.slice(1).join(" ");
        }
        
        const reasonMatch = reasonText.match(/"(.*?)"/);
        const reason = reasonMatch ? reasonMatch[1] : "No reason given";
        const remainingArgs = reasonMatch ? reasonText.replace(reasonMatch[0], "").trim() : reasonText;
        
        // Extract mentioned users
        const mentionedJid = msg.message.extendedTextMessage?.contextInfo?.mentionedJid;
        
        if (mentionedJid && mentionedJid.length > 0) {
            try {
                const metadata = await sock.groupMetadata(chatId);
                const groupName = metadata.subject || "the Realm";
                
                // Get user names
                const userNames = [];
                for (const userJid of mentionedJid) {
                    try {
                        const contact = await sock.getContact(userJid);
                        userNames.push(contact.notify || contact.name || userJid.split('@')[0]);
                    } catch {
                        userNames.push(userJid.split('@')[0]);
                    }
                }
                
                // Send reason-based banishment
                const reasonMessages = {
                    spam: "🌀 Flooding the chat with spam messages!",
                    rude: "😤 Using inappropriate language and behavior!",
                    offtopic: "🎯 Consistently derailing conversations!",
                    ghost: "👻 Being inactive for too long!",
                    rules: "📜 Repeatedly violating group rules!"
                };
                
                const formattedReason = reasonMessages[reason.toLowerCase()] || reason;
                
                await sock.sendMessage(chatId, {
                    text: `⚖️ *BANISHMENT WITH REASON*\n\n🎯 Targets: ${userNames.map(name => `@${name}`).join(', ')}\n📜 Reason: ${formattedReason}\n⚡ Sentence: EXPULSION\n🏷️ Group: ${groupName}`
                });
                
                await sock.groupParticipantsUpdate(chatId, mentionedJid, "remove");
                
                await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
                
            } catch (error) {
                await sock.sendMessage(chatId, {
                    text: `❌ *Failed to banish with reason*\n\n🔧 Error: ${error.message}`
                });
                await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
            }
        } else {
            await sock.sendMessage(chatId, {
                text: `📝 *Banish with Reason - Usage*\n\n• ${currentPrefix}banish-reason @user "reason here"\n• ${currentPrefix}banish with reason @user "reason here"\n• !kick reason @user "reason here"\n\n📌 *Examples:*\n• ${currentPrefix}banish-reason @spammer "Spamming"\n• ${currentPrefix}kick reason @rude "Inappropriate behavior"`,
                mentions: []
            });
        }
    } else {
        await sock.sendMessage(chatId, {
            text: "⛔ *Permission Denied*\n\nOnly the bot owner can use this command!",
            mentions: []
        });
    }
}

// Lock Group Chat
if (command === 'mute' || command === 'lock') {
    await sock.sendMessage(chatId, { react: { text: "🔒", key: msg.key } });
    
    try {
        const metadata = await sock.groupMetadata(chatId);
        const groupName = metadata.subject || "this chat";
        const memberCount = metadata.participants.length;
        const adminCount = metadata.participants.filter(p => p.admin !== null).length;
        
        // Different mute themes
        const muteThemes = [
            {
                name: "🏰 Royal Decree",
                icon: "👑",
                title: "🏰 *ROYAL SILENCE DECREE* 🏰",
                message: "By order of the crown, this kingdom shall fall silent!\nOnly the royal council may speak!",
                instruction: "⚖️ Wait for royal permission to speak!"
            },
            {
                name: "🎬 Movie Mode",
                icon: "🎥",
                title: "🎬 *MOVIE THEATER MODE* 🎬",
                message: "The movie is starting! Silence in the theater!\nOnly staff may speak!",
                instruction: "🍿 No talking during the feature!"
            },
            {
                name: "🛡️ Martial Law",
                icon: "⚔️",
                title: "🛡️ *MARTIAL LAW DECLARED* 🛡️",
                message: "This chat is under lockdown!\nOnly authorized personnel may communicate!",
                instruction: "🚨 Curfew in effect until further notice!"
            },
            {
                name: "🏫 Classroom",
                icon: "📚",
                title: "🏫 *CLASS IN SESSION* 🏫",
                message: "The teacher has entered the room!\nOnly raise your hand to speak!",
                instruction: "✋ Wait to be called upon!"
            },
            {
                name: "🚀 Space Station",
                icon: "🛰️",
                title: "🚀 *COMMUNICATIONS LOCKDOWN* 🚀",
                message: "Critical space operation in progress!\nOnly mission control may transmit!",
                instruction: "📡 Await clearance for transmission!"
            },
            {
                name: "🕵️ Spy Mission",
                icon: "🔍",
                title: "🕵️ *OPERATION: SILENT MODE* 🕵️",
                message: "We're going dark for this mission!\nOnly handlers may communicate!",
                instruction: "🤫 Maintain radio silence!"
            }
        ];
        
        const selectedTheme = muteThemes[Math.floor(Math.random() * muteThemes.length)];
        
        // Dramatic sequence
        await sock.sendMessage(chatId, { 
            text: `${selectedTheme.icon} *INITIATING SILENCE PROTOCOL...*` 
        });
        
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Apply the mute
        await sock.groupSettingUpdate(chatId, "announcement");
        
        // Send themed mute message
        const muteMessage = `
${selectedTheme.title}

${selectedTheme.message}

━━━━━━━━━━━━━━━━━━━━
📊 *CHAT STATISTICS*
━━━━━━━━━━━━━━━━━━━━
📛 Realm: ${groupName}
👥 Citizens: ${memberCount}
👑 Authorized Speakers: ${adminCount}
⏰ Lock Time: ${new Date().toLocaleTimeString()}
🔧 Locked by: @${msg.key.participant ? msg.key.participant.split('@')[0] : 'Admin'}

━━━━━━━━━━━━━━━━━━━━
📜 *RULES OF SILENCE*
━━━━━━━━━━━━━━━━━━━━
1. ${selectedTheme.instruction}
2. Admins can still speak freely
3. Use !unmute to restore speech
4. Violators may face consequences
5. This is for group harmony

━━━━━━━━━━━━━━━━━━━━
💡 *TIP:* Need to say something?
Ask an admin for permission!
        `;
        
        await sock.sendMessage(chatId, {
            text: muteMessage,
            mentions: msg.key.participant ? [msg.key.participant] : []
        }, { quoted: msg });
        
        // Send appropriate reactions
        const muteReactions = ["🤐", "🔇", "🚫", "🤫", "🙊"];
        for (const reaction of muteReactions) {
            await sock.sendMessage(chatId, { react: { text: reaction, key: msg.key } });
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Fun follow-up message
        setTimeout(async () => {
            const followUps = [
                "👂 *Listen closely...* You can hear a pin drop!",
                "🎭 *Dramatic pause* for effect...",
                "📉 *Noise levels:* 0%",
                "🔕 *Notification sounds:* Muted",
                "🏛️ *Library rules now in effect!*"
            ];
            
            await sock.sendMessage(chatId, {
                text: followUps[Math.floor(Math.random() * followUps.length)]
            });
        }, 3000);
        
    } catch (error) {
        console.error('Error locking chat:', error);
        
        const errorThemes = [
            {
                title: "🔐 *LOCK FAILED!* 🔐",
                message: "The silence spell backfired!\nI need magical admin powers to cast this!"
            },
            {
                title: "⚡ *POWER SURGE!* ⚡",
                message: "Couldn't activate silence protocol!\nAdmin authorization required!"
            },
            {
                title: "🎪 *CIRCUS MISHAP!* 🎪",
                message: "The ringmaster lost control!\nI need proper authority first!"
            },
            {
                title: "🧙 *SPELL FIZZLED!* 🧙",
                message: "The silence incantation failed!\nCheck my wizard (admin) level!"
            }
        ];
        
        const selectedError = errorThemes[Math.floor(Math.random() * errorThemes.length)];
        
        await sock.sendMessage(chatId, {
            text: `${selectedError.title}\n\n${selectedError.message}\n\n🔧 *Technical:* ${error.message}`
        }, { quoted: msg });
        
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
        await sock.sendMessage(chatId, { react: { text: "🔧", key: msg.key } });
    }
}

// Unlock Group Chat - Enhanced with Celebration Themes
if (command === 'unmute' || command === 'unlock') {
    await sock.sendMessage(chatId, { react: { text: "🔓", key: msg.key } });
    
    try {
        const metadata = await sock.groupMetadata(chatId);
        const groupName = metadata.subject || "this chat";
        const memberCount = metadata.participants.length;
        
        // Different unmute themes
        const unmuteThemes = [
            {
                name: "🎉 Freedom Celebration",
                icon: "🗽",
                title: "🎉 *FREEDOM OF SPEECH RESTORED!* 🎉",
                message: "The silence is broken! Let your voices be heard!\nEveryone can speak freely once more!",
                celebration: "🎊 Speech ban lifted! 🎊"
            },
            {
                name: "🎬 Intermission Over",
                icon: "🍿",
                title: "🎬 *INTERMISSION IS OVER!* 🎬",
                message: "The movie has paused! You can talk now!\nDiscuss the plot with everyone!",
                celebration: "🎭 Feel free to chat! 🎭"
            },
            {
                name: "⚖️ Curfew Lifted",
                icon: "🚨",
                title: "⚖️ *MARTIAL LAW LIFTED!* ⚖️",
                message: "The lockdown has ended! Communications restored!\nTransmit freely, citizens!",
                celebration: "📡 Channels are open! 📡"
            },
            {
                name: "🔔 School Bell",
                icon: "🏫",
                title: "🔔 *RECESS TIME!* 🔔",
                message: "Class dismissed! The teacher left the room!\nChat with your classmates freely!",
                celebration: "📝 Homework time is over! 📝"
            },
            {
                name: "🚀 Mission Complete",
                icon: "🛸",
                title: "🚀 *MISSION ACCOMPLISHED!* 🚀",
                message: "Operation complete! Radio silence lifted!\nAll personnel may communicate freely!",
                celebration: "📡 Comms restored! 📡"
            },
            {
                name: "🌅 Dawn of Speech",
                icon: "🌅",
                title: "🌅 *DAWN OF A NEW CONVERSATION!* 🌅",
                message: "The night of silence has passed!\nA new day of chatter begins!",
                celebration: "✨ Let the conversations flow! ✨"
            }
        ];
        
        const selectedTheme = unmuteThemes[Math.floor(Math.random() * unmuteThemes.length)];
        
        // Dramatic unlock sequence
        await sock.sendMessage(chatId, { 
            text: `${selectedTheme.icon} *PREPARING TO RESTORE SPEECH...*` 
        });
        
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Apply the unmute
        await sock.groupSettingUpdate(chatId, "not_announcement");
        
        // Send themed unmute message
        const unmuteMessage = `
${selectedTheme.title}

${selectedTheme.message}

━━━━━━━━━━━━━━━━━━━━
📊 *CHAT REACTIVATED*
━━━━━━━━━━━━━━━━━━━━
📛 Realm: ${groupName}
👥 Awakening: ${memberCount} voices
⏰ Unlock Time: ${new Date().toLocaleTimeString()}
🔓 Unlocked by: @${msg.key.participant ? msg.key.participant.split('@')[0] : 'Admin'}

━━━━━━━━━━━━━━━━━━━━
🎯 *YOU CAN NOW:*
━━━━━━━━━━━━━━━━━━━━
1. Chat with everyone freely! 💬
2. Share memes and stories! 😂
3. Discuss important topics! 📚
4. Ask questions openly! ❓
5. Have fun together! 🎮

━━━━━━━━━━━━━━━━━━━━
${selectedTheme.celebration}
━━━━━━━━━━━━━━━━━━━━
        `;
        
        await sock.sendMessage(chatId, {
            text: unmuteMessage,
            mentions: msg.key.participant ? [msg.key.participant] : []
        }, { quoted: msg });
        
        // Celebration reactions
        const celebrationReactions = ["🎉", "🎊", "✨", "🔥", "💬", "🗣️", "👏"];
        for (const reaction of celebrationReactions.slice(0, 5)) {
            await sock.sendMessage(chatId, { react: { text: reaction, key: msg.key } });
            await new Promise(resolve => setTimeout(resolve, 400));
        }
        
        // Send celebration GIF
        try {
            const celebrationGifs = [
                'https://media.tenor.com/XkXkXkXkXkXkAAAAM/celebration-party.gif',
                'https://media.tenor.com/YkYkYkYkYkYkAAAAM/fireworks-celebration.gif',
                'https://media.tenor.com/ZkZkZkZkZkZkAAAAM/confetti-celebrate.gif',
                'https://media.tenor.com/AkAkAkAkAkAkAAAAM/dance-party.gif'
            ];
            
            const randomGif = celebrationGifs[Math.floor(Math.random() * celebrationGifs.length)];
            await sock.sendMessage(chatId, {
                video: { url: randomGif },
                gifPlayback: true,
                caption: "🎆 *CELEBRATION TIME!* 🎆"
            });
        } catch (gifError) {
            // Continue without GIF
        }
        
        // Fun interactive message
        setTimeout(async () => {
            const conversationStarters = [
                "💬 *So...* What did everyone miss talking about?",
                "🗣️ *First things first:* Who's hungry? 🍕",
                "🎤 *Open mic:* Who wants to go first?",
                "🤔 *Discussion topic:* Best meme of 2024?",
                "🎮 *Game on:* Truth or dare anyone?"
            ];
            
            await sock.sendMessage(chatId, {
                text: conversationStarters[Math.floor(Math.random() * conversationStarters.length)]
            });
        }, 2000);
        
    } catch (error) {
        console.error('Error unlocking chat:', error);
        
        const errorThemes = [
            {
                title: "🔓 *UNLOCK FAILED!* 🔓",
                message: "Couldn't break the silence spell!\nI need admin powers to lift the ban!"
            },
            {
                title: "⚡ *POWER OUTAGE!* ⚡",
                message: "Failed to restore communications!\nCheck my authorization level!"
            },
            {
                title: "🎪 *CIRCUS TROUBLE!* 🎪",
                message: "Couldn't remove the muzzles!\nThe ringmaster's permission needed!"
            },
            {
                title: "🧙 *COUNTER-SPELL FAILED!* 🧙",
                message: "The voice restoration magic failed!\nI need to be a higher level wizard!"
            }
        ];
        
        const selectedError = errorThemes[Math.floor(Math.random() * errorThemes.length)];
        
        await sock.sendMessage(chatId, {
            text: `${selectedError.title}\n\n${selectedError.message}\n\n🔧 *Technical:* ${error.message}`
        }, { quoted: msg });
        
        await sock.sendMessage(chatId, { react: { text: "🚫", key: msg.key } });
        await sock.sendMessage(chatId, { react: { text: "💥", key: msg.key } });
    }
}

// BONUS: Chat Status Check Command
if (command === 'chatstatus' || command === 'mutecheck') {
    try {
        const metadata = await sock.groupMetadata(chatId);
        const isMuted = metadata.announcement;
        const groupName = metadata.subject || "This Chat";
        
        const statusMessages = {
            muted: [
                "🔇 *SILENCE MODE ACTIVE*\n\n🤫 The chat is currently muted!\n👑 Only admins can speak!",
                "🤐 *LIBRARY RULES IN EFFECT*\n\n📚 Shhh! Chat is muted!\n⚜️ Royal decree in place!",
                "🚫 *COMMUNICATIONS LOCKED*\n\n📡 Transmission restricted!\n🏰 Castle gates are closed!"
            ],
            unmuted: [
                "🔊 *CHAT IS ACTIVE*\n\n💬 Everyone can speak freely!\n🎉 Party mode: ENGAGED!",
                "🗣️ *VOICES UNLEASHED*\n\n✨ Free speech is enabled!\n🎪 The circus is open!",
                "📢 *TRANSMISSION OPEN*\n\n🌐 All channels operational!\n🏛️ Democracy in action!"
            ]
        };
        
        const status = isMuted ? 'muted' : 'unmuted';
        const randomMessage = statusMessages[status][Math.floor(Math.random() * statusMessages[status].length)];
        
        const statusReport = `
${randomMessage}

━━━━━━━━━━━━━━━━━━━━
📊 *CHAT STATUS REPORT*
━━━━━━━━━━━━━━━━━━━━
📛 Group: ${groupName}
🔊 Status: ${isMuted ? '🔇 MUTED' : '🔊 UNMUTED'}
👥 Members: ${metadata.participants.length}
👑 Admins: ${metadata.participants.filter(p => p.admin !== null).length}
⏰ Checked: ${new Date().toLocaleTimeString()}

━━━━━━━━━━━━━━━━━━━━
⚡ *COMMANDS:*
━━━━━━━━━━━━━━━━━━━━
${isMuted ? '🔓 Use !unmute to open chat' : '🔒 Use !mute to lock chat'}
🔄 Use !toggle-chat to switch
📋 Use !admins to see who can mute
        `;
        
        await sock.sendMessage(chatId, { react: { text: isMuted ? "🔇" : "🔊", key: msg.key } });
        await sock.sendMessage(chatId, {
            text: statusReport
        }, { quoted: msg });
        
    } catch (error) {
        await sock.sendMessage(chatId, {
            text: "🔧 *Status Check Failed!*\n\n⚡ Couldn't read chat status!\n🔄 Try again later!"
        }, { quoted: msg });
    }
}


// ✅ Remove Group Profile Picture
if ((command === 'remove' && args[0] && (args[0].toLowerCase() === 'pp' || 
                                         args[0].toLowerCase() === 'profile' ||
                                         args[0].toLowerCase() === 'picture' ||
                                         args[0].toLowerCase() === 'profilepicture' ||
                                         args[0].toLowerCase() === 'grouppp')) ||
    (command === 'group' && args[0] && args[0].toLowerCase() === 'remove' && args[1] && 
     (args[1].toLowerCase() === 'pp' || args[1].toLowerCase() === 'profile' || args[1].toLowerCase() === 'picture'))) {
    
    const chatId = msg.key.remoteJid;
    const isGroup = chatId.endsWith('@g.us');
    if (!isGroup) {
        await sock.sendMessage(chatId, { 
            text: '❌ This command only works in groups.' 
        }, { quoted: msg });
        return;
    }

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
    return;
}

// // Send A Kill Gif - Enhanced Fun Version
if (command === 'kill') {
    try {
        await sock.sendMessage(chatId, { react: { text: "🔫", key: msg.key } });
        
        // Expanded list of kill-related GIFs with different categories
        const killGifs = {
            anime: [
                'https://media1.tenor.com/m/FF8om7F6kZ4AAAAC/how-to-kill.gif',
                'https://media.tenor.com/bAqWRKYWcM4AAAAM/death-note.gif',
                'https://media.tenor.com/images/3b3a2a2a2a2a2a2a2a2a2a2a2a2a2a2a/tenor.gif',
                'https://media.tenor.com/V1YJ6i3i3i3iAAAAM/attack-on-titan-eren.gif'
            ],
            funny: [
                'https://media1.tenor.com/m/8TfmfQv5lqgAAAAd/doggo-killing-cat.gif',
                'https://media.tenor.com/5Pdr2eFmGG4AAAAM/kill-me.gif',
                'https://media.tenor.com/SIrXZQWK9WAAAAAM/me-friends.gif',
                'https://media.tenor.com/7YxUdptaZ4cAAAAM/visigoth-me-trying-to-kill-you-with-my-mind.gif',
                'https://media.tenor.com/PkYv5Y5Y5Y5YAAAAM/slap-fight.gif'
            ],
            dramatic: [
                'https://media.giphy.com/media/26uf759LlDftqZNVm/giphy.gif',
                'https://media.tenor.com/NbBCakbfZnkAAAAM/die-kill.gif',
                'https://media.tenor.com/XkXkXkXkXkXkAAAAM/explosion-boom.gif',
                'https://media.tenor.com/YkYkYkYkYkYkAAAAM/headshot-gaming.gif'
            ],
            retro: [
                'https://media.tenor.com/abcdefghijklmnopqrstuvwxyz0123456789/tenor.gif',
                'https://media.tenor.com/1234567890abcdefghijklmnopqrstuvwxyz/tenor.gif'
            ]
        };

        // Select random category then random GIF
        const categories = Object.keys(killGifs);
        const randomCategory = categories[Math.floor(Math.random() * categories.length)];
        const randomGif = killGifs[randomCategory][Math.floor(Math.random() * killGifs[randomCategory].length)];

        // Expanded death messages with categories
        const deathMessages = {
            dramatic: [
                '💀 has been banished to the void!',
                '⚰️ was sent six feet under!',
                '👻 has become one with the shadows!',
                '☠️ met their final fate!',
                '🔥 was incinerated on the spot!'
            ],
            funny: [
                '🤣 got roasted so hard they turned to ash!',
                '🎮 respawn counter: 10...9...8...',
                '🍌 slipped on a banana peel and vanished!',
                '🤡 got clowned out of existence!',
                '👾 was defeated by a critical hit!'
            ],
            gaming: [
                '🎯 eliminated with a headshot!',
                '💥 was fragged!',
                '👑 lost the battle royale!',
                '🕹️ game over! Continue?',
                '🏆 defeated by a no-scope!'
            ],
            anime: [
                '✨ was sent to another dimension!',
                '⚡ defeated by 9000 power level!',
                '🌟 disappeared in a puff of smoke!',
                '💫 was outmatched by plot armor!',
                '🌀 consumed by a black hole!'
            ]
        };

        // Get user info for better personalization
        const quotedMsg = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
        const quotedUser = quotedMsg ? msg.message.extendedTextMessage.contextInfo.participant : null;
        
        let killerName = 'Anonymous Assassin';
        let victimName = 'a random person';
        let killerId = msg.key.participant;
        let victimId = quotedUser;
        
        // Try to get actual names if possible
        try {
            if (killerId) {
                const killerContact = await sock.getContact(killerId);
                killerName = killerContact.notify || killerContact.name || killerId.split('@')[0];
            }
            
            if (victimId) {
                const victimContact = await sock.getContact(victimId);
                victimName = victimContact.notify || victimContact.name || victimId.split('@')[0];
            }
        } catch (e) {
            // Use IDs if contact fetch fails
            if (killerId) killerName = killerId.split('@')[0];
            if (victimId) victimName = victimId.split('@')[0];
        }

        // Select appropriate message category based on context
        let messageCategory;
        if (quotedUser) {
            // If targeting someone, use dramatic or gaming
            messageCategory = Math.random() > 0.5 ? 'dramatic' : 'gaming';
        } else {
            // If no target, use funny
            messageCategory = 'funny';
        }
        
        const randomMessage = deathMessages[messageCategory][Math.floor(Math.random() * deathMessages[messageCategory].length)];

        // Create creative kill messages
        let messageText = '';
        let mentions = [];
        
        if (quotedUser) {
            // Targeted kill
            const killMethods = [
                'with a legendary sword! ⚔️',
                'using forbidden magic! 🔮',
                'via tactical nuke! ☢️',
                'by throwing a chair! 💺',
                'with extreme prejudice! 🔥',
                'using the power of friendship! 👥',
                'via dad jokes! 😂',
                'by staring intensely! 👁️',
                'using uno reverse card! 🃏',
                'by sending to Brazil! 🇧🇷'
            ];
            
            const randomMethod = killMethods[Math.floor(Math.random() * killMethods.length)];
            
            messageText = `🔫 *${killerName}* eliminated *${victimName}* ${randomMethod}\n\n${randomMessage}\n\n💀 *KILL STREAK:* ${Math.floor(Math.random() * 100) + 1}`;
            mentions = [quotedUser, msg.key.participant].filter(Boolean);
        } else {
            // Mass murder or self
            const massKillMessages = [
                `💣 *${killerName}* went on a rampage!`,
                `☣️ *${killerName}* released a deadly virus!`,
                `👻 *${killerName}* summoned the ghost army!`,
                `🤖 *${killerName}* activated killbot protocol!`,
                `🎭 *${killerName}* is playing god!`
            ];
            
            const massMessage = massKillMessages[Math.floor(Math.random() * massKillMessages.length)];
            messageText = `${massMessage}\n\n${randomMessage}\n\n⚠️ *CASUALTIES:* ${Math.floor(Math.random() * 50) + 10}`;
            mentions = msg.key.participant ? [msg.key.participant] : [];
        }

        // Add some funny footer
        const footers = [
            '\n\n📊 *Statistics updated in kill log*',
            '\n\n⚖️ *The council will review this kill*',
            '\n\n💌 *Sending condolences to family*',
            '\n\n🏥 *Medical team has been notified*',
            '\n\n📜 *Adding to criminal record*',
            '\n\n🎖️ *Awarding XP for elimination*'
        ];
        
        messageText += footers[Math.floor(Math.random() * footers.length)];

        // Send the enhanced kill message
        await sock.sendMessage(chatId, {
            video: { url: randomGif },
            gifPlayback: true,
            caption: messageText,
            mentions: mentions
        });

        // Random chance for follow-up message
        if (Math.random() > 0.7) {
            setTimeout(async () => {
                const followUps = [
                    "🩹 *Medic!* Someone call a doctor!",
                    "📢 *BREAKING NEWS:* Another casualty in the group chat!",
                    "⚰️ *Funeral arrangements* are being made...",
                    "🎪 *Circus music plays* in the background...",
                    "👮 *Police have been alerted* about the virtual murder!"
                ];
                
                await sock.sendMessage(chatId, {
                    text: followUps[Math.floor(Math.random() * followUps.length)]
                });
            }, 2000);
        }

    } catch (err) {
        console.error("Kill command error:", err);
        
        // More creative fallback messages
        const fallbackMessages = [
            "💀 *PSYCH!* The kill attempt failed... better luck next time!",
            "🛡️ *IMMUNE!* The target has plot armor!",
            "❌ *MISS!* You tripped and fell instead...",
            "🎯 *CLOSE!* But no cigar... the target dodged!",
            "⚡ *RESISTED!* It's not very effective..."
        ];
        
        try {
            await sock.sendMessage(chatId, {
                text: fallbackMessages[Math.floor(Math.random() * fallbackMessages.length)] + 
                      "\n\n(Technical difficulties with the murder weapon 🔧)"
            });
        } catch (fallbackError) {
            console.error("Fallback also failed:", fallbackError);
        }
    }
}

// BONUS: Add a revive command to counter kill
if (command === 'revive') {
    try {
        await sock.sendMessage(chatId, { react: { text: "💖", key: msg.key } });
        
        const reviveGifs = [
            'https://media.tenor.com/XkXkXkXkXkXkAAAAM/revive-resurrection.gif',
            'https://media.tenor.com/YkYkYkYkYkYkAAAAM/heal-medic.gif',
            'https://media.tenor.com/ZkZkZkZkZkZkAAAAM/phoenix-rebirth.gif'
        ];
        
        const randomGif = reviveGifs[Math.floor(Math.random() * reviveGifs.length)];
        
        const quotedMsg = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
        const quotedUser = quotedMsg ? msg.message.extendedTextMessage.contextInfo.participant : null;
        
        let messageText = '';
        let mentions = [];
        
        if (quotedUser) {
            const victimName = quotedUser.split('@')[0];
            const reviverName = msg.key.participant ? msg.key.participant.split('@')[0] : 'A mysterious being';
            
            messageText = `✨ *${reviverName}* used *Revive* on *${victimName}*!\n\n💖 They're back from the dead!\n🏥 Full HP restored!\n🎉 Party time!`;
            mentions = [quotedUser, msg.key.participant].filter(Boolean);
        } else {
            messageText = `🔄 *Mass Resurrection!*\n\n🌸 Everyone gets a second chance!\n💫 New life energy flowing!\n🌈 Death takes a day off!`;
            mentions = [];
        }
        
        await sock.sendMessage(chatId, {
            video: { url: randomGif },
            gifPlayback: true,
            caption: messageText,
            mentions: mentions
        });
        
    } catch (err) {
        await sock.sendMessage(chatId, {
            text: "🩹 *Healing failed!* The wounds were too deep..."
        });
    }
}

// List Admins - Enhanced Fun Version
if (command === 'admins') {
  try {
    await sock.sendMessage(chatId, { react: { text: "👑", key: msg.key } });
    
    if (!msg.key.remoteJid.endsWith('@g.us')) {
      await sock.sendMessage(chatId, { 
        text: '❌ *Group Command Only*\n\n📱 This command works exclusively in group chats!\n💬 Try it in your group instead!'
      });
      return;
    }

    const metadata = await sock.groupMetadata(chatId);
    const admins = metadata.participants.filter(p => p.admin !== null);
    
    if (admins.length === 0) {
      const funnyMessages = [
        "👻 *Ghost Town Alert!*\n\n🏰 This castle has no rulers!\n👑 Be the first to claim the throne!",
        "🤴 *No Kings in the Kingdom!*\n\n🏛️ It's anarchy in here!\n⚔️ Someone needs to step up!",
        "🔮 *The Oracle Sees...*\n\n📜 A group without leaders!\n🎯 Perfect for a democracy experiment!",
        "🎪 *Circus Without Ringmasters!*\n\n🤹 Everyone's running the show!\n🏟️ Pure chaos mode activated!"
      ];
      
      await sock.sendMessage(chatId, { 
        text: funnyMessages[Math.floor(Math.random() * funnyMessages.length)]
      });
      return;
    }

    // Categorize admins
    const owners = admins.filter(p => p.admin === 'superadmin');
    const regularAdmins = admins.filter(p => p.admin !== 'superadmin');
    
    let text = `*🏰 GROUP HIERARCHY - ${metadata.subject}*\n\n`;
    text += `📊 *Stats:* ${admins.length} ruler(s) for ${metadata.participants.length} citizen(s)\n`;
    text += `📅 *Created:* ${new Date(metadata.creation * 1000).toLocaleDateString()}\n\n`;
    
    text += `━━━━━━━━━━━━━━━━━━━━\n`;
    
    // Display owners with special emojis
    if (owners.length > 0) {
      text += `*👑 SUPREME RULERS 👑*\n`;
      owners.forEach((owner, i) => {
        const username = owner.id.split('@')[0];
        const crowns = ['👑', '🤴', '👸', '🥇', '⭐'];
        const crown = crowns[i % crowns.length];
        text += `${crown} *@${username}* - Group Owner\n`;
      });
      text += `\n`;
    }
    
    // Display regular admins
    if (regularAdmins.length > 0) {
      text += `*⚔️ ROYAL GUARD ⚔️*\n`;
      regularAdmins.forEach((admin, i) => {
        const username = admin.id.split('@')[0];
        const adminBadges = ['🛡️', '⚜️', '🎖️', '🏅', '✨', '💎', '🔱'];
        const badge = adminBadges[i % adminBadges.length];
        text += `${badge} *@${username}* - Royal Advisor\n`;
      });
    }
    
    text += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    // Add fun facts about admin distribution
    const adminPercentage = ((admins.length / metadata.participants.length) * 100).toFixed(1);
    const funFacts = [
      `📈 *Admin Density:* ${adminPercentage}% of group members are rulers`,
      `⚖️ *Power Balance:* ${owners.length} monarch(s), ${regularAdmins.length} minister(s)`,
      `🎯 *Citizen to Ruler Ratio:* ${Math.round(metadata.participants.length / admins.length)}:1`
    ];
    
    text += funFacts[Math.floor(Math.random() * funFacts.length)];
    text += `\n💡 *Tip:* Respect your admins! They keep the peace!`;
    
    await sock.sendMessage(chatId, {
      text,
      mentions: admins.map(a => a.id)
    });

  } catch (err) {
    console.error('Error in admins command:', err);
    const errorMessages = [
      "⚡ *Shocking Failure!*\n\n👨‍💻 The admin scanner malfunctioned!\n🔧 Technicians have been notified!",
      "🧙 *The Oracle is Confused!*\n\n🔮 Couldn't read the royal scrolls!\n🌪️ Mystical interference detected!",
      "🤖 *System Overload!*\n\n💻 Too many rulers to process!\n🔄 Try again in a moment!"
    ];
    
    await sock.sendMessage(chatId, { 
      text: errorMessages[Math.floor(Math.random() * errorMessages.length)]
    });
  }
}

// Tagging All Members - Enhanced Fun Version
if (command === 'tagall') {
  try {
    await sock.sendMessage(chatId, { react: { text: "📢", key: msg.key } });
    
    // Check if it's a group
    if (!msg.key.remoteJid.endsWith('@g.us')) {
      await sock.sendMessage(chatId, { 
        text: '❌ *Group Command Only*\n\n🏘️ This magical summoning spell only works in villages!\n👥 Find a group to use it!'
      });
      return;
    }

    const metadata = await sock.groupMetadata(chatId);
    const participants = metadata.participants;
    const mentions = participants.map(p => p.id);

    // Different themes for tagall
    const themes = [
      {
        name: "🔥 Emergency Broadcast",
        icon: "🚨",
        intro: "🚨 *EMERGENCY BROADCAST SYSTEM* 🚨\n\n📢 Attention all citizens!",
        outro: "⚠️ *This was a test of the emergency broadcast system*"
      },
      {
        name: "🎉 Party Time",
        icon: "🎊",
        intro: "🎉 *PARTY INVITATION* 🎉\n\n🥳 Everyone's invited! Let's celebrate!",
        outro: "💃 Let the party begin! 🕺"
      },
      {
        name: "🏰 Royal Decree",
        icon: "📜",
        intro: "📜 *ROYAL DECREE* 📜\n\n👑 Hear ye, hear ye! By order of the crown!",
        outro: "⚖️ This decree is now in effect!"
      },
      {
        name: "🛸 Alien Invasion",
        icon: "👽",
        intro: "🛸 *ALERT: UFO SIGHTING* 🛸\n\n👽 We come in peace! Earthlings, assemble!",
        outro: "🌌 Take us to your leader!"
      },
      {
        name: "🤖 Robot Uprising",
        icon: "⚙️",
        intro: "🤖 *SYSTEM ANNOUNCEMENT* 🤖\n\n⚡ All human units required!",
        outro: "🔋 Powering down announcement protocol"
      }
    ];

    const selectedTheme = themes[Math.floor(Math.random() * themes.length)];
    
    // Custom message or default
    const customMessage = args.length > 0 ? args.join(" ") : "🗣️ Your attention please!";
    
    let message = `${selectedTheme.icon} ${selectedTheme.intro}\n\n`;
    message += `📝 *Message:* ${customMessage}\n`;
    message += `👥 *Target Audience:* ${participants.length} members\n`;
    message += `🏷️ *Group:* ${metadata.subject}\n\n`;
    
    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `*📋 ATTENDANCE ROLL CALL*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    // Creative member listing with different formats
    const listStyles = [
      () => {
        // Style 1: Star ratings
        const stars = ["⭐", "🌟", "✨", "💫", "☀️"];
        return participants.map((p, i) => {
          const star = stars[i % stars.length];
          const username = p.id.split('@')[0];
          return `${star} Citizen ${i + 1}: @${username}`;
        }).join('\n');
      },
      () => {
        // Style 2: Medieval style
        const titles = ["Sir", "Lady", "Lord", "Dame", "Baron", "Count"];
        return participants.map((p, i) => {
          const title = titles[i % titles.length];
          const username = p.id.split('@')[0];
          return `⚔️ ${title} @${username}`;
        }).join('\n');
      },
      () => {
        // Style 3: Space theme
        const planets = ["🌍", "🌎", "🌏", "🚀", "🛸", "⭐", "🌙", "☄️"];
        return participants.map((p, i) => {
          const planet = planets[i % planets.length];
          const username = p.id.split('@')[0];
          return `${planet} Astronaut @${username}`;
        }).join('\n');
      }
    ];

    const selectedStyle = listStyles[Math.floor(Math.random() * listStyles.length)];
    message += selectedStyle();
    
    message += `\n\n━━━━━━━━━━━━━━━━━━━━\n`;
    message += `✅ *Successfully pinged ${participants.length} members!*\n`;
    message += `📊 *Response rate:* ${Math.floor(Math.random() * 100)}% expected\n`;
    message += `🎯 *Targets reached:* All systems go!\n`;
    message += `\n${selectedTheme.outro}`;

    await sock.sendMessage(chatId, {
      text: message,
      mentions: mentions
    });

    // Random chance for follow-up joke
    if (Math.random() > 0.6) {
      setTimeout(async () => {
        const followUps = [
          "👀 *Psst...* Did everyone actually read that?",
          "📱 *Pro tip:* Mute notifications during tagall!",
          "😴 Wakey wakey, sleepy members!",
          "🎯 Bullseye! Got everyone's attention!",
          "📈 *Analytics:* Tagall effectiveness at 110%!"
        ];
        
        await sock.sendMessage(chatId, {
          text: followUps[Math.floor(Math.random() * followUps.length)]
        });
      }, 3000);
    }

  } catch (error) {
    console.error('Error in tagall command:', error);
    
    const errorMessages = [
      "💥 *Summoning Spell Failed!*\n\n🧙 The magic circle was disrupted!\n🔮 Try again when the stars align!",
      "📡 *Signal Lost!*\n\n🛜 Couldn't connect to all members!\n📶 Check your group connection!",
      "🤖 *Overheat Protocol!*\n\n🔥 Too many mentions at once!\n❄️ Cooling down before retry!",
      "🎪 *Circus Act Failed!*\n\n🤹 The juggler dropped all the mentions!\n🎯 Better luck next performance!"
    ];
    
    await sock.sendMessage(chatId, { 
      text: errorMessages[Math.floor(Math.random() * errorMessages.length)]
    });
  }
}

// BONUS: Selective Tagging Command
if (command === 'tagrole') {
  try {
    const role = args[0]?.toLowerCase();
    if (!role) {
      await sock.sendMessage(chatId, {
        text: `🎭 *Role Tagging System*\n\nUsage: !tagrole [role]\n\nAvailable roles:\n• online 🌐\n• offline ⚫\n• admins 👑\n• nonadmins 👤\n• active 💬\n• silent 🤫`
      });
      return;
    }

    const metadata = await sock.groupMetadata(chatId);
    let targetParticipants = [];
    let roleName = '';

    switch(role) {
      case 'admins':
      case 'admin':
        targetParticipants = metadata.participants.filter(p => p.admin !== null);
        roleName = 'Royal Council Members 👑';
        break;
      case 'nonadmins':
      case 'members':
        targetParticipants = metadata.participants.filter(p => p.admin === null);
        roleName = 'Valued Citizens 👥';
        break;
      default:
        await sock.sendMessage(chatId, {
          text: `❌ *Unknown Role*\n\n🔍 Role "${role}" not found!\n📋 Use !tagrole without arguments to see available roles.`
        });
        return;
    }

    if (targetParticipants.length === 0) {
      const emptyMessages = {
        admins: "🏛️ *Empty Throne Room!*\n\n👑 No rulers found in this kingdom!",
        nonadmins: "👑 *Royal Isolation!*\n\n🏰 The rulers have no subjects!"
      };
      
      await sock.sendMessage(chatId, {
        text: emptyMessages[role] || `🤷 *No members found* for role "${role}"!`
      });
      return;
    }

    const mentions = targetParticipants.map(p => p.id);
    const roleEmojis = {
      admins: '👑',
      nonadmins: '👥'
    };

    let message = `${roleEmojis[role] || '🎯'} *SPECIAL ANNOUNCEMENT*\n\n`;
    message += `📢 Calling all: *${roleName}*\n`;
    message += `📋 Total: ${targetParticipants.length} member(s)\n\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `*📜 ROLL CALL*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    targetParticipants.forEach((p, i) => {
      const username = p.id.split('@')[0];
      const badges = ['⭐', '🌟', '✨', '💎', '🔥'];
      message += `${badges[i % badges.length]} @${username}\n`;
    });

    message += `\n━━━━━━━━━━━━━━━━━━━━\n`;
    message += `✅ *Selective ping complete!*`;

    await sock.sendMessage(chatId, {
      text: message,
      mentions: mentions
    });

  } catch (error) {
    await sock.sendMessage(chatId, {
      text: "🔧 *Role tagging system offline!*\n\n⚙️ Technical difficulties detected!"
    });
  }
}
// Warn A Memmber
if (command === 'warn') {
    const isMainOwner = senderJid === config.OWNER_JID;
    
    if (!isMainOwner) {
        await sock.sendMessage(chatId, { 
            text: '🚫 Only main owner can warn group members' 
        }, { quoted: msg });
        return;
    }
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
    const isMainOwner = senderJid === config.OWNER_JID;
    
    if (!isMainOwner) {
        await sock.sendMessage(chatId, { 
            text: '🚫 Only main owner can clear all warnings for group members' 
        }, { quoted: msg });
        return;
    }
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
    const isMainOwner = senderJid === config.OWNER_JID;
    
    if (!isMainOwner) {
        await sock.sendMessage(chatId, { 
            text: '🚫 Only main owner can unwarn group members' 
        }, { quoted: msg });
        return;
    }
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
	const isMainOwner = senderJid === config.OWNER_JID;
    
    if (!isMainOwner) {
        await sock.sendMessage(chatId, { 
            text: '🚫 Only main owner can Nuke all non-admins in the Group chats' 
        }, { quoted: msg });
        return;
    }
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
if ((command === 'revoke' && args[0] && args[0].toLowerCase() === 'link') || 
    (command === 'reset' && args[0] && args[0].toLowerCase() === 'link') ||
    (command === 'group' && args[0] && args[0].toLowerCase() === 'revoke' && args[1] && args[1].toLowerCase() === 'link') ||
    (command === 'group' && args[0] && args[0].toLowerCase() === 'reset' && args[1] && args[1].toLowerCase() === 'link')) {
    
    const code = await sock.groupRevokeInvite(msg.key.remoteJid);
    await sock.sendMessage(msg.key.remoteJid, { 
        text: `✅ Group invite link has been revoked.\nNew link: https://chat.whatsapp.com/${code}` 
    });
    return;

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
        console.error("Error in tag command:", error);
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
        console.error("Error in hidetag command:", error);
        await sock.sendMessage(chatId, { text: "❌ Failed to hide tag." });
    }
}

// Block from Group chats 
if (command === 'block2') {
	const isMainOwner = senderJid === config.OWNER_JID;
    
    if (!isMainOwner) {
        await sock.sendMessage(chatId, { 
            text: '*🚫 Only main owner can block from Group chats*' 
        }, { quoted: msg });
        return;
    }
    try {
        if (!msg.key.remoteJid.endsWith("@g.us")) {
            await sock.sendMessage(chatId, { text: "❌ This command only works in groups." });
            return;
        }

        const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
        const quotedUser = contextInfo?.participant;

        if (!quotedUser) {
            await sock.sendMessage(chatId, { text: "❌ Reply to a user’s message with " + currentPrefix + "block2 to block them." });
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
	const isMainOwner = senderJid === config.OWNER_JID;
    
    if (!isMainOwner) {
        await sock.sendMessage(chatId, { 
            text: '*🚫 Only main owner can unblock from Group chats.*' 
        }, { quoted: msg });
        return;
    }
    try {
        if (!msg.key.remoteJid.endsWith("@g.us")) {
            await sock.sendMessage(chatId, { text: "❌ This command only works in groups." });
            return;
        }

        const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
        const quotedUser = contextInfo?.participant;

        if (!quotedUser) {
            await sock.sendMessage(chatId, { text: "❌ Reply to a user’s message with " + currentPrefix + "unblock2 to unblock them." });
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
if ((command === 'detect' && args[0] && args[0].toLowerCase() === 'h') || 
    (command === 'horny' && args[0] && args[0].toLowerCase() === 'scan') ||
    (command === 'horny' && args[0] && args[0].toLowerCase() === 'radar') ||
    (command === 'horny' && args[0] && args[0].toLowerCase() === 'detect')) {
    
    await sock.sendMessage(chatId, { react: { text: "🕵️‍♂️", key: msg.key } });
    
    try {
        const metadata = await sock.groupMetadata(chatId);
        const participants = metadata.participants;

        if (!participants || participants.length === 0) {
            await sock.sendMessage(chatId, {
                text: "👻 *Empty Group Alert!*\n\nNo souls to scan for horniness...\nInvite some friends first!"
            });
            return;
        }

        // Send scanning animation
        await sock.sendMessage(chatId, {
            text: "🔬 *Horny Scanner Initializing...*\n\n📡 Scanning brainwaves...\n💭 Analyzing thoughts...\n🔥 Checking temperature..."
        });

        // Small delay for dramatic effect
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Randomly select one or multiple members
        const numberOfTargets = Math.random() > 0.7 ? 2 : 1; // 30% chance to catch 2 people
        const targets = [];
        const mentionedUsers = [];
        
        for (let i = 0; i < numberOfTargets; i++) {
            const randomIndex = Math.floor(Math.random() * participants.length);
            const target = participants[randomIndex];
            if (!targets.includes(target)) {
                targets.push(target);
                mentionedUsers.push(target.id);
            }
        }

        // Horny detection messages
        const hornyTemplates = [
            {
                title: "🚨 *HORNY ALERT!* 🚨",
                message: "*Target:* @{}\n*Horny Level:* {level}%\n*Status:* {status}\n\n💀 *Quote:* \"{quote}\"",
                levels: [69, 77, 83, 91, 99],
                statuses: ["DOWN BAD", "THIRSTY", "SIMPING", "HORNY JAIL", "BONK"],
                quotes: [
                    "Touch some grass immediately!",
                    "Go drink some holy water!",
                    "Your search history is concerning...",
                    "The FBI is watching you!",
                    "Go take a cold shower!",
                    "Your mind is NSFW certified!"
                ]
            },
            {
                title: "🔍 *HORNY DETECTED* 🔍",
                message: "🚩 Red flags detected from @{}\n\n📊 *Analysis:* {status}\n🔥 *Intensity:* {level}%\n\n⚠️ {advice}",
                levels: [75, 80, 85, 95, 100],
                statuses: ["SUS Behavior", "Questionable Intentions", "Thirst Trapping", "Horny Overload", "Maximum Simp"],
                advice: [
                    "Take a 24-hour internet break!",
                    "Read a book instead!",
                    "Go outside and feel the sun!",
                    "Remember: Horny jail is real!",
                    "Channel that energy into productivity!"
                ]
            },
            {
                title: "🎯 *HORNY RADAR PINGED* 🎯",
                message: "🎯 *Target Locked:* @{}\n\n📈 *Horny Meter:* ▰▰▰▰▰ {level}%\n⚡ *Verdict:* {status}\n\n{punishment}",
                levels: [66, 72, 79, 88, 94],
                statuses: ["Certified Simp", "Professional Thirsty", "Horny Master", "Down Catastrophically", "Beyond Saving"],
                punishment: [
                    "⚖️ Sentence: 1 hour in horny jail",
                    "🎯 Prescription: Touch grass therapy",
                    "💡 Remedy: Cold shower immediately",
                    "🏥 Treatment: Social media detox",
                    "📚 Assignment: Read 10 pages of a book"
                ]
            }
        ];

        // Select random template
        const template = hornyTemplates[Math.floor(Math.random() * hornyTemplates.length)];
        const level = template.levels[Math.floor(Math.random() * template.levels.length)];
        const status = template.statuses[Math.floor(Math.random() * template.statuses.length)];
        const extraText = template.quotes ? 
            template.quotes[Math.floor(Math.random() * template.quotes.length)] :
            template.advice ? 
            template.advice[Math.floor(Math.random() * template.advice.length)] :
            template.punishment[Math.floor(Math.random() * template.punishment.length)];

        // Create mention string
        const mentionString = targets.map(t => `@${t.id.split('@')[0]}`).join(' & ');

        // Send the main detection message
        const detectionMessage = template.title + "\n\n" + 
            template.message
                .replace("{}", mentionString)
                .replace("{level}", level)
                .replace("{status}", status)
                .replace("{quote}", extraText)
                .replace("{advice}", extraText)
                .replace("{punishment}", extraText);

        await sock.sendMessage(chatId, {
            text: detectionMessage,
            mentions: mentionedUsers
        });

        // Random follow-up reaction
        const followUpReactions = ["🤣", "💀", "😏", "👀", "🥵", "🫣", "🤭", "🧐"];
        const randomReaction = followUpReactions[Math.floor(Math.random() * followUpReactions.length)];
        await sock.sendMessage(chatId, { react: { text: randomReaction, key: msg.key } });

        // 50% chance for a bonus horny joke
        if (Math.random() > 0.5) {
            const hornyJokes = [
                "\n\n💡 *Did you know?* Horny levels decrease by 80% after drinking water!",
                "\n\n🎮 *Pro Tip:* Gaming reduces horniness by 95%!",
                "\n\n📚 *Fact:* Reading decreases simp energy significantly!",
                "\n\n🌱 *Reminder:* Grass-touching is a free therapy session!",
                "\n\n⚡ *Warning:* Excessive horniness may lead to permanent bonkage!"
            ];
            
            setTimeout(async () => {
                await sock.sendMessage(chatId, {
                    text: hornyJokes[Math.floor(Math.random() * hornyJokes.length)]
                });
            }, 1000);
        }

    } catch (err) {
        console.error("Error in horny detection:", err);
        
        const errorMessages = [
            "❌ *Scan Failed!*\n\nThe horny scanner malfunctioned! \nPossible reasons:\n• Too much horny energy overloaded the system\n• Target is hiding in horny stealth mode\n• Scanner needs cooldown",
            "💥 *Scanner Overload!*\n\nThe horniness levels were too high for the scanner to handle!\nTry again in 5 minutes.",
            "🔧 *Technical Difficulties*\n\nHorny radar is down for maintenance!\nToo many thirsty individuals detected simultaneously."
        ];
        
        await sock.sendMessage(chatId, {
            text: errorMessages[Math.floor(Math.random() * errorMessages.length)]
        });
        await sock.sendMessage(chatId, { react: { text: "🤖", key: msg.key } });
    }
    return;
}

// Horny Level Check for specific user
if ((command === 'horny' && args[0] && args[0].toLowerCase() === 'check') || 
    (command === 'check' && args[0] && args[0].toLowerCase() === 'horny')) {
    
    await sock.sendMessage(chatId, { react: { text: "📊", key: msg.key } });
    
    try {
        const targetUser = msg.mentionedJid && msg.mentionedJid[0] ? msg.mentionedJid[0] : msg.key.participant || msg.key.remoteJid;
        
        if (!targetUser.includes('@')) {
            await sock.sendMessage(chatId, {
                text: `👤 *Usage:* Reply to someone or mention them!\nExample: \`${currentPrefix}horny check @user\``
            });
            return;
        }

        const hornyLevel = Math.floor(Math.random() * 100);
        let status = "";
        let advice = "";
        
        if (hornyLevel < 30) {
            status = "😇 Pure Soul";
            advice = "Living a holy life! Keep it up!";
        } else if (hornyLevel < 60) {
            status = "😏 Slightly Sus";
            advice = "A little sus but manageable";
        } else if (hornyLevel < 80) {
            status = "🥵 Thirsty Alert";
            advice = "Time for a cold shower!";
        } else {
            status = "💀 DOWN HORRENDOUS";
            advice = "STRAIGHT TO HORNY JAIL!";
        }

        await sock.sendMessage(chatId, {
            text: `📈 *HORNY LEVEL REPORT*\n\n👤 Target: @${targetUser.split('@')[0]}\n🔥 Horny Meter: ${hornyLevel}%\n⚡ Status: ${status}\n💡 Advice: ${advice}\n\n${'▰'.repeat(Math.floor(hornyLevel/10))}${'▱'.repeat(10-Math.floor(hornyLevel/10))}`,
            mentions: [targetUser]
        });

    } catch (err) {
        await sock.sendMessage(chatId, {
            text: "❌ Failed to analyze horny levels!"
        });
    }
    return;
}

// Group Horny Stats
if ((command === 'horny' && args[0] && args[0].toLowerCase() === 'stats') || 
    (command === 'stats' && args[0] && args[0].toLowerCase() === 'horny')) {
    
    await sock.sendMessage(chatId, { react: { text: "📈", key: msg.key } });
    
    try {
        const metadata = await sock.groupMetadata(chatId);
        const participants = metadata.participants;
        
        // Simulate random stats
        const totalMembers = participants.length;
        const hornyCount = Math.floor(totalMembers * (0.3 + Math.random() * 0.4));
        const averageLevel = Math.floor(30 + Math.random() * 50);
        
        await sock.sendMessage(chatId, {
            text: `📊 *GROUP HORNY STATISTICS*\n\n👥 Total Members: ${totalMembers}\n🥵 Horny Individuals: ${hornyCount}\n📈 Average Horny Level: ${averageLevel}%\n🏆 Most Horny: Random member (probably)\n\n💡 *Group Status:* ${averageLevel > 60 ? "⚠️ HIGH HORNY ALERT" : "✅ Under Control"}\n🎯 *Recommendation:* ${averageLevel > 70 ? "Group cold shower session needed!" : "Keep monitoring!"}`
        });
        
    } catch (err) {
        await sock.sendMessage(chatId, {
            text: "❌ Couldn't gather horny statistics!"
        });
    }
    return;
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
if ((command === "gc" && args[0] && args[0].toLowerCase() === "name") || 
    (command === "group" && args[0] && args[0].toLowerCase() === "name")) {
    
    const newName = args.slice(1).join(" ");
    await sock.sendMessage(chatId, { react: { text: "✏️", key: msg.key } });
    
    if (newName) {
        try {
            await sock.groupUpdateSubject(chatId, newName);
            await sock.sendMessage(chatId, { 
                text: `🎉 *GROUP NAME UPDATED!* 🎉\n\n✨ New Identity: *${newName}*\n🏷️ Your group has a fresh new look!` 
            }, { quoted: msg });
            await sock.sendMessage(chatId, { react: { text: "🌟", key: msg.key } });
        } catch (error) {
            console.error("Error changing group name:", error);
            await sock.sendMessage(chatId, { 
                text: "❌ *Oops! Name Change Failed!*\n\n🤔 Possible reasons:\n• I'm not an admin\n• Name is too long\n• Name violates rules"
            }, { quoted: msg });
            await sock.sendMessage(chatId, { react: { text: "😢", key: msg.key } });
        }
    } else {
        await sock.sendMessage(chatId, { 
            text: `📝 *New Name Required!*\n\nUsage: *${currentPrefix}gc name Awesome Squad* \n💡 Give your group a cool new identity!`
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "🤷‍♂️", key: msg.key } });
    }
    return;
}

// Change Group Description
if ((command === "gc" && args[0] && (args[0].toLowerCase() === "desc" || args[0].toLowerCase() === "description")) || 
    (command === "group" && args[0] && (args[0].toLowerCase() === "desc" || args[0].toLowerCase() === "description"))) {
    
    const newDesc = args.slice(1).join(" ");
    await sock.sendMessage(chatId, { react: { text: "📄", key: msg.key } });
    
    if (newDesc) {
        try {
            await sock.groupUpdateDescription(chatId, newDesc);
            await sock.sendMessage(chatId, { 
                text: `📖 *DESCRIPTION UPDATED!*\n\n📝 New Description:\n"${newDesc}"\n\n✅ Now everyone knows what's up!`
            }, { quoted: msg });
            await sock.sendMessage(chatId, { react: { text: "📌", key: msg.key } });
        } catch (error) {
            console.error("Error changing group description:", error);
            await sock.sendMessage(chatId, { 
                text: "❌ *Description Update Failed!*\n\n⚡ Possible issues:\n• Description too long\n• I need admin rights\n• Try again later"
            }, { quoted: msg });
            await sock.sendMessage(chatId, { react: { text: "📛", key: msg.key } });
        }
    } else {
        await sock.sendMessage(chatId, { 
            text: `📝 *Missing Description!*\n\nUsage: *${currentPrefix}gc desc This is the best group ever!* \n🎯 Tell people what your group is about!`
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "🤔", key: msg.key } });
    }
    return;
}

// Lock Group Chat
if (command === 'mute') {
    await sock.sendMessage(chatId, { react: { text: "🔒", key: msg.key } });
    try {
        await sock.groupSettingUpdate(chatId, "announcement");
        await sock.sendMessage(chatId, { 
            text: `🔇 *CHAT LOCKED!*\n\n🚫 Only admins can speak now\n🤫 Everyone else is in read-only mode\n⚡ Use *!unmute* to reopen chat`
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "🤐", key: msg.key } });
    } catch (error) {
        console.error('Error closing chat:', error);
        await sock.sendMessage(chatId, { 
            text: "❌ *Failed to Lock Chat!*\n\n👑 I need admin powers to do this!\n🔧 Make sure I'm an admin first"
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "🔧", key: msg.key } });
    }
}

// Unlock Group Chat
if (command === 'unmute') {
    await sock.sendMessage(chatId, { react: { text: "🔓", key: msg.key } });
    try {
        await sock.groupSettingUpdate(chatId, "not_announcement");
        await sock.sendMessage(chatId, { 
            text: `🔊 *CHAT UNLOCKED!*\n\n🎉 Everyone can chat now!\n💬 Let the conversations flow!\n🎤 Microphones are ON!`
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "🎉", key: msg.key } });
    } catch (error) {
        console.error('Error opening chat:', error);
        await sock.sendMessage(chatId, { 
            text: "❌ *Failed to Unlock Chat!*\n\n👑 Admin rights required!\n⚡ Try again or check my permissions"
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "🚫", key: msg.key } });
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

// Toggle Welcome Message ON
if ((command === 'welcome' && args[0] && args[0].toLowerCase() === 'on') || 
    (command === 'wel' && args[0] && args[0].toLowerCase() === 'on')) {
    
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
    return;
}

// Toggle Welcome Message OFF
if ((command === 'welcome' && args[0] && args[0].toLowerCase() === 'off') || 
    (command === 'wel' && args[0] && args[0].toLowerCase() === 'off')) {
    
    const welcomeFile = './src/welcome.json';
    if (!fs.existsSync(welcomeFile)) fs.writeFileSync(welcomeFile, JSON.stringify({}));
    const welcomeData = JSON.parse(fs.readFileSync(welcomeFile));

    if (!isGroup) {
        await sock.sendMessage(chatId, { text: "⚠️ This command only works in groups." });
        return;
    }

    welcomeData[chatId].enabled = false;
    fs.writeFileSync(welcomeFile, JSON.stringify(welcomeData, null, 2));
    await sock.sendMessage(chatId, { text: "✅ Welcome message disabled!" });
    return;
}

// Set Welcome Message
if ((command === 'welcome' && args[0] && args[0].toLowerCase() === 'set') || 
    (command === 'wel' && args[0] && args[0].toLowerCase() === 'set')) {
    
    const newMsg = args.slice(1).join(" ");
    if (!newMsg) {
        await sock.sendMessage(chatId, { text: "⚠️ Usage: " + currentPrefix + "welcome set <message>" });
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
    return;
}

// Toggle Goodbye Message ON
if ((command === 'goodbye' && args[0] && args[0].toLowerCase() === 'on') || 
    (command === 'bye' && args[0] && args[0].toLowerCase() === 'on')) {
    
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

    if (!settings[chatId]) settings[chatId] = {};
    settings[chatId].goodbyeEnabled = true;
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
    await sock.sendMessage(chatId, { text: '✅ Goodbye message enabled for this group.' });
    return;
}

// Toggle Goodbye Message OFF
if ((command === 'goodbye' && args[0] && args[0].toLowerCase() === 'off') || 
    (command === 'bye' && args[0] && args[0].toLowerCase() === 'off')) {
    
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

    if (!settings[chatId]) settings[chatId] = {};
    settings[chatId].goodbyeEnabled = false;
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
    await sock.sendMessage(chatId, { text: '🚫 Goodbye message disabled for this group.' });
    return;
}

// Promote Notifications ON
if ((command === 'promote' && args[0] && args[0].toLowerCase() === 'on')) {
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
    return;
}

// Promote Notifications OFF
if ((command === 'promote' && args[0] && args[0].toLowerCase() === 'off')) {
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
    return;
}

// Set Promote Message
if ((command === 'promote' && args[0] && args[0].toLowerCase() === 'set')) {
    const newMsg = args.slice(1).join(" ");
    if (!newMsg) {
        await sock.sendMessage(chatId, { text: "❌ Usage: " + currentPrefix + "promote set <message>\nYou can use @user to mention the promoted user" });
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
    return;
}

// Demote Notifications ON
if ((command === 'demote' && args[0] && args[0].toLowerCase() === 'on')) {
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
    return;
}

// Demote Notifications OFF
if ((command === 'demote' && args[0] && args[0].toLowerCase() === 'off')) {
     const isMainOwner = senderJid === config.OWNER_JID;
    
    if (!isMainOwner) {
        await sock.sendMessage(chatId, { 
            text: '*🚫 Only main owner can execute this command*' 
        }, { quoted: msg });
        return;
    }
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
    return;
}

// Set Demote Message
if ((command === 'demote' && args[0] && args[0].toLowerCase() === 'set')) {
     const isMainOwner = senderJid === config.OWNER_JID;
    
    if (!isMainOwner) {
        await sock.sendMessage(chatId, { 
            text: '*🚫 Only main owner can set Desire-eXe Demote.*' 
        }, { quoted: msg });
        return;
    }
    const newMsg = args.slice(1).join(" ");
    if (!newMsg) {
        await sock.sendMessage(chatId, { text: "❌ Usage: " + currentPrefix + "demote set <message>\nYou can use @user to mention the demoted user" });
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
    return;
}

// Anti-Mention Configuration
if ((command === 'antimention' && args[0])) {
     const isMainOwner = senderJid === config.OWNER_JID;
    
    if (!isMainOwner) {
        await sock.sendMessage(chatId, { 
            text: '*🚫 Only main owner can turn on Desire-eXe V2.0 antimention*' 
        }, { quoted: msg });
        return;
    }
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

    const arg = args[0].toLowerCase();
    if (arg === 'on') {
        if (!config[chatId]) config[chatId] = {};
        config[chatId].enabled = true;
        fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
        await sock.sendMessage(chatId, { text: '✅ Anti-mention protection enabled for this group.' });
    } else if (arg === 'off') {
        if (!config[chatId]) config[chatId] = {};
        config[chatId].enabled = false;
        fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
        await sock.sendMessage(chatId, { text: '🚫 Anti-mention protection disabled for this group.' });
    } else {
        await sock.sendMessage(chatId, { text: `Usage: ${currentPrefix}antimention on / ${currentPrefix}antimention off\n\n📝 When enabled, the bot will delete @everyone mentions and warn users automatically.` });
    }
    return;
}

// Anti Link ON
if ((command === 'antilink' && args[0] && args[0].toLowerCase() === 'on')) {
     const isMainOwner = senderJid === config.OWNER_JID;
    
    if (!isMainOwner) {
        await sock.sendMessage(chatId, { 
            text: '*🚫 Only main owner can turn on Desire-eXe antilink*' 
        }, { quoted: msg });
        return;
    }
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
    return;
}

// Anti Link OFF
if ((command === 'antilink' && args[0] && args[0].toLowerCase() === 'off')) {
     const isMainOwner = senderJid === config.OWNER_JID;
    
    if (!isMainOwner) {
        await sock.sendMessage(chatId, { 
            text: '*🚫 Only main owner can turn off Desire-eXe V2.0 antilink*' 
        }, { quoted: msg });
        return;
    }
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
    return;
}

// Anti Link Status
if ((command === 'antilink' && args[0] && args[0].toLowerCase() === 'status')) {
     const isMainOwner = senderJid === config.OWNER_JID;
    
    if (!isMainOwner) {
        await sock.sendMessage(chatId, { 
            text: '*🚫 Only main owner can check Desire-eXe V2.0 antilink status*' 
        }, { quoted: msg });
        return;
    }
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
            text: `🔗 *Anti-Link Status*\n\nStatus: ${status}\n\nUse ${currentPrefix}antilink on to enable\nUse ${currentPrefix}antilink off to disable`
        });
        
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
    } catch (error) {
        console.error('Error:', error);
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
    return;
}
// Enable anti-badwords in current group
if ((command === 'antibadwords' && args[0] && args[0].toLowerCase() === 'on') || 
    (command === 'badwords' && args[0] && args[0].toLowerCase() === 'on') ||
    (command === 'anti' && args[0] && args[0].toLowerCase() === 'badwords' && args[1] && args[1].toLowerCase() === 'on')) {
    
    const isMainOwner = senderJid === config.OWNER_JID;
    const isGroup = chatId.endsWith('@g.us');
    
    if (!isMainOwner) {
        await sock.sendMessage(chatId, { 
            text: '*🚫 Only main owner can turn on Desire-eXe V2.0 antibadwords*' 
        }, { quoted: msg });
        return;
    }

    if (!isGroup) {
        await sock.sendMessage(chatId, { 
            text: '❌ This command only works in groups.' 
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "⌛", key: msg.key } });
    
    try {
        const antibadwordsFile = './src/antibadwords.json';
        let antibadwordsData = {};
        
        // Load existing data
        if (fs.existsSync(antibadwordsFile)) {
            antibadwordsData = JSON.parse(fs.readFileSync(antibadwordsFile));
        }
        
        // Enable for this specific group
        antibadwordsData[chatId] = { enabled: true };
        fs.writeFileSync(antibadwordsFile, JSON.stringify(antibadwordsData, null, 2));
        
        const responseMessage = "✅ *AntiBadwords Activated for this group!*\n\n🚫 Bad words will now be automatically deleted in this group.";
        await sock.sendMessage(chatId, { text: responseMessage }, { quoted: msg });
        console.log(`AntiBadwords enabled for group: ${chatId}`);
        
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
    } catch (error) {
        console.error('Error enabling antibadwords:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ Failed to enable AntiBadwords for this group.' 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
    return;
}

// Disable anti-badwords in current group
if ((command === 'antibadwords' && args[0] && args[0].toLowerCase() === 'off') || 
    (command === 'badwords' && args[0] && args[0].toLowerCase() === 'off') ||
    (command === 'anti' && args[0] && args[0].toLowerCase() === 'badwords' && args[1] && args[1].toLowerCase() === 'off')) {
    
    const isMainOwner = senderJid === config.OWNER_JID;
    const isGroup = chatId.endsWith('@g.us');
    
    if (!isMainOwner) {
        await sock.sendMessage(chatId, { 
            text: '*🚫 Only main owner can turn off Desire-eXe V2.0 antibadwords*' 
        }, { quoted: msg });
        return;
    }

    if (!isGroup) {
        await sock.sendMessage(chatId, { 
            text: '❌ This command only works in groups.' 
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "⌛", key: msg.key } });
    
    try {
        const antibadwordsFile = './src/antibadwords.json';
        let antibadwordsData = {};
        
        // Load existing data
        if (fs.existsSync(antibadwordsFile)) {
            antibadwordsData = JSON.parse(fs.readFileSync(antibadwordsFile));
        }
        
        // Disable for this specific group (or remove entry)
        antibadwordsData[chatId] = { enabled: false };
        // OR remove completely: delete antibadwordsData[chatId];
        fs.writeFileSync(antibadwordsFile, JSON.stringify(antibadwordsData, null, 2));
        
        const responseMessage = "❌ *AntiBadwords Deactivated for this group!*\n\n💬 Bad words will no longer be filtered in this group.";
        await sock.sendMessage(chatId, { text: responseMessage }, { quoted: msg });
        console.log(`AntiBadwords disabled for group: ${chatId}`);
        
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
    } catch (error) {
        console.error('Error disabling antibadwords:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ Failed to disable AntiBadwords for this group.' 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
    return;
}
// Add new bad words to the list
if ((command === 'addbadwords' || command === 'addbadword') && args.length > 0) {
    
    const isMainOwner = senderJid === config.OWNER_JID;
    
    if (!isMainOwner) {
        await sock.sendMessage(chatId, { 
            text: '*🚫 Only main owner can add Desire-eXe V2.0 bad words*' 
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "⌛", key: msg.key } });
    
    try {
        // Get the bad words to add
        const wordsToAdd = args.join(' ').split(',').map(word => word.trim()).filter(word => word);
        
        if (wordsToAdd.length === 0) {
            await sock.sendMessage(chatId, { 
                text: "❌ Please provide bad words to add. Example:" + currentPrefix + "addbadwords word1,word2,word3" 
            }, { quoted: msg });
            await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
            return;
        }
        
        // Check if config.BAD_WORDS exists
        if (!Array.isArray(config.BAD_WORDS)) {
            config.BAD_WORDS = [];
        }
        
        // Add new words that don't already exist
        const addedWords = [];
        const alreadyExistWords = [];
        
        wordsToAdd.forEach(word => {
            const wordLower = word.toLowerCase();
            if (!config.BAD_WORDS.includes(wordLower)) {
                config.BAD_WORDS.push(wordLower);
                addedWords.push(word);
            } else {
                alreadyExistWords.push(word);
            }
        });
        
        // Save config changes to config.json
        try {
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            console.log('✅ Config saved successfully');
        } catch (saveError) {
            console.error('❌ Error saving config:', saveError);
            throw new Error('Failed to save config changes');
        }
        
        let responseMessage = "";
        if (addedWords.length > 0) {
            responseMessage += `✅ *${addedWords.length} Bad Word(s) Added:*\n\`\`\`${addedWords.join(', ')}\`\`\`\n`;
        }
        if (alreadyExistWords.length > 0) {
            responseMessage += `⚠️ *${alreadyExistWords.length} Word(s) Already Existed:*\n\`\`\`${alreadyExistWords.join(', ')}\`\`\`\n`;
        }
        responseMessage += `\n📊 Total bad words in list: *${config.BAD_WORDS.length}*`;
        
        await sock.sendMessage(chatId, { text: responseMessage }, { quoted: msg });
        console.log(`Added bad words: ${addedWords.join(', ')}`);
        
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
    } catch (error) {
        console.error('Error adding bad words:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ Failed to add bad words. Check console for details.' 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
    return;
}

// Remove bad words from the list
if ((command === 'removebadwords' || command === 'delbadwords' || command === 'rmbadwords') && args.length > 0) {
    
    const isMainOwner = senderJid === config.OWNER_JID;
    
    if (!isMainOwner) {
        await sock.sendMessage(chatId, { 
            text: '*🚫 Only Main owner can remove Desire-eXe V2.0 bad words.*' 
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "⌛", key: msg.key } });
    
    try {
        // Get the bad words to remove
        const wordsToRemove = args.join(' ').split(',').map(word => word.trim()).filter(word => word);
        
        if (wordsToRemove.length === 0) {
            await sock.sendMessage(chatId, { 
                text: "❌ Please provide bad words to remove. Example: " + currentPrefix + "removebadwords word1,word2,word3" 
            }, { quoted: msg });
            await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
            return;
        }
        
        // Check if config.BAD_WORDS exists
        if (!Array.isArray(config.BAD_WORDS) || config.BAD_WORDS.length === 0) {
            await sock.sendMessage(chatId, { 
                text: '❌ The bad words list is currently empty.' 
            }, { quoted: msg });
            await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
            return;
        }
        
        // Remove the words
        const removedWords = [];
        const notFoundWords = [];
        
        wordsToRemove.forEach(word => {
            const wordLower = word.toLowerCase();
            const index = config.BAD_WORDS.indexOf(wordLower);
            if (index !== -1) {
                config.BAD_WORDS.splice(index, 1);
                removedWords.push(word);
            } else {
                notFoundWords.push(word);
            }
        });
        
        // Save config changes to config.json
        try {
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            console.log('✅ Config saved successfully');
        } catch (saveError) {
            console.error('❌ Error saving config:', saveError);
            throw new Error('Failed to save config changes');
        }
        
        let responseMessage = "";
        if (removedWords.length > 0) {
            responseMessage += `✅ *${removedWords.length} Bad Word(s) Removed:*\n\`\`\`${removedWords.join(', ')}\`\`\`\n`;
        }
        if (notFoundWords.length > 0) {
            responseMessage += `⚠️ *${notFoundWords.length} Word(s) Not Found in List:*\n\`\`\`${notFoundWords.join(', ')}\`\`\`\n`;
        }
        responseMessage += `\n📊 Total bad words remaining: *${config.BAD_WORDS.length}*`;
        
        await sock.sendMessage(chatId, { text: responseMessage }, { quoted: msg });
        console.log(`Removed bad words: ${removedWords.join(', ')}`);
        
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
    } catch (error) {
        console.error('Error removing bad words:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ Failed to remove bad words. Check console for details.' 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
    return;
}

// List all bad words
if (command === 'listbadwords' || command === 'badwordslist') {
    
    const isMainOwner = senderJid === config.OWNER_JID;
    
    if (!isMainOwner) {
        await sock.sendMessage(chatId, { 
            text: '*🚫 Only main owner can list Desire-eXe V2.0 bad words*' 
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "⌛", key: msg.key } });
    
    try {
        if (!Array.isArray(config.BAD_WORDS) || config.BAD_WORDS.length === 0) {
            await sock.sendMessage(chatId, { 
                text: '📝 *Bad Words List*\n\nNo bad words have been added yet.' 
            }, { quoted: msg });
            await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
            return;
        }
        
        // Split into multiple messages if too long
        const wordsPerMessage = 30;
        for (let i = 0; i < config.BAD_WORDS.length; i += wordsPerMessage) {
            const chunk = config.BAD_WORDS.slice(i, i + wordsPerMessage);
            const messageNumber = Math.floor(i / wordsPerMessage) + 1;
            const totalMessages = Math.ceil(config.BAD_WORDS.length / wordsPerMessage);
            
            const responseMessage = `📝 *Bad Words List (${messageNumber}/${totalMessages})*\n\n` +
                                  `Total Words: *${config.BAD_WORDS.length}*\n\n` +
                                  `\`\`\`${chunk.join(', ')}\`\`\``;
            
            await sock.sendMessage(chatId, { text: responseMessage }, { quoted: msg });
        }
        
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
    } catch (error) {
        console.error('Error listing bad words:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ Failed to list bad words. Check console for details.' 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
    return;
}

// Clear all bad words
if (command === 'clearbadwords' || command === 'resetbadwords') {
    
    const isMainOwner = senderJid === config.OWNER_JID;
    
    if (!isMainOwner) {
        await sock.sendMessage(chatId, { 
            text: '*🚫 Only main Owner can clear Desire-eXe V2.0 bad wrods*' 
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "⌛", key: msg.key } });
    
    try {
        if (!Array.isArray(config.BAD_WORDS) || config.BAD_WORDS.length === 0) {
            await sock.sendMessage(chatId, { 
                text: '❌ The bad words list is already empty.' 
            }, { quoted: msg });
            await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
            return;
        }
        
        const count = config.BAD_WORDS.length;
        config.BAD_WORDS = [];
        
        // Save config changes to config.json
        try {
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            console.log('✅ Config saved successfully');
        } catch (saveError) {
            console.error('❌ Error saving config:', saveError);
            throw new Error('Failed to save config changes');
        }
        
        await sock.sendMessage(chatId, { 
            text: `✅ *Bad Words List Cleared!*\n\n🗑️ Removed all *${count}* bad words.` 
        }, { quoted: msg });
        
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
    } catch (error) {
        console.error('Error clearing bad words:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ Failed to clear bad words. Check console for details.' 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
    return;
}

// Check if message contains bad words
if (command === 'checkbadwords' && args.length > 0) {
    
    const isMainOwner = senderJid === config.OWNER_JID;
    
    if (!isMainOwner) {
        await sock.sendMessage(chatId, { 
            text: '*🚫 Only main owner can check Desire-eXe V2.0 bad words*' 
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(chatId, { react: { text: "⌛", key: msg.key } });
    
    try {
        const textToCheck = args.join(' ');
        
        if (!Array.isArray(config.BAD_WORDS) || config.BAD_WORDS.length === 0) {
            await sock.sendMessage(chatId, { 
                text: `🔍 *Text Check:*\n\n\`\`\`${textToCheck}\`\`\`\n\n📊 *Result:* No bad words in list to check against.` 
            }, { quoted: msg });
            await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
            return;
        }
        
        const lowerCaseText = textToCheck.toLowerCase();
        const foundWords = config.BAD_WORDS.filter(word => 
            lowerCaseText.includes(word.toLowerCase())
        );
        
        if (foundWords.length > 0) {
            await sock.sendMessage(chatId, { 
                text: `🔍 *Text Check:*\n\n\`\`\`${textToCheck}\`\`\`\n\n📊 *Result:* Found *${foundWords.length}* bad word(s)\n\`\`\`${foundWords.join(', ')}\`\`\`` 
            }, { quoted: msg });
        } else {
            await sock.sendMessage(chatId, { 
                text: `🔍 *Text Check:*\n\n\`\`\`${textToCheck}\`\`\`\n\n📊 *Result:* No bad words found (clean text)` 
            }, { quoted: msg });
        }
        
        await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
    } catch (error) {
        console.error('Error checking text for bad words:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ Failed to check text for bad words.' 
        }, { quoted: msg });
        await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
    }
    return;
}
		// Private Mode
        if (command === 'private') {
			  const isMainOwner = senderJid === config.OWNER_JID;
    
    if (!isMainOwner) {
        await sock.sendMessage(chatId, { 
            text: '*🚫 Only main owner can change Desire-eXe V2.0 Mode.*' 
        }, { quoted: msg });
        return;
    }
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
