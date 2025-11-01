// Imports
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require('@whiskeysockets/baileys');
const P = require('pino');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode'); // Add QR code generation
const MessageHandler = require('../controllers/Message');
const { restoreActivePresence } = require('../presenceSystem');
const delay = ms => new Promise(res => setTimeout(res, ms));

// File paths - consistent for Koyeb
const AUTH_DIR = './auth_info';
const CONTACT_FILE = './Desire_contact.json';
const CONFIG_FILE = './config.json';
const BUG_LOG = './buglog.json';

let contactList = [];
let botStartTime = null;
let isConnected = false;
let qrCode = null;
let qrCodeImage = null; // Store QR as image data

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
  const patterns = [
    /[\u200B-\u200F\u202A-\u202E\u2060]/,
    /(.+)\1{100,}/,
    /.{6000,}/,
    /[\uFFF9-\uFFFF]/,
  ];
  return patterns.some(p => p.test(text));
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
  return jid && (jid.endsWith('@newsletter') || jid.includes('@newsletter') || jid.includes('broadcast'));
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
    const qrImage = await qrcode.toDataURL(qr);
    return qrImage;
  } catch (error) {
    console.error('❌ Failed to generate QR image:', error);
    return null;
  }
}

// QR Code HTML page
function getQRPage() {
  return `
<!DOCTYPE html>
<html>
<head>
    <title>Desire eXe Bot - QR Code</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body {
            font-family: Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            margin: 0;
            padding: 20px;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
        }
        .container {
            background: white;
            padding: 40px;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            text-align: center;
            max-width: 400px;
            width: 100%;
        }
        h1 {
            color: #333;
            margin-bottom: 10px;
        }
        .status {
            padding: 10px;
            border-radius: 5px;
            margin: 15px 0;
            font-weight: bold;
        }
        .qr-pending {
            background: #fff3cd;
            color: #856404;
            border: 1px solid #ffeaa7;
        }
        .connected {
            background: #d1ecf1;
            color: #0c5460;
            border: 1px solid #bee5eb;
        }
        .qr-image {
            max-width: 300px;
            margin: 20px auto;
            border: 2px solid #ddd;
            border-radius: 10px;
            padding: 10px;
            background: white;
        }
        .instructions {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
            text-align: left;
        }
        .instructions ol {
            margin: 10px 0;
            padding-left: 20px;
        }
        .instructions li {
            margin-bottom: 8px;
        }
        .btn {
            display: inline-block;
            padding: 10px 20px;
            background: #007bff;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            margin: 5px;
        }
        .btn:hover {
            background: #0056b3;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🤖 Desire-eXe V1.0</h1>
        <div class="status ${qrCode ? 'qr-pending' : 'connected'}">
            ${qrCode ? '📱 QR Code Ready - Scan to Connect' : '✅ Bot Connected - No QR Needed'}
        </div>
        
        ${qrCode ? `
        <div class="qr-image">
            <img src="${qrCodeImage}" alt="WhatsApp QR Code" style="width: 100%;">
        </div>
        
        <div class="instructions">
            <h3>📲 How to Connect:</h3>
            <ol>
                <li>Open WhatsApp on your phone</li>
                <li>Tap <strong>Settings</strong> → <strong>Linked Devices</strong></li>
                <li>Tap <strong>Link a Device</strong></li>
                <li>Scan the QR code above</li>
                <li>Wait for connection confirmation</li>
            </ol>
        </div>
        
        <p><strong>QR Code will expire in 2 minutes</strong></p>
        ` : `
        <div style="font-size: 48px; margin: 20px 0;">✅</div>
        <h2>Bot is Connected!</h2>
        <p>The WhatsApp bot is successfully connected and running.</p>
        `}
        
        <div style="margin-top: 20px;">
            <a href="/status" class="btn">Status</a>
            <a href="/session" class="btn">Session Info</a>
            <a href="/health" class="btn">Health Check</a>
        </div>
        
        <div style="margin-top: 20px; font-size: 12px; color: #666;">
            Bot Uptime: ${getUptimeString()}
        </div>
    </div>
    
    <script>
        // Auto-refresh QR code every 30 seconds if pending
        ${qrCode ? `
        setTimeout(() => {
            location.reload();
        }, 30000);
        ` : ''}
    </script>
</body>
</html>
  `;
}

