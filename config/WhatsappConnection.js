// Imports
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  Browsers
} = require('@whiskeysockets/baileys');
const P = require('pino');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode');
const MessageHandler = require('../controllers/Message');
const { restoreActivePresence } = require('../presenceSystem');
const delay = ms => new Promise(res => setTimeout(res, ms));

// File paths - consistent for Koyeb
const AUTH_DIR = './auth_info';
const CONTACT_FILE = './Desire_contact.json';
const CONFIG_FILE = './config.json';
const BUG_LOG = './buglog.json';

// Global state variables
let contactList = [];
let botStartTime = null;
let isConnected = false;
let qrCode = null;
let qrCodeImage = null;
let pairingCode = null;
let pairingPhoneNumber = null;
let pairingCodeExpiry = null;
let sockInstance = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;

// Initialize global variables
global.botStatus = 'initializing';
global.connectionTime = null;

// Cleanup function
function cleanupState() {
  qrCode = null;
  qrCodeImage = null;
  pairingCode = null;
  pairingPhoneNumber = null;
  pairingCodeExpiry = null;
  isConnected = false;
  global.botStatus = 'initializing';
  global.connectionTime = null;
  reconnectAttempts = 0;
}

// Enhanced connection update handler (inspired by V2.0)
async function handleConnectionUpdate(update, sock, config) {
  const { connection, lastDisconnect, qr, isNewLogin } = update;
  
  console.log(`🔄 Connection update: ${connection}`, {
    qr: !!qr,
    isNewLogin,
    lastDisconnect: lastDisconnect?.error?.message
  });

  // Handle QR Code
  if (qr) {
    console.log('📱 QR Code received - generating web QR...');
    
    // Clear any existing pairing info
    pairingCode = null;
    pairingPhoneNumber = null;
    pairingCodeExpiry = null;
    
    qrCode = qr;
    qrCodeImage = await generateQRImage(qr);
    global.botStatus = 'qr_pending';
    isConnected = false;
    reconnectAttempts = 0; // Reset on new QR
    
    console.log('🌐 QR Code available at: http://your-app.koyeb.app/auth');
    console.log('📲 Scan the QR code via the web interface to connect');
    
    // Auto-clear QR after 2 minutes
    setTimeout(() => {
      if (!isConnected && qrCode === qr) {
        console.log('⏰ QR Code expired - will generate new one on next connection');
        qrCode = null;
        qrCodeImage = null;
      }
    }, 120000);
    return;
  }

  if (connection === 'close') {
    const code = lastDisconnect?.error?.output?.statusCode;
    const errorMessage = lastDisconnect?.error?.message;
    
    console.log('🔌 Connection closed:', {
      statusCode: code,
      message: errorMessage
    });

    isConnected = false;
    qrCode = null;
    qrCodeImage = null;
    pairingCode = null;
    pairingPhoneNumber = null;
    pairingCodeExpiry = null;

    // Enhanced reconnection logic
    const shouldReconnect = 
      code !== DisconnectReason.loggedOut &&
      code !== DisconnectReason.badSession &&
      code !== 401 &&
      !errorMessage?.includes('invalid session');

    if (shouldReconnect) {
      reconnectAttempts++;
      const delayTime = Math.min(10000 * reconnectAttempts, 60000); // Max 60 seconds
      
      console.log(`🔄 Attempting reconnect (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}) in ${delayTime/1000}s...`);
      global.botStatus = 'reconnecting';
      
      if (reconnectAttempts <= MAX_RECONNECT_ATTEMPTS) {
        setTimeout(() => {
          console.log('🔄 Starting reconnection...');
          startBot().catch(err => {
            console.error('❌ Reconnection failed:', err);
          });
        }, delayTime);
      } else {
        console.error('🚫 Max reconnection attempts reached. Manual intervention required.');
        global.botStatus = 'error';
      }
    } else {
      console.log('🔒 Session invalid - requires new authentication');
      global.botStatus = 'needs_auth';
      
      // Clear auth state to force fresh login
      try {
        if (fs.existsSync(AUTH_DIR)) {
          fs.rmSync(AUTH_DIR, { recursive: true });
          console.log('🧹 Cleared invalid session data');
        }
      } catch (e) {
        console.error('❌ Failed to clear session data:', e);
      }
    }
    return;
  }

  if (connection === 'open') {
    console.log('✅ Desire-eXe V1.0 Is Online!');
    isConnected = true;
    reconnectAttempts = 0;
    qrCode = null;
    qrCodeImage = null;
    pairingCode = null;
    pairingPhoneNumber = null;
    pairingCodeExpiry = null;
    global.botStatus = 'connected';
    global.connectionTime = new Date().toISOString();
    
    try {
      await sock.sendPresenceUpdate('available');
      await restoreActivePresence(sock);
      
      // Send connection notification to owner
      await sendConnectionNotification(sock, config);
    } catch (error) {
      console.error('❌ Error during connection setup:', error);
    }
  }

  if (connection === 'connecting') {
    console.log('🔄 Connecting to WhatsApp...');
    isConnected = false;
    global.botStatus = 'connecting';
  }
}

