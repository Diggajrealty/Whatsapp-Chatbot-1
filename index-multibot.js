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
const { normalizePhone, resolveBotId, parseInstruction, parseVisitTag, resolveFromDirectory } = require('./crmLead');
const { projectDirectory, PLACEHOLDER_BUILDERS } = require('./projectDirectory');

// ── Knowledge Base Integration ──────────────────────────────────────────────
const knowledgeBase = require('./knowledge-base/index.js');

// A long-running bot must survive a transient Puppeteer/WhatsApp error rather
// than exit and take every session down with it. Log loudly, stay alive.
process.on('unhandledRejection', (reason) => {
    console.error('[FATAL-GUARD] unhandled rejection:', reason && reason.message ? reason.message : reason);
});
process.on('uncaughtException', (err) => {
    console.error('[FATAL-GUARD] uncaught exception:', err && err.message ? err.message : err);
});

// Docker sends SIGTERM on every restart/redeploy. Without this, Node dies at
// once and Chromium is killed mid-write, leaving a torn session profile —
// which is what makes WhatsApp drop the device and demand a fresh QR. Close
// the browsers properly and the stored session survives the restart.
let shuttingDown = false;
for (const sig of ['SIGTERM', 'SIGINT']) {
    process.on(sig, async () => {
        if (shuttingDown) return;
        shuttingDown = true;
        console.log(`[SHUTDOWN] ${sig} — closing ${activeBots.size} bot(s) cleanly`);
        // Unbounded here means a wedged Chromium holds the whole shutdown until
        // Docker SIGKILLs us mid-write — exactly the torn profile we're avoiding.
        await Promise.all([...activeBots.values()].map(b =>
            withTimeout(b.client.destroy(), 15000, 'destroy')
                .catch(e => {
                    console.error('[SHUTDOWN] destroy failed:', e.message);
                    try { b.client.pupBrowser?.process()?.kill('SIGKILL'); } catch (_) {}
                })));
        console.log('[SHUTDOWN] done');
        process.exit(0);
    });
}

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

// The knowledge base is static, so stringify it once per bot rather than on
// every message - the 'all' bot's is ~106KB.
const kbCache = new Map();

