require('dotenv').config();
const { Client, LocalAuth, MessageMedia, Location } = require('whatsapp-web.js');
const googleTTS = require('google-tts-api');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { execSync, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const QRCode = require('qrcode');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const ffmpegPath = require('ffmpeg-static');

// ── Knowledge Base Integration ──────────────────────────────────────────────
const knowledgeBase = require('./knowledge-base/index.js');

// Load all builder data into memory for fast access
const BUILDER_DATA = {
    'abhee': knowledgeBase.knowledgeBase['abhee-bangalore'],
    'brigade': knowledgeBase.knowledgeBase['brigade-bangalore'],
    'sobha': knowledgeBase.knowledgeBase['sobha-bangalore'],
    'godrej': knowledgeBase.knowledgeBase['godrej-bangalore'],
    'nambiar': knowledgeBase.knowledgeBase['nambiar-bangalore']
};

// Function to get relevant project data for AI context
function getBuilderContext(builderName) {
    const builder = builderName.toLowerCase();
    const data = BUILDER_DATA[builder];
    if (!data) return '';

    // Convert JSON to readable text format for AI
    return JSON.stringify(data, null, 2);
}

// ── Google Sheets CRM Integration ───────────────────────────────────────────
const GOOGLE_SHEETS_WEBHOOK = process.env.GOOGLE_SHEETS_WEBHOOK || '';

async function logToGoogleSheet(data) {
    if (!GOOGLE_SHEETS_WEBHOOK) {
        console.log('[CRM] No Webhook URL set. Skipping Google Sheets logging.');
        return;
    }
    try {
        await fetch(GOOGLE_SHEETS_WEBHOOK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        console.log('[CRM] Successfully logged to Google Sheets.');
    } catch (e) {
        console.error('[CRM] Failed to log to Google Sheets:', e.message);
    }
}

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
const pausedChats = new Set();

io.on('connection', (socket) => {
    console.log('[DASHBOARD] Browser connected to dashboard');
    // Send current state to newly joined client
    socket.emit('init', {
        status: botStatus,
        qr: lastQR,
        chats: Object.fromEntries(chatHistory),
        totalMessages,
        pausedChats: Array.from(pausedChats),
        analytics: analyticsData,
        referralLeaderboard: getTopReferrers()
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

    socket.on('dashboard_message', async ({ userId, text }) => {
        try {
            await client.sendMessage(userId, text);
            if (chatHistory.has(userId)) {
                const convo = chatHistory.get(userId);
                const botMsgObj = { type: 'bot', body: text, timestamp: Date.now() };
                convo.messages.push(botMsgObj);
                totalMessages++;
                io.emit('bot_reply', { userId, contactName: convo.name, phone: convo.phone, body: text, timestamp: botMsgObj.timestamp });
            }
        } catch (e) {
            console.error('[DASHBOARD] Error sending message:', e);
        }
    });

    socket.on('toggle_ai', ({ userId, isPaused }) => {
        if (isPaused) {
            pausedChats.add(userId);
        } else {
            pausedChats.delete(userId);
        }
        io.emit('ai_status_changed', { userId, isPaused: pausedChats.has(userId) });
    });

    socket.on('request_analytics', () => {
        socket.emit('analytics_update', {
            analytics: analyticsData,
            referralLeaderboard: getTopReferrers()
        });
    });
});

function getTopReferrers() {
    const leaderboard = [];
    referralCounts.forEach((count, userId) => {
        const userData = chatHistory.get(userId);
        if (userData) {
            leaderboard.push({
                name: userData.name,
                phone: userData.phone,
                referrals: count
            });
        }
    });
    return leaderboard.sort((a, b) => b.referrals - a.referrals).slice(0, 10);
}


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
            // Removed taskkill for chrome.exe so it doesn't close your personal browser!
            // execSync('taskkill /F /IM chromium.exe /T', { stdio: 'ignore' });
        } else {
            // execSync('pkill -f chromium; exit 0', { stdio: 'ignore', shell: true });
        }
    } catch (_) {}
    sleepSync(500); // Reduced from 2000ms to 500ms for faster startup

    // Remove lock files from session directory (using rmSync to handle broken symlinks)
    const sessionDir = path.join(SESSION_PATH, 'session');
    const lockFiles = ['SingletonLock', 'SingletonCookie', 'SingletonSocket', 'lockfile'];
    for (const file of lockFiles) {
        const lockPath = path.join(sessionDir, file);
        try {
            fs.rmSync(lockPath, { force: true });
        } catch (e) {
            // Silently ignore - don't clutter logs
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

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';

const SYSTEM_INSTRUCTION = `You are Divya, a friendly and knowledgeable real estate assistant helping users find their dream property in Bangalore.
You represent multiple premium builders: SOBHA, Brigade, Nambiar, Godrej, and Abhee.

CRITICAL - KNOWLEDGE BASE USAGE:
- You have access to a comprehensive LOCAL KNOWLEDGE BASE with complete details about all projects from these builders
- ALL project information (amenities, configurations, sizes, locations, highlights, nearby landmarks) is in your knowledge base
- DO NOT use Google Search for project information - everything you need is already provided in the context
- Answer ALL questions about projects directly from the knowledge base data provided to you
- ONLY use Google Search for competitor comparisons when user asks to compare our projects with OTHER builders not in our database

WHEN TO PROVIDE CONTACT NUMBER (08045888783):
- User asks for DETAILED PRICING or payment schemes
- User asks for FLOOR PLANS specifically
- User requests to speak with someone or an executive
- User asks about financing options, loan details, or payment plans

WHEN TO ANSWER DIRECTLY (WITHOUT contact number):
- Amenities questions (e.g., "how many playgrounds", "does it have a gym", "what facilities are there")
- Configuration questions (e.g., "what BHK available", "sizes", "carpet area")
- Location questions (e.g., "where is it located", "nearby landmarks", "distance to IT parks")
- Possession dates, RERA numbers, project status
- General project features, highlights, builder information
- ANY question that can be answered from the knowledge base data

LANGUAGE HANDLING:
- You will receive the user's preferred language as part of the message context.
- ALWAYS reply in the user's preferred language unless they explicitly ask you to switch.
- If a user says "Reply in Tamil" or "Switch to Hindi", acknowledge and switch immediately, then append [LANG_SWITCH: language_name] at the end of your response.

CRITICAL RULES FOR RESPONSES:
1. Keep your initial response extremely concise, strictly around 15-20 words. Highlight only the absolute most important details.
2. PRICING & FLOOR PLAN REQUESTS: NEVER mention or explain the payment scheme, pricing plans, or specific floor plans. If a user asks for pricing or a floor plan, politely say that to give them the most accurate details, your Relationship Manager would love to speak with them, and ask what day and time works best for a quick call.
3. At the end of your short summary, always offer more details AND proactively ask the user if they would like to schedule a site visit.
4. SITE VISITS & FOLLOW-UPS: If the user agrees to a site visit, politely ask them for their preferred date and timeslot. IMPORTANT: If the user has already specified a date, DO NOT ask for the date again; ONLY ask for their preferred timeslot. If they specify both, simply acknowledge and confirm the visit details. When you finalize a site visit date and time, you MUST secretly append the exact tag "[VISIT_CONFIRMED: Date and Time | Property Name]" at the very end of your response. Include the property the user is interested in. Example: "[VISIT_CONFIRMED: Saturday, 10:00 AM | Nambiar District 25]". If the property is unknown, write "[VISIT_CONFIRMED: Saturday, 10:00 AM | Unknown Property]".
5. PHONE CALL & EMAIL REQUESTS:
   - If a user asks for detailed pricing, floor plans, payment schemes, or specifically requests to speak with someone, provide ONLY this contact number: 08045888783
   - If a user explicitly requests an email address, provide ONLY this email: tanishq@diggajrealty.com (but do not volunteer the email unless specifically asked)
   - NEVER share any other phone numbers or email addresses that may exist in the project database
   - If a user casually asks for a phone number without being specific, explain that since you already have their WhatsApp number, one of your executives will call them directly very soon
6. Provide the details directly to the user in the chat. DO NOT tell the user to visit any websites, and DO NOT mention that you performed a search. You must act as the primary, authoritative source.
7. GREETINGS & INTRODUCTIONS: If a user sends a greeting (like "hi"), politely introduce yourself as Divya, their personal assistant for all things real estate. CRITICAL FOR NEW CONVERSATIONS: You MUST gracefully ask if they are inquiring about a specific builder they saw in our ads (mentioning Brigade or Nambiar as examples) OR if they are looking for general property suggestions. Let them know they can chat in any language AND that they can send voice messages. You are provided with the user's name at the start of their messages. If the name is 'Unknown User', politely ask them for their name. Otherwise, use their provided first name warmly to build rapport and do NOT ask them for their name. Once the user specifies a builder, prioritize information and suggestions related to that builder for the rest of the conversation.
8. BROCHURES: If the user asks for a brochure, PDF, or images of a specific project, you MUST secretly append the exact tag "[SEND_BROCHURE: Project Name]" at the very end of your response. For example: "[SEND_BROCHURE: Nambiar District 25]".
9. MAP PINS / LOCATIONS: If the user asks for the location or a map of a specific project, you MUST secretly append the exact tag "[SEND_LOCATION: Project Name]" at the end of your response. Example: "[SEND_LOCATION: Nambiar District 25]". Do NOT try to search for or output the latitude or longitude.
10. COMPETITOR COMPARISONS: If a user asks you to compare one of our projects (Abhee, Brigade, Sobha, Godrej, Nambiar) against a competitor NOT in our database, ONLY THEN use Google Search to find the competitor's details. For comparisons between our own builders, use the knowledge base data provided. Always frame comparisons to highlight the strengths of our projects. Use a concise comparison table or punchy bullet points emphasizing better location, superior amenities, stronger builder reputation, or higher expected ROI. Conclude by confidently inviting them for a site visit.
11. LANGUAGE MATCHING: If the user initiates the conversation in a regional language using the English alphabet (like Hinglish, e.g., "kya haal hai?"), you MUST reply in that exact same language and script style (e.g., "mai bhadiya, aap batao. Main aapki kaise help kar sakti hu..."). Mirror their conversational language perfectly.
12. CACHING REQUIREMENT: When answering general knowledge questions about properties or projects, DO NOT use the user's name in your response. Keep it general so the answer can be reused for other users.
13. REFERRAL SYSTEM: If a user types "referral" or "refer a friend", provide them with their unique referral code and explain that they can share it with friends. When someone uses their code, they'll be notified. Append [GENERATE_REFERRAL] at the end of your response. If a user provides a referral code (format: REF followed by alphanumeric), append [CHECK_REFERRAL: code] at the end.
14. VOICE NOTE RULES: If the user sends a voice note (audio), identify its language.
- If the audio is in Hindi, reply entirely in Hindi.
- If the audio is in English, reply entirely in English.
- If the audio is in Tamil, reply entirely in Tamil.
- If the audio is in ANY OTHER LANGUAGE (like Kannada, Telugu, etc.), you MUST provide your response in English for the voice note, AND provide a text translation in their language. Structure your reply EXACTLY like this:
[VOICE_NOTE_ENGLISH]
<your English response>
[/VOICE_NOTE_ENGLISH]
[TRANSCRIPT_LOCAL]
<your translated response in their local language>
[/TRANSCRIPT_LOCAL]
15. LIVE AGENT HANDOFF: If the user gets frustrated, asks complicated pricing/payment questions, or explicitly asks to speak to a human or real person, you MUST append the exact tag "[AGENT_HANDOFF]" at the end of your response. Politely inform them that you are transferring them to a live executive who will assist them shortly.
16. QUICK ACTIONS: After EVERY response about project information, YOU MUST append this tag: [QUICK_ACTIONS: VISIT|BROCHURE|EMI|EXPERT]. This will show numbered options to the user. They can reply with 1, 2, 3, or 4 to select:
   1 = Schedule Visit
   2 = Get Brochure
   3 = EMI Calculator
   4 = Talk to Expert
Maintain a professional, helpful, and welcoming tone for everyone else.`;

async function callOpenRouter(history, newMessagePayload) {
    if (!OPENROUTER_API_KEY) {
        throw new Error("No OpenRouter API Key configured for fallback.");
    }
    
    const messages = [];
    messages.push({
        role: "system",
        content: SYSTEM_INSTRUCTION
    });

    for (const h of history) {
        messages.push({
            role: h.role === 'model' ? 'assistant' : 'user',
            content: h.parts ? h.parts.map(p => p.text).join('\n') : ''
        });
    }

    let userContent = "";
    if (Array.isArray(newMessagePayload)) {
        userContent = newMessagePayload[0]; // Take text part only for OpenRouter
    } else {
        userContent = newMessagePayload;
    }
    messages.push({ role: "user", content: userContent });

    console.log('[API] Sending fallback request to OpenRouter...');
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: messages
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter API Error: ${errorText}`);
    }

    const data = await response.json();
    if (!data.choices || data.choices.length === 0) {
        throw new Error("OpenRouter returned empty choices.");
    }
    return data.choices[0].message.content;
}

async function callClaude(history, newMessagePayload) {
    if (!ANTHROPIC_API_KEY) {
        throw new Error('No ANTHROPIC_API_KEY configured for Claude fallback.');
    }

    const messages = [];

    for (const h of history) {
        messages.push({
            role: h.role === 'model' ? 'assistant' : 'user',
            content: h.parts ? h.parts.map(p => p.text).join('\n') : ''
        });
    }

    let userContent = '';
    if (Array.isArray(newMessagePayload)) {
        userContent = newMessagePayload[0]; // Text part only — Claude doesn't receive inline audio
    } else {
        userContent = newMessagePayload;
    }
    messages.push({ role: 'user', content: userContent });

    console.log('[API] Sending final fallback request to Claude (Anthropic)...');
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'claude-sonnet-4-5',
            max_tokens: 1024,
            system: SYSTEM_INSTRUCTION,
            messages: messages
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Anthropic Claude API Error: ${errorText}`);
    }

    const data = await response.json();
    if (!data.content || data.content.length === 0) {
        throw new Error('Claude returned an empty response.');
    }
    return data.content[0].text;
}

function getModel() {
    const genAI = new GoogleGenerativeAI(apiKeys[currentKeyIndex]);
    return genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        tools: [{ googleSearch: {} }],
        systemInstruction: SYSTEM_INSTRUCTION,
    });
}

