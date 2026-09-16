/* ═══════════════════════════════════════════════════════════════
   REAL ESTATE BOT MANAGER — Multi-Bot Dashboard
   ═══════════════════════════════════════════════════════════════ */

// The server rejects sockets without the dashboard key. Ask once, remember it,
// and re-ask if it was wrong — otherwise the page silently never connects.
function dashboardToken() {
    let t = null;
    try { t = localStorage.getItem('kaira_token'); } catch (_) {}
    if (!t) {
        t = window.prompt('Dashboard key:') || '';
        try { localStorage.setItem('kaira_token', t); } catch (_) {}
    }
    return t;
}

const socket = io({ auth: { token: dashboardToken() } });

socket.on('connect_error', (err) => {
    if (err && err.message === 'unauthorized') {
        try { localStorage.removeItem('kaira_token'); } catch (_) {}
        alert('Wrong dashboard key — reload and try again.');
    }
});

// State
let activeBots = new Map(); // botId -> { name, status, messages, qrCode }
let currentTab = null;
let qrSimulationTimer = null; // Track the simulation timer

// Toast
function showToast(message, duration = 3000) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), duration);
}

// Update Stats
function updateStats() {
    const activeCount = Array.from(activeBots.values()).filter(b => b.status === 'online').length;
    document.getElementById('active-bots-count').textContent = activeCount;

    let totalMessages = 0;
    activeBots.forEach(bot => {
        totalMessages += bot.messages ? bot.messages.length : 0;
    });
    document.getElementById('total-messages-count').textContent = totalMessages;
}

// Toggle Bot
function toggleBot(botId, isOn) {
    const statusBadge = document.getElementById(`status-${botId}`);

    if (isOn) {
        // Turn on bot
        statusBadge.textContent = 'Connecting...';
        statusBadge.className = 'status-badge connecting';

        showToast(`Starting ${getBotName(botId)} bot...`);

        // Send start request to backend
        socket.emit('start_bot', { botId });

        // Show QR modal
        showQRModal(botId);

        // Add to active bots
        if (!activeBots.has(botId)) {
            activeBots.set(botId, {
                id: botId,
                name: getBotName(botId),
                status: 'connecting',
                messages: [],
                qrCode: null
            });
        }

        // Create tab
        createBotTab(botId);

    } else {
        // Turn off bot
        statusBadge.textContent = 'Offline';
        statusBadge.className = 'status-badge offline';

        showToast(`Stopping ${getBotName(botId)} bot...`);

        // Send stop request to backend
        socket.emit('stop_bot', { botId });

        // Remove from active bots
        activeBots.delete(botId);

        // Remove tab
        removeBotTab(botId);

        // Close modal if open
        closeQRModal();
    }

    updateStats();
    updateEmptyState();
}

// Operator-facing label for a bot. Every bot introduces itself to customers as
// Kaira, so the builder is what tells them apart here.
function getBotName(botId) {
    const names = {
        sobha: 'SOBHA',
        brigade: 'Brigade',
        nambiar: 'Nambiar',
        godrej: 'Godrej',
        abhee: 'Abhee',
        dsr: 'DSR',
        all: 'All Builders'
    };
    return names[botId] || botId;
}

// Get Bot Icon
function getBotIcon(botId) {
    const icons = {
        sobha: '🏢',
        brigade: '🏗️',
        nambiar: '🌆',
        godrej: '🏘️',
        abhee: '🏡',
        dsr: '🏙️',
        all: '⭐'
    };
    return icons[botId] || '🤖';
}

// Create Bot Tab
function createBotTab(botId) {
    const tabsContainer = document.getElementById('bot-tabs');

    // Check if tab already exists
    if (document.getElementById(`tab-${botId}`)) return;

    const tab = document.createElement('button');
    tab.id = `tab-${botId}`;
    tab.className = 'bot-tab';
    tab.onclick = () => switchTab(botId);

    tab.innerHTML = `
        <span class="bot-tab-icon">${getBotIcon(botId)}</span>
        <span>${getBotName(botId)}</span>
        <button class="bot-tab-close" onclick="event.stopPropagation(); closeBot('${botId}')">×</button>
    `;

    tabsContainer.appendChild(tab);

    // Create content area
    createBotContent(botId);

    // Switch to this tab
    switchTab(botId);
}

// Remove Bot Tab
function removeBotTab(botId) {
    const tab = document.getElementById(`tab-${botId}`);
    if (tab) tab.remove();

    const content = document.getElementById(`content-${botId}`);
    if (content) content.remove();

    // Switch to another tab if this was active
    if (currentTab === botId) {
        const remainingTabs = document.querySelectorAll('.bot-tab');
        if (remainingTabs.length > 0) {
            const firstTabId = remainingTabs[0].id.replace('tab-', '');
            switchTab(firstTabId);
        } else {
            currentTab = null;
        }
    }
}