// The KB belongs in the system instruction, not in each message: injected per
// message it is re-sent AND accumulates in the chat history, so every turn gets
// slower than the last. Here it is constant and charged once per call.
// The model has no clock. Without this it cannot turn "Saturday 4pm" into the
// absolute timestamp the CRM needs, and will guess a year at random.
const IST = 'Asia/Kolkata';
function todayLine() {
    const now = new Date();
    const date = now.toLocaleDateString('en-IN', { timeZone: IST, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const time = now.toLocaleTimeString('en-IN', { timeZone: IST, hour: '2-digit', minute: '2-digit', hour12: false });
    return `TODAY'S DATE is ${date}. The current time is ${time} IST (+05:30). ` +
        `Resolve every relative date the user gives you ("tomorrow", "Saturday", "next week") against this.`;
}

// Names only — the knowledge base has details for six builders, the CRM sells
// far more. Without this the general bot denies these projects exist; with it
// she can take the lead seriously. The "do not invent" rule below is the point:
// a name is all she has for most of them.
function projectCatalogue() {
    const lines = Object.entries(projectDirectory)
        .filter(([builder]) => !PLACEHOLDER_BUILDERS.has(builder))
        .map(([builder, projects]) => `${builder}: ${projects.join(', ')}`);
    return `=== PROJECTS THE COMPANY SELLS (names only) ===\n${lines.join('\n')}\n` +
        `=== END PROJECT LIST ===\n` +
        `These are real projects you can discuss. For any project NOT covered by your knowledge ` +
        `base above, you know only the name and the builder — you do NOT know its price, ` +
        `configurations, amenities, possession date or RERA number. Never invent them. Say you ` +
        `will have an expert share the details, offer to arrange a site visit, and give ` +
        `08045888783 for specifics. Inventing a detail about someone's home purchase is the ` +
        `worst thing you can do.`;
}

function fullSystemInstruction(botId) {
    const kb = getBotKnowledgeContext(botId);
    let base = getSystemInstruction(botId) + '\n\n' + todayLine();
    // Only the general bot: a builder's own bot must stay on its own projects.
    if (botId === 'all') base += '\n\n' + projectCatalogue();
    if (!kb) return base;
    return base +
        '\n\n=== YOUR KNOWLEDGE BASE (answer from this data directly) ===\n' + kb +
        '\n=== END KNOWLEDGE BASE ===';
}

// Function to get builder-specific knowledge base context
function getBotKnowledgeContext(botId) {
    if (kbCache.has(botId)) return kbCache.get(botId);
    const out = buildBotKnowledgeContext(botId);
    kbCache.set(botId, out);
    return out;
}

function buildBotKnowledgeContext(botId) {
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

// Autostart bots on boot, so the QR (or a reconnected session) is ready before
// anyone opens the dashboard - and so bots come back by themselves after a restart.
// e.g. AUTOSTART_BOTS=all,sobha
if (process.env.AUTOSTART_BOTS) {
    const ids = process.env.AUTOSTART_BOTS.split(',').map(x => x.trim()).filter(Boolean);
    setTimeout(() => {
        ids.forEach(id => {
            if (!botConfigs[id]) return console.warn(`[AUTOSTART] unknown bot '${id}'`);
            console.log(`[AUTOSTART] starting ${id}`);
            startBot(id).catch(e => console.error(`[AUTOSTART] ${id} failed:`, e.message));
        });
    }, 1000);
}

// ── Bot Health ──────────────────────────────────────────────────────────────
// A linked session is not the same as a working one: the WhatsApp page can wedge
// while still reporting 'ready', and every lead then fails until someone
// restarts by hand. Probe it, tell the truth in /api/bots, and recycle.
const recycling = new Set();
const HEALTH_STRIKES = 3;
const strikes = new Map();

async function recycleBot(botId, why) {
    if (recycling.has(botId)) return;
    recycling.add(botId);
    console.warn(`[HEALTH] recycling '${botId}': ${why}`);
    try {
        await stopBot(botId);
        await startBot(botId);       // session is on disk, so this is a reconnect, not a QR
    } catch (e) {
        console.error(`[HEALTH] recycle of '${botId}' failed:`, e.message);
    } finally {
        recycling.delete(botId);
    }
}

// Called when a live request proves the page is wedged.
function markDegraded(botId, why) {
    const n = (strikes.get(botId) || 0) + 1;
    strikes.set(botId, n);
    console.warn(`[HEALTH] '${botId}' stalled (${n}/${HEALTH_STRIKES}): ${why}`);
    if (n < HEALTH_STRIKES) return;   // one cold lookup is not a wedge
    strikes.delete(botId);
    const bot = activeBots.get(botId);
    if (bot && bot.status === 'ready') {
        bot.status = 'degraded';
        io.emit('bot_status', { botId, status: 'degraded' });
    }
    recycleBot(botId, why);
}

// Is Chromium still answering, and is WhatsApp's own code still on the page?
//
// NOT getState(), which is what this used to probe with. That call hangs forever
// against current WhatsApp Web: it timed out on all three strikes of every single
// cycle — it never once succeeded — while the bot was authenticating, reaching
// 'ready' and demonstrably replying to real messages. So the probe was measuring a
// broken accessor, concluding the page was wedged, and recycling a working bot
// every three minutes, which is the outage it was written to prevent. (The same
// thing already happened to getChat(); see the note in handleMessage.)
//
// The probe asks one thing only: does Chromium still answer? It deliberately does
// NOT assert on window.Store or any other WhatsApp internal. Depending on their
// internals is what broke getState() and getChat() in the first place, and a probe
// that can be wrong about WhatsApp's private API is a probe that recycles a working
// bot. A dead or hung page — the failure a recycle actually fixes — fails this.
async function pageAlive(client) {
    const page = client.pupPage;
    if (!page || page.isClosed()) return false;
    await withTimeout(page.evaluate(() => true), 15000, 'page probe');
    return true;
}

setInterval(() => {
    for (const [botId, bot] of activeBots) {
        if (bot.status !== 'ready' || recycling.has(botId)) continue;

        // Captured, because a recycle replaces bot.client while this is in flight. A
        // probe that outlived its own client was counting strikes against the fresh
        // one — which is why the log showed '1/3' twice and then '2/3', and why a
        // just-restarted bot could be condemned by its predecessor's failures.
        const client = bot.client;
        const stale = () => activeBots.get(botId)?.client !== client;

        pageAlive(client)
            .then((alive) => {
                if (stale()) return;
                if (alive) strikes.delete(botId);
                else markDegraded(botId, 'page stopped responding');
            })
            .catch((e) => {
                if (stale()) return;
                markDegraded(botId, `probe: ${e.message}`);
            });
    }
}, 60000);

// ── CRM Lead Intake (Luna → Kaira) ─────────────────────────────────────────
// Luna (the CRM AI) POSTs a new enquiry here; Kaira opens the WhatsApp chat.
app.use(express.json());

const KAIRA = 'Kaira'; // WhatsApp assistant name shown to leads

// The dashboard socket can start/stop bots, read live QR codes and send
// WhatsApp messages as our numbers, so it needs the same key the HTTP API uses.
// Fail-open without a key configured, matching authOk, so local dev still works.
io.use((socket, next) => {
    if (!process.env.CRM_API_KEY) return next();
    if (socket.handshake.auth && socket.handshake.auth.token === process.env.CRM_API_KEY) return next();
    console.warn('[SOCKET] rejected an unauthenticated dashboard connection');
    next(new Error('unauthorized'));
});

// Luna gives up on a slow reply, and an unbounded await on a stalled Chromium
// turns a fast, actionable error into a timeout on her side. Bound every
// WhatsApp call so the CRM always gets an answer it can act on.
function withTimeout(promise, ms, label) {
    let timer;
    return Promise.race([
        promise,
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms); })
    ]).finally(() => clearTimeout(timer));
}

