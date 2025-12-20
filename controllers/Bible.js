const axios = require('axios');

async function Bible(book, chapter) {
    try {
        const response = await axios.get(`https://bible-api.com/${book} ${chapter}`, {
            timeout: 10000
        });
        
        const data = response.data;

        if (!data.verses || data.verses.length === 0) {
            throw new Error('Chapter not found');
        }

        let responseText = `📖 *${data.reference}* (${data.translation_name})\n\n`;
        
        data.verses.forEach(verse => {
            responseText += `*${verse.verse}.* ${verse.text}\n\n`;
        });

        responseText += `\n_Translation: ${data.translation_name}_`;

        return responseText;
    } catch (error) {
        console.error('Bible API Error:', error.message);
        
        if (error.response) {
            throw new Error(`Bible API error: ${error.response.status}`);
        } else if (error.request) {
            throw new Error('Network error - cannot connect to Bible service');
        } else {
            throw new Error('Failed to fetch Bible chapter');
        }
    }
}

async function BibleVerse(book, chapter, verse) {
    try {
        const response = await axios.get(`https://bible-api.com/${book} ${chapter}:${verse}`, {
            timeout: 10000
        });
        
        const data = response.data;

        if (!data.verses || data.verses.length === 0) {
            throw new Error('Verse not found');
        }

        const verseData = data.verses[0];

        let responseText = `📖 *${data.reference}* (${data.translation_name})\n\n`;
        responseText += `*${verseData.verse}.* ${verseData.text}\n\n`;
        responseText += `_Translation: ${data.translation_name}_`;

        return responseText;
    } catch (error) {
        console.error('Bible Verse Error:', error.message);
        throw new Error('Failed to fetch Bible verse');
    }
}

async function BibleSearch(query) {
    try {
        const response = await axios.get(`https://bible-api.com/${encodeURIComponent(query)}`, {
            timeout: 10000
        });
        
        const data = response.data;

        if (!data.verses || data.verses.length === 0) {
            throw new Error('No results found');
        }

        let responseText = `🔍 *Bible Search: "${query}"*\n`;
        responseText += `📖 *${data.reference}* (${data.translation_name})\n\n`;
        
        // Show first 5 verses for search results
        data.verses.slice(0, 5).forEach(verse => {
            responseText += `*${verse.verse}.* ${verse.text}\n\n`;
        });

        if (data.verses.length > 5) {
            responseText += `\n_... and ${data.verses.length - 5} more verses_`;
        }

        responseText += `\n_Translation: ${data.translation_name}_`;

        return responseText;
    } catch (error) {
        console.error('Bible Search Error:', error.message);
        throw new Error('Search failed or no results found');
    }
}

async function RandomBibleVerse() {
    try {
        // Popular Bible verses for random selection
        const popularVerses = [
            "john 3:16",
            "philippians 4:13",
            "jeremiah 29:11",
            "psalms 23:1",
            "romans 8:28",
            "proverbs 3:5-6",
            "isaiah 41:10",
            "matthew 11:28",
            "2 timothy 1:7",
            "philippians 4:6-7",
            "psalms 46:1",
            "romans 12:2",
            "galatians 5:22-23",
            "ephesians 2:8-9",
            "1 corinthians 13:4-7"
        ];

        const randomVerse = popularVerses[Math.floor(Math.random() * popularVerses.length)];
        const response = await axios.get(`https://bible-api.com/${randomVerse}`, {
            timeout: 10000
        });
        
        const data = response.data;
        const verseData = data.verses[0];

        let responseText = `🎲 *Random Bible Verse*\n\n`;
        responseText += `📖 *${data.reference}* (${data.translation_name})\n\n`;
        responseText += `*${verseData.verse}.* ${verseData.text}\n\n`;
        responseText += `_Translation: ${data.translation_name}_`;

        return responseText;
    } catch (error) {
        console.error('Random Bible Verse Error:', error.message);
        throw new Error('Failed to fetch random verse');
    }
}

// Bible book list for reference
const bibleBooks = {
    oldTestament: [
        "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy",
        "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel",
        "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra",
        "Nehemiah", "Esther", "Job", "Psalms", "Proverbs",
        "Ecclesiastes", "Song of Solomon", "Isaiah", "Jeremiah", "Lamentations",
        "Ezekiel", "Daniel", "Hosea", "Joel", "Amos",
        "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk",
        "Zephaniah", "Haggai", "Zechariah", "Malachi"
    ],
    newTestament: [
        "Matthew", "Mark", "Luke", "John", "Acts",
        "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians",
        "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians", "1 Timothy",
        "2 Timothy", "Titus", "Philemon", "Hebrews", "James",
        "1 Peter", "2 Peter", "1 John", "2 John", "3 John",
        "Jude", "Revelation"
    ]
};

module.exports = { 
    Bible, 
    BibleVerse, 
    BibleSearch, 
    RandomBibleVerse,
    bibleBooks 
};