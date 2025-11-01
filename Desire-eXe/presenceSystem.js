const fs = require('fs').promises;
const path = require('path');

// File to store active presence states
const PRESENCE_STORAGE_FILE = path.join(__dirname, 'active_presence.json');

// Load active presence from file
const loadActivePresence = async () => {
    try {
        const data = await fs.readFile(PRESENCE_STORAGE_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // File doesn't exist or is invalid
        return {};
    }
};

// Save active presence to file
const saveActivePresence = async (activePresenceChats) => {
    try {
        const data = JSON.stringify(Array.from(activePresenceChats.entries()));
        await fs.writeFile(PRESENCE_STORAGE_FILE, data, 'utf8');
    } catch (error) {
        console.error('Error saving presence data:', error);
    }
};

const activePresenceChats = new Map(); // Tracks active presence per chat
const presenceIntervals = new Map(); // Stores interval IDs

// Helper function to manage presence updates
const managePresence = async (sock, chatId, type, enable) => {
    try {
        const presenceKey = `${chatId}_${type}`;
        
        if (enable) {
            // Send immediate presence update
            await sock.sendPresenceUpdate(type, chatId);
            
            // Set up recurring updates (every 15 seconds)
            const interval = setInterval(async () => {
                await sock.sendPresenceUpdate(type, chatId);
            }, 15000);
            
            // Store references
            activePresenceChats.set(presenceKey, true);
            presenceIntervals.set(presenceKey, interval);
            
            // Save to file
            await saveActivePresence(activePresenceChats);
            
            console.log(`Enabled ${type} in ${chatId}`);
        } else {
            // Clear presence
            await sock.sendPresenceUpdate('paused', chatId);
            
            // Clean up interval if exists
            if (presenceIntervals.has(presenceKey)) {
                clearInterval(presenceIntervals.get(presenceKey));
                presenceIntervals.delete(presenceKey);
            }
            
            activePresenceChats.delete(presenceKey);
            
            // Save to file
            await saveActivePresence(activePresenceChats);
            
            console.log(`Disabled ${type} in ${chatId}`);
        }
    } catch (error) {
        console.error(`Presence error in ${chatId}:`, error);
    }
};

// Restore all active presence indicators when bot starts
const restoreActivePresence = async (sock) => {
    try {
        const savedPresence = await loadActivePresence();
        const activePresenceArray = Array.isArray(savedPresence) ? savedPresence : [];
        
        console.log(`Restoring ${activePresenceArray.length} active presence indicators...`);
        
        for (const [presenceKey, _] of activePresenceArray) {
            const [chatId, type] = presenceKey.split('_');
            
            if (chatId && type) {
                // Start the presence indicator again
                await managePresence(sock, chatId, type, true);
                console.log(`Restored ${type} presence for ${chatId}`);
            }
        }
        
        console.log('Presence restoration completed');
    } catch (error) {
        console.error('Error restoring presence:', error);
    }
};

// Helper to get sender safely
const getSenderNumber = (msg) => {
    const senderJid = msg.key.participant || msg.key.remoteJid;
    return senderJid.split('@')[0]; // remove WhatsApp suffix
};

module.exports = {
    managePresence,
    restoreActivePresence,
    activePresenceChats,
    getSenderNumber
};
