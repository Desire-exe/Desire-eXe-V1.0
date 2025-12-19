const axios = require('axios');

// Helper function to fetch with timeout and retry
async function fetchWithRetry(url, options = {}) {
    const { retries = 3, timeout = 10000, ...axiosOptions } = options;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await axios({
                url,
                timeout,
                ...axiosOptions,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (WhatsApp-Bot Quran-App)',
                    'Accept': 'application/json',
                    ...axiosOptions.headers
                }
            });
            return response;
        } catch (error) {
            if (attempt === retries) throw error;
            console.log(`Attempt ${attempt} failed for ${url}, retrying...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
    }
}

async function Surah(surahId) {
    const apis = [
        {
            name: 'quran-api-id',
            url: `https://quran-api-id.vercel.app/surahs/${surahId}`,
            parser: (data) => {
                let text = `📖 *Surah ${data.data.name.transliteration.id} (${data.data.name.short})*\n`;
                text += `📚 *Translation:* ${data.data.name.translation.id}\n`;
                text += `🎯 *Verses:* ${data.data.numberOfVerses}\n`;
                text += `📍 *Revelation:* ${data.data.revelation.id}\n\n`;
                
                data.data.verses.forEach(verse => {
                    text += `*${verse.number.inSurah}.* ${verse.text.arab}\n`;
                    text += `   ${verse.translation.id}\n\n`;
                });
                
                return text;
            }
        },
        {
            name: 'sutanlab',
            url: `https://api.quran.sutanlab.id/surah/${surahId}`,
            parser: (data) => {
                let text = `📖 *Surah ${data.data.name.transliteration.id} (${data.data.name.short})*\n`;
                text += `📚 *Name:* ${data.data.name.long}\n`;
                text += `🎯 *Verses:* ${data.data.numberOfAyahs}\n`;
                text += `📍 *Revelation:* ${data.data.revelation.id}\n\n`;
                
                data.data.ayahs.forEach(ayah => {
                    text += `*${ayah.number.inSurah}.* ${ayah.text.arab}\n`;
                    text += `   ${ayah.translation.id}\n\n`;
                });
                
                return text;
            }
        },
        {
            name: 'equran',
            url: `https://equran.id/api/v2/surat/${surahId}`,
            parser: (data) => {
                let text = `📖 *Surah ${data.data.namaLatin} (${data.data.nama})*\n`;
                text += `📚 *Meaning:* ${data.data.arti}\n`;
                text += `🎯 *Verses:* ${data.data.jumlahAyat}\n`;
                text += `📍 *Revelation:* ${data.data.tempatTurun}\n\n`;
                
                data.data.ayat.forEach(ayat => {
                    text += `*${ayat.nomorAyat}.* ${ayat.teksArab}\n`;
                    text += `   ${ayat.teksIndonesia}\n\n`;
                });
                
                return text;
            }
        },
        {
            name: 'kemenag-fallback',
            url: `https://web-api.qurankemenag.net/quran-surah/${surahId}`,
            parser: (data) => {
                const details = data.data || [];
                let text = `📖 *Surah ${details[0]?.surah?.latin || 'Unknown'}*\n`;
                text += `🎯 *Total Verses:* ${details.length}\n\n`;
                
                details.forEach(ayah => {
                    text += `*${ayah.ayah}.* ${ayah.arabic}\n`;
                    text += `   ${ayah.translation}\n\n`;
                });
                
                return text;
            }
        }
    ];

    let lastError = null;

    for (const api of apis) {
        try {
            console.log(`Trying API: ${api.name} for surah ${surahId}`);
            const response = await fetchWithRetry(api.url);
            
            if (response.data) {
                const formattedText = api.parser(response.data);
                console.log(`Success with API: ${api.name}`);
                return formattedText;
            }
        } catch (error) {
            lastError = error;
            console.log(`Failed with API ${api.name}:`, error.message);
            continue;
        }
    }

    // If all APIs fail, throw the last error
    throw lastError || new Error('All Quran APIs failed. Please check your internet connection.');
}

