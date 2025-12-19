// File: Shazam.js - UPDATED WITH YOUR API KEY
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
ffmpeg.setFfmpegPath(ffmpegPath);

// Shazam API function
async function recognizeSong(audioBuffer, filename) {
    try {
        console.log('🎵 Starting Shazam recognition...');
        
        // Step 1: Save audio to temp file
        const tempDir = './temp_shazam';
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        const tempFile = path.join(tempDir, `shazam_${Date.now()}.mp3`);
        fs.writeFileSync(tempFile, audioBuffer);
        
        // Step 2: Use AudD API with YOUR KEY
        const result = await recognizeWithAudD(tempFile);
        
        // Cleanup
        fs.unlinkSync(tempFile);
        
        return result;
        
    } catch (error) {
        console.error('Shazam Error:', error.message);
        throw error;
    }
}

// Using AudD API with YOUR KEY
async function recognizeWithAudD(audioFile) {
    try {
        // ✅ YOUR ACTUAL API KEY HERE
        const apiToken = '641dc9f13027dffbaa8bc6163e4d31ef';
        
        console.log(`🔑 Using AudD API with key: ${apiToken.substring(0, 8)}...`);
        
        // Read and encode audio
        const audioData = fs.readFileSync(audioFile);
        const base64Audio = audioData.toString('base64');
        
        console.log(`📊 Audio size: ${audioData.length} bytes`);
        
        // Make API request
        const response = await axios.post('https://api.audd.io/', {
            api_token: apiToken,
            audio: base64Audio,
            return: 'apple_music,spotify',
            method: 'recognize'
        }, {
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log('📡 AudD API Response:', response.data.status);
        
        if (response.data.status === 'success' && response.data.result) {
            const song = response.data.result;
            console.log('✅ Song recognized:', song.title, '-', song.artist);
            
            return {
                success: true,
                title: song.title,
                artist: song.artist,
                album: song.album || 'Unknown Album',
                label: song.label || 'Unknown Label',
                releaseDate: song.release_date || 'Unknown',
                appleMusic: song.apple_music || null,
                spotify: song.spotify || null,
                lyrics: song.lyrics || null,
                timecode: song.timecode || null
            };
        } else if (response.data.status === 'error') {
            throw new Error(`AudD API Error: ${response.data.error.error_message || 'Unknown error'}`);
        } else {
            throw new Error('Song not recognized');
        }
        
    } catch (error) {
        console.error('AudD API Error:', error.message);
        
        // More detailed error handling
        if (error.response) {
            console.error('API Response Error:', error.response.data);
            
            // Check for specific errors
            if (error.response.data.error?.error_code === 901) {
                throw new Error('API key is invalid or expired');
            } else if (error.response.data.error?.error_code === 902) {
                throw new Error('Daily API limit reached (100 songs/day)');
            } else if (error.response.data.error?.error_code === 300) {
                throw new Error('No music detected in audio');
            }
        }
        
        // Fallback to alternative method
        return {
            success: false,
            error: error.message || 'Recognition failed. Try again with clearer audio.'
        };
    }
}

// Alternative: Recognize by humming or singing
async function recognizeByHumming(audioFile) {
    try {
        const apiToken = '641dc9f13027dffbaa8bc6163e4d31ef';
        const audioData = fs.readFileSync(audioFile);
        const base64Audio = audioData.toString('base64');
        
        // Different endpoint for humming
        const response = await axios.post('https://api.audd.io/recognizeWithOffset/', {
            api_token: apiToken,
            audio: base64Audio,
            return: 'apple_music,spotify',
            method: 'recognize'
        });
        
        return response.data;
    } catch (error) {
        throw error;
    }
}

// Process audio from WhatsApp
async function processWhatsAppAudio(audioBuffer, mimeType) {
    try {
        const tempDir = './temp_audio';
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        // Save original
        const inputFile = path.join(tempDir, `input_${Date.now()}.${mimeType.split('/')[1] || 'ogg'}`);
        fs.writeFileSync(inputFile, audioBuffer);
        
        // Convert to MP3 for better recognition
        const outputFile = path.join(tempDir, `output_${Date.now()}.mp3`);
        
        await new Promise((resolve, reject) => {
            ffmpeg(inputFile)
                .audioCodec('libmp3lame')
                .audioBitrate(128)
                .audioChannels(2)
                .audioFrequency(44100)
                .duration(30) // Limit to 30 seconds for API
                .output(outputFile)
                .on('end', () => {
                    console.log('✅ Audio processed successfully');
                    resolve();
                })
                .on('error', (err) => {
                    console.error('FFmpeg error:', err);
                    reject(err);
                })
                .run();
        });
        
        const processedBuffer = fs.readFileSync(outputFile);
        
        // Cleanup
        fs.unlinkSync(inputFile);
        fs.unlinkSync(outputFile);
        
        return processedBuffer;
        
    } catch (error) {
        console.error('Audio processing error:', error);
        throw error;
    }
}

// Search song by name using YOUR API key
async function searchSongByName(query) {
    try {
        const apiToken = '641dc9f13027dffbaa8bc6163e4d31ef';
        
        console.log(`🔍 Searching for: "${query}"`);
        
        // Use findLyrics endpoint
        const response = await axios.get('https://api.audd.io/findLyrics/', {
            params: {
                api_token: apiToken,
                q: query,
                limit: 3
            },
            timeout: 10000
        });
        
        if (response.data.result && response.data.result.length > 0) {
            console.log(`✅ Found ${response.data.result.length} results`);
            return response.data;
        } else {
            throw new Error('No results found');
        }
        
    } catch (error) {
        console.error('Search error:', error.message);
        
        // Fallback: Use iTunes API
        try {
            const itunesResponse = await axios.get(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=5`);
            
            if (itunesResponse.data.results.length > 0) {
                return {
                    result: itunesResponse.data.results.map(song => ({
                        title: song.trackName,
                        artist: song.artistName,
                        album: song.collectionName,
                        release_date: song.releaseDate?.split('T')[0],
                        preview_url: song.previewUrl
                    }))
                };
            }
        } catch (itunesError) {
            console.error('iTunes fallback failed:', itunesError.message);
        }
        
        throw error;
    }
}

// Get API usage statistics
async function getAPICredits() {
    try {
        const apiToken = '641dc9f13027dffbaa8bc6163e4d31ef';
        
        const response = await axios.get('https://api.audd.io/getAPICredits/', {
            params: { api_token: apiToken }
        });
        
        return response.data;
    } catch (error) {
        console.error('Credit check error:', error);
        return { credits: 'Unknown', limit: 'Unknown' };
    }
}

module.exports = { 
    recognizeSong, 
    processWhatsAppAudio,
    searchSongByName,
    getAPICredits,
    recognizeByHumming
};