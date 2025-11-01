const axios = require('axios');

async function Translate(text, targetLang) {
    try {
        // Input validation
        if (!text || !targetLang) {
            throw new Error('Text and target language are required');
        }

        if (text.length > 5000) {
            throw new Error('Text too long. Maximum 5000 characters.');
        }

        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
        
        const response = await axios.get(url, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        if (response.data && response.data[0] && response.data[0][0] && response.data[0][0][0]) {
            return response.data[0][0][0];
        } else {
            throw new Error('Invalid response from translation service');
        }
    } catch (error) {
        console.error('Translation API Error:', error.message);
        
        if (error.response) {
            throw new Error(`Translation service error: ${error.response.status}`);
        } else if (error.request) {
            throw new Error('Network error - cannot connect to translation service');
        } else {
            throw new Error(`Translation failed: ${error.message}`);
        }
    }
}

// Additional function for language detection
async function DetectLanguage(text) {
    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`;
        const response = await axios.get(url);
        
        if (response.data && response.data[2]) {
            return response.data[2];
        } else {
            throw new Error('Could not detect language');
        }
    } catch (error) {
        throw new Error(`Language detection failed: ${error.message}`);
    }
}

module.exports = { Translate, DetectLanguage };
