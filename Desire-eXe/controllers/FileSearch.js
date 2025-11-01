const axios = require('axios');
const cheerio = require('cheerio');

async function FileSearch(query, fileType) {
    try {
        console.log(`🔍 Searching for ${fileType} files: ${query}`);
        
        // Use different sources based on file type
        let results = [];
        
        switch (fileType) {
            case 'pdf':
                results = await searchPDFFiles(query);
                break;
            case 'doc':
            case 'docx':
                results = await searchDocumentFiles(query);
                break;
            case 'ppt':
            case 'pptx':
                results = await searchPresentationFiles(query);
                break;
            default:
                results = await searchGeneralFiles(query, fileType);
        }

        if (results.length === 0) {
            return `❌ No ${fileType.toUpperCase()} files found for "${query}"\n\n💡 Try:\n• Different keywords\n• More specific search terms\n• Check if the file type is commonly available online`;
        }

        // Format response
        return formatResults(results, query, fileType);

    } catch (error) {
        console.error('File Search Error:', error);
        return `❌ Search failed: ${error.message}\n\n💡 The search service might be temporarily unavailable.`;
    }
}

// PDF-specific search (using PDF-friendly sites)
async function searchPDFFiles(query) {
    const results = [];
    
    try {
        // PDF Drive (PDF-specific search engine)
        const pdfDriveUrl = `https://www.pdfdrive.com/search?q=${encodeURIComponent(query)}`;
        const pdfResponse = await axios.get(pdfDriveUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
            },
            timeout: 10000
        });

        const $ = cheerio.load(pdfResponse.data);
        
        $('.file-left, .files-new ul li').each((index, element) => {
            if (index >= 5) return false;
            
            const title = $(element).find('.file-right h2, .ai-search h2').text().trim();
            const link = $(element).find('a').attr('href');
            const info = $(element).find('.file-info, .attributes').text().trim();
            
            if (title && link) {
                const fullUrl = link.startsWith('http') ? link : `https://www.pdfdrive.com${link}`;
                results.push({
                    title: title || 'PDF Document',
                    url: fullUrl,
                    snippet: info ? info.substring(0, 120) + (info.length > 120 ? '...' : '') : 'PDF document',
                    source: 'PDF Drive'
                });
            }
        });
    } catch (error) {
        console.log('PDF Drive search failed:', error.message);
    }

    // Fallback: Archive.org search
    if (results.length === 0) {
        try {
            const archiveUrl = `https://archive.org/search.php?query=${encodeURIComponent(query)}+AND+format%3A"PDF"`;
            const archiveResponse = await axios.get(archiveUrl, {
                timeout: 10000
            });

            const $$ = cheerio.load(archiveResponse.data);
            
            $$('.item-ia').each((index, element) => {
                if (index >= 3) return false;
                
                const title = $$(element).find('.item-ttl a').text().trim();
                const link = $$(element).find('.item-ttl a').attr('href');
                
                if (title && link) {
                    const fullUrl = `https://archive.org${link}`;
                    results.push({
                        title: title,
                        url: fullUrl,
                        snippet: 'Available on Internet Archive',
                        source: 'Internet Archive'
                    });
                }
            });
        } catch (error) {
            console.log('Archive.org search failed:', error.message);
        }
    }

    return results;
}

// Document files search
async function searchDocumentFiles(query) {
    const results = [];
    
    try {
        // Scribd search for documents
        const scribdUrl = `https://www.scribd.com/search?query=${encodeURIComponent(query)}&content_type=documents`;
        const response = await axios.get(scribdUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 10000
        });

        const $ = cheerio.load(response.data);
        
        $('.book_card, .document_card').each((index, element) => {
            if (index >= 5) return false;
            
            const title = $(element).find('.title, .book_title').text().trim();
            const link = $(element).find('a').attr('href');
            
            if (title && link) {
                const fullUrl = link.startsWith('http') ? link : `https://www.scribd.com${link}`;
                results.push({
                    title: title,
                    url: fullUrl,
                    snippet: 'Document on Scribd',
                    source: 'Scribd'
                });
            }
        });
    } catch (error) {
        console.log('Document search failed:', error.message);
    }

    return results;
}

