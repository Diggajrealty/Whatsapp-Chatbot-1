require('dotenv').config();
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { botConfigs, getSystemInstruction } = require('./botConfigs');

// ── Knowledge Base Integration ──────────────────────────────────────────────
const knowledgeBase = require('./knowledge-base/index.js');

// Map each bot to their specific knowledge base
const BOT_KNOWLEDGE_BASE = {
    'sobha': knowledgeBase.knowledgeBase['sobha-bangalore'],
    'brigade': knowledgeBase.knowledgeBase['brigade-bangalore'],
    'nambiar': knowledgeBase.knowledgeBase['nambiar-bangalore'],
    'godrej': knowledgeBase.knowledgeBase['godrej-bangalore'],
    'abhee': knowledgeBase.knowledgeBase['abhee-bangalore']
    // Note: DSR database not yet created
    // Note: 'all' bot will get combined data from all builders
};

// Function to get builder-specific knowledge base context
function getBotKnowledgeContext(botId) {
    // Special case: 'all' bot gets data from ALL builders
    if (botId === 'all') {
        const allData = {
            sobha: knowledgeBase.knowledgeBase['sobha-bangalore'],
            brigade: knowledgeBase.knowledgeBase['brigade-bangalore'],
            nambiar: knowledgeBase.knowledgeBase['nambiar-bangalore'],
            godrej: knowledgeBase.knowledgeBase['godrej-bangalore'],
            abhee: knowledgeBase.knowledgeBase['abhee-bangalore']
        };
        return JSON.stringify(allData, null, 2);
    }

    // For DSR bot, return empty until database is created
    if (botId === 'dsr') {
        console.log('[KB] DSR knowledge base not yet created. Bot will use Google Search.');
        return '';
    }

    // Regular bot-specific data
    const data = BOT_KNOWLEDGE_BASE[botId];
    if (!data) return '';
    return JSON.stringify(data, null, 2);
}

// ── Express / Socket.io Dashboard Server ────────────────────────────────────
const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer);
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`[SERVER] Multi-Bot Dashboard running → http://localhost:${PORT}`);
});

// ── Multi-Bot State Management ──────────────────────────────────────────────
const activeBots = new Map(); // botId → { client, status, qr, chatHistory, model, sessions }
const apiKeys = [
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY_4,
    process.env.GEMINI_API_KEY_5
].filter(Boolean);
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
let currentKeyIndex = 0;

// ── Socket.io Events ────────────────────────────────────────────────────────
io.on('connection', (socket) => {
    console.log('[DASHBOARD] Browser connected');

    // Send current bot states
    const states = {};
    activeBots.forEach((bot, botId) => {
        states[botId] = {
            status: bot.status,
            qr: bot.qr,
            chats: Object.fromEntries(bot.chatHistory),
            totalMessages: Array.from(bot.chatHistory.values()).reduce((sum, c) => sum + c.messages.length, 0)
        };
    });
    socket.emit('init', { bots: states });

    // Start a bot
    socket.on('start_bot', async ({ botId }) => {
        console.log(`[${botId.toUpperCase()}] Start requested`);
        if (activeBots.has(botId)) {
            socket.emit('bot_error', { botId, error: 'Bot already running' });
            return;
        }
        await startBot(botId);
    });

    // Stop a bot
    socket.on('stop_bot', async ({ botId }) => {
        console.log(`[${botId.toUpperCase()}] Stop requested`);
        await stopBot(botId);
    });

    // Send manual message
    socket.on('dashboard_message', async ({ botId, userId, text }) => {
        const bot = activeBots.get(botId);
        if (!bot || bot.status !== 'ready') return;

        try {
            await bot.client.sendMessage(userId, text);
            if (bot.chatHistory.has(userId)) {
                const convo = bot.chatHistory.get(userId);
                const msgObj = { type: 'bot', body: text, timestamp: Date.now() };
                convo.messages.push(msgObj);
                io.emit('bot_reply', { botId, userId, contactName: convo.name, body: text, timestamp: msgObj.timestamp });
            }
        } catch (e) {
            console.error(`[${botId.toUpperCase()}] Error sending message:`, e);
        }
    });
});

