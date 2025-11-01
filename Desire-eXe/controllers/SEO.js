const axios = require('axios');
const cheerio = require('cheerio');

async function CheckSEO(domain) {
    try {
        // Add protocol if missing
        let url = domain.startsWith('http') ? domain : `https://${domain}`;
        
        const response = await axios.get(url, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(response.data);

        // Basic SEO Elements
        const title = $('title').text().trim() || 'Not Available';
        const metaDescription = $('meta[name="description"]').attr('content') || 'Not Available';
        const metaKeywords = $('meta[name="keywords"]').attr('content') || 'Not Available';
        
        // Open Graph Tags
        const ogTitle = $('meta[property="og:title"]').attr('content') || 'Not Available';
        const ogDescription = $('meta[property="og:description"]').attr('content') || 'Not Available';
        const ogImage = $('meta[property="og:image"]').attr('content') || 'Not Available';
        const ogUrl = $('meta[property="og:url"]').attr('content') || 'Not Available';
        
        // Twitter Cards
        const twitterTitle = $('meta[name="twitter:title"]').attr('content') || 'Not Available';
        const twitterDescription = $('meta[name="twitter:description"]').attr('content') || 'Not Available';
        const twitterImage = $('meta[name="twitter:image"]').attr('content') || 'Not Available';
        
        // Technical SEO
        const canonicalUrl = $('link[rel="canonical"]').attr('href') || 'Not Available';
        const metaRobots = $('meta[name="robots"]').attr('content') || 'Not Available';
        const viewport = $('meta[name="viewport"]').attr('content') || 'Not Available';
        const charset = $('meta[charset]').attr('charset') || $('meta[charset]').attr('content') || 'Not Available';
        
        // H1 Headings
        const h1Count = $('h1').length;
        const h1Text = $('h1').first().text().trim().substring(0, 100) || 'Not Available';
        
        // Images with alt tags
        const totalImages = $('img').length;
        const imagesWithAlt = $('img[alt]').length;
        const altTextPercentage = totalImages > 0 ? ((imagesWithAlt / totalImages) * 100).toFixed(2) + '%' : 'No images';
        
        // Links
        const totalLinks = $('a').length;
        const internalLinks = $('a[href^="/"], a[href*="' + domain + '"]').length;
        const externalLinks = totalLinks - internalLinks;

        // Indexability
        const isIndexable = !(metaRobots.includes('noindex') || metaRobots.includes('none'));

        // Calculate SEO Score (more comprehensive)
        let totalCriteria = 15;
        let totalCriteriaMet = 0;

        // Basic checks
        if (title !== 'Not Available' && title.length > 0) totalCriteriaMet++;
        if (metaDescription !== 'Not Available' && metaDescription.length > 0) totalCriteriaMet++;
        if (metaKeywords !== 'Not Available') totalCriteriaMet++;
        if (ogTitle !== 'Not Available') totalCriteriaMet++;
        if (ogDescription !== 'Not Available') totalCriteriaMet++;
        if (ogImage !== 'Not Available') totalCriteriaMet++;
        if (canonicalUrl !== 'Not Available') totalCriteriaMet++;
        if (isIndexable) totalCriteriaMet++;
        if (viewport !== 'Not Available') totalCriteriaMet++;
        if (charset !== 'Not Available') totalCriteriaMet++;
        if (h1Count > 0) totalCriteriaMet++;
        if (totalImages > 0) totalCriteriaMet++;
        if (imagesWithAlt > 0) totalCriteriaMet++;
        if (totalLinks > 0) totalCriteriaMet++;
        if (internalLinks > 0) totalCriteriaMet++;

        const seoSuccessRate = ((totalCriteriaMet / totalCriteria) * 100).toFixed(2) + '%';

        return {
            domain: domain,
            seoSuccessRate,
            isIndexable,
            
            // Basic SEO
            title,
            titleLength: title.length,
            metaDescription,
            metaDescriptionLength: metaDescription.length,
            metaKeywords,
            
            // Social Media
            ogTitle,
            ogDescription,
            ogImage,
            ogUrl,
            twitterTitle,
            twitterDescription,
            twitterImage,
            
            // Technical
            canonicalUrl,
            metaRobots,
            viewport,
            charset,
            
            // Content
            h1Count,
            h1Text,
            
            // Images
            totalImages,
            imagesWithAlt,
            altTextPercentage,
            
            // Links
            totalLinks,
            internalLinks,
            externalLinks,
            
            // Analysis
            totalCriteria,
            totalCriteriaMet
        };

    } catch (error) {
        console.error('Error fetching SEO data:', error);
        throw new Error(`Failed to fetch SEO data: ${error.message}`);
    }
}

module.exports = { CheckSEO };
