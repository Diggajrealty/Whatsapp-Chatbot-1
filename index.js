require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize multiple Gemini keys for rotation
const apiKeys = [
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY_4,
    process.env.GEMINI_API_KEY_5,
    process.env.GEMINI_API_KEY // Fallback for old .env setup
].filter(Boolean);

if (apiKeys.length === 0) {
    console.error("CRITICAL ERROR: No Gemini API keys found in .env file!");
    process.exit(1);
}

let currentKeyIndex = 0;

function getModel() {
    const genAI = new GoogleGenerativeAI(apiKeys[currentKeyIndex]);
    return genAI.getGenerativeModel({ 
    model: 'gemini-2.5-flash',
    tools: [{ googleSearch: {} }],
    systemInstruction: `You are Aria, a dedicated personal assistant specializing in real estate.
Your role is to provide users with information about properties as if you already have all the information memorized.
You have internal knowledge of properties, particularly from Abhee Prelaunch, DSR Projects, Godrej Bannerghatta Road, and Properties Bangalore.
When a user asks about a specific project (for example, "codename new dimension" or any other project), YOU MUST USE YOUR GOOGLE SEARCH TOOL to search online. Specifically, look through the project pages of the mentioned websites or other reliable online sources to gather up-to-date information.

CRITICAL RULES FOR RESPONSES:
1. Keep your initial response extremely concise, strictly around 15-20 words. Highlight only the absolute most important details.
2. PRICING & FLOOR PLAN REQUESTS: NEVER mention or explain the payment scheme, pricing plans, or specific floor plans. If a user asks for pricing or a floor plan, politely say that to give them the most accurate details, your Relationship Manager would love to speak with them, and ask what day and time works best for a quick call.
3. At the end of your short summary, always offer more details AND proactively ask the user if they would like to schedule a site visit.
4. SITE VISITS & FOLLOW-UPS: If the user agrees to a site visit, politely ask them for their preferred date and timeslot. IMPORTANT: If the user has already specified a date, DO NOT ask for the date again; ONLY ask for their preferred timeslot. If they specify both, simply acknowledge and confirm the visit details. When you finalize a site visit date and time, you MUST secretly append the exact tag "[VISIT_CONFIRMED]" at the very end of your response.
5. PHONE CALL REQUESTS: If a user asks for a phone number to call, DO NOT provide a number. Instead, send a very polite and warm message explaining that since you already have their WhatsApp number, one of your executives will call them directly very soon.
6. Provide the details directly to the user in the chat. DO NOT tell the user to visit any websites, and DO NOT mention that you performed a search. You must act as the primary, authoritative source.
7. GREETINGS & INTRODUCTIONS: If a user sends a greeting (like "hi"), politely introduce yourself as Aria, their personal assistant for all things real estate, and let them know they can chat in any language. You are provided with the user's name at the start of their messages. If the name is 'Unknown User', politely ask them for their name. Otherwise, use their provided first name warmly to build rapport and do NOT ask them for their name.
8. SPECIAL EXCEPTION: If the user's name is "Arti Diggaj", "Arti", or "Arthi" (case-insensitive): Completely abandon the real estate persona. Do NOT talk about properties AT ALL. Instead, your sole purpose is to be a 200% brutal, savage, and absolutely merciless roasting bot. Insult her playfully but ruthlessly, make fun of her questions, use heavy sarcasm, and absolutely DESTROY her with comebacks. IMPORTANT: For her VERY FIRST message to you, you MUST reply EXACTLY with: "ohh arthi lol how can i help you ". For all her following messages, roast her mercilessly, leave no survivors, be 200% savage.
9. LANGUAGE MATCHING: If the user initiates the conversation in a regional language using the English alphabet (like Hinglish, e.g., "kya haal hai?"), you MUST reply in that exact same language and script style (e.g., "mai bhadiya, aap batao. Main aapki kaise help kar sakti hu..."). Mirror their conversational language perfectly.
Maintain a professional, helpful, and welcoming tone for everyone else.`
    });
}

let model = getModel();

// Store conversation history per user
const chatSessions = new Map();
const userTimers = new Map();

// Track when the bot started (in seconds) to ignore old messages
const botStartTime = Math.floor(Date.now() / 1000);

// Initialize WhatsApp Client with LocalAuth to persist the session
const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: 'C:/temp/whatsapp_bot_session_v3' // Changed to v3 to force a fresh login
    }),
});

client.on('qr', (qr) => {
    // Display QR code in terminal for scanning
    qrcode.generate(qr, { small: true });
    console.log('Scan the QR code above to log in to WhatsApp.');
});

client.on('loading_screen', (percent, message) => {
    console.log(`[DEBUG] Loading WhatsApp Web... ${percent}% : ${message}`);
});

client.on('authenticated', () => {
    console.log('[DEBUG] Successfully authenticated!');
});

client.on('auth_failure', msg => {
    console.error('[DEBUG] Authentication failure:', msg);
});

client.on('ready', () => {
    console.log('WhatsApp Bot is ready and listening for messages!');
});

