require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

// ── Express / Socket.io Dashboard Server ────────────────────────────────────
const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer);

app.use(express.static(path.join(__dirname, 'public')));

// In-memory chat history { userId → { name, phone, messages: [] } }
const chatHistory = new Map();
let totalMessages = 0;
let botStatus = 'starting'; // 'starting' | 'qr' | 'authenticated' | 'ready'
let lastQR = null;
let isLoggingOut = false; // prevents disconnected auto-restart during logout
let isInitializing = false; // prevents concurrent initialization

io.on('connection', (socket) => {
    console.log('[DASHBOARD] Browser connected to dashboard');
    // Send current state to newly joined client
    socket.emit('init', {
        status: botStatus,
        qr: lastQR,
        chats: Object.fromEntries(chatHistory),
        totalMessages,
    });

    socket.on('request_logout', async () => {
        console.log('[LOGOUT] Logout requested from dashboard');
        isLoggingOut = true; // stop disconnected handler from auto-restarting
        // Notify all connected dashboards immediately
        io.emit('logging_out');
        // Clear server-side history
        chatHistory.clear();
        totalMessages = 0;
        lastQR = null;
        botStatus = 'starting';
        try {
            await client.logout();
            console.log('[LOGOUT] WhatsApp session cleared.');
        } catch (e) {
            console.warn('[LOGOUT] client.logout() error (may already be disconnected):', e.message);
        }
        // Reinitialize after cleanup — will emit fresh 'qr' event
        setTimeout(async () => {
            isLoggingOut = false;
            await restartBot();
        }, 3000);
    });
});


const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`[SERVER] Dashboard running → http://localhost:${PORT}`);
});

// ── Cross-Platform Helpers ───────────────────────────────────────────────────
const isWindows = process.platform === 'win32';
const SESSION_PATH = process.env.SESSION_PATH || path.join(__dirname, 'whatsapp_session');

function sleepSync(ms) {
    const end = Date.now() + ms;
    while (Date.now() < end) {}
}

function cleanupStaleBrowser() {
    console.log('[STARTUP] Cleaning up stale browser processes...');
    try {
        if (isWindows) {
            execSync('taskkill /F /IM chrome.exe /T', { stdio: 'ignore' });
            execSync('taskkill /F /IM chromium.exe /T', { stdio: 'ignore' });
        } else {
            execSync('pkill -f chrome; exit 0', { stdio: 'ignore', shell: true });
            execSync('pkill -f chromium; exit 0', { stdio: 'ignore', shell: true });
        }
    } catch (_) {}
    sleepSync(2000);

    // Remove lock files from session directory (using rmSync to handle broken symlinks)
    const sessionDir = path.join(SESSION_PATH, 'session');
    const lockFiles = ['SingletonLock', 'SingletonCookie', 'SingletonSocket', 'lockfile'];
    for (const file of lockFiles) {
        const lockPath = path.join(sessionDir, file);
        try {
            fs.rmSync(lockPath, { force: true });
        } catch (e) {
            console.warn(`[STARTUP] Could not remove ${file}: ${e.message}`);
        }
    }
    console.log('[STARTUP] Cleanup complete.');
}

cleanupStaleBrowser();

// ── Chromium Path Detection (Windows + Linux/Cloud) ─────────────────────────
const CHROME_PATHS_WIN = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];
const CHROME_PATHS_LINUX = [
    process.env.CHROMIUM_PATH,
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/snap/bin/chromium',
].filter(Boolean);

const chromePaths = isWindows ? CHROME_PATHS_WIN : CHROME_PATHS_LINUX;
const systemChrome = chromePaths.find(p => { try { return fs.existsSync(p); } catch { return false; } });

if (systemChrome) console.log(`[STARTUP] Using system Chrome: ${systemChrome}`);
else console.log('[STARTUP] System Chrome not found – using bundled Chromium.');

// ── Gemini API Key Rotation ──────────────────────────────────────────────────
const apiKeys = [
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY_4,
    process.env.GEMINI_API_KEY_5,
    process.env.GEMINI_API_KEY,
].filter(Boolean);

