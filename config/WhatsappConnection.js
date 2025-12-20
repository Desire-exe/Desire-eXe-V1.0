// Request pairing code - FIXED for V1
async function requestPairingCode(phoneNumber) {
  try {
    console.log(`📱 Requesting pairing code for: ${phoneNumber}`);
    
    // Check if socket is available
    if (!sockInstance) {
      return {
        success: false,
        error: 'Bot is not initialized yet. Please wait a moment and try again.'
      };
    }
    
    // Validate phone number format
    const cleanNumber = phoneNumber.replace(/[^\d+]/g, '');
    if (!cleanNumber.match(/^\+?[\d\s-()]+$/)) {
      throw new Error('Invalid phone number format');
    }
    
    // Ensure phone number has + prefix
    const formattedNumber = cleanNumber.startsWith('+') ? cleanNumber : `+${cleanNumber}`;
    
    console.log(`🔍 Attempting to generate pairing code for: ${formattedNumber}`);
    
    // Check if socket has requestPairingCode method
    if (!sockInstance.requestPairingCode) {
      return {
        success: false,
        error: 'Pairing code feature not available in this version. Please use QR code instead.'
      };
    }
    
    // Try to generate pairing code
    const code = await sockInstance.requestPairingCode(formattedNumber);
    
    if (!code || typeof code !== 'string') {
      throw new Error('Invalid pairing code received');
    }
    
    // Store pairing info
    pairingCode = code;
    pairingPhoneNumber = cleanNumber;
    pairingCodeExpiry = Date.now() + (2 * 60 * 1000); // 2 minutes expiry
    
    console.log(`✅ Pairing code generated: ${code} for ${cleanNumber}`);
    console.log(`⏰ Code expires at: ${new Date(pairingCodeExpiry).toLocaleTimeString()}`);
    
    return {
      success: true,
      code: code,
      phoneNumber: cleanNumber,
      expiresAt: new Date(pairingCodeExpiry).toISOString(),
      message: 'Pairing code generated successfully'
    };
  } catch (error) {
    console.error('❌ Failed to generate pairing code:', error);
    
    // Better error messages for V1
    let errorMessage = error.message;
    let suggestion = 'Please try using QR code authentication instead.';
    
    if (error.message.includes('not authenticated') || error.message.includes('not connected')) {
      errorMessage = 'Bot socket is still initializing. Please wait a moment and try again, or use QR code.';
      suggestion = 'Try refreshing the page and generating the code again.';
    }
    
    if (error.message.includes('timed out')) {
      errorMessage = 'Request timed out. The bot may be busy connecting.';
      suggestion = 'Wait for bot to stabilize and try again.';
    }
    
    return {
      success: false,
      error: errorMessage,
      suggestion: suggestion
    };
  }
}

// Also update the connection update handler to set sockInstance properly
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
    console.log('🔑 Pairing code is also available as an alternative');
    
    // Store socket instance for pairing code generation
    if (sock && !sockInstance) {
      sockInstance = sock;
      console.log('📡 Socket stored for pairing code access');
    }
    
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
    sockInstance = sock; // Store the socket globally
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
    
    // Store the socket even when connecting, so we can generate pairing codes
    if (sock && !sockInstance) {
      sockInstance = sock;
      console.log('📡 Socket stored for pairing code generation');
    }
  }
}

// Also update the main bot function to set sockInstance immediately
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

  // Check if session exists
  const sessionExists = fs.existsSync(AUTH_DIR);
  console.log(`🔍 Session check: ${sessionExists ? 'Found existing session' : 'No session found'}`);

  let state, saveCreds;
  try {
    ({ state, saveCreds } = await useMultiFileAuthState(AUTH_DIR));
  } catch (error) {
    console.error('❌ Failed to load auth state:', error);
    // Clear corrupted session
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
      
      // Enhanced connection options
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
    
    // Store socket instance globally IMMEDIATELY
    sockInstance = sock;
    console.log('📡 Socket initialized and stored for pairing code access');
    
  } catch (err) {
    console.error('❌ Failed to initialize socket:', err);
    sockInstance = null; // Reset socket
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

  // Setup message handlers
  setupMessageHandlers(sock, config);

  return sock;
}

// Also update the export at the bottom
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
  requestPairingCode: (phoneNumber) => requestPairingCode(phoneNumber), // Fixed: removed sock parameter
  getSock: () => sockInstance,
  getUptimeString,
  getBotStatus: () => global.botStatus
};