function authOk(req) {
    return !process.env.CRM_API_KEY || req.get('x-api-key') === process.env.CRM_API_KEY;
}

// ── Callback: Kaira → Luna ──────────────────────────────────────────────────
// Tell the CRM a site visit was booked so Luna can put it on the calendar.
// Fire-and-forget: a CRM outage must never stop the lead's WhatsApp reply.
async function notifyVisitScheduled({ botId, convo, userId, visit, lastUserMessage }) {
    const phone = String(userId).split('@')[0];

    // A slot we cannot turn into an instant is worse than none - Luna would book
    // it at the wrong time. Log it loudly so the visit can be booked by hand.
    if (!visit.at) {
        return console.error(`[VISIT] ${phone} confirmed a visit but the model wrote an ` +
            `unusable date: "${visit.raw}" — book this one manually`);
    }

    const url = process.env.CRM_WEBHOOK_URL;
    if (!url) return console.warn(`[VISIT] ${phone} booked ${visit.at} but CRM_WEBHOOK_URL is unset — not sent`);

    const cfg = botConfigs[botId] || {};
    // Luna's contract: phone and at are required; project is free text matched
    // against her project list, falling back to whatever is on the lead already.
    const payload = {
        phone,
        at: visit.at,
        project: convo.project || cfg.builder || undefined,
        notes: lastUserMessage ? `Booked over WhatsApp with ${KAIRA}. Lead's words: "${lastUserMessage}"`
                               : `Booked over WhatsApp with ${KAIRA}.`
    };

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(process.env.CRM_API_KEY ? { 'x-api-key': process.env.CRM_API_KEY } : {})
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(10000)
        });
        const body = await res.text();
        // 422 means Luna understood but could not place it (unknown lead, no
        // project match). That needs a human, so say which.
        if (!res.ok) throw new Error(`${res.status} ${body.slice(0, 300)}`);
        console.log(`[VISIT] → Luna: ${phone} at ${visit.at} (${payload.project || 'no project'}) ${body.slice(0, 120)}`);
    } catch (e) {
        console.error(`[VISIT] callback failed for ${phone} at ${visit.at}:`, e.message);
    }
}

