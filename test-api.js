// Quick test script to verify all APIs are working
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testGemini() {
    console.log('\n🧪 Testing Gemini API Keys...\n');

    const keys = [
        process.env.GEMINI_API_KEY_1,
        process.env.GEMINI_API_KEY_2,
        process.env.GEMINI_API_KEY_3,
        process.env.GEMINI_API_KEY_4,
        process.env.GEMINI_API_KEY_5
    ].filter(Boolean);

    console.log(`Found ${keys.length} Gemini API keys\n`);

    for (let i = 0; i < keys.length; i++) {
        try {
            const genAI = new GoogleGenerativeAI(keys[i]);
            const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

            const result = await model.generateContent('Say hi in 2 words');
            const response = result.response.text();

            console.log(`✅ Key ${i + 1}: WORKING - Response: "${response}"`);
        } catch (error) {
            const shortError = error.message.substring(0, 100);
            console.log(`❌ Key ${i + 1}: FAILED - ${shortError}`);
        }
    }

    console.log('\n🔚 Test complete!\n');
}

testGemini();