// Main bot
async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  let sock;

  // Set bot start time
  botStartTime = Date.now();

  // Load config for owner JID - with environment variable fallback
  let config = {
    AUTO_BLOCK_UNKNOWN: false,
    OWNER_JID: process.env.OWNER_JID || '2347017747337@s.whatsapp.net', // YOUR JID WHATSAPP_NUMBER@s.whatsapp.net
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

  try {
    sock = makeWASocket({
      auth: state,
      logger: P({ level: 'warn' }),
      
      // Remove printQRInTerminal since it's deprecated
      // Connection options for Koyeb
      browser: ["Ubuntu", "Chrome", "120.0.0.0"],
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 30000,
      defaultQueryTimeoutMs: 60000,
      retryRequestDelayMs: 1000,
      maxRetries: 5,
      
      emitOwnEvents: true,
      shouldIgnoreJid: jid => {
        return typeof jid === 'string' && (
          jid.endsWith('@bot') || 
          isNewsletterJid(jid)
        );
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
  } catch (err) {
    console.error('❌ Failed to initialize socket:', err);
    setTimeout(startBot, 10000);
    return;
  }

  sock.ev.on('creds.update', saveCreds);

  // Connection update handler
sock.ev.on('connection.update', async (update) => {
  const { connection, lastDisconnect, qr } = update;
  
  // Handle QR Code - Generate web-accessible QR
  if (qr) {
    console.log('📱 QR Code received - generating web QR...');
    qrCode = qr;
    qrCodeImage = await generateQRImage(qr);
    global.botStatus = 'qr_pending';
    isConnected = false;
    
    console.log('🌐 QR Code available at: http://your-app.koyeb.app/qr');
    console.log('📲 Scan the QR code via the web interface to connect');
    
    // Auto-clear QR after 2 minutes
    setTimeout(() => {
      if (!isConnected && qrCode === qr) {
        console.log('⏰ QR Code expired - will generate new one on next connection');
        qrCode = null;
        qrCodeImage = null;
      }
    }, 120000);
  }

  if (connection === 'close') {
    const code = lastDisconnect?.error?.output?.statusCode;
    const errorMessage = lastDisconnect?.error?.message;
    
    console.log('🔌 Connection closed, code:', code, 'Error:', errorMessage);
    isConnected = false;
    qrCode = null;
    qrCodeImage = null;
    
    // FIXED: Handle 428 (Connection Terminated) with auto-reconnect
    if (code === 428 || errorMessage?.includes('Connection Terminated')) {
      console.log('🔄 WhatsApp terminated connection - auto-reconnecting in 10s...');
      global.botStatus = 'reconnecting';
      setTimeout(startBot, 10000);
    }
    else if (code !== DisconnectReason.loggedOut) {
      console.log('⚠️ Connection closed - reconnecting in 10s...');
      global.botStatus = 'reconnecting';
      setTimeout(startBot, 10000);
    } else {
      console.log('🔒 Bot logged out - QR authentication required');
      global.botStatus = 'needs_auth';
    }
  }

  if (connection === 'open') {
    console.log('✅ Desire-eXe V1.0 Is Online!');
    isConnected = true;
    qrCode = null;
    qrCodeImage = null;
    global.botStatus = 'connected';
    global.connectionTime = new Date().toISOString();
    
    await sock.sendPresenceUpdate('available');
    await restoreActivePresence(sock);
    
    // Send connection notification to owner
    await sendConnectionNotification(sock, config);
  }

  if (connection === 'connecting') {
    console.log('🔄 Connecting to WhatsApp...');
    isConnected = false;
    global.botStatus = 'connecting';
  }
});
  loadContactsFromFile();

  // Remove old listeners
  sock.ev.removeAllListeners('messages.upsert');
  sock.ev.removeAllListeners('group-participants.update');

  // Message handler (only when connected)
  sock.ev.on('messages.upsert', async ({ messages }) => {
    if (!isConnected) return;
    
    await delay(100);
    let msg;

    try {
      msg = messages[0];
      const jid = msg.key.remoteJid;
      
      if (isNewsletterJid(jid)) {
        console.log('📰 Ignoring newsletter/channel message from:', jid);
        return;
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

      if (!jid.endsWith('@g.us') && !jid.endsWith('@broadcast') && !isNewsletterJid(jid)) {
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

      if (jid && !jid.endsWith('@g.us') && !isNewsletterJid(jid)) {
        const known = contactList.find(c => c.jid === jid);
        if (!known) {
          if (config.AUTO_BLOCK_UNKNOWN) {
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

      console.log('📩 Message:', msg.message);
      await MessageHandler(sock, messages, contactList);
    } catch (err) {
      console.error('❌ Message handler error:', err);
      if (msg) await sock.sendMessageAck(msg.key);
    }
  });

  // Group participants update handler (only when connected)
  sock.ev.on('group-participants.update', async ({ id, participants, action }) => {
    if (!isConnected) return;
    
    if (isNewsletterJid(id)) {
      console.log('📰 Ignoring newsletter/channel participant update:', id);
      return;
    }
    
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

  return sock;
}

// Export QR code related functions for use in app.js
module.exports = { 
  startBot, 
  getQRPage, 
  getQRCode: () => ({ qrCode, qrCodeImage, isConnected }) 
};

