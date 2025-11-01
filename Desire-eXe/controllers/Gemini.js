const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const configPath = path.join(__dirname, '../config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

// Function to get available models and find one that supports generateContent
async function findWorkingModel() {
    try {
        const apiKey = config.GEMINI_API;
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
        
        // Find working model if not cached
        if (!workingModel) {
            console.log('🔍 Finding working model...');
            workingModel = await findWorkingModel();
            console.log(`✅ Using model: ${workingModel}`);
        }
        
        const apiUrl = `https://generativelanguage.googleapis.com/v1/${workingModel}:generateContent?key=${apiKey}`;
        
        const fullPrompt = (isRoasting ? config.GEMINI_PROMPT_ROASTING : config.GEMINI_PROMPT) + prompt;
        
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
            throw new Error(`Gemini API error: ${error.response.status} - ${errorDetails.message || 'Unknown error'}`);
        } else if (error.request) {
            throw new Error('Network error - cannot connect to Gemini API');
        } else {
            throw new Error(`AI service error: ${error.message}`);
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
    findWorkingModel  // Add this export
};