// ── Bot Lifecycle Management ────────────────────────────────────────────────
async function startBot(botId) {
    const config = botConfigs[botId];
    if (!config) {
        console.error(`[ERROR] Unknown bot ID: ${botId}`);
        return;
    }

    const SESSION_PATH = path.join(__dirname, `whatsapp_session_${botId}`);

    // Cleanup stale lock files
    const lockFiles = ['SingletonLock', 'SingletonCookie', 'SingletonSocket'];
    const sessionDir = path.join(SESSION_PATH, 'session');
    for (const file of lockFiles) {
        try {
            fs.rmSync(path.join(sessionDir, file), { force: true });
        } catch (_) {}
    }

    const client = new Client({
        authStrategy: new LocalAuth({
            dataPath: SESSION_PATH,
            clientId: botId
        }),
        puppeteer: {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu'
            ]
        }
    });

    const botState = {
        client,
        status: 'starting',
        qr: null,
        chatHistory: new Map(),
        model: null,
        sessions: new Map(), // userId → Gemini chat session
        config
    };

    activeBots.set(botId, botState);
    io.emit('bot_status', { botId, status: 'starting' });

    // Initialize Gemini model
    const genAI = new GoogleGenerativeAI(apiKeys[currentKeyIndex]);
    botState.model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction: getSystemInstruction(botId)
    });

    // Event: QR Code
    client.on('qr', async (qr) => {
        try {
            const qrData = await QRCode.toDataURL(qr, { width: 300 });
            botState.qr = qrData;
            botState.status = 'qr';
            io.emit('qr', { botId, qr: qrData });
            console.log(`[${botId.toUpperCase()}] QR code generated`);
        } catch (err) {
            console.error(`[${botId.toUpperCase()}] QR generation error:`, err.message);
        }
    });

    // Event: Loading
    client.on('loading_screen', (percent, message) => {
        io.emit('loading', { botId, percent, message });
    });

    // Event: Authenticated
    client.on('authenticated', () => {
        botState.status = 'authenticated';
        botState.qr = null;
        io.emit('authenticated', { botId });
        console.log(`[${botId.toUpperCase()}] Authenticated!`);
    });

    // Event: Ready
    client.on('ready', () => {
        botState.status = 'ready';
        io.emit('ready', { botId });
        console.log(`[${botId.toUpperCase()}] Bot is ready!`);
    });

    // Event: Disconnected
    client.on('disconnected', (reason) => {
        console.log(`[${botId.toUpperCase()}] Disconnected: ${reason}`);
        activeBots.delete(botId);
        io.emit('bot_status', { botId, status: 'offline' });
    });

    // Event: Message
    client.on('message', (msg) => handleMessage(botId, msg));

    // Initialize
    await client.initialize();
}

async function stopBot(botId) {
    const bot = activeBots.get(botId);
    if (!bot) return;

    try {
        await bot.client.destroy();
        activeBots.delete(botId);
        io.emit('bot_status', { botId, status: 'offline' });
        console.log(`[${botId.toUpperCase()}] Stopped`);
    } catch (e) {
        console.error(`[${botId.toUpperCase()}] Error stopping:`, e.message);
    }
}

