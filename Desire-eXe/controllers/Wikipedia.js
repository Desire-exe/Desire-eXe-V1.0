const axios = require('axios');

async function WikipediaAI(query) {
    try {
        const wikiApiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&utf8=1&origin=*`;
        const response = await axios.get(wikiApiUrl);
        const searchResults = response.data.query.search;

        if (searchResults.length > 0) {
            const result = searchResults[0];
            const responseMessage = `*${result.title}*\n\n${result.snippet.replace(/<[^>]+>/g, '')}...\n\nRead more: https://en.wikipedia.org/wiki/${encodeURIComponent(result.title)}`;
            console.log(`Response: ${responseMessage}`);
            return responseMessage;
        } else {
            const responseMessage = "❌ No results found.";
            console.log(`Response: ${responseMessage}`);
            return responseMessage;
        }
    } catch (error) {
        console.error('Wikipedia AI Error:', error);
        return "❌ Error fetching Wikipedia data.";
    }
}

async function WikipediaSearch(query) {
    try {
        const wikiApiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=5&format=json&utf8=1&origin=*`;
        const response = await axios.get(wikiApiUrl);
        const searchResults = response.data.query.search;

        if (searchResults.length > 0) {
            let responseMessage = "📚 *Wikipedia Search Results:*\n\n";
            
            searchResults.slice(0, 3).forEach((result, index) => {
                const title = result.title;
                const snippet = result.snippet.replace(/<[^>]+>/g, '');
                responseMessage += `${index + 1}. *${title}*\n${snippet}...\n🔗 https://en.wikipedia.org/wiki/${encodeURIComponent(title)}\n\n`;
            });

            console.log(`Response: ${responseMessage}`);
            return responseMessage;
        } else {
            const responseMessage = "❌ No results found.";
            console.log(`Response: ${responseMessage}`);
            return responseMessage;
        }
    } catch (error) {
        console.error('Wikipedia Search Error:', error);
        return "❌ Error searching Wikipedia.";
    }
}

async function WikipediaImage(query) {
    try {
        const searchResponse = await axios.get(`https://en.wikipedia.org/w/api.php`, {
            params: {
                action: 'query',
                format: 'json',
                list: 'search',
                srsearch: query,
                utf8: 1,
                srlimit: 1
            }
        });
        
        const pageId = searchResponse.data.query.search[0]?.pageid;
        if (!pageId) {
            return null;
        }

        const imageResponse = await axios.get(`https://en.wikipedia.org/w/api.php`, {
            params: {
                action: 'query',
                format: 'json',
                prop: 'pageimages|info',
                pageids: pageId,
                pithumbsize: 500,
                inprop: 'url'
            }
        });
        
        const pageData = imageResponse.data.query.pages[pageId];
        const imageUrl = pageData?.thumbnail?.source;
        const pageTitle = pageData?.title;
        
        if (!imageUrl) {
            return null;
        }
        
        return { 
            url: imageUrl, 
            caption: `📷 *${pageTitle}*\n\nWikipedia image result for: ${query}` 
        };
        
    } catch (error) {
        console.error("Wikipedia Image Error:", error);
        return null;
    }
}

module.exports = { WikipediaAI, WikipediaSearch, WikipediaImage };