// Load contacts
function loadContactsFromFile() {
  if (fs.existsSync(CONTACT_FILE)) {
    try {
      const raw = fs.readFileSync(CONTACT_FILE);
      contactList = JSON.parse(raw) || [];
      console.log(`📁 Loaded ${contactList.length} saved contacts.`);
    } catch (e) {
      console.error('❌ Failed to parse contact file:', e);
      contactList = [];
    }
  }
}

// Save contacts
function saveContactsToFile() {
  try {
    fs.writeFileSync(CONTACT_FILE, JSON.stringify(contactList, null, 2));
  } catch (e) {
    console.error('❌ Failed to save contacts:', e);
  }
}

// Save bug log
function logBugIncident(jid, type, detail) {
  const logEntry = {
    time: new Date().toISOString(),
    jid,
    type,
    detail
  };

  let logs = [];
  if (fs.existsSync(BUG_LOG)) {
    try {
      logs = JSON.parse(fs.readFileSync(BUG_LOG));
    } catch (e) {
      console.error('❌ Failed to parse bug log:', e);
    }
  }

  logs.push(logEntry);
  try {
    fs.writeFileSync(BUG_LOG, JSON.stringify(logs, null, 2));
  } catch (e) {
    console.error('❌ Failed to save bug log:', e);
  }
}

// Unwrap ephemeral/viewOnce messages
function unwrapMessage(message) {
  if (message?.ephemeralMessage?.message) {
    return unwrapMessage(message.ephemeralMessage.message);
  }
  if (message?.viewOnceMessage?.message) {
    return unwrapMessage(message.viewOnceMessage.message);
  }
  return message;
}

// Bug detection helpers
function isDangerousText(msg) {
  const text = msg?.conversation || msg?.extendedTextMessage?.text || '';
  
  if (!text || text.trim().length === 0) return false;
  
  // Remove ALL emoji-related characters including complex sequences
  const textWithoutEmojis = text
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
    .replace(/[\u{1F700}-\u{1F77F}]/gu, '')
    .replace(/[\u{1F780}-\u{1F7FF}]/gu, '')
    .replace(/[\u{1F800}-\u{1F8FF}]/gu, '')
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, '')
    .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '')
    .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '')
    .replace(/[\u{2600}-\u{26FF}]/gu, '')
    .replace(/[\u{2700}-\u{27BF}]/gu, '')
    .replace(/[\u{2300}-\u{23FF}]/gu, '')
    .replace(/[\u{2B50}-\u{2BFF}]/gu, '')
    .replace(/[\u{FE0F}\u{200D}]/gu, '');
  
  if (textWithoutEmojis.trim().length === 0) {
    return false;
  }
  
  const dangerousPatterns = [
    /[\u200B-\u200C\u200E-\u200F\u202A-\u202E\u2060]/,
    /(.+)\1{50,}/,
    /.{4000,}/,
    /[\uFFF9-\uFFFF]/,
  ];
  
  return dangerousPatterns.some(p => p.test(textWithoutEmojis));
}

function isSuspiciousMedia(msg, maxBytes) {
  const media = msg?.stickerMessage || msg?.imageMessage || msg?.videoMessage || msg?.audioMessage || msg?.documentMessage;
  const size = media?.fileLength || 0;
  return size > maxBytes;
}

// Get participant action text
function getParticipantActionText(participants, action) {
  const actionTexts = {
    'promote': 'promoted',
    'demote': 'demoted'
  };
  
  const actionText = actionTexts[action] || action;
  const participantNames = participants.map(p => `@${p.split('@')[0]}`).join(', ');
  
  return `${participantNames} ${actionText}`;
}

// Detect group status mention messages
function isGroupStatusMentionMessage(message) {
  return message?.groupStatusMentionMessage?.message?.protocolMessage !== undefined;
}

// Extract info from group status mention
function extractMentionInfo(message) {
  const mentionMsg = message.groupStatusMentionMessage;
  return {
    type: 'group_mention',
    protocolMessage: mentionMsg.message?.protocolMessage,
    timestamp: mentionMsg.messageTimestamp,
    key: mentionMsg.message?.key
  };
}