// ── Fallback API Functions ──────────────────────────────────────────────────
async function callOpenRouter(history, newMessage, systemInstruction) {
    if (!OPENROUTER_API_KEY) {
        throw new Error("No OpenRouter API Key configured");
    }

    const messages = [];
    messages.push({ role: "system", content: systemInstruction });

    for (const turn of history) {
        if (turn.role === 'user') {
            messages.push({ role: "user", content: turn.parts.map(p => p.text).join('') });
        } else if (turn.role === 'model') {
            messages.push({ role: "assistant", content: turn.parts.map(p => p.text).join('') });
        }
    }
    messages.push({ role: "user", content: newMessage });

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "WhatsApp Bot"
        },
        body: JSON.stringify({
            model: "google/gemini-2.5-flash:free",
            messages: messages
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

async function callClaude(history, newMessage, systemInstruction) {
    if (!ANTHROPIC_API_KEY) {
        throw new Error("No Anthropic API Key configured");
    }

    const messages = [];
    for (const turn of history) {
        if (turn.role === 'user') {
            messages.push({ role: "user", content: turn.parts.map(p => p.text).join('') });
        } else if (turn.role === 'model') {
            messages.push({ role: "assistant", content: turn.parts.map(p => p.text).join('') });
        }
    }
    messages.push({ role: "user", content: newMessage });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        },
        body: JSON.stringify({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 2048,
            system: systemInstruction,
            messages: messages
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Claude error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return data.content[0].text;
}

// ── Message Handler ──────────────────────────────────────────────────────────
async function handleMessage(botId, msg) {
    const bot = activeBots.get(botId);
    if (!bot || bot.status !== 'ready') return;

    if (msg.from === 'status@broadcast' || msg.fromMe) return;

    const chat = await msg.getChat();
    if (chat.isGroup) return;

    const userId = msg.from;
    let userMessage = msg.body || '';
    if (!userMessage.trim() && !msg.hasMedia) return;

    console.log(`[${botId.toUpperCase()}] Message from ${userId}: ${userMessage}`);

    // Get or create conversation
    let convo = bot.chatHistory.get(userId);
    if (!convo) {
        const contact = await msg.getContact();
        convo = {
            name: contact.pushname || contact.name || userId,
            phone: userId,
            messages: []
        };
        bot.chatHistory.set(userId, convo);
    }

    // Store user message
    convo.messages.push({ type: 'user', body: userMessage, timestamp: Date.now() });
    io.emit('user_message', { botId, userId, contactName: convo.name, body: userMessage, timestamp: Date.now() });

    // Handle number responses
    const trimmedMsg = userMessage.trim();

    // Check conversation context - what was the last bot message?
    const lastBotMessage = convo.messages.filter(m => m.type === 'bot').slice(-1)[0];
    const lastBotText = lastBotMessage ? lastBotMessage.body : '';

    // Determine if this is a quick action or project selection based on context
    const isQuickActionContext = lastBotText.includes('[QUICK_ACTIONS:') ||
                                  lastBotText.includes('*Quick Actions:*') ||
                                  lastBotText.includes('1. 📅 Schedule Visit') ||
                                  lastBotText.includes('2. 📄 Get Brochure') ||
                                  lastBotText.includes('Reply with the number of your choice');

    const isProjectSelectionContext = lastBotText.includes('Which project would you like to know more about') ||
                                       lastBotText.includes('Just reply with the number!');

    if (/^[1-9]$/.test(trimmedMsg)) {
        const num = parseInt(trimmedMsg);

        // Priority 1: If context shows we're selecting projects, treat as project selection
        if (isProjectSelectionContext && !isQuickActionContext) {
            const config = bot.config;
            if (config.projects && num <= config.projects.length) {
                const projectName = config.projects[num - 1].split(' - ')[0];
                userMessage = `Tell me more about ${projectName}`;
                console.log(`[${botId.toUpperCase()}] User selected project #${num}: ${projectName}`);
            }
        }
        // Priority 2: If context shows quick actions menu, treat as quick action
        else if (isQuickActionContext && num >= 1 && num <= 4) {
            const actionMap = {
                '1': 'I would like to schedule a site visit',
                '2': 'Please send me the brochure',
                '3': 'Can you help me with EMI calculation?',
                '4': 'I want to speak with an expert'
            };
            userMessage = actionMap[num];
            console.log(`[${botId.toUpperCase()}] User selected quick action #${num}`);
        }
        // Priority 3: Default - if unsure, treat as project selection
        else {
            const config = bot.config;
            if (config.projects && num <= config.projects.length) {
                const projectName = config.projects[num - 1].split(' - ')[0];
                userMessage = `Tell me more about ${projectName}`;
                console.log(`[${botId.toUpperCase()}] User selected project #${num}: ${projectName}`);
            }
        }
    }

    await chat.sendStateTyping();

    // Get or create Gemini session
    let chatSession = bot.sessions.get(userId);
    if (!chatSession) {
        chatSession = bot.model.startChat({ history: [] });
        bot.sessions.set(userId, chatSession);
    }

    // Inject knowledge base context for this bot
    let enhancedMessage = userMessage;
    const kbContext = getBotKnowledgeContext(botId);

    // Only inject knowledge base if:
    // 1. We have knowledge base for this bot
    // 2. User is asking about projects (not just "hi" or greetings)
    const needsKnowledgeBase = kbContext &&
                                (userMessage.toLowerCase().includes('tell me') ||
                                 userMessage.toLowerCase().includes('about') ||
                                 userMessage.toLowerCase().includes('project') ||
                                 userMessage.toLowerCase().includes('price') ||
                                 userMessage.toLowerCase().includes('amenities') ||
                                 userMessage.toLowerCase().includes('location') ||
                                 userMessage.toLowerCase().includes('bhk') ||
                                 /how many|what.*have|does.*have/.test(userMessage.toLowerCase()));

    if (needsKnowledgeBase) {
        enhancedMessage = `User Question: ${userMessage}

IMPORTANT: You have a knowledge base below with ALL project information. Use this data to answer the user's question directly.

=== YOUR KNOWLEDGE BASE ===
${kbContext}
=== END KNOWLEDGE BASE ===

Now answer the user's question using the data above. Provide specific details from the knowledge base.`;
        console.log(`[${botId.toUpperCase()}] ✅ Injected knowledge base context (${kbContext.length} chars)`);
    } else {
        console.log(`[${botId.toUpperCase()}] Skipped knowledge base injection (greeting/general message)`);
    }

    // Send to AI: Try Gemini first, then fallback to OpenRouter, then Claude
    let responseText = '';
    let geminiWorked = false;

    // Try Gemini if keys are available
    if (apiKeys.length > 0 && apiKeys[0].length > 20) {
        for (let attempts = 0; attempts < apiKeys.length; attempts++) {
            try {
                const result = await chatSession.sendMessage(enhancedMessage);
                responseText = result.response.text();
                geminiWorked = true;
                break;
            } catch (error) {
                console.error(`[${botId.toUpperCase()}] Gemini error with key ${currentKeyIndex + 1}/${apiKeys.length}:`, error.message.substring(0, 100));

                if (attempts === apiKeys.length - 1) {
                    console.log(`[${botId.toUpperCase()}] All ${apiKeys.length} Gemini keys failed. Trying OpenRouter...`);
                    break;
                }

                // Rotate to next key
                currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;

                try {
                    const genAI = new GoogleGenerativeAI(apiKeys[currentKeyIndex]);
                    const currentHistory = await chatSession.getHistory();
                    bot.model = genAI.getGenerativeModel({
                        model: 'gemini-2.5-flash',
                        systemInstruction: getSystemInstruction(botId)
                    });
                    chatSession = bot.model.startChat({ history: currentHistory });
                    bot.sessions.set(userId, chatSession);
                } catch (rotateError) {
                    console.error(`[${botId.toUpperCase()}] Error rotating key:`, rotateError.message);
                }
            }
        }
    } else {
        console.log(`[${botId.toUpperCase()}] No valid Gemini keys detected. Using OpenRouter...`);
    }

    // If Gemini didn't work, try OpenRouter
    if (!geminiWorked && !responseText) {
        try {
            // Get conversation history from our stored messages instead of Gemini
            const history = [];
            if (convo && convo.messages) {
                for (const msg of convo.messages) {
                    if (msg.type === 'user') {
                        history.push({ role: 'user', parts: [{ text: msg.body }] });
                    } else if (msg.type === 'bot') {
                        history.push({ role: 'model', parts: [{ text: msg.body }] });
                    }
                }
            }

            responseText = await callOpenRouter(history, userMessage, getSystemInstruction(botId));
            console.log(`[${botId.toUpperCase()}] ✅ OpenRouter responded successfully`);
        } catch (openRouterError) {
            console.error(`[${botId.toUpperCase()}] OpenRouter failed:`, openRouterError.message);

            // Final fallback: Claude Haiku (cheapest)
            try {
                // Use stored history again
                const history = [];
                if (convo && convo.messages) {
                    for (const msg of convo.messages) {
                        if (msg.type === 'user') {
                            history.push({ role: 'user', parts: [{ text: msg.body }] });
                        } else if (msg.type === 'bot') {
                            history.push({ role: 'model', parts: [{ text: msg.body }] });
                        }
                    }
                }

                responseText = await callClaude(history, userMessage, getSystemInstruction(botId));
                console.log(`[${botId.toUpperCase()}] ✅ Claude Haiku responded successfully`);
            } catch (claudeError) {
                console.error(`[${botId.toUpperCase()}] Claude failed:`, claudeError.message);
                responseText = "I'm having trouble connecting right now. Let me transfer you to a live executive who can help you immediately. [AGENT_HANDOFF]";
            }
        }
    }

    console.log(`[${botId.toUpperCase()}] AI Reply: ${responseText.substring(0, 60)}...`);

    // Parse tags before sending
    const quickActionsMatch = responseText.match(/\[QUICK_ACTIONS:\s*(.*?)\]/i);
    const brochureMatch = responseText.match(/\[SEND_BROCHURE:\s*(.*?)\]/i);

    // Remove all tags from response text
    let cleanResponse = responseText
        .replace(/\[AGENT_HANDOFF\]/gi, '')
        .replace(/\[QUICK_ACTIONS:.*?\]/gi, '')
        .replace(/\[SEND_BROCHURE:.*?\]/gi, '')
        .replace(/\[SEND_LOCATION:.*?\]/gi, '')
        .replace(/\[ASSIGN_EXECUTIVE\]/gi, '')
        .replace(/\[VISIT_CONFIRMED:.*?\]/gi, '')
        .replace(/\[GENERATE_REFERRAL\]/gi, '')
        .replace(/\[CHECK_REFERRAL:.*?\]/gi, '')
        .replace(/\[LANG_SWITCH:.*?\]/gi, '')
        .trim();

    // STEP 1: Send main reply FIRST
    await msg.reply(cleanResponse);

    // STEP 2: Then send quick actions (if any)
    let quickActionsText = '';
    if (quickActionsMatch) {
        const actions = quickActionsMatch[1].split('|');
        const actionEmojis = {
            'VISIT': '📅 Schedule Visit',
            'BROCHURE': '📄 Get Brochure',
            'EMI': '💰 EMI Calculator',
            'EXPERT': '📞 Talk to Expert'
        };
        let buttonText = '\n*Quick Actions:*\n';
        actions.forEach((action, idx) => {
            if (actionEmojis[action.trim()]) {
                buttonText += `${idx + 1}. ${actionEmojis[action.trim()]}\n`;
            }
        });
        buttonText += '\n_Reply with the number of your choice._';
        await chat.sendMessage(buttonText);
        quickActionsText = buttonText;  // Save for storage
    }

    // STEP 3: Then send brochure (if requested)
    if (brochureMatch) {
        const projectName = brochureMatch[1].trim().toLowerCase();
        await sendBrochure(botId, chat, projectName);
    }

    // Store bot reply (include quick actions text for context detection)
    const storedMessage = cleanResponse + (quickActionsText ? '\n' + quickActionsText : '');
    convo.messages.push({ type: 'bot', body: storedMessage, timestamp: Date.now() });
    io.emit('bot_reply', { botId, userId, contactName: convo.name, body: cleanResponse, timestamp: Date.now() });
}

// ── Helper: Send Brochure ────────────────────────────────────────────────────
async function sendBrochure(botId, chat, projectName) {
    const bot = activeBots.get(botId);
    if (!bot) return;

    const brochureDir = path.join(__dirname, 'media', bot.config.brochureFolder);

    try {
        if (!fs.existsSync(brochureDir)) {
            await chat.sendMessage("Brochure folder not found. An executive will send it to you shortly!");
            return;
        }

        const files = fs.readdirSync(brochureDir);
        const pdfFiles = files.filter(f => f.toLowerCase().endsWith('.pdf'));

        // Fuzzy match
        const keywords = projectName.split(/\s+/).filter(w => w.length > 2);
        let matchedFile = null;

        for (const pdf of pdfFiles) {
            const pdfLower = pdf.toLowerCase();
            if (keywords.some(kw => pdfLower.includes(kw))) {
                matchedFile = pdf;
                break;
            }
        }

        if (!matchedFile && pdfFiles.length > 0) {
            matchedFile = pdfFiles[0]; // Default to first PDF
        }

        if (matchedFile) {
            const brochurePath = path.join(brochureDir, matchedFile);
            const media = MessageMedia.fromFilePath(brochurePath);
            await chat.sendMessage(media, { caption: 'Here is the requested brochure!' });
            console.log(`[${botId.toUpperCase()}] Brochure sent: ${matchedFile}`);
        } else {
            await chat.sendMessage("Brochure not found. An executive will send it to you shortly!");
        }
    } catch (e) {
        console.error(`[${botId.toUpperCase()}] Brochure error:`, e.message);
        await chat.sendMessage("Couldn't send the brochure right now. An executive will assist you!");
    }
}

console.log('[SYSTEM] Multi-Bot WhatsApp Manager Ready');
console.log('[SYSTEM] Use the dashboard to start individual bots');
