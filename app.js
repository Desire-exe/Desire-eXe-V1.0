const { startBot, getQRPage, getQRCode, requestPairingCode, clearPairingCode } = require('./config/WhatsappConnection.js');
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

// ✅ Express server setup
const app = express();
const port = process.env.PORT || 8000;

app.use(bodyParser.json());
app.use(express.static('public'));

// Global variables to track bot state
global.botStatus = 'starting';
global.whatsappBot = null;
global.connectionTime = null;
global.lastActivity = new Date();

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
    lastActivity: global.lastActivity
  };
}

// Get pairing code status
function getPairingStatus() {
  const { pairingCode, pairingPhoneNumber } = getQRCode();
  return {
    hasPairingCode: !!pairingCode,
    phoneNumber: pairingPhoneNumber,
    code: pairingCode
  };
}

// ✅ FIXED: Landing Page with proper routing
app.get('/', (req, res) => {
  const sessionInfo = getSessionInfo();
  const { qrCode, qrCodeImage, isConnected } = getQRCode();
  const pairingStatus = getPairingStatus();
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Desire-eXe V1.0 - WhatsApp Bot</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                margin: 0;
                padding: 20px;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                color: white;
            }
            .container {
                background: rgba(255,255,255,0.1);
                padding: 40px;
                border-radius: 20px;
                backdrop-filter: blur(10px);
                max-width: 800px;
                width: 100%;
                text-align: center;
                box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            }
            .logo {
                font-size: 3em;
                margin-bottom: 10px;
            }
            .title {
                font-size: 2.5em;
                margin-bottom: 10px;
                background: linear-gradient(45deg, #fff, #e0e0e0);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
            }
            .subtitle {
                color: #ccc;
                margin-bottom: 30px;
                font-size: 1.2em;
            }
            .status-badge {
                display: inline-block;
                padding: 10px 20px;
                border-radius: 25px;
                font-weight: bold;
                margin: 10px 0;
            }
            .status-connected { background: #4CAF50; }
            .status-disconnected { background: #f44336; }
            .status-waiting { background: #ff9800; }
            .status-pairing { background: #2196F3; }
            .card-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 20px;
                margin: 30px 0;
            }
            .card {
                background: rgba(255,255,255,0.1);
                padding: 20px;
                border-radius: 15px;
                transition: transform 0.3s ease;
                cursor: pointer;
            }
            .card:hover {
                transform: translateY(-5px);
            }
            .card h3 {
                margin-bottom: 10px;
                color: #fff;
            }
            .card p {
                color: #ccc;
                font-size: 0.9em;
            }
            .btn {
                display: inline-block;
                padding: 12px 24px;
                background: #007bff;
                color: white;
                text-decoration: none;
                border-radius: 8px;
                margin: 5px;
                transition: all 0.3s ease;
                border: none;
                cursor: pointer;
                font-size: 1em;
            }
            .btn:hover {
                background: #0056b3;
                transform: translateY(-2px);
            }
            .btn-success { background: #28a745; }
            .btn-success:hover { background: #1e7e34; }
            .btn-warning { background: #ffc107; color: #000; }
            .btn-warning:hover { background: #e0a800; }
            .btn-info { background: #17a2b8; }
            .btn-info:hover { background: #138496; }
            .info-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 15px;
                margin: 20px 0;
                text-align: left;
            }
            .info-item {
                background: rgba(255,255,255,0.05);
                padding: 15px;
                border-radius: 10px;
            }
            .info-label {
                font-weight: bold;
                color: #ccc;
                font-size: 0.9em;
            }
            .info-value {
                color: #fff;
                font-size: 1.1em;
            }
            .pairing-alert {
                background: rgba(33, 150, 243, 0.2);
                border: 2px solid #2196F3;
                padding: 15px;
                border-radius: 10px;
                margin: 20px 0;
            }
            .pairing-code {
                font-size: 1.5em;
                font-weight: bold;
                color: #4CAF50;
                margin: 10px 0;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="logo">🤖</div>
            <h1 class="title">Desire-eXe V1.0</h1>
            <p class="subtitle">Advanced WhatsApp Bot with AI Capabilities</p>
            
            ${pairingStatus.hasPairingCode ? `
            <div class="pairing-alert">
                <h3>🔢 Active Pairing Code</h3>
                <p>Phone: ${pairingStatus.phoneNumber}</p>
                <div class="pairing-code">${pairingStatus.code}</div>
                <p>Enter this code in WhatsApp under "Linked Devices" → "Link with code"</p>
                <a href="/pairing" class="btn btn-info">View Pairing Instructions</a>
            </div>
            ` : ''}
            
            <div class="status-badge ${isConnected ? 'status-connected' : (pairingStatus.hasPairingCode ? 'status-pairing' : 'status-waiting')}">
                ${isConnected ? '✅ CONNECTED' : (pairingStatus.hasPairingCode ? '🔢 WAITING FOR PAIRING' : '⏳ WAITING FOR AUTHENTICATION')}
            </div>
            
            <div class="card-grid">
                <div class="card" onclick="window.location.href='/qr'">
                    <h3>📱 QR Code</h3>
                    <p>Authenticate with QR code scanning</p>
                    <div class="btn">Get QR Code</div>
                </div>
                <div class="card" onclick="window.location.href='/pairing'">
                    <h3>🔢 Pairing Code</h3>
                    <p>Use phone number for authentication</p>
                    <div class="btn btn-warning">Pairing Code</div>
                </div>
                <div class="card" onclick="window.location.href='/status'">
                    <h3>📊 Status</h3>
                    <p>Check bot status and connection info</p>
                    <div class="btn">View Status</div>
                </div>
                <div class="card" onclick="window.location.href='/health'">
                    <h3>🛠️ Health</h3>
                    <p>System health and performance metrics</p>
                    <div class="btn btn-success">Health Check</div>
                </div>
            </div>
            
            <div class="info-grid">
                <div class="info-item">
                    <div class="info-label">Platform</div>
                    <div class="info-value">${process.env.PLATFORM || 'Koyeb Cloud'}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Status</div>
                    <div class="info-value">${global.botStatus}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Uptime</div>
                    <div class="info-value">${Math.floor(process.uptime() / 60)} minutes</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Session</div>
                    <div class="info-value">${sessionInfo.connected ? 'Active' : 'Not Connected'}</div>
                </div>
            </div>
            
            <div style="margin-top: 30px;">
                <p style="color: #ccc; font-size: 0.9em;">
                    🤖 Powered by Desire-eXe V1.0 | 
                    <a href="/bot/info" style="color: #4CAF50; text-decoration: none;">Bot Info</a> | 
                    <a href="/session" style="color: #2196F3; text-decoration: none;">Session</a>
                </p>
            </div>
        </div>
        
        <script>
            // Auto-refresh status every 30 seconds if not connected
            if (!${isConnected}) {
                setTimeout(() => location.reload(), 30000);
            }
            
            // Add smooth animations
            document.addEventListener('DOMContentLoaded', function() {
                const cards = document.querySelectorAll('.card');
                cards.forEach((card, index) => {
                    card.style.animationDelay = (index * 0.1) + 's';
                    card.style.animation = 'fadeInUp 0.6s ease forwards';
                });
            });
        </script>
        <style>
            @keyframes fadeInUp {
                from {
                    opacity: 0;
                    transform: translateY(20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            .card {
                opacity: 0;
            }
        </style>
    </body>
    </html>
  `);
});

// ✅ REMOVED: Authentication Choice Page (no longer needed)
// Directly route to pairing page instead

// ✅ FIXED: Direct Pairing Code Interface
app.get('/pairing', (req, res) => {
  const pairingStatus = getPairingStatus();
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Pairing Code - Desire-eXe V1.0</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                margin: 0;
                padding: 20px;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                color: white;
            }
            .container {
                background: rgba(255,255,255,0.1);
                padding: 40px;
                border-radius: 20px;
                backdrop-filter: blur(10px);
                max-width: 500px;
                width: 100%;
                text-align: center;
            }
            input, button {
                width: 100%;
                padding: 15px;
                margin: 10px 0;
                border: 2px solid rgba(255,255,255,0.2);
                border-radius: 10px;
                background: rgba(255,255,255,0.1);
                color: white;
                font-size: 1em;
            }
            input::placeholder { color: #ccc; }
            input:focus {
                outline: none;
                border-color: #007bff;
            }
            button {
                background: #007bff;
                border: none;
                cursor: pointer;
                font-weight: bold;
                transition: all 0.3s ease;
            }
            button:hover {
                background: #0056b3;
                transform: translateY(-2px);
            }
            .pairing-code {
                font-size: 2.5em;
                font-weight: bold;
                color: #4CAF50;
                margin: 20px 0;
                padding: 20px;
                background: rgba(255,255,255,0.1);
                border-radius: 10px;
                border: 2px dashed #4CAF50;
            }
            .instructions {
                background: rgba(255,255,255,0.1);
                padding: 20px;
                border-radius: 10px;
                margin: 20px 0;
                text-align: left;
            }
            .timer {
                color: #ff9800;
                font-weight: bold;
                margin: 10px 0;
            }
            .error-message {
                color: #ff6b6b;
                background: rgba(255,107,107,0.1);
                padding: 10px;
                border-radius: 5px;
                margin: 10px 0;
                border: 1px solid #ff6b6b;
            }
            .success-message {
                color: #4CAF50;
                background: rgba(76,175,80,0.1);
                padding: 10px;
                border-radius: 5px;
                margin: 10px 0;
                border: 1px solid #4CAF50;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🔢 Pairing Code</h1>
            
            ${pairingStatus.hasPairingCode ? `
                <div class="pairing-code">${pairingStatus.code}</div>
                <p class="success-message">✅ Active pairing code for: ${pairingStatus.phoneNumber}</p>
                <div class="timer">⏰ Code expires in 2 minutes</div>
            ` : `
                <p>Enter your phone number to get a pairing code</p>
                <input type="tel" id="phoneNumber" placeholder="Phone number (e.g., 2347017747337)" pattern="[0-9]{10,15}">
                <button onclick="getPairingCode()">Get Pairing Code</button>
            `}
            
            <div id="pairingResult"></div>
            
            <div class="instructions">
                <h3>📋 Instructions:</h3>
                <ol>
                    <li>${pairingStatus.hasPairingCode ? 'You have an active pairing code' : 'Enter your phone number (with country code, no +)'}</li>
                    <li>${pairingStatus.hasPairingCode ? 'Use the code shown above' : 'Click "Get Pairing Code"'}</li>
                    <li>Open WhatsApp → Settings → Linked Devices</li>
                    <li>Tap "Link a Device" → "Link with phone number"</li>
                    <li>${pairingStatus.hasPairingCode ? `Enter phone number: ${pairingStatus.phoneNumber}` : 'Enter your phone number'}</li>
                    <li>Enter the 6-digit pairing code</li>
                    <li>Wait for connection confirmation</li>
                </ol>
            </div>
            
            <div style="margin-top: 20px;">
                <a href="/" style="color: #ccc; text-decoration: none;">← Back to Home</a>
                ${pairingStatus.hasPairingCode ? `
                <button onclick="clearPairingCode()" style="background: #dc3545; margin-left: 10px;">Clear Code</button>
                ` : ''}
            </div>
        </div>
        
        <script>
            async function getPairingCode() {
                const phoneInput = document.getElementById('phoneNumber');
                const phoneNumber = phoneInput.value.trim();
                const resultDiv = document.getElementById('pairingResult');
                
                if (!phoneNumber) {
                    resultDiv.innerHTML = '<div class="error-message">Please enter a phone number</div>';
                    return;
                }
                
                if (!/^[0-9]{10,15}$/.test(phoneNumber)) {
                    resultDiv.innerHTML = '<div class="error-message">Please enter a valid phone number (10-15 digits)</div>';
                    return;
                }
                
                resultDiv.innerHTML = '<div class="success-message">🔄 Requesting pairing code from WhatsApp...</div>';
                
                try {
                    const response = await fetch('/api/pairing-code', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ phoneNumber })
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                        // Reload to show the new pairing code
                        location.reload();
                    } else {
                        resultDiv.innerHTML = \`<div class="error-message">❌ \${data.error}</div>\`;
                    }
                } catch (error) {
                    resultDiv.innerHTML = \`<div class="error-message">❌ Error: \${error.message}</div>\`;
                }
            }
            
            async function clearPairingCode() {
                try {
                    const response = await fetch('/api/clear-pairing', {
                        method: 'POST'
                    });
                    location.reload();
                } catch (error) {
                    alert('Error clearing pairing code: ' + error.message);
                }
            }
            
            // Auto-refresh if there's an active pairing code
            ${pairingStatus.hasPairingCode ? `
            setTimeout(() => {
                location.reload();
            }, 30000);
            ` : `
            // Auto-focus on input
            document.getElementById('phoneNumber').focus();
            `}
        </script>
    </body>
    </html>
  `);
});

// ✅ FIXED: API endpoint for pairing codes
app.post('/api/pairing-code', async (req, res) => {
  const { phoneNumber } = req.body;
  
  if (!phoneNumber) {
    return res.json({ success: false, error: 'Phone number is required' });
  }
  
  if (!/^[0-9]{10,15}$/.test(phoneNumber)) {
    return res.json({ success: false, error: 'Please enter a valid phone number (10-15 digits)' });
  }
  
  try {
    // Use the actual requestPairingCode function that calls WhatsApp's API
    const code = await requestPairingCode(phoneNumber);
    
    res.json({ 
      success: true, 
      code: code,
      message: 'Pairing code generated successfully'
    });
  } catch (error) {
    console.error('❌ Pairing request error:', error);
    res.json({ success: false, error: error.message });
  }
});

// ✅ API endpoint to clear pairing code
app.post('/api/clear-pairing', async (req, res) => {
  try {
    clearPairingCode();
    res.json({ success: true, message: 'Pairing code cleared' });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// ✅ QR Code Page
app.get('/qr', (req, res) => {
  res.send(getQRPage());
});

// ✅ Health Check Endpoint
app.get('/health', (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    botStatus: global.botStatus,
    lastActivity: global.lastActivity,
    platform: process.env.PLATFORM || 'unknown'
  };
  
  res.json(health);
});

// ✅ Status Endpoint
app.get('/status', (req, res) => {
  const sessionInfo = getSessionInfo();
  const { qrCode, qrCodeImage, isConnected } = getQRCode();
  const pairingStatus = getPairingStatus();
  
  const status = {
    bot: {
      status: global.botStatus,
      connected: isConnected,
      connectionTime: global.connectionTime,
      lastActivity: global.lastActivity
    },
    session: sessionInfo,
    authentication: {
      qrCode: !!qrCode,
      pairingCode: pairingStatus.hasPairingCode,
      pairingPhone: pairingStatus.phoneNumber
    },
    system: {
      uptime: process.uptime(),
      platform: process.env.PLATFORM || 'unknown',
      nodeVersion: process.version
    }
  };
  
  res.json(status);
});

// ✅ Bot Info Endpoint
app.get('/bot/info', (req, res) => {
  const info = {
    name: 'Desire-eXe V1.0',
    version: '1.0.0',
    description: 'Advanced WhatsApp Bot with AI Capabilities',
    features: [
      'QR Code Authentication',
      'Pairing Code Authentication', 
      'Group Management',
      'AI-Powered Responses',
      'Multi-Device Support'
    ],
    endpoints: [
      '/ - Home',
      '/qr - QR Code',
      '/pairing - Pairing Code',
      '/status - Status',
      '/health - Health Check'
    ]
  };
  
  res.json(info);
});

// ✅ Session Info Endpoint
app.get('/session', (req, res) => {
  res.json(getSessionInfo());
});

// ✅ Enhanced initialization with better error handling
async function initializeApp() {
  try {
    console.log('🚀 Starting Desire-eXe V1.0...');
    console.log('📦 Platform:', process.env.PLATFORM || 'Koyeb Cloud');
    console.log('🌐 Environment:', process.env.NODE_ENV || 'development');
    
    // Start WhatsApp bot first
    const sock = await startBot();
    global.whatsappBot = sock;
    global.lastActivity = new Date();
    
    console.log('✅ WhatsApp bot initialization complete');
    
    // Start Express server
    const server = app.listen(port, '0.0.0.0', () => {
      console.log(`🚀 Express server running on port ${port}`);
      
      const baseUrl = process.env.KOYEB_APP_DOMAIN 
        ? `https://${process.env.KOYEB_APP_DOMAIN}`
        : `http://localhost:${port}`;
      
      console.log('🔗 Available Endpoints:');
      console.log(`   🏠 Home: ${baseUrl}/`);
      console.log(`   📱 QR Code: ${baseUrl}/qr`);
      console.log(`   🔢 Pairing: ${baseUrl}/pairing`);
      console.log(`   📊 Status: ${baseUrl}/status`);
      console.log(`   🩺 Health: ${baseUrl}/health`);
      console.log(`   🤖 Bot Info: ${baseUrl}/bot/info`);
      console.log(`   🔄 Session: ${baseUrl}/session`);
    });

    // Enhanced graceful shutdown
    const gracefulShutdown = (signal) => {
      console.log(`\n👋 Received ${signal}, shutting down gracefully...`);
      global.botStatus = 'shutting_down';
      
      server.close(() => {
        console.log('✅ Express server closed');
        console.log('👋 Desire-eXe V1.0 stopped gracefully');
        process.exit(0);
      });
      
      // Force close after 10 seconds
      setTimeout(() => {
        console.log('⚠️ Forcing shutdown...');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (err) {
    console.error('❌ Failed to start bot:', err);
    global.botStatus = 'failed';
    
    // Auto-restart with backoff
    const restartDelay = 10000;
    console.log(`🔄 Auto-restarting in ${restartDelay/1000} seconds...`);
    setTimeout(initializeApp, restartDelay);
  }
}

// Enhanced error handling
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error.message);
  global.botStatus = 'error';
  global.lastActivity = new Date();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection:', reason);
  global.botStatus = 'error';
  global.lastActivity = new Date();
});

// Enhanced keep-alive with activity tracking
setInterval(() => {
  global.lastActivity = new Date();
  
  if (global.whatsappBot && global.botStatus === 'connected') {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    
    console.log(`❤️ Keep-alive | Status: ${global.botStatus} | Uptime: ${hours}h ${minutes}m`);
  }
}, 60000);

// Start the application
initializeApp();

console.log('🔄 app.js loaded with fixed routing and pairing code features');