if (apiKeys.length === 0) {
    console.error('CRITICAL ERROR: No Gemini API keys found in .env file!');
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
10. CACHING REQUIREMENT: When answering general knowledge questions about properties or projects, DO NOT use the user's name in your response. Keep it general so the answer can be reused for other users.
Maintain a professional, helpful, and welcoming tone for everyone else.`,
    });
}

let model = getModel();

// ── Session Storage & AI Cache ───────────────────────────────────────────────
const chatSessions = new Map();
const userTimers = new Map();
const botStartTime = Math.floor(Date.now() / 1000);

const CACHE_FILE = path.join(SESSION_PATH, 'ai_cache.json');
let aiCache = {};
try {
    if (fs.existsSync(CACHE_FILE)) {
        aiCache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    }
} catch (e) {
    console.warn('[STARTUP] Could not load AI cache:', e.message);
}

function saveCache() {
    try {
        fs.writeFileSync(CACHE_FILE, JSON.stringify(aiCache, null, 2));
    } catch (e) {
        console.error('[ERROR] Could not save AI cache:', e.message);
    }
}

// ── WhatsApp Client ──────────────────────────────────────────────────────────
const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: SESSION_PATH,
    }),
    puppeteer: {
        headless: true,
        executablePath: systemChrome || undefined,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--disable-gpu',
            '--disable-extensions',
            '--disable-background-networking',
        ],
    },
});

// Auto-restart if Chrome crashes or WhatsApp disconnects
client.on('disconnected', async (reason) => {
    console.log(`[DEBUG] Client disconnected (${reason}).`);
    botStatus = 'starting';
    io.emit('disconnected', reason);
    if (isLoggingOut) {
        console.log('[DEBUG] Disconnected due to logout — skipping auto-restart.');
        return;
    }
    console.log('[DEBUG] Auto-restarting in 5s...');
    setTimeout(async () => {
        await restartBot();
    }, 5000);
});

// Restart Helper to prevent duplicate browsers
async function restartBot() {
    if (isInitializing) return;
    isInitializing = true;
    try {
        console.log('[STARTUP] Destroying old client...');
        await client.destroy().catch(() => {});
        cleanupStaleBrowser();
        console.log('[STARTUP] Starting new client...');
        await client.initialize();
    } catch (e) {
        console.error('[STARTUP] Restart failed:', e);
    } finally {
        isInitializing = false;
    }
}

// ── WhatsApp Events → Socket Emissions ──────────────────────────────────────
client.on('qr', async (qr) => {
    try {
        lastQR = await QRCode.toDataURL(qr, { width: 300, margin: 2, color: { dark: '#000000', light: '#ffffff' } });
        botStatus = 'qr';
        io.emit('qr', lastQR);
        console.log(`[QR] Open dashboard → http://localhost:${PORT} to scan the QR code`);
    } catch (err) {
        console.error('[QR] Failed to generate QR image:', err.message);
    }
});

client.on('loading_screen', (percent, message) => {
    console.log(`[LOADING] ${percent}% – ${message}`);
    io.emit('loading', { percent, message });
});

client.on('authenticated', () => {
    botStatus = 'authenticated';
    lastQR = null;
    io.emit('authenticated');
    console.log('[AUTH] Successfully authenticated!');
});

client.on('auth_failure', (msg) => {
    console.error('[AUTH] Authentication failure:', msg);
    io.emit('auth_failure', msg);
});

client.on('ready', () => {
    botStatus = 'ready';
    io.emit('ready');
    console.log('[READY] WhatsApp Bot is ready and listening for messages!');
});

// ── Debug All Network Activity ───────────────────────────────────────────────
client.on('message_create', (msg) => {
    // Ignore historical sync spam (older than 5 mins before boot)
    if (msg.timestamp < botStartTime - 300) return;
    console.log(`[NETWORK] NEW Message: "${msg.body}" (fromMe: ${msg.fromMe}, timestamp: ${msg.timestamp})`);
});

