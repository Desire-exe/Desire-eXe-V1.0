const axios = require('axios');

// Wikipedia API configuration with proper User-Agent
const WIKIPEDIA_CONFIG = {
    headers: {
        'User-Agent': 'WhatsAppBot/1.0 (https://example.com; bot@example.com)',
        'Accept': 'application/json'
    },
    timeout: 15000 // 15 seconds timeout
};

// Helper function to make Wikipedia API requests
async function makeWikipediaRequest(params) {
    try {
        const response = await axios.get('https://en.wikipedia.org/w/api.php', {
            ...WIKIPEDIA_CONFIG,
            params: {
                ...params,
                format: 'json',
                utf8: 1,
                origin: '*'
            }
        });
        return response.data;
    } catch (error) {
        console.error('Wikipedia API Error:', error.message);
        if (error.response?.status === 403) {
            throw new Error('Wikipedia API access denied. Please check User-Agent configuration.');
        }
        throw error;
    }
}

// Helper function to clean HTML snippets
function cleanSnippet(snippet) {
    return snippet
        .replace(/<[^>]+>/g, '') // Remove HTML tags
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
}

// Helper function to create Wikipedia URL
function createWikipediaUrl(title) {
    return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
}

async function WikipediaAI(query) {
    try {
        // First, search for the query
        const searchData = await makeWikipediaRequest({
            action: 'query',
            list: 'search',
            srsearch: query,
            srlimit: 1
        });

        const searchResults = searchData.query?.search;

        if (!searchResults || searchResults.length === 0) {
            return "❌ No Wikipedia page found for your query.";
        }

        const result = searchResults[0];
        
        // Now get detailed information about the page
        const pageData = await makeWikipediaRequest({
            action: 'query',
            prop: 'extracts|info',
            exintro: true,
            explaintext: true,
            titles: result.title,
            inprop: 'url'
        });

        const pages = pageData.query?.pages;
        if (!pages) {
            return "❌ Could not fetch page details.";
        }

        const pageId = Object.keys(pages)[0];
        const page = pages[pageId];

        if (pageId === '-1' || !page.extract) {
            return `❌ No detailed information available for "${result.title}".`;
        }

        // Format the response
        let responseMessage = `📚 *${page.title}*\n\n`;
        
        // Clean and truncate extract
        const extract = cleanSnippet(page.extract);
        if (extract.length > 1500) {
            responseMessage += extract.substring(0, 1500) + '...';
        } else {
            responseMessage += extract;
        }
        
        responseMessage += `\n\n🔗 *Read more:* ${page.fullurl || createWikipediaUrl(page.title)}`;
        responseMessage += `\n\n🤖 *AI Summary* | 📅 Last modified: ${page.touched ? new Date(page.touched).toLocaleDateString() : 'Unknown'}`;

        return responseMessage;

    } catch (error) {
        console.error('Wikipedia AI Error:', error);
        
        // User-friendly error messages
        if (error.message.includes('User-Agent') || error.message.includes('access denied')) {
            return "❌ Wikipedia API configuration error. Please contact bot administrator.";
        } else if (error.code === 'ETIMEDOUT') {
            return "❌ Wikipedia servers are taking too long to respond. Please try again.";
        } else if (error.code === 'ENOTFOUND') {
            return "❌ Cannot connect to Wikipedia. Please check your internet connection.";
        }
        
        return "❌ Error fetching Wikipedia data. Please try again later.";
    }
}

async function WikipediaSearch(query) {
    try {
        const data = await makeWikipediaRequest({
            action: 'query',
            list: 'search',
            srsearch: query,
            srlimit: 5,
            srprop: 'snippet|titlesnippet'
        });

        const searchResults = data.query?.search;

        if (!searchResults || searchResults.length === 0) {
            return "❌ No Wikipedia results found for your search.";
        }

        let responseMessage = "🔍 *Wikipedia Search Results*\n\n";
        
        searchResults.forEach((result, index) => {
            const title = result.title;
            const snippet = cleanSnippet(result.snippet || '');
            
            responseMessage += `${index + 1}. *${title}*\n`;
            if (snippet) {
                responseMessage += `   ${snippet}\n`;
            }
            responseMessage += `   🔗 ${createWikipediaUrl(title)}\n\n`;
        });

        responseMessage += `ℹ️ *${searchResults.length} result${searchResults.length > 1 ? 's' : ''} found*`;
        responseMessage += `\n\nUse \`.wiki-ai <page_title>\` to get detailed information about any result.`;

        return responseMessage;

    } catch (error) {
        console.error('Wikipedia Search Error:', error);
        
        if (error.message.includes('User-Agent') || error.message.includes('access denied')) {
            return "❌ Wikipedia API configuration error. Please contact bot administrator.";
        } else if (error.code === 'ETIMEDOUT') {
            return "❌ Search timeout. Please try again.";
        }
        
        return "❌ Error searching Wikipedia. Please try again later.";
    }
}

async function WikipediaImage(query) {
    try {
        // First, search for the page
        const searchData = await makeWikipediaRequest({
            action: 'query',
            list: 'search',
            srsearch: query,
            srlimit: 1
        });

        const searchResults = searchData.query?.search;
        if (!searchResults || searchResults.length === 0) {
            return null;
        }

        const pageTitle = searchResults[0].title;
        
        // Get page images and info
        const pageData = await makeWikipediaRequest({
            action: 'query',
            prop: 'pageimages|info',
            titles: pageTitle,
            pithumbsize: 800, // Larger image size
            piprop: 'thumbnail|name',
            inprop: 'url'
        });

        const pages = pageData.query?.pages;
        if (!pages) {
            return null;
        }

        const pageId = Object.keys(pages)[0];
        const page = pages[pageId];
        
        const imageUrl = page.thumbnail?.source;
        
        if (!imageUrl) {
            return null;
        }
        
        return { 
            url: imageUrl, 
            caption: `📷 *${page.title}*\n\nWikipedia image for: ${query}\n\n🔗 ${page.fullurl || createWikipediaUrl(page.title)}`
        };
        
    } catch (error) {
        console.error("Wikipedia Image Error:", error);
        return null;
    }
}

module.exports = { WikipediaAI, WikipediaSearch, WikipediaImage };