async function SurahDetails(surahId, ayahId) {
    const apis = [
        {
            name: 'quran-api-id',
            url: `https://quran-api-id.vercel.app/surahs/${surahId}/ayahs/${ayahId}`,
            parser: (data) => {
                let text = `📖 *Surah ${data.data.surah.name.transliteration.id} (${data.data.surah.name.short})*\n`;
                text += `🎯 *Verse ${data.data.number.inSurah}*\n\n`;
                text += `📜 *Arabic:*\n${data.data.text.arab}\n\n`;
                text += `🔄 *Translation:*\n${data.data.translation.id}\n\n`;
                text += `📖 *Surah:* ${data.data.surah.number} | `;
                text += `📚 *Juz:* ${data.data.juz} | `;
                text += `📍 *Page:* ${data.data.page}`;
                return text;
            }
        },
        {
            name: 'sutanlab',
            url: `https://api.quran.sutanlab.id/surah/${surahId}/${ayahId}`,
            parser: (data) => {
                let text = `📖 *Surah ${data.data.surah.name.transliteration.id} (${data.data.surah.name.short})*\n`;
                text += `🎯 *Verse ${data.data.number.inSurah}*\n\n`;
                text += `📜 *Arabic:*\n${data.data.text.arab}\n\n`;
                text += `🔄 *Translation:*\n${data.data.translation.id}\n\n`;
                text += `📖 *Surah:* ${data.data.surah.number} | `;
                text += `📚 *Juz:* ${data.data.juz} | `;
                text += `📍 *Page:* ${data.data.page}`;
                return text;
            }
        },
        {
            name: 'equran',
            url: `https://equran.id/api/v2/tafsir/${surahId}/${ayahId}`,
            parser: (data) => {
                let text = `📖 *Surah ${data.data.namaLatin} (${data.data.nama})*\n`;
                text += `🎯 *Verse ${data.data.nomorAyat}*\n\n`;
                text += `📜 *Arabic:*\n${data.data.teksArab}\n\n`;
                text += `🔄 *Translation:*\n${data.data.teksIndonesia}\n\n`;
                text += `📝 *Tafsir:*\n${data.data.tafsir.id.short || data.data.tafsir.id.long.substring(0, 200)}...`;
                return text;
            }
        },
        {
            name: 'kemenag-fallback',
            url: `https://web-api.qurankemenag.net/quran-ayah?surah=${surahId}`,
            parser: (data) => {
                const ayahDetail = data.data?.find(ayah => ayah.ayah == ayahId);
                
                if (!ayahDetail) {
                    return 'Surah Not available';
                }

                let text = `📖 *Surah ${ayahDetail.surah.latin} (${ayahDetail.surah.translation})*\n`;
                text += `🎯 *Verse ${ayahDetail.ayah}*\n\n`;
                text += `📜 *Arabic:*\n${ayahDetail.arabic}\n\n`;
                text += `🔄 *Translation:*\n${ayahDetail.translation}`;
                return text;
            }
        }
    ];

    let lastError = null;

    for (const api of apis) {
        try {
            console.log(`Trying API: ${api.name} for surah ${surahId}:${ayahId}`);
            const response = await fetchWithRetry(api.url);
            
            if (response.data) {
                const formattedText = api.parser(response.data);
                console.log(`Success with API: ${api.name}`);
                
                // Check if verse was found
                if (formattedText === 'Surah Not available') {
                    throw new Error('Verse not found');
                }
                
                return formattedText;
            }
        } catch (error) {
            lastError = error;
            console.log(`Failed with API ${api.name}:`, error.message);
            continue;
        }
    }

    // If all APIs fail
    throw lastError || new Error('Verse not found. Please check the surah and verse numbers.');
}

// Local fallback for popular surahs/verses (optional but recommended)
const popularVerses = {
    '1:1': {
        arabic: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
        translation: 'Dengan nama Allah Yang Maha Pengasih, Maha Penyayang.',
        surah: 'Al-Fatihah',
        meaning: 'Pembukaan'
    },
    '2:255': {
        arabic: 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ ۚ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ ۚ لَهُ مَا فِي السَّمَاوَاتِ وَمَا فِي الْأَرْضِ ۗ مَنْ ذَا الَّذِي يَشْفَعُ عِنْدَهُ إِلَّا بِإِذْنِهِ ۚ يَعْلَمُ مَا بَيْنَ أَيْدِيهِمْ وَمَا خَلْفَهُمْ ۖ وَلَا يُحِيطُونَ بِشَيْءٍ مِنْ عِلْمِهِ إِلَّا بِمَا شَاءَ ۚ وَسِعَ كُرْسِيُّهُ السَّمَاوَاتِ وَالْأَرْضَ ۖ وَلَا يَئُودُهُ حِفْظُهُمَا ۚ وَهُوَ الْعَلِيُّ الْعَظِيمُ',
        translation: 'Allah, tidak ada Tuhan selain Dia. Yang Mahahidup, Yang terus menerus mengurus (makhluk-Nya), tidak mengantuk dan tidak tidur. Milik-Nya apa yang di langit dan di bumi. Tidak ada yang dapat memberi syafaat di sisi-Nya tanpa izin-Nya. Dia mengetahui apa yang di hadapan mereka dan apa yang di belakang mereka, dan mereka tidak mengetahui sesuatu pun dari ilmu-Nya melainkan apa yang Dia kehendaki. Kursi-Nya meliputi langit dan bumi. Dan tidak berat bagi-Nya memelihara keduanya, dan Dia Mahatinggi, Mahabesar.',
        surah: 'Al-Baqarah',
        meaning: 'Sapi Betina'
    },
    '36:1': {
        arabic: 'يس',
        translation: 'Yā Sīn.',
        surah: 'Ya-Sin',
        meaning: 'Ya Sin'
    },
    '112:1': {
        arabic: 'قُلْ هُوَ اللَّهُ أَحَدٌ',
        translation: 'Katakanlah (Muhammad), "Dialah Allah, Yang Maha Esa."',
        surah: 'Al-Ikhlas',
        meaning: 'Ikhlas'
    }
};

module.exports = { Surah, SurahDetails };