// ── Message Handler ──────────────────────────────────────────────────────────
client.on('message', async (msg) => {
    if (msg.from === 'status@broadcast') return;
    if (msg.timestamp < botStartTime) {
        console.log(`[DEBUG] Ignored old message from ${msg.from}`);
        return;
    }

    console.log(`[DEBUG] Received message from ${msg.from}: ${msg.body}`);

    const chat = await msg.getChat();
    if (chat.isGroup) { console.log('[DEBUG] Ignored group message.'); return; }
    if (!msg.body || msg.body.trim() === '') { console.log('[DEBUG] Ignored empty message.'); return; }
    if (msg.fromMe) { console.log('[DEBUG] Ignored own message.'); return; }

    const userId = msg.from;
    const userMessage = msg.body;

    console.log(`[DEBUG] Processing: "${userMessage}"`);
    await chat.sendStateTyping();

    // Fetch contact name
    const contact = await msg.getContact();
    let contactName = contact.name || contact.pushname || 'Unknown User';
    if (contactName !== 'Unknown User') contactName = contactName.split(' ')[0];
    const phone = userId.replace('@c.us', '').replace('@lid', '');

    // ── Store in chat history & emit to dashboard ──
    if (!chatHistory.has(userId)) {
        chatHistory.set(userId, { name: contactName, phone, messages: [] });
    }
    const convo = chatHistory.get(userId);
    convo.name = contactName;
    convo.phone = phone;
    const userMsgObj = { type: 'user', body: userMessage, timestamp: Date.now() };
    convo.messages.push(userMsgObj);
    totalMessages++;

    io.emit('new_message', { userId, contactName, phone, body: userMessage, timestamp: userMsgObj.timestamp });

    try {
        const normalizedMsg = userMessage.toLowerCase().replace(/[^\w\s]/g, '').trim();
        const isCachable = normalizedMsg.length >= 20;

        if (isCachable && aiCache[normalizedMsg]) {
            console.log(`[CACHE] Hit for: "${normalizedMsg}"`);
            const cachedResponse = aiCache[normalizedMsg];
            await msg.reply(cachedResponse);
            
            const botMsgObj = { type: 'bot', body: cachedResponse, timestamp: Date.now() };
            convo.messages.push(botMsgObj);
            totalMessages++;
            io.emit('bot_reply', { userId, contactName, phone, body: cachedResponse, timestamp: botMsgObj.timestamp });
            return; // Skip Gemini
        }

        let chatSession;
        if (chatSessions.has(userId)) {
            chatSession = chatSessions.get(userId);
        } else {
            chatSession = model.startChat({ history: [] });
            chatSessions.set(userId, chatSession);
        }

        const fullMessage = `[User Name: ${contactName}]\n${userMessage}`;
        let result;
        let responseText = '';
        const currentHistory = await chatSession.getHistory();

        // Retry loop with key rotation
        for (let attempts = 0; attempts < apiKeys.length; attempts++) {
            try {
                result = await chatSession.sendMessage(fullMessage);
                responseText = result.response.text();
                break;
            } catch (apiError) {
                console.error(`[API] Error with key ${currentKeyIndex}:`, apiError.message || apiError);
                if (attempts === apiKeys.length - 1) throw apiError;
                console.log('[API] Rotating to next key...');
                currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
                model = getModel();
                chatSession = model.startChat({ history: currentHistory });
                chatSessions.set(userId, chatSession);
            }
        }

        console.log(`[DEBUG] Gemini reply: ${responseText.substring(0, 60)}...`);

        if (isCachable) {
            aiCache[normalizedMsg] = responseText;
            saveCache();
            console.log(`[CACHE] Saved new answer for: "${normalizedMsg}"`);
        }

        // Handle visit confirmation tag
        if (responseText.includes('[VISIT_CONFIRMED]')) {
            responseText = responseText.replace('[VISIT_CONFIRMED]', '').trim();
            console.log('[DEBUG] Visit confirmed! Setting 24h reminder.');
            setTimeout(async () => {
                try {
                    await chat.sendMessage("Hi there! Just a polite reminder from Aria about your upcoming site visit. We're looking forward to showing you around!");
                } catch (e) {
                    console.error('[Reminder] Failed to send:', e);
                }
            }, 60000 * 60 * 24);
        }

        // Send reply
        await msg.reply(responseText);
        console.log('[DEBUG] Reply sent.');

        // Store bot reply in history & emit
        const botMsgObj = { type: 'bot', body: responseText, timestamp: Date.now() };
        convo.messages.push(botMsgObj);
        totalMessages++;
        io.emit('bot_reply', { userId, contactName, phone, body: responseText, timestamp: botMsgObj.timestamp });

        // 60-second summary timer
        if (userTimers.has(userId)) clearTimeout(userTimers.get(userId));
        const timer = setTimeout(async () => {
            try {
                const history = await chatSession.getHistory();
                const historyCopy = JSON.parse(JSON.stringify(history));
                const summaryModel = getModel();
                const summarySession = summaryModel.startChat({ history: historyCopy });
                const prompt = "Based on this conversation, summarize the user's interest level in a single line using exactly this format: '\"[user's name]\" : interested/not interested in \"[property name]\"'. If you don't know the property name, use 'unknown property'. Do not add any extra text.";
                const summaryResult = await summarySession.sendMessage(prompt);
                const summaryText = summaryResult.response.text().trim();
                console.log(`\n================ SUMMARY ================\n${summaryText}\n=========================================\n`);
                io.emit('summary', { userId, contactName, summary: summaryText });
            } catch (err) {
                console.error('[Summary] Error:', err.message || err);
            }
        }, 60000);
        userTimers.set(userId, timer);

    } catch (error) {
        console.error('[ERROR] Final Gemini failure:', error.message || error);
    } finally {
        await chat.clearState();
    }
});

restartBot();
