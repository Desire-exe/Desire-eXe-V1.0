const axios = require('axios');

async function Weather(cityName) {
    try {
        const weatherUrl = `https://wttr.in/${cityName}?format=%t|%C|%w|%h&lang=id&m`;

        const response = await axios.get(weatherUrl, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const weatherData = response.data;

        // Check if city not found
        if (weatherData.includes("Sorry") || weatherData.includes("Unknown")) {
            throw new Error(`City "${cityName}" not found`);
        }

        const weatherParts = weatherData.split('|');
        
        if (weatherParts.length < 4) {
            throw new Error('Invalid weather data received');
        }

        const weatherJson = {
            temperature: weatherParts[0].trim(),
            condition: weatherParts[1].trim(),
            wind: weatherParts[2].trim(),
            humidity: weatherParts[3].trim()
        };

        return weatherJson;
        
    } catch (error) {
        console.error('Weather Fetch Error:', error.message);
        
        if (error.response) {
            throw new Error(`Weather service error: ${error.response.status}`);
        } else if (error.request) {
            throw new Error('Network error - cannot connect to weather service');
        } else if (error.message.includes('not found')) {
            throw error;
        } else {
            throw new Error('Failed to fetch weather data');
        }
    }
}

// Additional function for multiple cities
async function WeatherMultiple(cities) {
    const results = [];
    
    for (const city of cities) {
        try {
            const weather = await Weather(city);
            results.push({ city, weather, success: true });
        } catch (error) {
            results.push({ city, error: error.message, success: false });
        }
    }
    
    return results;
}

module.exports = { Weather, WeatherMultiple };