// Shared by /api/lead and /api/instruct. Returns { status, body }.
async function startLeadConversation({ phone, property, builder, name, notes, botId: forcedBot }) {
    if (!phone) return { status: 400, body: { error: 'phone is required' } };

    // Luna sometimes leaves `property` null and mentions the project in `notes`
    // instead ("new property launch dsr villas"). Read both before giving up.
    // Still resolved, but only to label the greeting with the right builder -
    // the lead is served by one number so Luna never has to know, or check,
    // which builder bot happens to be linked. LEAD_BOT overrides which one.
    const leadBotId = resolveBotId(botConfigs, builder, [property, notes].filter(Boolean).join(' '));
    let botId = forcedBot || process.env.LEAD_BOT || 'all';
    let bot = activeBots.get(botId);
    // If the one number is down, any other linked bot is better than a dropped
    // lead - it introduces itself by the lead's own builder either way.
    if (!bot || bot.status !== 'ready') {
        const spare = [...activeBots].find(([, b]) => b.status === 'ready' && b.model);
        if (spare) {
            console.warn(`[LEAD] '${botId}' not ready → serving from '${spare[0]}'`);
            [botId, bot] = spare;
        }
    }
    if (!bot || bot.status !== 'ready' || !bot.model) {
        return { status: 503, body: { error: `bot '${botId}' is not running — start it from the dashboard`, botId } };
    }

    const digits = normalizePhone(phone);
    let userId;
    try {
        const numId = await withTimeout(bot.client.getNumberId(digits), 20000, 'number lookup');
        if (!numId) return { status: 404, body: { error: 'number is not on WhatsApp', phone: digits } };
        userId = numId._serialized;
    } catch (e) {
        // A timeout here means the page is wedged, not that the number is bad.
        if (/timed out/i.test(e.message)) {
            markDegraded(botId, `number lookup: ${e.message}`);
            return { status: 503, body: { error: 'bot is reconnecting — retry shortly', botId, phone: digits } };
        }
        return { status: 500, body: { error: `lookup failed: ${e.message}`, phone: digits } };
    }

    const cfg = bot.config;
    // The lead came in for one builder. Even when the general 'all' bot serves
    // it, introduce that builder — never "All Builders".
    // Most of the CRM's ~250 projects belong to builders with no bot of their
    // own, so look them up in the directory before falling back to the bot.
    const found = resolveFromDirectory(projectDirectory, [property, builder, notes].filter(Boolean).join(' '), PLACEHOLDER_BUILDERS);
    const leadBuilder = (builder && !PLACEHOLDER_BUILDERS.has(builder) ? builder : '')
        || (found && found.builder)
        || (leadBotId !== 'all' && botConfigs[leadBotId] && botConfigs[leadBotId].builder)
        || (cfg.id !== 'all' ? cfg.builder : '');
    // Only a real project or builder. Never cfg.builder for the general bot — a
    // lead told "you enquired about All Builders" knows they enquired about no
    // such thing, and we look like a bot that lost their details.
    // Prefer the directory's spelling: Luna's "new dimension" becomes the
    // "Abhee New Dimension" the lead actually recognises.
    const projectLabel = (found && found.project) || property || leadBuilder || '';
    if (!projectLabel) {
        console.warn(`[LEAD] ${digits}: no property/builder in the payload — greeting without a project. ` +
            `Luna should send "property" (e.g. "DSR Villas") so Kaira opens with the right one.`);
    }
    const greeting =
        `Hi${name ? ' ' + String(name).split(' ')[0] : ''}! 👋 I'm ${KAIRA}${leadBuilder ? ' from ' + leadBuilder : ''}.\n\n` +
        (projectLabel
            ? `I see you enquired about *${projectLabel}* — I'd be happy to help!\n\n` +
              `Would you like details on the configurations, amenities or location? Or shall I arrange a site visit for you?`
            : `Thanks for your interest in our properties!\n\n` +
              `Which project were you enquiring about? I can share configurations, amenities and location, ` +
              `or arrange a site visit for you.`);

    try {
        await withTimeout(bot.client.sendMessage(userId, greeting), 20000, 'send');
    } catch (e) {
        if (/timed out/i.test(e.message)) {
            markDegraded(botId, `send: ${e.message}`);
            return { status: 503, body: { error: 'bot is reconnecting — retry shortly', botId } };
        }
        return { status: 500, body: { error: `send failed: ${e.message}` } };
    }

    // Record it so the dashboard shows the chat
    const convo = bot.chatHistory.get(userId) || { name: name || digits, phone: userId, messages: [] };
    // Remembered so the site-visit callback can tell Luna which project it is for.
    convo.builder = leadBuilder || cfg.builder;
    convo.project = property || null;
    convo.messages.push({ type: 'bot', body: greeting, timestamp: Date.now() });
    bot.chatHistory.set(userId, convo);

    // Seed the AI session with the lead context, so the next reply continues the
    // conversation instead of restarting with the project-selection menu.
    bot.sessions.set(userId, bot.model.startChat({
        history: [
            { role: 'user', parts: [{ text:
                `[CRM LEAD HANDOVER — system context, not a message from the user]\n` +
                `Your name in this chat is ${KAIRA}.\n` +
                (leadBuilder ? `You represent ${leadBuilder} in this chat ONLY. Introduce yourself as ` +
                    `"${KAIRA} from ${leadBuilder}" — never as a general or multi-builder assistant, and do ` +
                    `not offer other builders' projects unless the user asks for them.\n` : '') +
                `Lead name: ${name || 'unknown'}\nEnquired about: ${projectLabel || 'not recorded in the CRM'}\n` +
                `CRM notes: ${notes || 'none'}\n` +
                `You have ALREADY sent this person the opening message below.\n` +
                (projectLabel
                    ? `They have already chosen ${projectLabel}, so do NOT show the project selection menu ` +
                      `again. Answer their next message directly about ${projectLabel} using the knowledge base.`
                    : `The CRM did not record which project they enquired about, and you have just asked them. ` +
                      `Work out from their reply which project they mean, then answer about it from the ` +
                      `knowledge base.`) }] },
            { role: 'model', parts: [{ text: greeting }] }
        ]
    }));

    io.emit('bot_reply', { botId, userId, contactName: convo.name, body: greeting, timestamp: Date.now() });
    console.log(`[LEAD] ${digits} → ${botId} (${projectLabel})`);
    return { status: 200, body: { ok: true, botId, whatsappId: userId, sent: greeting } };
}