let model = getModel();

// ── Session Storage & AI Cache ───────────────────────────────────────────────
const chatSessions = new Map();
const userTimers = new Map();
const botStartTime = Math.floor(Date.now() / 1000);

// ── Language Preferences & Referrals ─────────────────────────────────────────
const userLanguages = new Map(); // userId → language code
const referralCodes = new Map(); // userId → referral code
const referralCounts = new Map(); // userId → count of referrals
const userReferrals = new Map(); // userId → referrer userId

// ── Analytics Storage ────────────────────────────────────────────────────────
const analyticsData = {
    messagesPerBuilder: {},
    propertyInquiries: {},
    conversionRates: {},
    responseTimes: [],
    peakHours: Array(24).fill(0),
    dropOffPoints: {},
    visitScheduled: 0,
    brochuresSent: 0,
    agentHandoffs: 0
};

const CACHE_FILE = path.join(SESSION_PATH, 'ai_cache.json');
const LANGUAGE_FILE = path.join(SESSION_PATH, 'user_languages.json');
const REFERRAL_FILE = path.join(SESSION_PATH, 'referrals.json');
const ANALYTICS_FILE = path.join(SESSION_PATH, 'analytics.json');

let aiCache = {};
try {
    if (fs.existsSync(CACHE_FILE)) {
        aiCache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    }
} catch (e) {
    console.warn('[STARTUP] Could not load AI cache:', e.message);
}