// Check if JID is a newsletter/channel
function isNewsletterJid(jid) {
  if (!jid) return false;
  
  // More specific check - only newsletters and status broadcasts
  return jid.endsWith('@newsletter');
}

// Get uptime string
function getUptimeString() {
  if (!botStartTime) return 'Just started';
  
  const uptime = Date.now() - botStartTime;
  const seconds = Math.floor(uptime / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

// Send connection notification to owner
async function sendConnectionNotification(sock, config) {
  if (!config.OWNER_JID) {
    console.log('⚠️ No OWNER_JID configured - skipping connection notification');
    return;
  }
  
  try {
    const timestamp = new Date().toLocaleString();
    const uptime = getUptimeString();
    
    const connectionMessage = `🤖 *Desire eXe Bot Connected!*
    
✅ *Status:* Online and Ready
🕒 *Connected At:* ${timestamp}
⏱️ *Uptime:* ${uptime}
🔗 *Session:* ${sock.authState.creds.registered ? 'Authenticated' : 'Not Registered'}
📱 *Platform:* ${sock.user?.platform || 'Unknown'}

The bot is now operational and listening for messages.`;

    await sock.sendMessage(config.OWNER_JID, {
      text: connectionMessage
    });
    
    console.log(`✅ Connection notification sent to owner: ${config.OWNER_JID}`);
  } catch (error) {
    console.error('❌ Failed to send connection notification:', error);
  }
}

// Generate QR Code as image
async function generateQRImage(qr) {
  try {
    if (!qr) return null;
    const qrImage = await qrcode.toDataURL(qr);
    return qrImage;
  } catch (error) {
    console.error('❌ Failed to generate QR image:', error);
    // Return a placeholder error image
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjUwIiBoZWlnaHQ9IjI1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZmZmIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIyNCIgZmlsbD0iIzMzMyIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPlFSIENvZGUgRXJyb3I8L3RleHQ+PC9zdmc+';
  }
}

// Request pairing code
async function requestPairingCode(sock, phoneNumber) {
  try {
    if (!sock) {
      return {
        success: false,
        error: 'Bot is not initialized yet. Please wait a moment.'
      };
    }
    
    console.log(`📱 Requesting pairing code for: ${phoneNumber}`);
    
    // Validate phone number format
    const cleanNumber = phoneNumber.replace(/[^\d+]/g, '');
    if (!cleanNumber.match(/^\+?[\d\s-()]+$/)) {
      throw new Error('Invalid phone number format');
    }
    
    const code = await sock.requestPairingCode(cleanNumber);
    
    // Store pairing info
    pairingCode = code;
    pairingPhoneNumber = cleanNumber;
    pairingCodeExpiry = Date.now() + (2 * 60 * 1000); // 2 minutes expiry
    
    console.log(`✅ Pairing code generated: ${code}`);
    
    return {
      success: true,
      code: code,
      phoneNumber: cleanNumber,
      expiresAt: new Date(pairingCodeExpiry).toISOString()
    };
  } catch (error) {
    console.error('❌ Failed to generate pairing code:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Clear expired pairing code
function clearExpiredPairingCode() {
  if (pairingCodeExpiry && Date.now() > pairingCodeExpiry) {
    console.log('⏰ Pairing code expired');
    pairingCode = null;
    pairingPhoneNumber = null;
    pairingCodeExpiry = null;
  }
}

// Start periodic cleanup of expired pairing codes
function startPairingCodeCleanup() {
  setInterval(() => {
    clearExpiredPairingCode();
  }, 30000); // Check every 30 seconds
}

// Setup message handlers separately 
function setupMessageHandlers(sock, config) {
  // Remove old listeners to prevent duplicates
  sock.ev.removeAllListeners('messages.upsert');
  sock.ev.removeAllListeners('group-participants.update');

  // Message handler (only when connected)
  sock.ev.on('messages.upsert', async ({ messages }) => {
    if (!isConnected) {
      console.log('⚠️ Message received but bot not connected, ignoring...');
      return;
    }
    
    await delay(100);
    let msg;

    try {
      msg = messages[0];
      const jid = msg.key.remoteJid;
      
       if (isNewsletterJid(jid)) {
      console.log('📰 Newsletter message received from:', jid);
  
    }
      
      if (!msg.message || jid === 'status@broadcast' || jid.endsWith('@bot')) return;

      msg.message = unwrapMessage(msg.message);

      if (isGroupStatusMentionMessage(msg.message)) {
        console.log('🔔 Group mention detected:', jid);
        
        const configFile = './src/antimention.json';
        if (fs.existsSync(configFile)) {
          const config = JSON.parse(fs.readFileSync(configFile));
          
          if (config[jid]?.enabled) {
            const mentionInfo = extractMentionInfo(msg.message);
            const mentionUser = msg.key.participant || msg.key.remoteJid;
            
            try {
              await sock.sendMessage(jid, {
                delete: msg.key
              });
              console.log(`🗑️ Deleted mention message from ${mentionUser} in ${jid}`);
            } catch (deleteError) {
              console.error('❌ Failed to delete mention message:', deleteError);
            }
            
            await sock.sendMessage(jid, {
              text: `⚠️ *Mention Warning!*\n\n@${mentionUser.split('@')[0]} Please avoid mentioning everyone in the group.\n\n🚫 Mass mentions are not allowed and will be deleted automatically.`,
              mentions: [mentionUser]
            });

            logBugIncident(jid, 'group_mention', `User ${mentionUser} mentioned everyone - MESSAGE DELETED`);
            return;
          }
        }
      }

     if (!jid.endsWith('@g.us') && !jid.endsWith('@broadcast')) {
        if (isDangerousText(msg.message)) {
          console.warn(`🚨 Bug-like TEXT from ${jid}`);
          await sock.sendMessage(jid, { text: '⚠️' });
          await sock.updateBlockStatus(jid, 'block');
          logBugIncident(jid, 'text', JSON.stringify(msg.message).slice(0, 500));
          if (config.OWNER_JID) {
            await sock.sendMessage(config.OWNER_JID, {
              text: `🚨 Bug alert\nFrom: ${jid}\nType: Text\nAction: Blocked`
            });
          }
          return;
        }
      }

      // DYNAMIC CONFIG RELOAD 
      if (jid && !jid.endsWith('@g.us')) {
        const known = contactList.find(c => c.jid === jid);
        if (!known) {
          // ✅ Dynamically reload auto-block setting from config
          let currentAutoBlock = false;
          try {
            if (fs.existsSync(CONFIG_FILE)) {
              const currentConfig = JSON.parse(fs.readFileSync(CONFIG_FILE));
              currentAutoBlock = currentConfig.AUTO_BLOCK_UNKNOWN || false;
            }
          } catch (e) {
            console.error('❌ Failed to reload config:', e);
          }
          
          if (currentAutoBlock) {
            console.log(`🚫 Unknown contact blocked: ${jid}`);
            await sock.updateBlockStatus(jid, 'block');
            return;
          }
          
          const name = msg.pushName || 'Unknown';
          contactList.push({ jid, name, firstSeen: new Date().toISOString() });
          saveContactsToFile();
          console.log(`➕ Saved: ${name} (${jid})`);
        }
      }

      console.log('📩 Message processed from:', jid);
      await MessageHandler(sock, messages, contactList);
    } catch (err) {
      console.error('❌ Message handler error:', err);
      if (msg) {
        try {
          await sock.sendMessageAck(msg.key);
        } catch (ackError) {
          console.error('❌ Failed to send message ack:', ackError);
        }
      }
    }
  });

  // Group participants update handler
  sock.ev.on('group-participants.update', async ({ id, participants, action }) => {
    if (!isConnected) return;
   
    console.log(`👥 Group update in ${id}: ${action} - ${participants.join(', ')}`);
    
    const now = new Date();
    const date = now.toLocaleDateString('en-GB').replace(/\//g, '-');
    const time = now.toLocaleTimeString('en-US', { hour12: false });
    
    if (action === 'promote' || action === 'demote') {
      try {
        const configFile = action === 'promote' ? './src/promote.json' : './src/demote.json';
        
        if (fs.existsSync(configFile)) {
          const configData = JSON.parse(fs.readFileSync(configFile));
          
          if (configData[id]?.enabled) {
            const customMessage = configData[id]?.message || 
              (action === 'promote' ? "👑 @user has been promoted to admin!" : "🔻 @user has been demoted from admin!");
            
            for (const user of participants) {
              const userMessage = customMessage.replace(/@user/g, `@${user.split('@')[0]}`);
              const messageText = `${userMessage}\n🕒 ${time}, ${date}`;
              
              await sock.sendMessage(id, {
                text: messageText,
                mentions: [user]
              });
            }
            
            console.log(`✅ ${action} notification sent for ${participants.join(', ')} in ${id}`);
          }
        } else {
          const actionText = action === 'promote' ? '👑 Promoted to Admin' : '🔻 Demoted from Admin';
          const messageText = `*${actionText}*\n👤 User: ${getParticipantActionText(participants, action)}\n🕒 Time: ${time}, ${date}`;
          
          await sock.sendMessage(id, {
            text: messageText,
            mentions: participants
          });
        }
        
      } catch (error) {
        console.error(`❌ Error sending ${action} notification:`, error);
      }
      return;
    }

    // Welcome new members
    if (action === 'add') {
      const welcomeFile = './src/welcome.json';
      if (!fs.existsSync(welcomeFile)) return;
      
      let welcomeData = {};
      try {
        welcomeData = JSON.parse(fs.readFileSync(welcomeFile));
      } catch (e) {
        console.error('❌ Failed to load welcome data:', e);
        return;
      }
      
      if (!welcomeData[id]?.enabled) return;

      for (const user of participants) {
        try {
          const userJid = typeof user === 'string' ? user : user.id || user.jid;
          
          if (!userJid) {
            console.log('⚠️ Could not extract JID from:', user);
            continue;
          }

          let pfpUrl;
          try {
            pfpUrl = await sock.profilePictureUrl(userJid, 'image');
          } catch {
            pfpUrl = 'https://i.imgur.com/1s6Qz8v.png';
          }

          const userDisplay = userJid.split('@')[0];
          const welcomeText = (welcomeData[id]?.message || '👋 Welcome @user!')
            .replace(/@user/g, `@${userDisplay}`);

          try {
            await sock.sendMessage(id, {
              ...(pfpUrl && { image: { url: pfpUrl } }),
              caption: welcomeText,
              mentions: [userJid]
            });
          } catch (e) {
            await sock.sendMessage(id, {
              text: welcomeText,
              mentions: [userJid]
            });
          }
        } catch (error) {
          console.error('❌ Error processing welcome for user:', user, error);
        }
      }
    }
    
    // Goodbye for removed members
    if (action === 'remove') {
      const settingsFile = './src/group_settings.json';
      if (!fs.existsSync(settingsFile)) return;

      let settings = {};
      try {
        settings = JSON.parse(fs.readFileSync(settingsFile));
      } catch (e) {
        console.error('❌ Failed to load group settings:', e);
        return;
      }
      
      if (!settings[id]?.goodbyeEnabled) return;

      for (const user of participants) {
        try {
          const userJid = typeof user === 'string' ? user : user.id || user.jid;
          if (!userJid) continue;

          const userDisplay = userJid.split('@')[0];
          const goodbyeText = `👋 Goodbye @${userDisplay}!\n⌚ Left at: ${time}, ${date}\nToo Bad We Won't Miss You! 💔`;

          let pfpUrl;
          try {
            pfpUrl = await sock.profilePictureUrl(userJid, 'image');
          } catch {
            pfpUrl = 'https://i.imgur.com/1s6Qz8v.png';
          }

          try {
            await sock.sendMessage(id, {
              ...(pfpUrl && { image: { url: pfpUrl } }),
              caption: goodbyeText,
              mentions: [userJid]
            });
          } catch (e) {
            await sock.sendMessage(id, {
              text: goodbyeText,
              mentions: [userJid]
            });
          }
        } catch (error) {
          console.error('❌ Error processing goodbye for user:', user, error);
        }
      }
    }
  });
}

// Main bot with improved session handling
async function startBot() {
  // Cleanup previous state
  cleanupState();
  
  // Set bot start time
  botStartTime = Date.now();

  // Load config for owner JID - with environment variable fallback
  let config = {
    AUTO_BLOCK_UNKNOWN: false,
    OWNER_JID: process.env.OWNER_JID || '2347017747337@s.whatsapp.net',
    MAX_MEDIA_SIZE: 1500000
  };

  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const fileConfig = JSON.parse(fs.readFileSync(CONFIG_FILE));
      config = { ...config, ...fileConfig };
    }
  } catch (e) {
    console.error('❌ Failed to load config:', e);
  }

  // Check if session exists (V2.0 improvement)
  const sessionExists = fs.existsSync(AUTH_DIR);
  console.log(`🔍 Session check: ${sessionExists ? 'Found existing session' : 'No session found'}`);

  let state, saveCreds;
  try {
    ({ state, saveCreds } = await useMultiFileAuthState(AUTH_DIR));
  } catch (error) {
    console.error('❌ Failed to load auth state:', error);
    // Clear corrupted session (V1.0 improvement)
    try {
      if (fs.existsSync(AUTH_DIR)) {
        fs.rmSync(AUTH_DIR, { recursive: true });
        console.log('🧹 Cleared corrupted session data');
      }
    } catch (e) {
      console.error('❌ Failed to clear corrupted session:', e);
    }
    // Retry with fresh state
    ({ state, saveCreds } = await useMultiFileAuthState(AUTH_DIR));
  }

  let sock;
  try {
    sock = makeWASocket({
      auth: state,
      logger: P({ level: 'warn' }),
      
      // Enhanced connection options from V2.0
      browser: Browsers.ubuntu('Chrome'),
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 30000,
      defaultQueryTimeoutMs: 60000,
      retryRequestDelayMs: 2000,
      maxRetries: 10,
      
      emitOwnEvents: true,
shouldIgnoreJid: jid => {
  return typeof jid === 'string' && (jid.endsWith('@bot')); 
}, 
      markOnlineOnConnect: true,
      syncFullHistory: false,
      linkPreviewImageThumbnailWidth: 200,
      generateHighQualityLinkPreview: false,
      getMessage: async (key) => {
        console.warn('⚠️ getMessage called for unknown message:', key.id);
        return null;
      }
    });
    
    // Store socket instance globally
    sockInstance = sock;
    
  } catch (err) {
    console.error('❌ Failed to initialize socket:', err);
    // Enhanced retry logic from V2.0
    setTimeout(startBot, 15000);
    return;
  }

  // Start pairing code cleanup
  startPairingCodeCleanup();

  sock.ev.on('creds.update', saveCreds);

  // Use enhanced connection update handler
  sock.ev.on('connection.update', (update) => {
    handleConnectionUpdate(update, sock, config).catch(err => {
      console.error('❌ Connection update handler error:', err);
    });
  });

  loadContactsFromFile();

  // Setup message handlers using modular approach from V2.0
  setupMessageHandlers(sock, config);

  return sock;
}

// Enhanced QR Code & Pairing HTML page (keeping V1.0 branding)
function getAuthPage() {
  const hasQR = !!qrCode;
  const hasPairingCode = !!pairingCode;
  const isConnecting = global.botStatus === 'connecting' || global.botStatus === 'reconnecting';
  
  clearExpiredPairingCode();
  
  return `
<!DOCTYPE html>
<html>
<head>
    <title>Desire eXe Bot - Authentication</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            margin: 0;
            padding: 20px;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            color: #333;
        }
        
        .container {
            background: white;
            padding: 40px;
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 500px;
            width: 100%;
            position: relative;
            overflow: hidden;
        }
        
        .container::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(90deg, #667eea, #764ba2);
        }
        
        h1 {
            color: #2d3748;
            margin-bottom: 10px;
            font-size: 2.2em;
            font-weight: 700;
        }
        
        .subtitle {
            color: #718096;
            margin-bottom: 30px;
            font-size: 1.1em;
        }
        
        .status {
            padding: 15px;
            border-radius: 12px;
            margin: 20px 0;
            font-weight: 600;
            font-size: 1.1em;
            border: 2px solid;
            transition: all 0.3s ease;
        }
        
        .qr-pending {
            background: #fff3cd;
            color: #856404;
            border-color: #ffeaa7;
        }
        
        .pairing-pending {
            background: #d1ecf1;
            color: #0c5460;
            border-color: #bee5eb;
        }
        
        .connected {
            background: #d4edda;
            color: #155724;
            border-color: #c3e6cb;
        }
        
        .connecting {
            background: #fff3cd;
            color: #856404;
            border-color: #ffeaa7;
        }
        
        .auth-method {
            background: #f8f9fa;
            border-radius: 15px;
            padding: 25px;
            margin: 25px 0;
            border: 2px dashed #dee2e6;
        }
        
        .method-title {
            font-size: 1.3em;
            font-weight: 600;
            margin-bottom: 15px;
            color: #2d3748;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
        }
        
        .qr-image {
            max-width: 250px;
            margin: 20px auto;
            border: 3px solid #e9ecef;
            border-radius: 12px;
            padding: 15px;
            background: white;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        }
        
        .pairing-code {
            font-size: 2.5em;
            font-weight: 800;
            color: #2d3748;
            background: linear-gradient(135deg, #667eea, #764ba2);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin: 15px 0;
            letter-spacing: 5px;
            padding: 10px;
            border: 3px dashed #e9ecef;
            border-radius: 10px;
        }
        
        .phone-number {
            font-size: 1.2em;
            color: #4a5568;
            margin: 10px 0;
            font-weight: 600;
        }
        
        .instructions {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 12px;
            margin: 20px 0;
            text-align: left;
            border-left: 4px solid #667eea;
        }
        
        .instructions h3 {
            color: #2d3748;
            margin-bottom: 15px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .instructions ol {
            margin: 10px 0;
            padding-left: 20px;
        }
        
        .instructions li {
            margin-bottom: 12px;
            line-height: 1.5;
        }
        
        .form-group {
            margin: 20px 0;
            text-align: left;
        }
        
        .form-label {
            display: block;
            margin-bottom: 8px;
            font-weight: 600;
            color: #2d3748;
        }
        
        .form-input {
            width: 100%;
            padding: 15px;
            border: 2px solid #e2e8f0;
            border-radius: 10px;
            font-size: 16px;
            transition: all 0.3s ease;
        }
        
        .form-input:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        
        .btn {
            display: inline-block;
            padding: 15px 30px;
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            text-decoration: none;
            border-radius: 10px;
            margin: 10px 5px;
            font-weight: 600;
            border: none;
            cursor: pointer;
            transition: all 0.3s ease;
            font-size: 16px;
        }
        
        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
        }
        
        .btn-secondary {
            background: #6c757d;
        }
        
        .btn-secondary:hover {
            background: #545b62;
        }
        
        .btn-success {
            background: #28a745;
        }
        
        .btn-success:hover {
            background: #218838;
        }
        
        .nav-buttons {
            display: flex;
            justify-content: center;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 25px;
        }
        
        .countdown {
            font-size: 0.9em;
            color: #e53e3e;
            font-weight: 600;
            margin-top: 10px;
        }
        
        .loader {
            border: 3px solid #f3f3f3;
            border-top: 3px solid #667eea;
            border-radius: 50%;
            width: 30px;
            height: 30px;
            animation: spin 1s linear infinite;
            margin: 10px auto;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        .method-tabs {
            display: flex;
            margin-bottom: 20px;
            background: #f8f9fa;
            border-radius: 12px;
            padding: 5px;
        }
        
        .method-tab {
            flex: 1;
            padding: 12px;
            text-align: center;
            cursor: pointer;
            border-radius: 8px;
            font-weight: 600;
            transition: all 0.3s ease;
        }
        
        .method-tab.active {
            background: white;
            color: #667eea;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        
        .hidden {
            display: none;
        }
        
        .footer {
            margin-top: 25px;
            font-size: 12px;
            color: #a0aec0;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🤖 Desire-eXe V1.0</h1>
        <div class="subtitle">Secure WhatsApp Bot Authentication</div>
        
        <div class="status ${isConnecting ? 'connecting' : hasQR ? 'qr-pending' : hasPairingCode ? 'pairing-pending' : 'connected'}">
            ${isConnecting ? '🔄 Connecting to WhatsApp...' : 
              hasQR ? '📱 QR Code Ready - Scan to Connect' : 
              hasPairingCode ? '🔢 Pairing Code Ready - Enter on Phone' : 
              '✅ Bot Connected - No Authentication Needed'}
        </div>
        
        <div class="method-tabs">
            <div class="method-tab ${!hasPairingCode ? 'active' : ''}" onclick="showMethod('qr')">QR Code</div>
            <div class="method-tab ${hasPairingCode ? 'active' : ''}" onclick="showMethod('pairing')">Pairing Code</div>
        </div>
        
        <!-- QR Code Method -->
        <div id="qrMethod" class="auth-method ${hasPairingCode ? 'hidden' : ''}">
            <div class="method-title">
                <span>📱 QR Code Authentication</span>
            </div>
            
            ${hasQR ? `
            <div class="qr-image">
                <img src="${qrCodeImage}" alt="WhatsApp QR Code" style="width: 100%;">
            </div>
            
            <div class="instructions">
                <h3>📲 How to Connect with QR Code:</h3>
                <ol>
                    <li>Open WhatsApp on your phone</li>
                    <li>Tap <strong>Settings</strong> → <strong>Linked Devices</strong></li>
                    <li>Tap <strong>Link a Device</strong></li>
                    <li>Scan the QR code above</li>
                    <li>Wait for connection confirmation</li>
                </ol>
            </div>
            
            <p><strong>⏰ QR Code expires in 2 minutes</strong></p>
            ` : `
            <div style="padding: 40px 20px;">
                <div style="font-size: 48px; margin-bottom: 20px;">📵</div>
                <h3>No QR Code Available</h3>
                <p>QR code will appear automatically when needed, or try the pairing code method.</p>
            </div>
            `}
        </div>
        
        <!-- Pairing Code Method -->
        <div id="pairingMethod" class="auth-method ${!hasPairingCode ? 'hidden' : ''}">
            <div class="method-title">
                <span>🔢 Pairing Code Authentication</span>
            </div>
            
            ${hasPairingCode ? `
            <div class="phone-number">
                📱 For: ${pairingPhoneNumber}
            </div>
            
            <div class="pairing-code">
                ${pairingCode}
            </div>
            
            <div class="instructions">
                <h3>📲 How to Connect with Pairing Code:</h3>
                <ol>
                    <li>Open WhatsApp on your phone</li>
                    <li>Tap <strong>Settings</strong> → <strong>Linked Devices</strong></li>
                    <li>Tap <strong>Link a Device</strong></li>
                    <li>Tap <strong>Link with phone number</strong></li>
                    <li>Enter the pairing code shown above</li>
                    <li>Wait for connection confirmation</li>
                </ol>
            </div>
            
            <p class="countdown">⏰ Code expires in <span id="countdown">2:00</span></p>
            ` : `
            <div style="padding: 20px 0;">
                <form id="pairingForm" onsubmit="requestPairingCode(event)">
                    <div class="form-group">
                        <label class="form-label" for="phoneNumber">Enter Your WhatsApp Number:</label>
                        <input type="tel" class="form-input" id="phoneNumber" 
                               placeholder="+1234567890" required
                               pattern="^\+?[\\d\\s-()]+$">
                        <small style="color: #718096; margin-top: 5px; display: block;">
                            Include country code (e.g., +1 for US, +44 for UK, +234 for Nigeria)
                        </small>
                    </div>
                    <button type="submit" class="btn btn-success" style="width: 100%;">
                        🔢 Generate Pairing Code
                    </button>
                </form>
            </div>
            `}
        </div>
        
        <div class="nav-buttons">
            <a href="/status" class="btn btn-secondary">Status</a>
            <a href="/session" class="btn btn-secondary">Session Info</a>
            <a href="/health" class="btn btn-secondary">Health Check</a>
            ${hasQR || hasPairingCode ? '<a href="/auth" class="btn">🔄 Refresh</a>' : ''}
        </div>
        
        <div class="footer">
            Bot Uptime: ${getUptimeString()} | Desire-eXe V1.0
        </div>
    </div>
    
    <script>
        function showMethod(method) {
            document.getElementById('qrMethod').classList.toggle('hidden', method !== 'qr');
            document.getElementById('pairingMethod').classList.toggle('hidden', method !== 'pairing');
            
            document.querySelectorAll('.method-tab').forEach(tab => {
                tab.classList.toggle('active', 
                    (method === 'qr' && tab.textContent.includes('QR')) ||
                    (method === 'pairing' && tab.textContent.includes('Pairing'))
                );
            });
        }
        
        async function requestPairingCode(event) {
            event.preventDefault();
            
            const phoneNumber = document.getElementById('phoneNumber').value;
            const button = event.target.querySelector('button') || event.target;
            const originalText = button.innerHTML;
            
            button.innerHTML = '<div class="loader"></div> Generating...';
            button.disabled = true;
            
            try {
                const response = await fetch('/auth/pairing', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ phoneNumber })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    // Reload the page to show the pairing code
                    location.reload();
                } else {
                    alert('Error: ' + (result.error || 'Failed to generate pairing code'));
                    button.innerHTML = originalText;
                    button.disabled = false;
                }
            } catch (error) {
                alert('Network error: ' + error.message);
                button.innerHTML = originalText;
                button.disabled = false;
            }
        }
        
        // Countdown timer for pairing code
        ${hasPairingCode ? `
        let timeLeft = 120; // 2 minutes in seconds
        const countdownElement = document.getElementById('countdown');
        
        const countdown = setInterval(() => {
            timeLeft--;
            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;
            countdownElement.textContent = minutes + ':' + seconds.toString().padStart(2, '0');
            
            if (timeLeft <= 0) {
                clearInterval(countdown);
                location.reload();
            }
        }, 1000);
        ` : ''}
        
        // Auto-refresh every 30 seconds if authentication is pending
        ${hasQR || hasPairingCode ? `
        setTimeout(() => {
            location.reload();
        }, 30000);
        ` : ''}
        
        // Show appropriate method based on what's available
        window.addEventListener('load', () => {
            ${hasPairingCode ? "showMethod('pairing');" : "showMethod('qr');"}
        });
    </script>
</body>
</html>
  `;
}




// Export functions for use in app.js
module.exports = { 
  startBot, 
  getAuthPage, 
  getQRCode: () => ({ 
    qrCode, 
    qrCodeImage, 
    isConnected, 
    pairingCode, 
    pairingPhoneNumber,
    botStatus: global.botStatus,
    uptime: getUptimeString()
  }),
  requestPairingCode: (phoneNumber) => requestPairingCode(sockInstance, phoneNumber),
  getSock: () => sockInstance,
  getUptimeString,
  getBotStatus: () => global.botStatus
};
