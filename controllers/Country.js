const axios = require('axios');

async function Country(countryName) {
    try {
        // Clean the country name
        const cleanName = countryName.trim();
        
        // Try multiple API endpoints in order of reliability
        const apis = [
            {
                name: 'restcountries-v3-full',
                url: `https://restcountries.com/v3.1/name/${encodeURIComponent(cleanName)}?fullText=true`,
                parse: (data) => Array.isArray(data) ? data[0] : data
            },
            {
                name: 'restcountries-v3-alpha',
                url: `https://restcountries.com/v3.1/alpha/${cleanName.toUpperCase()}`,
                parse: (data) => data
            },
            {
                name: 'restcountries-v3-partial',
                url: `https://restcountries.com/v3.1/name/${encodeURIComponent(cleanName)}`,
                parse: (data) => Array.isArray(data) ? data[0] : data
            },
            {
                name: 'restcountries-v2',
                url: `https://restcountries.com/v2/name/${encodeURIComponent(cleanName)}`,
                parse: (data) => Array.isArray(data) ? data[0] : data
            }
        ];
        
        let countryData = null;
        let apiUsed = '';
        let errorMessages = [];
        
        // Try each API endpoint
        for (const api of apis) {
            try {
                console.log(`Trying API: ${api.name} - ${api.url}`);
                const response = await axios.get(api.url, { 
                    timeout: 8000,
                    headers: {
                        'User-Agent': 'WhatsApp-Country-Bot/1.0',
                        'Accept': 'application/json'
                    }
                });
                
                if (response.data && !(response.data.status === 404 || response.data.message === 'Not Found')) {
                    countryData = api.parse(response.data);
                    apiUsed = api.name;
                    console.log(`Success with API: ${api.name}`);
                    break;
                }
            } catch (error) {
                const errorMsg = `${api.name}: ${error.message}`;
                errorMessages.push(errorMsg);
                console.log(`Failed with API: ${errorMsg}`);
                continue;
            }
        }
        
        if (!countryData) {
            // Provide helpful suggestions based on common mistakes
            const suggestions = [];
            const lowerName = cleanName.toLowerCase();
            
            // Common country code mappings
            const countryCodes = {
                'us': 'USA', 'usa': 'USA', 'united states': 'USA',
                'uk': 'UK', 'england': 'UK', 'united kingdom': 'UK',
                'uae': 'UAE', 'united arab emirates': 'UAE',
                'ind': 'India', 'indonesia': 'Indonesia',
                'jp': 'Japan', 'japan': 'Japan',
                'cn': 'China', 'china': 'China',
                'ru': 'Russia', 'russia': 'Russia',
                'de': 'Germany', 'germany': 'Germany',
                'fr': 'France', 'france': 'France',
                'br': 'Brazil', 'brazil': 'Brazil'
            };
            
            if (countryCodes[lowerName]) {
                suggestions.push(`Try: "${countryCodes[lowerName]}"`);
            }
            
            throw new Error(`Country "${cleanName}" not found. ${suggestions.length > 0 ? suggestions.join(', ') : 'Try using the full country name or official country code.'}`);
        }
        
        // Format the response with emojis and sections
        let responseText = `🌍 *COUNTRY INFORMATION* 🌍\n`;
        responseText += `📍 *Data Source:* ${apiUsed}\n\n`;
        
        // Flag section
        const flag = countryData.flag || countryData.flags?.svg || countryData.flags?.png || '';
        responseText += `🏳️ *Flag:* ${flag}\n`;
        
        // Names section
        responseText += `\n📛 *NAMES*\n`;
        responseText += `└─ Official: ${countryData.name?.official || countryData.name || 'N/A'}\n`;
        responseText += `└─ Common: ${countryData.name?.common || 'N/A'}\n`;
        
        // Capital section
        if (countryData.capital && countryData.capital.length > 0) {
            responseText += `\n🏛️ *CAPITAL*\n`;
            responseText += `└─ ${Array.isArray(countryData.capital) ? countryData.capital.join(', ') : countryData.capital}\n`;
        }
        
        // Geography section
        responseText += `\n🗺️ *GEOGRAPHY*\n`;
        responseText += `└─ Continent: ${countryData.region || 'N/A'}\n`;
        responseText += `└─ Subregion: ${countryData.subregion || 'N/A'}\n`;
        
        // Location (coordinates)
        if (countryData.latlng && countryData.latlng.length === 2) {
            const [lat, lng] = countryData.latlng;
            responseText += `└─ Coordinates: ${lat.toFixed(2)}°N, ${lng.toFixed(2)}°E\n`;
            responseText += `└─ Maps: https://maps.google.com/?q=${lat},${lng}\n`;
        }
        
        // Population with emoji based on size
        if (countryData.population) {
            const population = countryData.population.toLocaleString();
            let populationEmoji = '👥';
            if (countryData.population > 100000000) populationEmoji = '🌍';
            else if (countryData.population > 10000000) populationEmoji = '👨‍👩‍👧‍👦';
            
            responseText += `\n${populationEmoji} *POPULATION*\n`;
            responseText += `└─ ${population} people\n`;
            responseText += `└─ Rank: #${countryData.populationRank || 'N/A'}\n`;
        }
        
        // Area
        if (countryData.area) {
            const area = countryData.area.toLocaleString();
            responseText += `\n📏 *AREA*\n`;
            responseText += `└─ ${area} km²\n`;
            
            // Add comparison
            if (countryData.area > 10000000) {
                responseText += `└─ (Larger than India)\n`;
            } else if (countryData.area > 1000000) {
                responseText += `└─ (About the size of Mexico)\n`;
            }
        }
        
        // Currency section
        if (countryData.currencies) {
            responseText += `\n💰 *CURRENCY*\n`;
            const currencies = Object.entries(countryData.currencies)
                .map(([code, currency]) => `${currency.name} (${currency.symbol || code})`)
                .join(', ');
            responseText += `└─ ${currencies}\n`;
        }
        
        // Languages section
        if (countryData.languages) {
            responseText += `\n🗣️ *LANGUAGES*\n`;
            const languages = Object.values(countryData.languages);
            responseText += `└─ ${languages.slice(0, 3).join(', ')}`;
            if (languages.length > 3) responseText += ` +${languages.length - 3} more`;
            responseText += '\n';
        }
        
        // Timezones
        if (countryData.timezones && countryData.timezones.length > 0) {
            responseText += `\n🕒 *TIMEZONES*\n`;
            responseText += `└─ ${countryData.timezones.slice(0, 2).join(', ')}`;
            if (countryData.timezones.length > 2) responseText += ` +${countryData.timezones.length - 2} more`;
            responseText += '\n';
        }
        
        // Calling code
        if (countryData.idd && countryData.idd.root && countryData.idd.suffixes) {
            const callingCode = `${countryData.idd.root}${countryData.idd.suffixes[0]}`;
            responseText += `\n📞 *CALLING CODE*\n`;
            responseText += `└─ +${callingCode}\n`;
        }
        
        // Borders
        if (countryData.borders && countryData.borders.length > 0) {
            responseText += `\n🛂 *BORDERS*\n`;
            responseText += `└─ ${countryData.borders.slice(0, 5).join(', ')}`;
            if (countryData.borders.length > 5) responseText += ` +${countryData.borders.length - 5} more`;
            responseText += '\n';
        }
        
        // Driving side with emoji
        if (countryData.car) {
            responseText += `\n🚗 *DRIVING*\n`;
            responseText += `└─ Side: ${countryData.car.side} side\n`;
            if (countryData.car.signs && countryData.car.signs.length > 0) {
                responseText += `└─ Signs: ${countryData.car.signs.join(', ')}\n`;
            }
        }
        
        // Fun facts section
        responseText += `\n✨ *DID YOU KNOW?*\n`;
        
        // Generate fun facts based on country data
        const funFacts = [];
        
        if (countryData.landlocked) {
            funFacts.push(`• This country is landlocked (no coastline)`);
        }
        
        if (countryData.unMember) {
            funFacts.push(`• Member of the United Nations`);
        }
        
        if (countryData.independent) {
            funFacts.push(`• Independent sovereign state`);
        }
        
        // Add some generic fun facts
        const genericFacts = [
            `• Check local weather before visiting`,
            `• Try the local cuisine!`,
            `• Learn basic greetings in local language`
        ];
        
        // Add 2-3 fun facts
        const selectedFacts = [...funFacts, ...genericFacts].slice(0, 3);
        selectedFacts.forEach(fact => {
            responseText += `${fact}\n`;
        });
        
        // Quick travel tips
        responseText += `\n🎒 *QUICK TRAVEL TIPS*\n`;
        responseText += `• Currency: ${countryData.currencies ? Object.keys(countryData.currencies)[0] : 'Check locally'}\n`;
        responseText += `• Language: ${countryData.languages ? Object.values(countryData.languages)[0] : 'English helpful'}\n`;
        responseText += `• Plug type: ${countryData.car?.side === 'left' ? 'UK-type' : 'EU/US-type'}\n`;
        
        // Footer with timestamp
        responseText += `\n⏰ *Last updated:* ${new Date().toLocaleTimeString('en-US', { hour12: true })}`;
        
        return responseText;
        
    } catch (error) {
        console.error('Country Function Error:', error.message);
        throw new Error(`🌍 Country lookup failed: ${error.message}`);
    }
}

module.exports = Country;