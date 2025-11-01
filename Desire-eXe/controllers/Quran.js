const axios = require('axios');

async function Surah(surahId) {
    try {
        const response = await axios.get(`https://web-api.qurankemenag.net/quran-ayah?surah=${surahId}`, {
            timeout: 15000
        });
        
        const details = response.data.data;

        if (!details || details.length === 0) {
            throw new Error('Surah not found');
        }

        let responseText = `📖 *Surah ${details[0].surah.latin}* (${details[0].surah.translation})\n`;
        responseText += `🎯 Total Verses: ${details.length}\n\n`;
        
        details.forEach(ayah => {
            responseText += `*${ayah.ayah}.* ${ayah.arabic}\n`;
            responseText += `${ayah.translation}\n`;
            responseText += `────────────────────\n\n`;
        });

        return responseText;
    } catch (error) {
        console.error('Error fetching surah:', error.message);
        
        if (error.response) {
            throw new Error(`Quran API error: ${error.response.status}`);
        } else if (error.request) {
            throw new Error('Network error - cannot connect to Quran service');
        } else {
            throw new Error('Failed to fetch surah data');
        }
    }
}

async function SurahDetails(surahId, ayahId) {
    try {
        const response = await axios.get(`https://web-api.qurankemenag.net/quran-ayah?surah=${surahId}`, {
            timeout: 15000
        });
        
        const ayahDetail = response.data.data.find(ayah => ayah.ayah == ayahId);

        if (!ayahDetail) {
            return 'Surah Not available';
        }

        let responseText = `📖 *Surah ${ayahDetail.surah.latin}* (${ayahDetail.surah.translation})\n`;
        responseText += `🎯 *Verse ${ayahDetail.ayah}*\n\n`;
        responseText += `📜 *Arabic:*\n${ayahDetail.arabic}\n\n`;
        responseText += `🔄 *Translation:*\n${ayahDetail.translation}`;

        return responseText;
    } catch (error) {
        console.error('Error fetching ayah:', error.message);
        throw new Error('Failed to fetch verse details');
    }
}

module.exports = { Surah, SurahDetails };
