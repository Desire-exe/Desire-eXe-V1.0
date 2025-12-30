// ====================== shazam.js ======================
// Main music API module for Desire-eXe bot
// Integrates ACRCloud (audio) + Last.fm (metadata) + Lyrics.ovh (full lyrics)
const crypto = require('crypto');
const axios = require('axios');

// ====================== CONFIGURATION ======================
const ACR_ACCESS_KEY = 'f0bae141570ea97f07e5aca0746553bc';
const ACR_ACCESS_SECRET = '0cOLR02YvpSKinXBVi8mZ8QbCTpdutm8bKn7U9Uz';
const ACR_ENDPOINT = 'https://identify-eu-west-1.acrcloud.com/v1/identify';
const LASTFM_API_KEY = 'aa8e157f2e69f4a83204b686ab987484';
const LASTFM_BASE_URL = 'http://ws.audioscrobbler.com/2.0/';

// ====================== 1. ACRCLOUD AUDIO RECOGNITION ======================
async function recognizeSong(audioBuffer, filename = 'audio.mp3') {
    console.log(`[ACRCloud] Starting recognition for ${filename} (${audioBuffer.length} bytes)`);
   
    try {
        const http_method = 'POST';
        const endpoint = '/v1/identify';
        const data_type = 'audio';
        const signature_version = '1';
        const timestamp = Math.floor(Date.now() / 1000);
        const stringToSign = http_method + "\n" +
                            endpoint + "\n" +
                            ACR_ACCESS_KEY + "\n" +
                            data_type + "\n" +
                            signature_version + "\n" +
                            timestamp;
        const signature = crypto.createHmac('sha1', ACR_ACCESS_SECRET)
                               .update(stringToSign)
                               .digest('base64');

        const FormData = require('form-data');
        const form = new FormData();
        form.append('sample', audioBuffer, {
            filename: 'recording.mp3',
            contentType: 'audio/mpeg'
        });
        form.append('access_key', ACR_ACCESS_KEY);
        form.append('data_type', data_type);
        form.append('signature_version', signature_version);
        form.append('signature', signature);
        form.append('timestamp', timestamp.toString());

        const response = await axios.post(ACR_ENDPOINT, form, {
            headers: form.getHeaders(),
            timeout: 10000
        });
        const result = response.data;

        if (result.status.code === 0) {
            const music = result.metadata?.music?.[0];
            if (music) {
                const title = music.title || 'Unknown Title';
                const artist = music.artists?.[0]?.name || 'Unknown Artist';
               
                return {
                    success: true,
                    title: title,
                    artist: artist,
                    album: music.album?.name || 'Unknown Album',
                    releaseDate: music.release_date || 'Unknown',
                    label: music.label || 'Unknown Label',
                    timecode: `${Math.floor(music.play_offset_ms / 1000)}s`,
                    spotify: {
                        url: `https://open.spotify.com/search/${encodeURIComponent(title + ' ' + artist)}`
                    },
                    appleMusic: {
                        url: `https://music.apple.com/search?term=${encodeURIComponent(title + ' ' + artist)}`
                    },
                    youtube: `https://youtube.com/results?search_query=${encodeURIComponent(title + ' ' + artist)}`,
                    lyrics: await getLyricsPreview(title, artist),
                    acrId: music.acrid,
                    score: music.score
                };
            }
        }
       
        return {
            success: false,
            error: result.status?.msg || 'No music detected in audio'
        };
       
    } catch (error) {
        console.error('[ACRCloud Error]:', error.message);
        return {
            success: false,
            error: error.message || 'ACRCloud request failed'
        };
    }
}

// ====================== 2. LAST.FM TEXT SERVICES ======================
async function getLyrics(trackName, artistName = '') {
    console.log(`[Last.fm] Getting info for: "${trackName}" by "${artistName}"`);
   
    try {
        const params = new URLSearchParams({
            method: 'track.getInfo',
            api_key: LASTFM_API_KEY,
            track: trackName,
            artist: artistName,
            format: 'json'
        });
        const response = await axios.get(`${LASTFM_BASE_URL}?${params.toString()}`, {
            headers: { 'User-Agent': 'Desire-eXe-Bot/1.0' },
            timeout: 5000
        });
        const data = response.data;
        if (data.error) {
            return { success: false, error: `Last.fm: ${data.message}` };
        }
        const track = data.track;
        const cleanSummary = track.wiki?.summary
            ? track.wiki.summary.replace(/<[^>]*>/g, '').substring(0, 500)
            : null;

        return {
            success: true,
            title: track.name,
            artist: track.artist?.name || artistName,
            album: track.album?.title,
            duration: track.duration ? `${Math.floor(track.duration / 1000)}s` : 'Unknown',
            listeners: track.listeners,
            playcount: track.playcount,
            summary: cleanSummary,
            url: track.url,
            source: 'Last.fm'
        };
    } catch (error) {
        console.error('[Last.fm Error]:', error.message);
        return { success: false, error: `Last.fm request failed: ${error.message}` };
    }
}

async function getLyricsPreview(title, artist) {
    try {
        const trackInfo = await getLyrics(title, artist);
        if (trackInfo.success && trackInfo.summary) {
            return trackInfo.summary.substring(0, 100) + '...';
        }
    } catch (error) {}
    return null;
}