// Structured intake — Luna posts JSON fields
app.post('/api/lead', async (req, res) => {
    if (!authOk(req)) return res.status(401).json({ error: 'invalid api key' });
    const r = await startLeadConversation(req.body || {});
    if (r.status !== 200) console.error('[LEAD] rejected:', r.status, JSON.stringify(r.body), 'payload:', JSON.stringify(req.body));
    res.status(r.status).json(r.body);
});

// Plain-English intake — "Kaira, talk to 9876543210 about Abhee New Dimension"
app.post('/api/instruct', async (req, res) => {
    if (!authOk(req)) return res.status(401).json({ error: 'invalid api key' });
    const { text, phone } = req.body || {};
    if (!text) return res.status(400).json({ error: 'text is required' });
    const parsed = parseInstruction(botConfigs, text);
    if (phone) parsed.phone = phone;
    if (!parsed.phone) return res.status(400).json({ error: 'could not find a phone number in the instruction' });
    if (!parsed.property) return res.status(400).json({ error: 'could not work out which project — mention it by name' });
    const r = await startLeadConversation(parsed);
    res.status(r.status).json({ ...r.body, parsed });
});

// Which bots are live right now (Luna can check before sending)
app.get('/api/bots', (req, res) => {
    res.json(Object.keys(botConfigs).map(id => ({
        id,
        builder: botConfigs[id].builder,
        status: activeBots.get(id) ? activeBots.get(id).status : 'stopped'
    })));
});

// Stored WhatsApp profiles. The volume is small and a Chromium profile is not,
// so a bot nobody uses still costs the space the live one needs to write.
function sessionPath(botId) {
    return path.join(process.env.SESSION_DIR || __dirname, `whatsapp_session_${botId}`);
}

app.get('/api/sessions', (req, res) => {
    if (!authOk(req)) return res.status(401).json({ error: 'invalid api key' });
    const root = process.env.SESSION_DIR || __dirname;
    const dirs = fs.readdirSync(root).filter(d => d.startsWith('whatsapp_session_'));
    res.json(dirs.map(d => ({
        botId: d.replace('whatsapp_session_', ''),
        mb: +(du(path.join(root, d)) / 1e6).toFixed(1),
        running: activeBots.has(d.replace('whatsapp_session_', ''))
    })));
});

function du(dir) {
    let total = 0;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const f = path.join(dir, e.name);
        try { total += e.isDirectory() ? du(f) : fs.statSync(f).size; } catch (_) {}
    }
    return total;
}

// Deleting a session means that number has to scan a QR again, so never touch
// one that is currently linked and running - stop it first, deliberately.
app.delete('/api/sessions/:botId', (req, res) => {
    if (!authOk(req)) return res.status(401).json({ error: 'invalid api key' });
    const { botId } = req.params;
    if (!botConfigs[botId]) return res.status(404).json({ error: `unknown bot '${botId}'` });
    if (activeBots.has(botId)) {
        return res.status(409).json({ error: `'${botId}' is running — stop it from the dashboard first`, botId });
    }
    const dir = sessionPath(botId);
    if (!fs.existsSync(dir)) return res.json({ ok: true, botId, note: 'no stored session' });
    fs.rmSync(dir, { recursive: true, force: true });
    console.warn(`[SESSION] deleted stored session for '${botId}' — needs a fresh QR`);
    res.json({ ok: true, botId, deleted: dir });
});

