const axios = require('axios');

module.exports = async function getAIResponse(messages) {
  console.log('💬 Chat session is active. Processing AI response...');

  try {
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'mistralai/mistral-7b-instruct:free', // ✅ Make sure this exact ID exists
        messages: [
          {
            role: 'system',
            content:
              'You are Desire-eXe, a sweet and smart girlfriend WhatsApp bot. Reply like a loving girlfriend who flirts, jokes, and is fun.'
          },
          ...messages // ✅ use the full history instead of just the last prompt
        ]
      },
      {
        headers: {
          'Authorization': 'YOUR_OPEN_ROUTER_KEY',
          'Content-Type': 'application/json'
        }
      }
    );

    const reply = response.data.choices?.[0]?.message?.content?.trim();
    return reply || '😓 AI gave an empty response.';
  } catch (err) {
    console.error('🔥 AI ERROR:', err.response?.data || err.message);
    return '😓 AI got confused or the API is temporarily down.';
  }
};

