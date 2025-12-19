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

// Gemini Roasting Message function
async function GeminiRoastingMessage(seoData) {
    let data;
    if (typeof seoData === 'string') {
        data = parseSEOString(seoData);
    } else {
        data = seoData;
    }
    
    let roast = "🔥 *SEO ROASTING SESSION* 🔥\n\n";
    roast += `📊 *Website:* ${data.domain || 'Unknown'}\n`;
    roast += `🎯 *SEO Score:* ${data.seoSuccessRate || '0%'}\n\n`;
    
    roast += "⚡ *QUICK ANALYSIS*\n";
    roast += "────────────────\n\n";
    
    // Title roast
    if (data.title === 'Not Available') {
        roast += "🤦‍♂️ *NO TITLE TAG?!* Even a blank page deserves a name!\n";
    } else if (data.titleLength < 10) {
        roast += `📝 *Title too short (${data.titleLength} chars):* Shorter than my grocery list!\n`;
    } else if (data.titleLength > 60) {
        roast += `📝 *Title too long (${data.titleLength} chars):* Google's cutting it off mid-sentence!\n`;
    } else {
        roast += `✅ *Title length good (${data.titleLength} chars)*\n`;
    }
    
    // Description roast
    if (data.metaDescription === 'Not Available') {
        roast += "🔍 *Missing meta description:* Making Google write your snippets? Lazy!\n";
    } else if (data.metaDescriptionLength < 50) {
        roast += `🔍 *Description too short (${data.metaDescriptionLength} chars):* Can't even describe a meme properly!\n`;
    } else if (data.metaDescriptionLength > 160) {
        roast += `🔍 *Description too long (${data.metaDescriptionLength} chars):* Writing a novel in meta tags?\n`;
    } else {
        roast += `✅ *Description length good (${data.metaDescriptionLength} chars)*\n`;
    }
    
    // Indexability roast
    if (!data.isIndexable) {
        roast += "🚫 *NOINDEX FOUND:* Why have a website if you're hiding from Google?\n";
    } else {
        roast += "✅ *Page is indexable*\n";
    }
    
    // H1 roast
    if (data.h1Count === 0) {
        roast += "📑 *No H1 tags:* Even my to-do list has headings!\n";
    } else if (data.h1Count > 1) {
        roast += `📑 *${data.h1Count} H1 tags:* Multiple main headings? Pick a lane!\n`;
    } else {
        roast += `✅ *${data.h1Count} H1 tag found*\n`;
    }
    
    // Images roast
    if (data.totalImages > 0) {
        roast += `🖼️ *Images:* ${data.totalImages} total, ${data.imagesWithAlt} with alt text (${data.altTextPercentage})\n`;
        if (parseFloat(data.altTextPercentage) < 50) {
            roast += "   👎 Too many images missing alt text!\n";
        }
    }
    
    // Canonical roast
    if (data.canonicalUrl === 'Not Available') {
        roast += "🔄 *No canonical URL:* Duplicate content party? Google hates that!\n";
    }
    
    // Viewport roast
    if (data.viewport === 'Not Available') {
        roast += "📱 *No viewport tag:* Mobile users hate this one simple trick!\n";
    }
    
    // Social media roast
    const hasOG = data.ogTitle !== 'Not Available' && data.ogDescription !== 'Not Available';
    const hasTwitter = data.twitterTitle !== 'Not Available' && data.twitterDescription !== 'Not Available';
    
    if (!hasOG && !hasTwitter) {
        roast += "📱 *No social media tags:* Your shares look like spam!\n";
    } else if (hasOG && !hasTwitter) {
        roast += "📱 *Has Facebook OG but no Twitter cards:* Playing favorites?\n";
    }
    
    roast += "\n📈 *DETAILED METRICS*\n";
    roast += "────────────────\n\n";
    
    roast += `• *Title:* ${data.title.substring(0, 80)}${data.title.length > 80 ? '...' : ''}\n`;
    roast += `• *Description:* ${data.metaDescription.substring(0, 100)}${data.metaDescription.length > 100 ? '...' : ''}\n`;
    roast += `• *Canonical:* ${data.canonicalUrl.substring(0, 50)}\n`;
    roast += `• *Robots:* ${data.metaRobots}\n`;
    roast += `• *H1 Count:* ${data.h1Count}\n`;
    roast += `• *Images:* ${data.totalImages} (${data.altTextPercentage} with alt)\n`;
    roast += `• *Links:* ${data.totalLinks} (${data.internalLinks} internal, ${data.externalLinks} external)\n`;
    
    roast += "\n💡 *QUICK FIXES*\n";
    roast += "────────────────\n";
    
    // Generate fixes based on issues
    const fixes = [];
    
    if (data.title === 'Not Available' || data.titleLength < 10 || data.titleLength > 60) {
        fixes.push("1. Write compelling title (55-60 characters)");
    }
    
    if (data.metaDescription === 'Not Available' || data.metaDescriptionLength < 50 || data.metaDescriptionLength > 160) {
        fixes.push("2. Add meta description (150-160 characters)");
    }
    
    if (!data.isIndexable) {
        fixes.push("3. Remove 'noindex' from robots meta tag");
    }
    
    if (data.canonicalUrl === 'Not Available') {
        fixes.push("4. Add canonical URL to avoid duplicate content");
    }
    
    if (data.viewport === 'Not Available') {
        fixes.push("5. Add viewport tag for mobile responsiveness");
    }
    
    if (parseFloat(data.altTextPercentage) < 50 && data.totalImages > 0) {
        fixes.push("6. Add alt text to images for accessibility & SEO");
    }
    
    if (data.h1Count === 0) {
        fixes.push("7. Add at least one H1 heading to the page");
    } else if (data.h1Count > 1) {
        fixes.push("7. Use only one H1 tag per page");
    }
    
    if (!hasOG) {
        fixes.push("8. Add Open Graph tags for social sharing");
    }
    
    // Add default fixes if none found
    if (fixes.length === 0) {
        fixes.push("1. Consider adding structured data (Schema.org)");
        fixes.push("2. Improve page loading speed");
        fixes.push("3. Build quality backlinks");
        fixes.push("4. Create valuable, long-form content");
    }
    
    // Add fixes to roast
    fixes.forEach((fix, index) => {
        roast += `${fix}\n`;
    });
    
    roast += "\n🎯 *NEXT STEPS*\n";
    roast += "────────────────\n";
    roast += "• Run Google Lighthouse audit\n";
    roast += "• Check Core Web Vitals\n";
    roast += "• Analyze competitors' SEO\n";
    roast += "• Monitor rankings regularly\n";
    
    roast += `\n⏱️ *Analysis completed at:* ${new Date().toLocaleTimeString()}`;
    
    return roast;
}

function parseSEOString(seoString) {
    const lines = seoString.split('\n');
    const data = {};
    
    lines.forEach(line => {
        if (line.includes('SEO Success Rate:')) {
            data.seoSuccessRate = line.split(': ')[1];
        } else if (line.includes('Title:')) {
            data.title = line.split(': ')[1];
            data.titleLength = data.title.length;
        } else if (line.includes('Meta Description:')) {
            data.metaDescription = line.split(': ')[1];
            data.metaDescriptionLength = data.metaDescription.length;
        } else if (line.includes('Meta Keywords:')) {
            data.metaKeywords = line.split(': ')[1];
        } else if (line.includes('Open Graph Title:')) {
            data.ogTitle = line.split(': ')[1];
        } else if (line.includes('Open Graph Description:')) {
            data.ogDescription = line.split(': ')[1];
        } else if (line.includes('Open Graph Image:')) {
            data.ogImage = line.split(': ')[1];
        } else if (line.includes('Canonical URL:')) {
            data.canonicalUrl = line.split(': ')[1];
        } else if (line.includes('Is Indexable:')) {
            data.isIndexable = line.split(': ')[1] === 'Yes';
        }
    });
    
    return data;
}

module.exports = { CheckSEO, GeminiRoastingMessage };