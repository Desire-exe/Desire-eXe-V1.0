const axios = require('axios');

async function FileSearch(query, fileType) {
    try {
        console.log(`🔍 Searching for ${fileType} files: "${query}"`);
        
        // Get search suggestions instead of scraping
        const results = await getSearchSuggestions(query, fileType);
        
        return formatSearchResponse(results, query, fileType);
        
    } catch (error) {
        console.error('File Search Error:', error.message);
        return getFallbackMessage(query, fileType, error);
    }
}

// Get search suggestions from safe sources
async function getSearchSuggestions(query, fileType) {
    const suggestions = [];
    
    // Google Search links (always safe)
    suggestions.push({
        title: `Google ${fileType.toUpperCase()} Search`,
        url: `https://www.google.com/search?q=filetype:${fileType}+${encodeURIComponent(query)}+free+download`,
        description: 'Direct Google search with file type filter',
        source: 'Google',
        type: 'search_link'
    });
    
    // Academic sources for PDFs
    if (fileType === 'pdf') {
        suggestions.push({
            title: `Academic ${fileType.toUpperCase()} Search`,
            url: `https://scholar.google.com/scholar?q=${encodeURIComponent(query)}+filetype:pdf`,
            description: 'Academic papers and research PDFs',
            source: 'Google Scholar',
            type: 'search_link'
        });
        
        suggestions.push({
            title: 'Research Papers Database',
            url: `https://arxiv.org/search/?query=${encodeURIComponent(query)}`,
            description: 'Free research papers and academic PDFs',
            source: 'arXiv',
            type: 'search_link'
        });
        
        suggestions.push({
            title: 'Internet Archive Books',
            url: `https://archive.org/search.php?query=${encodeURIComponent(query)}+AND+mediatype:texts`,
            description: 'Historical books and documents',
            source: 'Internet Archive',
            type: 'search_link'
        });
    }
    
    // Office documents
    if (['doc', 'docx', 'ppt', 'pptx'].includes(fileType)) {
        const officeType = fileType.startsWith('ppt') ? 'presentation' : 'document';
        
        suggestions.push({
            title: `${officeType.charAt(0).toUpperCase() + officeType.slice(1)} Templates`,
            url: `https://templates.office.com/en-us/search/results?q=${encodeURIComponent(query)}`,
            description: 'Official Microsoft templates',
            source: 'Microsoft Office',
            type: 'search_link'
        });
    }
    
    // Media files
    if (['jpg', 'png', 'mp3', 'mp4'].includes(fileType)) {
        const mediaType = fileType === 'mp3' ? 'audio' : 
                         fileType === 'mp4' ? 'video' : 'image';
        
        suggestions.push({
            title: `Free ${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)}s`,
            url: `https://www.google.com/search?q=${encodeURIComponent(query)}+free+${fileType}+download`,
            description: `Free ${mediaType} downloads`,
            source: 'Media Search',
            type: 'search_link'
        });
    }
    
    // General file hosting sites
    suggestions.push({
        title: 'File Hosting Sites',
        url: `https://www.google.com/search?q=${encodeURIComponent(query)}+${fileType}+site:mediafire.com+OR+site:drive.google.com+OR+site:mega.nz`,
        description: 'Popular file hosting services',
        source: 'File Hosts',
        type: 'search_link'
    });
    
    return suggestions;
}

// Format the response for WhatsApp
function formatSearchResponse(suggestions, query, fileType) {
    const fileTypeNames = {
        'pdf': '📄 PDF Document',
        'doc': '📝 Word Document',
        'docx': '📝 Word Document',
        'ppt': '📊 Presentation',
        'pptx': '📊 Presentation',
        'xls': '📈 Spreadsheet',
        'xlsx': '📈 Spreadsheet',
        'txt': '📋 Text File',
        'jpg': '🖼️ Image',
        'png': '🖼️ Image',
        'zip': '📦 Archive',
        'rar': '📦 Archive',
        'mp3': '🎵 Audio',
        'mp4': '🎬 Video'
    };
    
    const displayType = fileTypeNames[fileType] || `📁 ${fileType.toUpperCase()} File`;
    
    let response = `${displayType} Search Results\n\n`;
    response += `🔍 *Search:* "${query}"\n`;
    response += `📁 *Type:* ${fileType.toUpperCase()}\n`;
    response += `🔗 *Sources:* ${suggestions.length}\n\n`;
    
    response += `⚡ *QUICK SEARCH LINKS:*\n\n`;
    
    suggestions.forEach((suggestion, index) => {
        response += `${index + 1}. *${suggestion.title}*\n`;
        response += `   ${suggestion.description}\n`;
        response += `   🔗 ${suggestion.url}\n`;
        response += `   📍 ${suggestion.source}\n\n`;
    });
    
    response += `💡 *SEARCH TIPS:*\n`;
    response += `• Click any link above to search\n`;
    response += `• Add "free" or "download" to your query\n`;
    response += `• Try different keywords\n`;
    response += `• Check file size before downloading\n\n`;
    
    response += `⚠️ *SAFETY REMINDER:*\n`;
    response += `• Scan files with antivirus\n`;
    response += `• Verify file sources\n`;
    response += `• Avoid suspicious websites\n\n`;
    
    response += `🎯 *BEST SEARCH:*\n`;
    response += `https://google.com/search?q=filetype:${fileType}+${encodeURIComponent(query)}`;
    
    return response;
}

// Fallback message when everything fails
function getFallbackMessage(query, fileType, error) {
    return `❌ *File Search Issue Detected*\n\n` +
           `*Search:* "${query}"\n` +
           `*Type:* ${fileType.toUpperCase()}\n` +
           `*Issue:* ${error.message || 'Search service blocked'}\n\n` +
           `🔧 *SOLUTION:*\n` +
           `Search manually using this link:\n` +
           `https://google.com/search?q=filetype:${fileType}+${encodeURIComponent(query)}+free+download\n\n` +
           `💡 *RECOMMENDED SEARCHES:*\n` +
           `• PDF: https://scholar.google.com\n` +
           `• Docs: https://templates.office.com\n` +
           `• Images: https://unsplash.com\n` +
           `• Audio/Video: https://youtube.com`;
}

// Quick multi-type search
async function QuickFileSearch(query) {
    try {
        const types = ['pdf', 'doc', 'ppt', 'jpg', 'mp3'];
        let response = `⚡ *Quick Multi-File Search: "${query}"*\n\n`;
        
        response += `*Searching across ${types.length} file types...*\n\n`;
        
        types.forEach((type, index) => {
            const searchUrl = `https://google.com/search?q=filetype:${type}+${encodeURIComponent(query)}`;
            response += `${index + 1}. ${type.toUpperCase()}: ${searchUrl}\n`;
        });
        
        response += `\n💡 *Tip:* Click any link above to search for specific file types`;
        
        return response;
        
    } catch (error) {
        return `❌ Quick search failed. Try: https://google.com/search?q=${encodeURIComponent(query)}+filetype:pdf+OR+filetype:doc+OR+filetype:ppt`;
    }
}

module.exports = { FileSearch, QuickFileSearch };