// Presentation files search
async function searchPresentationFiles(query) {
    const results = [];
    
    try {
        // Slideshare search
        const slideshareUrl = `https://www.slideshare.net/search/slideshow?searchfrom=header&q=${encodeURIComponent(query)}`;
        const response = await axios.get(slideshareUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 10000
        });

        const $ = cheerio.load(response.data);
        
        $('.slidey-card, .slideshow-card').each((index, element) => {
            if (index >= 5) return false;
            
            const title = $(element).find('.slideshow-title, .title').text().trim();
            const link = $(element).find('a').attr('href');
            
            if (title && link) {
                const fullUrl = link.startsWith('http') ? link : `https://www.slideshare.net${link}`;
                results.push({
                    title: title,
                    url: fullUrl,
                    snippet: 'Presentation on SlideShare',
                    source: 'SlideShare'
                });
            }
        });
    } catch (error) {
        console.log('Presentation search failed:', error.message);
    }

    return results;
}

// General file search fallback
async function searchGeneralFiles(query, fileType) {
    const results = [];
    
    try {
        // Use DuckDuckGo (more scraping-friendly)
        const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}+filetype:${fileType}`;
        const response = await axios.get(ddgUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 10000
        });

        const $ = cheerio.load(response.data);
        
        $('.result').each((index, element) => {
            if (index >= 5) return false;
            
            const title = $(element).find('.result__title a').text().trim();
            const link = $(element).find('.result__title a').attr('href');
            const snippet = $(element).find('.result__snippet').text().trim();
            
            if (title && link) {
                // DuckDuckGo uses redirects, extract actual URL
                const urlMatch = link.match(/uddg=([^&]+)/);
                const cleanUrl = urlMatch ? decodeURIComponent(urlMatch[1]) : link;
                
                if (cleanUrl.toLowerCase().includes(`.${fileType}`)) {
                    results.push({
                        title: title.substring(0, 80),
                        url: cleanUrl,
                        snippet: snippet ? snippet.substring(0, 100) + (snippet.length > 100 ? '...' : '') : 'File download',
                        source: 'Web Search'
                    });
                }
            }
        });
    } catch (error) {
        console.log('General search failed:', error.message);
    }

    return results;
}

// Format results for WhatsApp
function formatResults(results, query, fileType) {
    let responseMessage = `📁 *${fileType.toUpperCase()} File Search Results for "${query}"*\n\n`;
    
    results.forEach((result, index) => {
        responseMessage += `${index + 1}. *${result.title}*\n`;
        responseMessage += `   📝 ${result.snippet}\n`;
        responseMessage += `   🔗 ${result.url}\n`;
        if (result.source) {
            responseMessage += `   🏷️ Source: ${result.source}\n`;
        }
        responseMessage += `\n`;
    });

    responseMessage += `💡 *Found ${results.length} ${fileType.toUpperCase()} files*\n\n`;
    responseMessage += `⚠️ *Safety Notice:*\n`;
    responseMessage += `• Always scan files before opening\n`;
    responseMessage += `• Verify file sources\n`;
    responseMessage += `• Be cautious with downloads\n`;

    return responseMessage;
}

// Quick file search with multiple types
async function QuickFileSearch(query) {
    try {
        const results = {};
        
        // Search for multiple file types
        const types = ['pdf', 'doc', 'ppt'];
        
        for (const type of types) {
            try {
                const typeResults = await FileSearch(query, type);
                results[type] = typeResults;
            } catch (error) {
                results[type] = `❌ No ${type.toUpperCase()} files found`;
            }
        }
        
        return results;
    } catch (error) {
        throw new Error(`Quick search failed: ${error.message}`);
    }
}

module.exports = { FileSearch, QuickFileSearch };