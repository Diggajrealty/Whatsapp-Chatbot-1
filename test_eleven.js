require('dotenv').config();
const fs = require('fs');

async function testEleven() {
    const key = process.env.ELEVENLABS_API_KEY || 'sk_8872743fb24ec1155d299cf2fd7a32267fa0bb0bb2977d69';
    console.log('Testing ElevenLabs with key:', key.substring(0, 5) + '...');
    
    try {
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/EXAVITQu4vr4xnSDxMaL`, {
            method: 'POST',
            headers: {
                'Accept': 'audio/mpeg',
                'Content-Type': 'application/json',
                'xi-api-key': key
            },
            body: JSON.stringify({
                text: "Hello, this is a test.",
                model_id: 'eleven_multilingual_v2',
                voice_settings: { stability: 0.5, similarity_boost: 0.75 }
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error('Error status:', response.status, errText);
        } else {
            console.log('Success! Got audio buffer.');
        }
    } catch (e) {
        console.error('Fetch error:', e);
    }
}

testEleven();
