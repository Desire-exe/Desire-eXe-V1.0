const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Define config path - FIXED PATH
const configPath = path.join(__dirname, '../config.json');

// Load config with proper error handling
let config;

try {
  // Check if config file exists
  if (!fs.existsSync(configPath)) {
    console.error(`❌ Config file not found at: ${configPath}`);
    
    // Create default config file
    const defaultConfig = {
      "SELF_BOT_UTILITY": true,
      "OWNER_JID": "2347017747337@s.whatsapp.net",
      "MAX_MEDIA_SIZE": 1500000,
      "GEMINI_API": "",  // Changed from GEMINI_API_KEY to match your code
      "GEMINI_PROMPT": "You are a helpful AI assistant.",
      "GEMINI_PROMPT_ROASTING": "You are a funny AI that roasts people humorously."
    };
    
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    console.log(`✅ Created default config at: ${configPath}`);
    config = defaultConfig;
  } else {
    // Read config file
    const configContent = fs.readFileSync(configPath, 'utf-8').trim();
    
    // Validate JSON before parsing
    try {
      JSON.parse(configContent);
    } catch (jsonError) {
      console.error(`❌ Invalid JSON in config file: ${jsonError.message}`);
      throw new Error(`Config file has invalid JSON: ${jsonError.message}`);
    }
    
    config = JSON.parse(configContent);
    console.log('✅ Config loaded successfully from:', configPath);
    
    // Validate required properties
    if (!config.GEMINI_API && config.GEMINI_API !== '') {
      console.warn('⚠️ GEMINI_API not found in config, using empty string');
      config.GEMINI_API = '';
    }
  }
} catch (error) {
  console.error('❌ Fatal error loading config:', error.message);
  
  // Use fallback config to prevent crash
  config = {
    "SELF_BOT_UTILITY": true,
    "OWNER_JID": "2347017747337@s.whatsapp.net",
    "MAX_MEDIA_SIZE": 1500000,
    "GEMINI_API": "",
    "GEMINI_PROMPT": "You are a helpful AI assistant.",
    "GEMINI_PROMPT_ROASTING": "You are a funny AI that roasts people humorously."
  };
  
  console.log('⚠️ Using fallback configuration');
}

// Function to get available models and find one that supports generateContent
async function findWorkingModel() {
    try {
        const apiKey = config.GEMINI_API;
        
        // Check if API key is configured
        if (!apiKey || apiKey.trim() === '') {
            throw new Error('Gemini API key is not configured. Please add GEMINI_API to config.json');
        }
        
        const modelsUrl = `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`;
        
        const response = await axios.get(modelsUrl, { timeout: 10000 });
        const models = response.data.models || [];
        
        console.log('Available models:');
        models.forEach(model => {
            console.log(`- ${model.name} (${model.displayName})`);
            if (model.supportedGenerationMethods) {
                console.log(`  Supports: ${model.supportedGenerationMethods.join(', ')}`);
            }
        });
        
        // Find models that support generateContent
        const workingModels = models.filter(model => 
            model.supportedGenerationMethods && 
            model.supportedGenerationMethods.includes('generateContent')
        );
        
        if (workingModels.length > 0) {
            console.log(`✅ Found ${workingModels.length} models that support generateContent`);
            return workingModels[0].name; // Return the first working model
        }
        
        throw new Error('No models found that support generateContent');
        
    } catch (error) {
        console.error('Error finding models:', error.message);
        throw error;
    }
}

// Cache the working model
let workingModel = null;

async function callGeminiAPI(prompt, isRoasting = false) {
    try {
        const apiKey = config.GEMINI_API;
        
        // Check if API key is configured
        if (!apiKey || apiKey.trim() === '') {
            return '❌ Gemini API key is not configured. Please add your GEMINI_API to config.json file.';
        }
        
        // Find working model if not cached
        if (!workingModel) {
            console.log('🔍 Finding working model...');
            try {
                workingModel = await findWorkingModel();
                console.log(`✅ Using model: ${workingModel}`);
            } catch (modelError) {
                console.error('Failed to find working model:', modelError.message);
                return `❌ Failed to initialize AI: ${modelError.message}`;
            }
        }
        
        const apiUrl = `https://generativelanguage.googleapis.com/v1/${workingModel}:generateContent?key=${apiKey}`;
        
        // Get prompts from config or use defaults
        const defaultPrompt = "You are a helpful AI assistant.";
        const defaultRoastPrompt = "You are a funny AI that roasts people humorously.";
        
        const fullPrompt = (isRoasting ? 
            (config.GEMINI_PROMPT_ROASTING || defaultRoastPrompt) : 
            (config.GEMINI_PROMPT || defaultPrompt)
        ) + "\n\n" + prompt;
        
        const requestBody = {
            contents: [{
                parts: [{
                    text: fullPrompt
                }]
            }],
            generationConfig: {
                temperature: isRoasting ? 0.9 : 0.7,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 1024,
            }
        };

        console.log(`🔍 Calling Gemini API with model: ${workingModel}`);
        
        const response = await axios.post(apiUrl, requestBody, {
            headers: {
                'Content-Type': 'application/json',
            },
            timeout: 15000
        });

        if (response.status === 200) {
            const data = response.data;
            
            if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
                throw new Error('Invalid response format from API');
            }
            
            console.log('✅ Gemini API response received!');
            return data.candidates[0].content.parts[0].text;
        } else {
            throw new Error(`API returned status: ${response.status}`);
        }
        
    } catch (error) {
        console.error('Gemini API Error:', error.message);
        
        // Reset model cache if it fails
        workingModel = null;
        
        if (error.response) {
            const errorDetails = error.response.data?.error || {};
            return `❌ Gemini API error: ${error.response.status} - ${errorDetails.message || 'Unknown error'}`;
        } else if (error.request) {
            return '❌ Network error - cannot connect to Gemini API';
        } else {
            return `❌ AI service error: ${error.message}`;
        }
    }
}

// Main functions
async function GeminiMessage(question) {
    return await callGeminiAPI(question, false);
}

async function GeminiRoastingMessage(question) {
    return await callGeminiAPI(question, true);
}

// Image functions
async function GeminiImage(imagePath, getPrompt) {
    return `🖼️ Image analysis coming soon!\nPrompt: "${getPrompt}"\n\n💡 Text-based AI is working perfectly now!`;
}

async function GeminiImageRoasting(imagePath, getPrompt) {
    return `🔥 Image roast mode!\nPrompt: "${getPrompt}"\n\n💀 Can't roast images yet, but your text roasts will be fire!`;
}

module.exports = { 
    GeminiMessage, 
    GeminiImage, 
    GeminiRoastingMessage, 
    GeminiImageRoasting,
    findWorkingModel
};