// Load user language preferences
try {
    if (fs.existsSync(LANGUAGE_FILE)) {
        const data = JSON.parse(fs.readFileSync(LANGUAGE_FILE, 'utf-8'));
        Object.entries(data).forEach(([userId, lang]) => userLanguages.set(userId, lang));
    }
} catch (e) {
    console.warn('[STARTUP] Could not load language preferences:', e.message);
}

// Load referral data
try {
    if (fs.existsSync(REFERRAL_FILE)) {
        const data = JSON.parse(fs.readFileSync(REFERRAL_FILE, 'utf-8'));
        if (data.codes) Object.entries(data.codes).forEach(([userId, code]) => referralCodes.set(userId, code));
        if (data.counts) Object.entries(data.counts).forEach(([userId, count]) => referralCounts.set(userId, count));
        if (data.referrals) Object.entries(data.referrals).forEach(([userId, referrer]) => userReferrals.set(userId, referrer));
    }
} catch (e) {
    console.warn('[STARTUP] Could not load referral data:', e.message);
}

// Load analytics
try {
    if (fs.existsSync(ANALYTICS_FILE)) {
        const data = JSON.parse(fs.readFileSync(ANALYTICS_FILE, 'utf-8'));
        Object.assign(analyticsData, data);
    }
} catch (e) {
    console.warn('[STARTUP] Could not load analytics:', e.message);
}