// Create Bot Content
function createBotContent(botId) {
    const container = document.getElementById('bot-contents');

    // Check if content already exists
    if (document.getElementById(`content-${botId}`)) return;

    const content = document.createElement('div');
    content.id = `content-${botId}`;
    content.className = 'bot-content';

    content.innerHTML = `
        <div class="bot-content-header">
            <h2>${getBotIcon(botId)} ${getBotName(botId)}</h2>
            <span>Real Estate Bot Dashboard</span>
        </div>
        <div class="bot-content-body">
            <div class="chat-area" id="messages-${botId}">
                <div style="text-align: center; padding: 40px; color: var(--text-muted);">
                    <p>Waiting for messages...</p>
                </div>
            </div>
        </div>
    `;

    container.appendChild(content);
}

// Switch Tab
function switchTab(botId) {
    // Update tabs
    document.querySelectorAll('.bot-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    const activeTab = document.getElementById(`tab-${botId}`);
    if (activeTab) activeTab.classList.add('active');

    // Update content
    document.querySelectorAll('.bot-content').forEach(content => {
        content.classList.remove('active');
    });
    const activeContent = document.getElementById(`content-${botId}`);
    if (activeContent) activeContent.classList.add('active');

    currentTab = botId;
    updateEmptyState();
}

// Close Bot
function closeBot(botId) {
    const checkbox = document.querySelector(`.bot-item[data-bot="${botId}"] input[type="checkbox"]`);
    if (checkbox) {
        checkbox.checked = false;
        toggleBot(botId, false);
    }
}

// Update Empty State
function updateEmptyState() {
    const emptyState = document.getElementById('empty-state');
    const botContents = document.getElementById('bot-contents');

    if (activeBots.size === 0) {
        emptyState.style.display = 'flex';
        botContents.style.display = 'none';
    } else {
        emptyState.style.display = 'none';
        botContents.style.display = 'block';
    }
}

// QR Modal
let currentQRBot = null;

// The 'qr' event can arrive before the modal is open (or while another bot's
// modal is), so keep the last QR per bot and paint it whenever it's needed.
const qrCache = new Map();

function paintQR(botId) {
    if (currentQRBot !== botId) return;
    const qr = qrCache.get(botId);
    if (!qr) return;
    document.getElementById('qr-placeholder').style.display = 'none';
    const img = document.getElementById('qr-image');
    img.src = qr;
    img.style.display = 'block';
}

function showQRModal(botId) {
    currentQRBot = botId;
    const modal = document.getElementById('qr-modal');
    const title = document.getElementById('qr-modal-title');
    title.textContent = `Connect ${getBotName(botId)} Bot`;

    // Reset QR display
    document.getElementById('qr-placeholder').style.display = 'flex';
    document.getElementById('qr-image').style.display = 'none';

    modal.classList.add('active');

    // Paint immediately if we already have one; otherwise the 'qr' event will.
    paintQR(botId);
}

function closeQRModal() {
    const modal = document.getElementById('qr-modal');
    modal.classList.remove('active');

    // Clear any pending simulation timer
    if (qrSimulationTimer) {
        clearTimeout(qrSimulationTimer);
        qrSimulationTimer = null;
    }

    // If bot was closed before authentication, revert to offline
    if (currentQRBot && activeBots.has(currentQRBot)) {
        const bot = activeBots.get(currentQRBot);
        if (bot.status === 'connecting') {
            const statusBadge = document.getElementById(`status-${currentQRBot}`);
            statusBadge.textContent = 'Offline';
            statusBadge.className = 'status-badge offline';

            // Uncheck the toggle
            const toggleInput = document.querySelector(`[onchange*="'${currentQRBot}'"]`);
            if (toggleInput) toggleInput.checked = false;

            // Remove from active bots
            activeBots.delete(currentQRBot);
            removeBotTab(currentQRBot);
            updateStats();
            updateEmptyState();
        }
    }

    currentQRBot = null;
}

function simulateQRCode(botId) {
    // This is a simulation - in real implementation,
    // you'll receive QR from Socket.io

    const qrPlaceholder = document.getElementById('qr-placeholder');
    const qrImage = document.getElementById('qr-image');

    // For now, just show placeholder text
    qrPlaceholder.innerHTML = '<p style="color: #64748b; font-size: 14px;">QR code will appear here when WhatsApp client is ready</p>';

    // REMOVED: Auto-online simulation
    // The bot should only go online when 'bot_ready' event is received from backend
    // Do NOT automatically set bot online without actual authentication
}

function setBotOnline(botId) {
    const statusBadge = document.getElementById(`status-${botId}`);
    statusBadge.textContent = 'Online';
    statusBadge.className = 'status-badge online';

    if (activeBots.has(botId)) {
        const bot = activeBots.get(botId);
        bot.status = 'online';
        activeBots.set(botId, bot);
    }

    showToast(`${getBotName(botId)} is now online!`);
    updateStats();
}

// Add Message to Bot
function addMessage(botId, message) {
    if (!activeBots.has(botId)) return;

    const bot = activeBots.get(botId);
    bot.messages.push(message);
    activeBots.set(botId, bot);

    // Update UI
    const messagesContainer = document.getElementById(`messages-${botId}`);
    if (!messagesContainer) return;

    // Clear placeholder
    if (messagesContainer.children[0]?.textContent?.includes('Waiting')) {
        messagesContainer.innerHTML = '';
    }

    const messageEl = document.createElement('div');
    messageEl.className = 'message-item';
    messageEl.innerHTML = `
        <div class="message-avatar">${message.sender[0].toUpperCase()}</div>
        <div class="message-content">
            <div class="message-header">
                <span class="message-name">${message.sender}</span>
                <span class="message-time">${new Date(message.timestamp).toLocaleTimeString()}</span>
            </div>
            <div class="message-text">${message.text}</div>
        </div>
    `;

    messagesContainer.appendChild(messageEl);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    updateStats();
}

// Socket.io Events
socket.on('connect', () => {
    console.log('Connected to server');
});

// Multi-bot backend events (with botId)
socket.on('qr', ({ botId, qr }) => {
    console.log(`QR received for ${botId}`);
    qrCache.set(botId, qr);
    paintQR(botId);
});

// On (re)connect the server replays current bot state, including any live QR,
// so a page reload doesn't lose it.
socket.on('init', ({ bots }) => {
    Object.entries(bots || {}).forEach(([botId, b]) => {
        if (b && b.qr) { qrCache.set(botId, b.qr); paintQR(botId); }
    });
});

socket.on('loading', ({ botId, percent, message }) => {
    console.log(`${botId} loading: ${percent}%`);
    if (currentQRBot === botId) {
        const qrPlaceholder = document.getElementById('qr-placeholder');
        qrPlaceholder.innerHTML = `
            <div class="spinner"></div>
            <p style="color: #64748b; font-size: 14px;">Connecting… ${percent}%</p>
            <p style="color: #94a3b8; font-size: 12px;">${message} — if this bot is already linked, no QR will appear.</p>
        `;
    }
});

socket.on('authenticated', ({ botId }) => {
    console.log(`${botId} authenticated!`);
    showToast(`${getBotName(botId)} authenticated!`);
    // A bot with a saved session never emits a QR, so the modal would otherwise
    // sit on "Loading: 99%" under a "Connect" title as if the code had failed.
    if (currentQRBot === botId) {
        document.getElementById('qr-image').style.display = 'none';
        const p = document.getElementById('qr-placeholder');
        p.style.display = 'flex';
        p.innerHTML = '<div class="spinner"></div>' +
            '<p style="color:#16a34a;font-size:14px;font-weight:600;">Already linked — no scan needed</p>' +
            '<p style="color:#94a3b8;font-size:12px;">Reconnecting the saved session…</p>';
    }
});

socket.on('ready', ({ botId }) => {
    console.log(`${botId} ready!`);
    setBotOnline(botId);
    if (currentQRBot === botId) {
        closeQRModal();
    }
});

socket.on('bot_status', ({ botId, status }) => {
    const statusBadge = document.getElementById(`status-${botId}`);
    if (!statusBadge) return;

    if (status === 'offline') {
        statusBadge.textContent = 'Offline';
        statusBadge.className = 'status-badge offline';

        // Uncheck toggle
        const toggleInput = document.querySelector(`[onchange*="'${botId}'"]`);
        if (toggleInput) toggleInput.checked = false;

        activeBots.delete(botId);
        removeBotTab(botId);
        updateStats();
        updateEmptyState();
    }
});

socket.on('user_message', ({ botId, userId, contactName, body, timestamp }) => {
    addMessage(botId, { sender: contactName, text: body, timestamp });
});

socket.on('bot_reply', ({ botId, userId, contactName, body, timestamp }) => {
    addMessage(botId, { sender: 'Bot', text: body, timestamp });
});

socket.on('bot_error', ({ botId, error }) => {
    console.error(`${botId} error:`, error);
    showToast(`Error: ${error}`);
});

// Initialize
updateEmptyState();
updateStats();

// Demo: Add test message after 3 seconds (remove in production)
setTimeout(() => {
    // This is just for demo - remove in production
    console.log('Dashboard loaded and ready');
}, 3000);