// Canonical builder and project spelling, so the CRM can normalise against the
// same names we route on instead of transcribing them from chat transcripts.
app.get('/api/projects', (req, res) => {
    const bots = {};
    for (const [id, c] of Object.entries(botConfigs)) {
        if (id !== 'all') bots[c.builder] = id;
    }
    res.json({
        builders: Object.entries(projectDirectory)
            .filter(([b]) => !PLACEHOLDER_BUILDERS.has(b))
            .map(([builder, projects]) => ({ builder, botId: bots[builder] || null, projects })),
        note: 'Match property against projects[]; routing is case-insensitive substring, ' +
              'so the exact spelling is preferred but not required.'
    });
});

// ── Bot Lifecycle Management ────────────────────────────────────────────────
async function startBot(botId) {
    const config = botConfigs[botId];
    if (!config) {
        console.error(`[ERROR] Unknown bot ID: ${botId}`);
        return;
    }

    const SESSION_PATH = sessionPath(botId);

    // Cleanup stale lock files. LocalAuth's actual Chromium profile is
    // `session-<clientId>`; a lock left behind by a killed process in there
    // blocks startup with "profile appears to be in use", so clear both.
    const lockFiles = ['SingletonLock', 'SingletonCookie', 'SingletonSocket'];
    for (const dir of [path.join(SESSION_PATH, 'session'), path.join(SESSION_PATH, `session-${botId}`)]) {
      const sessionDir = dir;
      for (const file of lockFiles) {
        try {
            fs.rmSync(path.join(sessionDir, file), { force: true });
        } catch (_) {}
      }
    }

    // Which of these survives a redeploy is the difference between a silent
    // reconnect and someone having to rescan a QR, so say it out loud.
    console.log(`[${botId.toUpperCase()}] session ` +
        `${fs.existsSync(path.join(SESSION_PATH, `session-${botId}`)) ? 'restored from' : 'NEW at'} ${SESSION_PATH}`);

    const client = new Client({
        authStrategy: new LocalAuth({
            dataPath: SESSION_PATH,
            clientId: botId
        }),
        puppeteer: {
            headless: true,
            // A shared-CPU instance is slow enough that Chromium blows
            // Puppeteer's default protocol timeout mid-handshake and the bot
            // dies before it ever shows a scannable QR.
            protocolTimeout: 60000,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                // Each bot is a whole browser; trim what we never use.
                '--disable-extensions',
                '--disable-background-networking',
                '--disable-accelerated-2d-canvas',
                '--mute-audio'
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
        // Set now, or the first message would "roll over" and wipe the session
        // the CRM handover just seeded.
        modelDay: new Date().toLocaleDateString('en-CA', { timeZone: IST }),
        config
    };

    activeBots.set(botId, botState);
    io.emit('bot_status', { botId, status: 'starting' });

    // Initialize Gemini model
    const genAI = new GoogleGenerativeAI(apiKeys[currentKeyIndex]);
    botState.model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction: fullSystemInstruction(botId),
        // 2.5 Flash thinks before answering by default, which adds seconds per
        // reply. These are short lookup answers - no thinking needed.
        generationConfig: { thinkingConfig: { thinkingBudget: 0 } }
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
        console.log(`[${botId.toUpperCase()}] loading ${percent}% ${message}`);
    });

    // A stale session fails here rather than ever showing a QR. Wipe it and
    // come back with a fresh one instead of leaving the bot dark.
    client.on('auth_failure', async (msg) => {
        console.error(`[${botId.toUpperCase()}] auth failure: ${msg} — wiping session for a fresh QR`);
        await resetSession(botId);
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
    client.on('disconnected', async (reason) => {
        console.log(`[${botId.toUpperCase()}] Disconnected: ${reason}`);
        activeBots.delete(botId);
        io.emit('bot_status', { botId, status: 'offline' });
        // Leaving the client alive leaks a Chromium per disconnect.
        try { await client.destroy(); } catch (_) {}

        // LOGOUT means the phone unlinked this device - the session really is
        // gone and only a fresh QR can fix it. Everything else (lost network,
        // WhatsApp Web navigating, CONFLICT) reconnects from the stored session,
        // so come back by ourselves instead of waiting for someone to notice.
        if (String(reason).toUpperCase().includes('LOGOUT')) {
            console.warn(`[${botId.toUpperCase()}] Logged out on the phone — needs a QR rescan`);
            return;
        }
        setTimeout(() => {
            if (activeBots.has(botId)) return;
            console.log(`[${botId.toUpperCase()}] Reconnecting after '${reason}'`);
            startBot(botId).catch(e => console.error(`[${botId.toUpperCase()}] reconnect failed:`, e.message));
        }, 5000);
    });

    // Event: Message
    client.on('message', (msg) => {
        // Never let one bad message become an unhandled rejection - Node kills
        // the process on those, which drops every other bot too.
        handleMessage(botId, msg).catch(e =>
            console.error(`[${botId.toUpperCase()}] handleMessage failed:`, e.message));
    });

    // Initialize. A session whose device was unlinked on the phone never emits
    // 'qr' and never resolves initialize() — WhatsApp Web just hangs on the
    // loading screen. Bound it: no QR and no auth within QR_TIMEOUT_MS means the
    // stored session is dead, so drop it and restart into a real QR.
    const watchdog = setTimeout(() => {
        if (activeBots.get(botId) !== botState) return;
        // Not 'authenticated': LocalAuth emits that as soon as session files
        // exist, before WhatsApp validates them — a dead session parks there.
        if (botState.status === 'qr' || botState.status === 'ready') return;
        console.error(`[${botId.toUpperCase()}] no QR after ${QR_TIMEOUT_MS / 1000}s (status '${botState.status}') — session is dead`);
        resetSession(botId);
    }, QR_TIMEOUT_MS);

    try {
        await client.initialize();
    } catch (e) {
        clearTimeout(watchdog);
        console.error(`[${botId.toUpperCase()}] initialize failed:`, e.message);
        throw e;
    }
    client.once('qr', () => clearTimeout(watchdog));
    client.once('ready', () => clearTimeout(watchdog));
}

// How long a bot may sit between "starting" and a scannable QR before we treat
// the stored session as dead. Cold Chromium on a shared CPU is ~20-40s.
const QR_TIMEOUT_MS = Number(process.env.QR_TIMEOUT_MS || 90000);

// Stop the bot, throw away the stored credentials, start it again. The restart
// has nothing on disk to restore, so it can only end in a QR.
const resetting = new Set();
async function resetSession(botId) {
    if (resetting.has(botId)) return;
    resetting.add(botId);
    try {
        await stopBot(botId);
        fs.rmSync(sessionPath(botId), { recursive: true, force: true });
        console.warn(`[${botId.toUpperCase()}] stored session deleted — restarting for a fresh QR`);
        await startBot(botId);
    } catch (e) {
        console.error(`[${botId.toUpperCase()}] session reset failed:`, e.message);
    } finally {
        resetting.delete(botId);
    }
}

async function stopBot(botId) {
    const bot = activeBots.get(botId);
    if (!bot) return;

    activeBots.delete(botId);
    io.emit('bot_status', { botId, status: 'offline' });
    try {
        await withTimeout(bot.client.destroy(), 15000, 'destroy');
    } catch (e) {
        console.error(`[${botId.toUpperCase()}] destroy failed (${e.message}) — killing Chromium`);
    } finally {
        // A graceful destroy can leave the browser behind; make sure it dies.
        try { bot.client.pupBrowser?.process()?.kill('SIGKILL'); } catch (_) {}
    }
    console.log(`[${botId.toUpperCase()}] Stopped`);
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
            // claude-3-5-sonnet-20241022 was retired; the call 404'd, so the last
            // fallback in the chain could never have answered even with a key set.
            // Haiku 4.5 because this function's whole purpose is the cheap last
            // resort — see the caller's comment — and a WhatsApp reply is short.
            model: "claude-haiku-4-5",
            max_tokens: 1024,
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

    // msg.getChat() fails against current WhatsApp Web, so avoid it entirely:
    // group JIDs always end in @g.us, and client.sendMessage works fine.
    if (String(msg.from).endsWith('@g.us')) return;

    const userId = msg.from;
    let userMessage = msg.body || '';
    if (!userMessage.trim() && !msg.hasMedia) return;

    console.log(`[${botId.toUpperCase()}] Message from ${userId}: ${userMessage}`);

    // Get or create conversation
    let convo = bot.chatHistory.get(userId);
    if (!convo) {
        // getContact() throws against current WhatsApp Web just like getChat().
        // A new number must never lose its first message to a name lookup.
        let name = userId;
        try {
            const contact = await msg.getContact();
            name = contact.pushname || contact.name || userId;
        } catch (e) {
            console.warn(`[${botId.toUpperCase()}] getContact failed, using number:`, e.message);
        }
        convo = { name, phone: userId, messages: [] };
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

    try { await bot.client.sendPresenceAvailable(); } catch (_) {}

    // Get or create Gemini session
    // The date is baked into the model's system instruction, so after midnight a
    // long-running bot would still think it is yesterday and book site visits a
    // day early. Rebuild on rollover. Sessions go with it - they hold the old
    // instruction - which costs a day-old conversation its context, fairly cheap
    // next to a wrong booking date.
    const istToday = new Date().toLocaleDateString('en-CA', { timeZone: IST });
    if (bot.modelDay !== istToday) {
        bot.model = new GoogleGenerativeAI(apiKeys[currentKeyIndex]).getGenerativeModel({
            model: 'gemini-2.5-flash',
            systemInstruction: fullSystemInstruction(botId),
            generationConfig: { thinkingConfig: { thinkingBudget: 0 } }
        });
        bot.sessions.clear();
        bot.modelDay = istToday;
        console.log(`[${botId.toUpperCase()}] Model refreshed for ${istToday}`);
    }

    let chatSession = bot.sessions.get(userId);
    if (!chatSession) {
        chatSession = bot.model.startChat({ history: [] });
        bot.sessions.set(userId, chatSession);
    }

    // Knowledge base now lives in the system instruction (see fullSystemInstruction),
    // so the model always has it without it bloating the per-turn history.
    const enhancedMessage = userMessage;

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
                // Not truncated. The 100-character cut used to stop exactly before the
                // HTTP status code, so every Gemini failure in the log read
                // "Error fetching from https://generativelanguage.googleapis.com/v1beta/mod"
                // and there was no way to tell a bad key from a rate limit from an
                // outage without reproducing it by hand.
                console.error(`[${botId.toUpperCase()}] Gemini error with key ${currentKeyIndex + 1}/${apiKeys.length}:`, error.message);

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
                        systemInstruction: fullSystemInstruction(botId),
                        generationConfig: { thinkingConfig: { thinkingBudget: 0 } }
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

            responseText = await callOpenRouter(history, userMessage, fullSystemInstruction(botId));
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

                responseText = await callClaude(history, userMessage, fullSystemInstruction(botId));
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
    const visit = parseVisitTag(responseText);

    // Push the booking to the CRM without making the lead wait on it.
    if (visit) notifyVisitScheduled({ botId, convo, userId, visit, lastUserMessage: userMessage });

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
    await bot.client.sendMessage(userId, cleanResponse);

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
        await bot.client.sendMessage(userId, buttonText);
        quickActionsText = buttonText;  // Save for storage
    }

    // STEP 3: Then send brochure (if requested)
    if (brochureMatch) {
        const projectName = brochureMatch[1].trim().toLowerCase();
        await sendBrochure(botId, userId, projectName);
    }

    // Store bot reply (include quick actions text for context detection)
    const storedMessage = cleanResponse + (quickActionsText ? '\n' + quickActionsText : '');
    convo.messages.push({ type: 'bot', body: storedMessage, timestamp: Date.now() });
    io.emit('bot_reply', { botId, userId, contactName: convo.name, body: cleanResponse, timestamp: Date.now() });
}

// ── Helper: Send Brochure ────────────────────────────────────────────────────
async function sendBrochure(botId, userId, projectName) {
    const bot = activeBots.get(botId);
    if (!bot) return;

    const brochureDir = path.join(__dirname, 'media', bot.config.brochureFolder);

    try {
        if (!fs.existsSync(brochureDir)) {
            await bot.client.sendMessage(userId, "Let me get that brochure across to you — one of our executives will send it shortly!");
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
            await bot.client.sendMessage(userId, media, { caption: 'Here is the requested brochure!' });
            console.log(`[${botId.toUpperCase()}] Brochure sent: ${matchedFile}`);
        } else {
            await bot.client.sendMessage(userId, "Let me get that brochure across to you — one of our executives will send it shortly!");
        }
    } catch (e) {
        console.error(`[${botId.toUpperCase()}] Brochure error:`, e.message);
        await bot.client.sendMessage(userId, "Couldn't send the brochure right now. An executive will assist you!");
    }
}

console.log('[SYSTEM] Multi-Bot WhatsApp Manager Ready');
console.log('[SYSTEM] Use the dashboard to start individual bots');