async function searchLyrics(query) {
    console.log(`[Last.fm Search]: "${query}"`);
    try {
        const params = new URLSearchParams({
            method: 'track.search',
            api_key: LASTFM_API_KEY,
            track: query,
            format: 'json',
            limit: 5
        });
        const response = await axios.get(`${LASTFM_BASE_URL}?${params.toString()}`, {
            headers: { 'User-Agent': 'Desire-eXe-Bot/1.0' },
            timeout: 5000
        });
        const data = response.data;
       
        if (data.error) return { success: false, error: data.message };
        
        const results = data.results?.trackmatches?.track || [];
        return {
            success: true,
            results: results.map(track => ({
                title: track.name,
                artist: track.artist,
                url: track.url
            }))
        };
    } catch (error) {
        console.error('[Last.fm Search Error]:', error.message);
        return { success: false, error: error.message };
    }
}

// ====================== 3. FULL LYRICS FROM LYRICS.OVH ======================
async function getFullLyrics(artist, title) {
    try {
        const normalizedArtist = encodeURIComponent(artist.trim());
        const normalizedTitle = encodeURIComponent(title.trim());
        const url = `https://api.lyrics.ovh/v1/${normalizedArtist}/${normalizedTitle}`;
        
        const response = await axios.get(url, { timeout: 8000 });
        
        if (response.data.lyrics && response.data.lyrics.trim() !== '') {
            return {
                success: true,
                lyrics: response.data.lyrics.trim(),
                source: 'Lyrics.ovh'
            };
        } else {
            return { success: false, error: 'No lyrics found' };
        }
    } catch (error) {
        if (error.response?.status === 404) {
            return { success: false, error: 'Lyrics not found' };
        }
        return { success: false, error: 'Lyrics service unavailable' };
    }
}

// ====================== 4. ENHANCED SEARCH & INTERACTIVE SYSTEM ======================
const lyricsSessions = new Map();

function storeLyricsSession(userJid, results, query, page = 0) {
    lyricsSessions.set(userJid, {
        results: results,
        page: page,
        query: query,
        timestamp: Date.now()
    });
   
    setTimeout(() => {
        const session = lyricsSessions.get(userJid);
        if (session && Date.now() - session.timestamp > 600000) {
            lyricsSessions.delete(userJid);
        }
    }, 600000);
}

function getLyricsSession(userJid) {
    const session = lyricsSessions.get(userJid);
    if (!session) return null;
    if (Date.now() - session.timestamp > 600000) {
        lyricsSessions.delete(userJid);
        return null;
    }
    return session;
}

function updateSessionPage(userJid, newPage) {
    const session = getLyricsSession(userJid);
    if (session) {
        session.page = newPage;
        session.timestamp = Date.now();
        return true;
    }
    return false;
}

function clearLyricsSession(userJid) {
    return lyricsSessions.delete(userJid);
}

function getPaginatedResults(userJid, page = 0) {
    const session = getLyricsSession(userJid);
    if (!session) return null;
   
    const resultsPerPage = 5;
    const totalPages = Math.ceil(session.results.length / resultsPerPage);
   
    if (page < 0 || page >= totalPages) return null;
   
    const startIdx = page * resultsPerPage;
    const endIdx = Math.min(startIdx + resultsPerPage, session.results.length);
   
    return {
        results: session.results.slice(startIdx, endIdx),
        page: page,
        totalPages: totalPages,
        startIdx: startIdx,
        query: session.query
    };
}

async function enhancedSearchLyrics(query, artist = '') {
    console.log(`[Enhanced Search]: "${query}" by "${artist}"`);
   
    try {
        const searchParams = new URLSearchParams({
            method: 'track.search',
            api_key: LASTFM_API_KEY,
            track: query,
            artist: artist,
            format: 'json',
            limit: 15
        });
        const response = await axios.get(`${LASTFM_BASE_URL}?${searchParams.toString()}`, {
            headers: { 'User-Agent': 'Desire-eXe-Bot/1.0' },
            timeout: 5000
        });
        const data = response.data;
       
        if (data.error) return { success: false, error: data.message };
        
        const results = data.results?.trackmatches?.track || [];
       
        const enhancedResults = results.map(track => ({
            title: track.name,
            artist: track.artist,
            album: 'Unknown Album',
            url: track.url
        }));
       
        return {
            success: true,
            results: enhancedResults,
            total: results.length
        };
    } catch (error) {
        console.error('[Enhanced Search Error]:', error.message);
        return { success: false, error: error.message };
    }
}

async function selectTrack(userJid, selectionNum) {
    const session = getLyricsSession(userJid);
    if (!session) {
        return { success: false, error: 'No active search session. Please search first.' };
    }
   
    if (selectionNum < 1 || selectionNum > session.results.length) {
        return { success: false, error: `Invalid selection. Choose between 1 and ${session.results.length}.` };
    }
   
    const selectedTrack = session.results[selectionNum - 1];
    const trackInfo = await getLyrics(selectedTrack.title, selectedTrack.artist);
   
    if (trackInfo.success) {
        clearLyricsSession(userJid);
    }
   
    return trackInfo;
}

// ====================== 5. COMPATIBILITY & EXPORTS ======================
async function processWhatsAppAudio(buffer, mimetype) {
    return buffer;
}

async function searchSongByName(query) {
    return await searchLyrics(query);
}

async function getAPICredits() {
    return {
        success: true,
        service: 'ACRCloud',
        plan: 'Free Trial',
        credits: '5,000 total trial requests',
        rateLimit: '2 requests/second',
        bucket: '300 minutes file storage'
    };
}

module.exports = {
    recognizeSong,
    processWhatsAppAudio,
    searchSongByName,
    getAPICredits,
    getLyrics,
    searchLyrics,
    enhancedSearchLyrics,
    storeLyricsSession,
    getLyricsSession,
    updateSessionPage,
    clearLyricsSession,
    getPaginatedResults,
    selectTrack,
    getFullLyrics  // NEW: Full lyrics
};