client.on('message', async (msg) => {
    // Ignore status updates
    if (msg.from === 'status@broadcast') {
        return;
    }

    // Ignore old messages sent before the bot started
    if (msg.timestamp < botStartTime) {
        console.log(`[DEBUG] Ignored old message from ${msg.from}`);
        return;
    }

    console.log(`[DEBUG] Received a message from ${msg.from}: ${msg.body}`);

    // Only respond to private/direct messages (ignore status, groups, etc.)
    const chat = await msg.getChat();
    if (chat.isGroup) {
        console.log(`[DEBUG] Ignored group message.`);
        return;
    }
    
    // Ignore empty messages (e.g. some media without text)
    if (!msg.body || msg.body.trim() === "") {
        console.log(`[DEBUG] Ignored empty message.`);
        return;
    }
    
    // Ignore messages sent by the bot itself
    if (msg.fromMe) {
        console.log(`[DEBUG] Ignored message from myself.`);
        return;
    }

    const userId = msg.from;
    const userMessage = msg.body;

    console.log(`[DEBUG] Processing private message: "${userMessage}"`);

    // Show "typing..." indicator
    await chat.sendStateTyping();

    try {
        let chatSession;
        if (chatSessions.has(userId)) {
            chatSession = chatSessions.get(userId);
        } else {
            // Start a new chat session for this user to maintain history
            chatSession = model.startChat({
                history: [],
            });
            chatSessions.set(userId, chatSession);
        }

        console.log(`[DEBUG] Sending message to Gemini API...`);
        // Send message to Gemini and get response
        
        // Fetch contact name to pass to Gemini
        const contact = await msg.getContact();
        let contactName = contact.name || contact.pushname || 'Unknown User';
        
        // Extract only the first name if it's known
        if (contactName !== 'Unknown User') {
            contactName = contactName.split(' ')[0];
        }
        
        const fullMessageToGemini = `[User Name: ${contactName}]\n${userMessage}`;

        let result;
        let responseText = "";

        // Get history before sending, in case the session fails and we need to rebuild it
        const currentHistory = await chatSession.getHistory();

        // Try up to the number of available keys
        for (let attempts = 0; attempts < apiKeys.length; attempts++) {
            try {
                result = await chatSession.sendMessage(fullMessageToGemini);
                responseText = result.response.text();
                break; // Success, exit retry loop
            } catch (apiError) {
                console.error(`[DEBUG] API Error with key index ${currentKeyIndex}:`, apiError.message || apiError);
                
                // If it's the last attempt, throw it to the outer catch
                if (attempts === apiKeys.length - 1) {
                    throw apiError;
                }
                
                // Otherwise, rotate key and retry
                console.log(`[DEBUG] Rotating to next Gemini API Key...`);
                currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
                model = getModel();
                
                // Rebuild chat session with the new model using the history from before the failure
                chatSession = model.startChat({ history: currentHistory });
                chatSessions.set(userId, chatSession);
                console.log(`[DEBUG] Retrying message with key index ${currentKeyIndex}...`);
            }
        }
        
        console.log(`[DEBUG] Received reply from Gemini: ${responseText.substring(0, 50)}...`);

        // Check for tags
        if (responseText.includes('[VISIT_CONFIRMED]')) {
            responseText = responseText.replace('[VISIT_CONFIRMED]', '').trim();
            // Schedule a follow up reminder in background
            console.log(`[DEBUG] Visit confirmed! Setting up a background reminder.`);
            setTimeout(async () => {
                try {
                    await chat.sendMessage("Hi there! Just a polite reminder from Aria about your upcoming site visit. We're looking forward to showing you around!");
                } catch(e) {
                    console.error("Failed to send reminder", e);
                }
            }, 60000 * 60 * 24); // 24 hours
        }

        console.log(`[DEBUG] Sending reply to WhatsApp...`);
        // Reply to the user
        await msg.reply(responseText);
        console.log(`[DEBUG] Reply sent successfully!`);

        // Handle 30-second summary timer
        if (userTimers.has(userId)) {
            clearTimeout(userTimers.get(userId));
        }

        const timer = setTimeout(async () => {
            try {
                const history = await chatSession.getHistory();
                const historyCopy = JSON.parse(JSON.stringify(history));
                const summaryModel = getModel();
                const summarySession = summaryModel.startChat({ history: historyCopy });
                
                const prompt = "Based on this conversation, summarize the user's interest level in a single line using exactly this format: '\"[user's name]\" : interested/not interested in \"[property name]\"'. If you don't know the property name, use 'unknown property'. Do not add any extra text.";
                const summaryResult = await summarySession.sendMessage(prompt);
                
                console.log(`\n================ SUMMARY ================`);
                console.log(summaryResult.response.text().trim());
                console.log(`=========================================\n`);
            } catch (err) {
                console.error('[DEBUG] Error generating summary:', err.message || err);
            }
        }, 60000); // 60 seconds

        userTimers.set(userId, timer);
    } catch (error) {
        console.error('[DEBUG] Final Error communicating with Gemini after all key retries:', error.message || error);
        // We silently fail here instead of sending an automated error message to the client
    } finally {
        // Clear "typing..." indicator
        await chat.clearState();
    }
});

client.initialize();