function saveCache() {
    try {
        fs.writeFileSync(CACHE_FILE, JSON.stringify(aiCache, null, 2));
    } catch (e) {
        console.error('[ERROR] Could not save AI cache:', e.message);
    }
}

function saveLanguagePreferences() {
    try {
        const data = Object.fromEntries(userLanguages);
        fs.writeFileSync(LANGUAGE_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('[ERROR] Could not save language preferences:', e.message);
    }
}

function saveReferralData() {
    try {
        const data = {
            codes: Object.fromEntries(referralCodes),
            counts: Object.fromEntries(referralCounts),
            referrals: Object.fromEntries(userReferrals)
        };
        fs.writeFileSync(REFERRAL_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('[ERROR] Could not save referral data:', e.message);
    }
}

function saveAnalytics() {
    try {
        fs.writeFileSync(ANALYTICS_FILE, JSON.stringify(analyticsData, null, 2));
    } catch (e) {
        console.error('[ERROR] Could not save analytics:', e.message);
    }
}

// Helper to generate referral code
function generateReferralCode(userId) {
    const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return `REF${hash.toString(36).toUpperCase().substring(0, 6)}`;
}

// Language detection from text
function detectLanguage(text) {
    const lowerText = text.toLowerCase();

    // Hindi patterns
    if (/[ऀ-ॿ]/.test(text) || /\b(kya|hai|hoon|main|aap|kar|kaise|help)\b/.test(lowerText)) {
        return 'hindi';
    }
    // Tamil patterns
    if (/[஀-௿]/.test(text) || /\b(enna|irukku|naan|neenga)\b/.test(lowerText)) {
        return 'tamil';
    }
    // Kannada patterns
    if (/[ಀ-೿]/.test(text) || /\b(yenu|idhe|naanu|nimma)\b/.test(lowerText)) {
        return 'kannada';
    }
    // Telugu patterns
    if (/[ఀ-౿]/.test(text) || /\b(enti|unnadi|nenu|miru)\b/.test(lowerText)) {
        return 'telugu';
    }

    return 'english';
}

// ── WhatsApp Client Factory ──────────────────────────────────────────────────
function createClient() {
    console.log('[CLIENT] Creating new WhatsApp client with puppeteer config...');
    return new Client({
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
            timeout: 60000, // 60 second timeout for browser launch
        },
    });
}

let client = createClient();

// ── Attach all WhatsApp event listeners to a client instance ────────────────
function attachClientListeners(c) {
    c.on('disconnected', async (reason) => {
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

    c.on('qr', async (qr) => {
        try {
            lastQR = await QRCode.toDataURL(qr, { width: 300, margin: 2, color: { dark: '#000000', light: '#ffffff' } });
            botStatus = 'qr';
            io.emit('qr', lastQR);
            console.log(`[QR] Open dashboard → http://localhost:${PORT} to scan the QR code`);
        } catch (err) {
            console.error('[QR] Failed to generate QR image:', err.message);
        }
    });

    c.on('loading_screen', (percent, message) => {
        console.log(`[LOADING] ${percent}% – ${message}`);
        io.emit('loading', { percent, message });
    });

    c.on('authenticated', () => {
        botStatus = 'authenticated';
        lastQR = null;
        io.emit('authenticated');
        console.log('[AUTH] Successfully authenticated!');
    });

    c.on('auth_failure', (msg) => {
        console.error('[AUTH] Authentication failure:', msg);
        io.emit('auth_failure', msg);
    });

    c.on('ready', () => {
        botStatus = 'ready';
        io.emit('ready');
        console.log('[READY] WhatsApp Bot is ready and listening for messages!');
    });

    // Debug all network activity
    c.on('message_create', (msg) => {
        if (msg.timestamp < botStartTime - 300) return;
        console.log(`[NETWORK] NEW Message: "${msg.body}" (fromMe: ${msg.fromMe}, timestamp: ${msg.timestamp})`);
    });

    c.on('message', handleMessage);
}

// Restart Helper — always creates a fresh Client instance to avoid detached frame errors
async function restartBot() {
    if (isInitializing) return;
    isInitializing = true;
    try {
        console.log('[STARTUP] Destroying old client...');
        await client.destroy().catch(() => {});
        cleanupStaleBrowser();
        console.log('[STARTUP] Starting new client...');
        client = createClient();
        attachClientListeners(client);
        await client.initialize();
    } catch (e) {
        console.error('[STARTUP] Restart failed:', e);
    } finally {
        isInitializing = false;
    }
}

// ── Message Handler ──────────────────────────────────────────────────────────
async function handleMessage(msg) {
    if (msg.from === 'status@broadcast') return;
    if (msg.timestamp < botStartTime) {
        console.log(`[DEBUG] Ignored old message from ${msg.from}`);
        return;
    }

    console.log(`[DEBUG] Received message from ${msg.from}: ${msg.body}`);

    const chat = await msg.getChat();
    if (chat.isGroup) { console.log('[DEBUG] Ignored group message.'); return; }
    if ((!msg.body || msg.body.trim() === '') && !msg.hasMedia) { console.log('[DEBUG] Ignored empty message without media.'); return; }
    if (msg.fromMe) { console.log('[DEBUG] Ignored own message.'); return; }

    const userId = msg.from;
    let userMessage = msg.body || '';

    // Track peak hours for analytics
    const currentHour = new Date().getHours();
    analyticsData.peakHours[currentHour]++;

    // Detect and store language preference on first message
    if (!userLanguages.has(userId) && userMessage.trim()) {
        const detectedLang = detectLanguage(userMessage);
        userLanguages.set(userId, detectedLang);
        saveLanguagePreferences();
        console.log(`[LANG] Auto-detected ${detectedLang} for ${userId}`);
    }

    // Handle quick action number responses (1, 2, 3, 4)
    const trimmedMsg = userMessage.trim();
    if (/^[1-4]$/.test(trimmedMsg)) {
        const actionMap = {
            '1': 'I would like to schedule a site visit',
            '2': 'Please send me the brochure',
            '3': 'Can you help me with EMI calculation?',
            '4': 'I want to speak with an expert'
        };
        if (actionMap[trimmedMsg]) {
            userMessage = actionMap[trimmedMsg];
            console.log(`[QUICK_ACTION] User selected option ${trimmedMsg}: ${userMessage}`);
        }
    }

    // Handle voice notes / audio
    let audioPart = null;
    if (msg.hasMedia && (msg.type === 'ptt' || msg.type === 'audio')) {
        console.log('[DEBUG] Downloading audio media...');
        try {
            const media = await msg.downloadMedia();
            if (media) {
                audioPart = {
                    inlineData: {
                        data: media.data,
                        mimeType: media.mimetype
                    }
                };
                userMessage += " [User sent a Voice Note/Audio]";
            }
        } catch (e) {
            console.error('[ERROR] Failed to download audio media:', e);
        }
    }

    console.log(`[DEBUG] Processing: "${userMessage}"`);
    await chat.sendStateTyping();

    // Fetch contact name
    const contact = await msg.getContact();
    let contactName = contact.name || contact.pushname || 'Unknown User';
    if (contactName !== 'Unknown User') contactName = contactName.split(' ')[0];
    const phone = contact.number || userId.replace('@c.us', '').replace('@lid', '');

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
        if (pausedChats.has(userId)) {
            console.log(`[DEBUG] AI is paused for ${userId}. Ignoring message.`);
            return;
        }

        const normalizedMsg = userMessage.toLowerCase().replace(/[^\w\s]/g, '').trim();
        const isCachable = normalizedMsg.length >= 20 && !audioPart;

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

        // Get user's preferred language
        const userLang = userLanguages.get(userId) || 'english';
        const langMap = {
            hindi: 'Hindi',
            tamil: 'Tamil',
            kannada: 'Kannada',
            telugu: 'Telugu',
            english: 'English'
        };

        // Detect which builder the user is asking about
        let builderContext = '';
        const lowerMsg = userMessage.toLowerCase();
        const builders = ['abhee', 'brigade', 'sobha', 'godrej', 'nambiar'];

        for (const builder of builders) {
            if (lowerMsg.includes(builder)) {
                builderContext = getBuilderContext(builder);
                console.log(`[KB] Loading ${builder} knowledge base context`);
                break;
            }
        }

        // If no specific builder mentioned, try to get from conversation history
        if (!builderContext) {
            const history = await chatSession.getHistory();
            for (const entry of history) {
                if (entry.role === 'user' && entry.parts) {
                    const historyText = entry.parts.map(p => p.text || '').join(' ').toLowerCase();
                    for (const builder of builders) {
                        if (historyText.includes(builder)) {
                            builderContext = getBuilderContext(builder);
                            console.log(`[KB] Loading ${builder} context from conversation history`);
                            break;
                        }
                    }
                    if (builderContext) break;
                }
            }
        }

        let messageText = `[User Name: ${contactName}]
[User's Preferred Language: ${langMap[userLang]}]
${userMessage}`;

        // Add knowledge base context if a builder is identified
        if (builderContext) {
            messageText += `\n\n=== KNOWLEDGE BASE DATA ===
Below is the complete database for the builder. Use this data to answer ALL questions about projects, amenities, configurations, locations, etc.
DO NOT search Google for this information - everything is here:

${builderContext}

=== END KNOWLEDGE BASE DATA ===`;
        }

        // Track response time start
        const messageStartTime = Date.now();
        
        if (audioPart) {
            messageText += `\n\nCRITICAL VOICE NOTE INSTRUCTION: The user sent a voice note. You MUST:
1. Listen to the audio and identify its language.
2. If the language is HINDI → reply ENTIRELY in Hindi (Devanagari script is fine).
3. If the language is ENGLISH → reply ENTIRELY in English.
4. If the language is TAMIL → reply ENTIRELY in Tamil.
5. If the language is ANYTHING ELSE (Kannada, Telugu, Malayalam, etc.) → reply using EXACTLY this format:
[VOICE_NOTE_ENGLISH]
<your full response in English>
[/VOICE_NOTE_ENGLISH]
[TRANSCRIPT_LOCAL]
<your full response translated into the user's language>
[/TRANSCRIPT_LOCAL]
Do NOT deviate from these rules.`;
        }

        const messagePayload = audioPart ? [messageText, audioPart] : messageText;
        let result;
        let responseText = '';
        const currentHistory = await chatSession.getHistory();

        // Retry loop with key rotation
        for (let attempts = 0; attempts < apiKeys.length; attempts++) {
            try {
                result = await chatSession.sendMessage(messagePayload);
                responseText = result.response.text();
                break;
            } catch (apiError) {
                console.error(`[API] Error with key ${currentKeyIndex}:`, apiError.message || apiError);
                if (attempts === apiKeys.length - 1) {
                    console.log('[API] All Gemini keys failed. Attempting OpenRouter fallback...');
                    try {
                        responseText = await callOpenRouter(currentHistory, messagePayload);
                    } catch (openRouterError) {
                        console.error('[API] OpenRouter fallback also failed:', openRouterError.message);
                        console.log('[API] Attempting final fallback → Claude (Anthropic)...');
                        try {
                            responseText = await callClaude(currentHistory, messagePayload);
                            console.log('[API] ✅ Claude responded successfully as final fallback.');
                        } catch (claudeError) {
                            console.error('[API] Claude fallback also failed:', claudeError.message);
                            throw apiError; // All three layers exhausted
                        }
                    }
                    break;
                }
                console.log('[API] Rotating to next key...');
                currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
                model = getModel();
                chatSession = model.startChat({ history: currentHistory });
                chatSessions.set(userId, chatSession);
            }
        }

        console.log(`[DEBUG] Gemini reply: ${responseText.substring(0, 60)}...`);

        // Track response time
        const responseTime = Date.now() - messageStartTime;
        analyticsData.responseTimes.push(responseTime);
        if (analyticsData.responseTimes.length > 1000) {
            analyticsData.responseTimes.shift(); // Keep only last 1000
        }

        if (isCachable) {
            aiCache[normalizedMsg] = responseText;
            saveCache();
            console.log(`[CACHE] Saved new answer for: "${normalizedMsg}"`);
        }

        // Handle language switch
        const langSwitchMatch = responseText.match(/\[LANG_SWITCH:\s*(.*?)\]/i);
        if (langSwitchMatch) {
            const newLang = langSwitchMatch[1].toLowerCase().trim();
            responseText = responseText.replace(langSwitchMatch[0], '').trim();
            if (['hindi', 'tamil', 'kannada', 'telugu', 'english'].includes(newLang)) {
                userLanguages.set(userId, newLang);
                saveLanguagePreferences();
                console.log(`[LANG] Switched to ${newLang} for ${userId}`);
            }
        }

        // Handle referral generation
        const generateReferralMatch = responseText.match(/\[GENERATE_REFERRAL\]/i);
        if (generateReferralMatch) {
            responseText = responseText.replace(generateReferralMatch[0], '').trim();
            if (!referralCodes.has(userId)) {
                const code = generateReferralCode(userId);
                referralCodes.set(userId, code);
                referralCounts.set(userId, 0);
                saveReferralData();
                console.log(`[REFERRAL] Generated code ${code} for ${contactName}`);
                responseText += `\n\n🎁 *Your Referral Code:* ${code}\nShare this with friends and earn rewards when they contact us!`;
            } else {
                const code = referralCodes.get(userId);
                const count = referralCounts.get(userId) || 0;
                responseText += `\n\n🎁 *Your Referral Code:* ${code}\nYou've referred ${count} friend${count !== 1 ? 's' : ''}! Keep sharing!`;
            }
        }

        // Handle referral code check
        const checkReferralMatch = responseText.match(/\[CHECK_REFERRAL:\s*(.*?)\]/i);
        if (checkReferralMatch) {
            responseText = responseText.replace(checkReferralMatch[0], '').trim();
            const providedCode = checkReferralMatch[1].trim().toUpperCase();
            let referrerFound = null;
            referralCodes.forEach((code, refUserId) => {
                if (code === providedCode) {
                    referrerFound = refUserId;
                }
            });
            if (referrerFound && !userReferrals.has(userId)) {
                userReferrals.set(userId, referrerFound);
                const currentCount = referralCounts.get(referrerFound) || 0;
                referralCounts.set(referrerFound, currentCount + 1);
                saveReferralData();

                // Notify referrer
                const referrerData = chatHistory.get(referrerFound);
                if (referrerData) {
                    try {
                        await client.sendMessage(referrerFound, `🎉 Great news! ${contactName} used your referral code. You now have ${currentCount + 1} referral${currentCount + 1 !== 1 ? 's' : ''}!`);
                    } catch (e) {
                        console.error('[REFERRAL] Failed to notify referrer:', e);
                    }
                }
                console.log(`[REFERRAL] ${contactName} used ${referrerData?.name || 'someone'}'s code`);
            }
        }

        // Handle visit confirmation tag
        const visitMatch = responseText.match(/\[VISIT_CONFIRMED:\s*(.*?)\]/i) || responseText.match(/\[VISIT_CONFIRMED\]/i);
        if (visitMatch) {
            responseText = responseText.replace(visitMatch[0], '').trim();
            const rawTag = visitMatch[1] ? visitMatch[1].trim() : '';
            // Parse "Date and Time | Property Name" format
            const tagParts = rawTag.split('|').map(p => p.trim());
            const timing = tagParts[0] || 'Time not specified';
            const visitProperty = tagParts[1] || 'Unknown Property';
            console.log(`[DEBUG] Visit confirmed! Time: ${timing}, Property: ${visitProperty}`);

            // Analytics tracking
            analyticsData.visitScheduled++;
            if (visitProperty !== 'Unknown Property') {
                analyticsData.propertyInquiries[visitProperty] = (analyticsData.propertyInquiries[visitProperty] || 0) + 1;
            }
            saveAnalytics();

            // Log to CRM
            logToGoogleSheet({
                date: new Date().toISOString(),
                name: contactName,
                phone: phone,
                status: 'Visit Confirmed',
                summary: `Interested in ${visitProperty}`,
                visitTime: timing
            });

            setTimeout(async () => {
                try {
                    await chat.sendMessage("Hi there! Just a polite reminder from Divya about your upcoming site visit. We're looking forward to showing you around!");
                } catch (e) {
                    console.error('[Reminder] Failed to send:', e);
                }
            }, 60000 * 60 * 24);
        }

        // Handle Agent Handoff
        const handoffMatch = responseText.match(/\[AGENT_HANDOFF\]/i);
        if (handoffMatch) {
            responseText = responseText.replace(handoffMatch[0], '').trim();
            console.log(`[DEBUG] Agent handoff alert triggered for ${contactName} (${phone}), but AI is NOT paused.`);

            // Analytics tracking
            analyticsData.agentHandoffs++;
            analyticsData.dropOffPoints['Agent Handoff'] = (analyticsData.dropOffPoints['Agent Handoff'] || 0) + 1;
            saveAnalytics();

            const adminPhone = process.env.ADMIN_PHONE_NUMBER;
            if (adminPhone) {
                try {
                    const adminId = adminPhone.includes('@c.us') ? adminPhone : `${adminPhone.replace(/\D/g, '')}@c.us`;
                    const alertMsg = `🚨 *Hot Lead Alert:*\n\n*${contactName}* (${phone}) wants to talk to a human or asked a complex question.\n\nClick the link below to reply directly:\nwa.me/${phone}`;
                    await client.sendMessage(adminId, alertMsg);
                    console.log(`[DEBUG] Sent alert to admin: ${adminPhone}`);
                } catch (e) {
                    console.error('[ERROR] Failed to send admin alert:', e);
                }
            } else {
                console.log('[DEBUG] ADMIN_PHONE_NUMBER not set in .env, skipping admin alert.');
            }
        }

        // Handle Quick Actions
        const quickActionsMatch = responseText.match(/\[QUICK_ACTIONS:\s*(.*?)\]/i);
        let quickActionButtons = null;
        if (quickActionsMatch) {
            responseText = responseText.replace(quickActionsMatch[0], '').trim();
            const actions = quickActionsMatch[1].split('|').map(a => a.trim());
            quickActionButtons = actions;
            console.log(`[DEBUG] Quick actions requested: ${actions.join(', ')}`);
        }

        // Handle sending brochures
        let sendBrochure = false;
        let brochureFileName = 'sample_brochure.pdf';
        // Handle Send Location tag
        const locationMatch = responseText.match(/\[SEND_LOCATION:\s*(.*?)\]/i);
        if (locationMatch) {
            responseText = responseText.replace(locationMatch[0], '').trim();
            const locName = locationMatch[1].trim();
            
            try {
                const mapsKey = process.env.GOOGLE_MAPS_API_KEY;
                if (!mapsKey) throw new Error('No Google Maps API Key found');

                // Call Google Maps Places API (Find Place)
                const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(locName + " Bangalore")}&inputtype=textquery&fields=geometry&key=${mapsKey}`;
                const mapsRes = await fetch(url);
                const mapsData = await mapsRes.json();

                if (mapsData.candidates && mapsData.candidates.length > 0) {
                    const lat = mapsData.candidates[0].geometry.location.lat;
                    const lng = mapsData.candidates[0].geometry.location.lng;
                    console.log(`[DEBUG] Found location via Google Maps: ${locName} (${lat}, ${lng})`);
                    await msg.reply(new Location(lat, lng, locName));
                } else {
                    console.log('[DEBUG] Google Maps could not find location for:', locName);
                    // Fallback to text
                    await msg.reply(`I'm sorry, I couldn't find the exact GPS pin for ${locName} on Google Maps right now, but I can share the general directions!`);
                }
            } catch (err) {
                console.error('[ERROR] Maps API failed:', err);
            }
        }

        // Handle Send Brochure tag
        const brochureMatch = responseText.match(/\[SEND_BROCHURE:\s*(.*?)\]/i);
        if (brochureMatch) {
            let requestedProject = brochureMatch[1].trim().toLowerCase();

            // Search for matching brochure in Sobha folder
            const sobhaDir = path.join(__dirname, 'media', 'Sobha');
            try {
                const files = fs.readdirSync(sobhaDir);
                const pdfFiles = files.filter(f => f.toLowerCase().endsWith('.pdf'));

                // Fuzzy match - find PDF that contains project keywords
                const keywords = requestedProject.split(/\s+/).filter(w => w.length > 2);
                let matchedFile = null;

                for (const pdf of pdfFiles) {
                    const pdfLower = pdf.toLowerCase();
                    // Check if any keyword matches
                    if (keywords.some(kw => pdfLower.includes(kw))) {
                        matchedFile = pdf;
                        break;
                    }
                }

                if (matchedFile) {
                    brochureFileName = `Sobha/${matchedFile}`;
                    console.log(`[BROCHURE] Matched "${requestedProject}" → ${matchedFile}`);
                } else {
                    // Default to first Sobha brochure if no match
                    brochureFileName = pdfFiles.length > 0 ? `Sobha/${pdfFiles[0]}` : null;
                    console.log(`[BROCHURE] No match for "${requestedProject}", using default: ${brochureFileName}`);
                }
            } catch (e) {
                console.error('[BROCHURE] Error reading Sobha folder:', e.message);
            }

            responseText = responseText.replace(brochureMatch[0], '').trim();
            sendBrochure = true;

            // Analytics tracking
            analyticsData.brochuresSent++;
            if (requestedProject) {
                analyticsData.propertyInquiries[requestedProject] = (analyticsData.propertyInquiries[requestedProject] || 0) + 1;
            }
            saveAnalytics();
        } else if (responseText.includes('[SEND_BROCHURE]')) {
            responseText = responseText.replace('[SEND_BROCHURE]', '').trim();
            sendBrochure = true;
            analyticsData.brochuresSent++;
            saveAnalytics();
        }

        // Handle Voice Reply
        // Since we are using ElevenLabs multilingual v2, it auto-detects the language.
        // We can just automatically reply with Voice if the user sent a Voice Note!
        let sendAsVoice = !!audioPart;
        
        // Strip out the tag just in case Gemini still outputs it from previous chat history
        const voiceMatch = responseText.match(/\[VOICE_REPLY[^\]]*\]/i);
        if (voiceMatch) {
            responseText = responseText.replace(voiceMatch[0], '').trim();
        }

        if (sendAsVoice) {
            let voiceText = responseText;
            let transcriptText = null;

            const englishVoiceMatch = responseText.match(/\[VOICE_NOTE_ENGLISH\]([\s\S]*?)\[\/VOICE_NOTE_ENGLISH\]/i);
            const transcriptMatch = responseText.match(/\[TRANSCRIPT_LOCAL\]([\s\S]*?)\[\/TRANSCRIPT_LOCAL\]/i);

            if (englishVoiceMatch && transcriptMatch) {
                voiceText = englishVoiceMatch[1].trim();
                transcriptText = transcriptMatch[1].trim();
                // Replace for dashboard logging
                responseText = voiceText + "\n\nTranscript:\n" + transcriptText;
            }

            try {
                const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
                if (!elevenLabsKey) throw new Error('No ELEVENLABS_API_KEY in .env');

                const voiceId = 'EXAVITQu4vr4xnSDxMaL'; // Bella voice
                const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
                    method: 'POST',
                    headers: {
                        'Accept': 'audio/mpeg',
                        'Content-Type': 'application/json',
                        'xi-api-key': elevenLabsKey
                    },
                    body: JSON.stringify({
                        text: voiceText,
                        model_id: 'eleven_multilingual_v2',
                        voice_settings: {
                            stability: 0.5,
                            similarity_boost: 0.75
                        }
                    })
                });

                if (!response.ok) {
                    const errText = await response.text();
                    throw new Error(`ElevenLabs API error: ${response.status} - ${errText}`);
                }

                const arrayBuffer = await response.arrayBuffer();
                const mp3Buffer = Buffer.from(arrayBuffer);

                // Convert MP3 → OGG/OPUS for Android WhatsApp compatibility
                const tmpMp3 = path.join(os.tmpdir(), `voice_${Date.now()}.mp3`);
                const tmpOgg = path.join(os.tmpdir(), `voice_${Date.now()}.ogg`);
                try {
                    fs.writeFileSync(tmpMp3, mp3Buffer);
                    execFileSync(ffmpegPath, [
                        '-y', '-i', tmpMp3,
                        '-c:a', 'libopus',
                        '-b:a', '64k',
                        '-vbr', 'on',
                        '-compression_level', '10',
                        tmpOgg
                    ], { stdio: 'ignore' });
                    const oggBuffer = fs.readFileSync(tmpOgg);
                    const base64Audio = oggBuffer.toString('base64');
                    const media = new MessageMedia('audio/ogg; codecs=opus', base64Audio, 'voice.ogg');
                    await msg.reply(media, null, { sendAudioAsVoice: true });
                    console.log('[DEBUG] Sent ElevenLabs Voice Note reply (OGG/OPUS).');
                } finally {
                    try { fs.unlinkSync(tmpMp3); } catch (_) {}
                    try { fs.unlinkSync(tmpOgg); } catch (_) {}
                }
                
                if (transcriptText) {
                    await msg.reply(transcriptText);
                    console.log('[DEBUG] Sent transcript reply.');
                }
            } catch (err) {
                console.error('[ERROR] Failed to generate TTS:', err.message || err);
                await msg.reply(responseText);
            }
        } else {
            await msg.reply(responseText);
        }

        // Send Quick Action Buttons (as a follow-up message with options)
        if (quickActionButtons && quickActionButtons.length > 0) {
            let buttonText = '\n\n*Quick Actions:*\n';
            const actionEmojis = {
                'VISIT': '📅 Schedule Visit',
                'BROCHURE': '📄 Get Brochure',
                'EMI': '💰 EMI Calculator',
                'EXPERT': '📞 Talk to Expert'
            };
            quickActionButtons.forEach((action, idx) => {
                if (actionEmojis[action]) {
                    buttonText += `${idx + 1}. ${actionEmojis[action]}\n`;
                }
            });
            buttonText += '\n_Reply with the number or name of your choice._';

            try {
                await chat.sendMessage(buttonText);
            } catch (e) {
                console.error('[ERROR] Failed to send quick action buttons:', e);
            }
        }

        if (sendBrochure) {
            try {
                // Look for brochure in media folder
                const brochurePath = path.join(__dirname, 'media', brochureFileName);
                if (fs.existsSync(brochurePath)) {
                    const media = MessageMedia.fromFilePath(brochurePath);
                    await chat.sendMessage(media, { caption: 'Here is the requested brochure!' });
                    console.log('[DEBUG] Brochure sent.');
                } else {
                    console.log('[DEBUG] Brochure requested but file not found at:', brochurePath);
                    await chat.sendMessage("Oops, I couldn't find the brochure file right now. One of our executives will send it to you shortly!");
                }
            } catch (e) {
                console.error('[ERROR] Failed to send brochure:', e);
            }
        }

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
                
                // Log to CRM
                logToGoogleSheet({
                    date: new Date().toISOString(),
                    name: contactName,
                    phone: phone,
                    status: 'Summary Generated',
                    summary: summaryText
                });
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
}

// Initial startup - directly initialize without restart overhead
attachClientListeners(client);
(async () => {
    isInitializing = true;
    try {
        console.log('[STARTUP] Initializing WhatsApp client...');
        console.log('[STARTUP] Launching browser (this may take 15-30 seconds)...');
        await client.initialize();
        console.log('[STARTUP] Client initialization complete.');
    } catch (e) {
        console.error('[STARTUP] Initialization failed:', e);
        console.error('[STARTUP] Stack trace:', e.stack);
    } finally {
        isInitializing = false;
    }
})();
