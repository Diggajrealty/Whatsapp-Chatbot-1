/* ═══════════════════════════════════════════════════════════════
   ARIA DASHBOARD — Socket.io Client
   ═══════════════════════════════════════════════════════════════ */

const socket = io();

// ── State ────────────────────────────────────────────────────────
let chats = {};         // { userId: { name, phone, messages: [] } }
let activeUserId = null;
let totalMessages = 0;
let unreadCounts = {};  // { userId: number }

// Avatar color palette
const AVATAR_COLORS = [
    '#16a34a', '#7c3aed', '#0891b2', '#db2777',
    '#d97706', '#dc2626', '#059669', '#6d28d9',
];
function avatarColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
function initials(name) {
    const parts = (name || '?').split(' ');
    return parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : (parts[0][0] || '?').toUpperCase();
}
function formatTime(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function formatDate(ts) {
    const d = new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return 'Today';
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' });
}

// ── Screen Manager ────────────────────────────────────────────────
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => {
        s.classList.remove('active');
        s.classList.add('hidden');
    });
    const target = document.getElementById(id);
    target.classList.remove('hidden');
    setTimeout(() => target.classList.add('active'), 10);
}

// ── Toast ─────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg, duration = 3000) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        el.classList.remove('show');
        el.classList.add('hidden');
    }, duration);
}

// ── Socket Events ─────────────────────────────────────────────────

socket.on('init', ({ status, qr, chats: initChats, totalMessages: tm }) => {
    chats = initChats || {};
    totalMessages = tm || 0;

    if (status === 'ready' || status === 'authenticated') {
        // Bot is running — go straight to dashboard
        showScreen('screen-dashboard');
        Object.keys(chats).forEach(uid => {
            addContactToSidebar(uid, chats[uid]);
        });
        updateStats();
        if (status === 'qr' && qr) {
            // Still waiting for QR scan
            showScreen('screen-qr');
            showQR(qr);
        }
    } else if (status === 'qr' && qr) {
        showScreen('screen-qr');
        showQR(qr);
    }
    // else: default is QR screen, waiting
});

socket.on('qr', (dataUrl) => {
    showQR(dataUrl);
    showScreen('screen-qr');
});

socket.on('authenticated', () => {
    showScreen('screen-loading');
    document.getElementById('sstep-authenticated').classList.add('done');
    document.getElementById('sstep-loading').classList.add('loading');
});

socket.on('loading', ({ percent, message }) => {
    document.getElementById('start-progress').style.width = percent + '%';
    document.getElementById('starting-msg').textContent = message;
    document.getElementById('sstep-load-text').textContent = `${message} (${percent}%)`;
});

socket.on('ready', () => {
    document.getElementById('start-progress').style.width = '100%';
    document.getElementById('sstep-loading').classList.remove('loading');
    document.getElementById('sstep-loading').classList.add('done');
    document.getElementById('sstep-load-text').textContent = 'WhatsApp Web Loaded';
    document.getElementById('sstep-ready').classList.add('done');
    document.getElementById('sstep-ready').querySelector('span').textContent = '✦ Aria is online!';
    setTimeout(() => showScreen('screen-dashboard'), 1600);
});

socket.on('new_message', ({ userId, contactName, phone, body, timestamp }) => {
    // Ensure contact exists
    if (!chats[userId]) {
        chats[userId] = { name: contactName, phone, messages: [] };
        addContactToSidebar(userId, chats[userId]);
    }
    chats[userId].name = contactName;
    chats[userId].phone = phone;
    chats[userId].messages.push({ type: 'user', body, timestamp });
    totalMessages++;

    // Update sidebar preview
    updateContactPreview(userId, body, timestamp);

    // Unread or live render
    if (activeUserId === userId) {
        appendMessage(userId, { type: 'user', body, timestamp });
        scrollToBottom();
    } else {
        unreadCounts[userId] = (unreadCounts[userId] || 0) + 1;
        updateUnreadBadge(userId);
    }
    updateStats();
    showToast(`💬 New message from ${contactName}`);
});

socket.on('bot_reply', ({ userId, contactName, phone, body, timestamp }) => {
    if (!chats[userId]) return;
    chats[userId].messages.push({ type: 'bot', body, timestamp });
    totalMessages++;

    updateContactPreview(userId, `Aria: ${body}`, timestamp);

    if (activeUserId === userId) {
        appendMessage(userId, { type: 'bot', body, timestamp });
        scrollToBottom();
    }
    updateStats();
});

socket.on('summary', ({ userId, contactName, summary }) => {
    if (activeUserId === userId) {
        const area = document.getElementById('messages-area');
        const card = document.createElement('div');
        card.className = 'summary-card';
        card.textContent = summary;
        area.appendChild(card);
        scrollToBottom();
    }
});

socket.on('disconnected', (reason) => {
    showToast(`⚠️ Bot disconnected: ${reason}. Restarting...`, 5000);
});

socket.on('auth_failure', () => {
    showToast('❌ Authentication failed. Refresh to retry.', 5000);
});

// ── QR Code Display ───────────────────────────────────────────────
function showQR(dataUrl) {
    document.getElementById('qr-loading-state').classList.add('hidden');
    const img = document.getElementById('qr-image');
    img.src = dataUrl;
    img.classList.remove('hidden');
    document.getElementById('qr-tag').textContent = 'Scan with WhatsApp to connect';
}

// ── Contact Sidebar ───────────────────────────────────────────────
function addContactToSidebar(userId, data) {
    document.getElementById('empty-contacts').classList.add('hidden');

    // Check if already exists
    if (document.getElementById(`contact-${userId}`)) return;

    const color = avatarColor(userId);
    const init = initials(data.name);
    const lastMsg = data.messages && data.messages.length > 0 ? data.messages[data.messages.length - 1] : null;

    const el = document.createElement('div');
    el.className = 'contact-item';
    el.id = `contact-${userId}`;
    el.innerHTML = `
        <div class="contact-ava" style="background: ${color}">${init}</div>
        <div class="contact-body">
            <div class="contact-name">${data.name}</div>
            <div class="contact-preview" id="preview-${userId}">${lastMsg ? (lastMsg.type === 'bot' ? 'Aria: ' : '') + lastMsg.body : 'No messages yet'}</div>
        </div>
        <div class="contact-right">
            <div class="contact-time" id="time-${userId}">${lastMsg ? formatTime(lastMsg.timestamp) : ''}</div>
            <div class="unread-badge hidden" id="badge-${userId}">0</div>
        </div>
    `;
    el.addEventListener('click', () => openChat(userId));
    document.getElementById('contact-list').appendChild(el);
}

function updateContactPreview(userId, previewText, timestamp) {
    const previewEl = document.getElementById(`preview-${userId}`);
    const timeEl = document.getElementById(`time-${userId}`);
    if (previewEl) previewEl.textContent = previewText.length > 40 ? previewText.substring(0, 40) + '...' : previewText;
    if (timeEl) timeEl.textContent = formatTime(timestamp);

    // Move contact to top of list
    const contactEl = document.getElementById(`contact-${userId}`);
    const list = document.getElementById('contact-list');
    if (contactEl && list.firstChild !== contactEl) {
        list.insertBefore(contactEl, list.firstChild);
    }
}

function updateUnreadBadge(userId) {
    const badge = document.getElementById(`badge-${userId}`);
    if (!badge) return;
    const count = unreadCounts[userId] || 0;
    if (count > 0) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.classList.remove('hidden');
        document.getElementById(`contact-${userId}`).classList.add('has-new');
    } else {
        badge.classList.add('hidden');
        document.getElementById(`contact-${userId}`).classList.remove('has-new');
    }
}

// ── Chat View ─────────────────────────────────────────────────────
function openChat(userId) {
    // Update active state in sidebar
    document.querySelectorAll('.contact-item').forEach(el => el.classList.remove('active'));
    const contactEl = document.getElementById(`contact-${userId}`);
    if (contactEl) contactEl.classList.add('active');

    // Clear unread
    unreadCounts[userId] = 0;
    updateUnreadBadge(userId);

    activeUserId = userId;
    const data = chats[userId];
    if (!data) return;

    // Show chat view, hide welcome
    document.getElementById('welcome-view').classList.add('hidden');
    const chatView = document.getElementById('chat-view');
    chatView.classList.remove('hidden');

    // Set header
    const color = avatarColor(userId);
    const init = initials(data.name);
    const ava = document.getElementById('chat-avatar');
    ava.style.background = color;
    ava.textContent = init;
    document.getElementById('chat-name').textContent = data.name;
    document.getElementById('chat-phone').textContent = `+${data.phone || userId.replace('@c.us','').replace('@lid','')}`;

    // Render all messages
    renderAllMessages(userId);
    scrollToBottom();
}

function renderAllMessages(userId) {
    const area = document.getElementById('messages-area');
    area.innerHTML = '';
    const msgs = chats[userId]?.messages || [];

    document.getElementById('chat-msg-count').textContent = `${msgs.length} message${msgs.length !== 1 ? 's' : ''}`;

    if (msgs.length === 0) {
        area.innerHTML = '<div style="text-align:center;color:var(--text-muted);font-size:13px;margin-top:40px">No messages yet</div>';
        return;
    }

    let lastDate = null;
    let lastType = null;

    msgs.forEach((msg, i) => {
        const msgDate = formatDate(msg.timestamp);
        if (msgDate !== lastDate) {
            const sep = document.createElement('div');
            sep.className = 'date-sep';
            sep.innerHTML = `<span>${msgDate}</span>`;
            area.appendChild(sep);
            lastDate = msgDate;
        }

        // Show sender label on type change
        if (msg.type !== lastType) {
            const senderEl = document.createElement('div');
            senderEl.className = `msg-sender ${msg.type}`;
            senderEl.textContent = msg.type === 'user' ? chats[userId].name : 'Aria ✦';
            area.appendChild(senderEl);
            lastType = msg.type;
        }

        const row = document.createElement('div');
        row.className = `msg-row ${msg.type}`;
        row.innerHTML = `
            <div class="msg-bubble">${escapeHtml(msg.body)}</div>
        `;
        area.appendChild(row);

        // Show time on last message or type change
        const nextMsg = msgs[i + 1];
        if (!nextMsg || nextMsg.type !== msg.type || formatDate(nextMsg.timestamp) !== msgDate) {
            const timeEl = document.createElement('div');
            timeEl.className = 'msg-time';
            timeEl.textContent = formatTime(msg.timestamp);
            area.appendChild(timeEl);
        }
    });
}

function appendMessage(userId, msg) {
    const area = document.getElementById('messages-area');
    const msgs = chats[userId]?.messages || [];
    const prevMsg = msgs[msgs.length - 2]; // message before this one

    // Date separator if needed
    if (!prevMsg || formatDate(prevMsg.timestamp) !== formatDate(msg.timestamp)) {
        const sep = document.createElement('div');
        sep.className = 'date-sep';
        sep.innerHTML = `<span>${formatDate(msg.timestamp)}</span>`;
        area.appendChild(sep);
    }

    // Sender label on type change
    if (!prevMsg || prevMsg.type !== msg.type) {
        const senderEl = document.createElement('div');
        senderEl.className = `msg-sender ${msg.type}`;
        senderEl.textContent = msg.type === 'user' ? chats[userId].name : 'Aria ✦';
        area.appendChild(senderEl);
    }

    const row = document.createElement('div');
    row.className = `msg-row ${msg.type}`;
    row.innerHTML = `<div class="msg-bubble">${escapeHtml(msg.body)}</div>`;
    area.appendChild(row);

    const timeEl = document.createElement('div');
    timeEl.className = 'msg-time';
    timeEl.textContent = formatTime(msg.timestamp);
    area.appendChild(timeEl);

    // Update message count
    const allMsgs = chats[userId]?.messages || [];
    document.getElementById('chat-msg-count').textContent = `${allMsgs.length} message${allMsgs.length !== 1 ? 's' : ''}`;
}

function scrollToBottom() {
    const area = document.getElementById('messages-area');
    area.scrollTop = area.scrollHeight;
}

// ── Stats ─────────────────────────────────────────────────────────
function updateStats() {
    const contactCount = Object.keys(chats).length;
    document.getElementById('stat-contacts').textContent = contactCount;
    document.getElementById('stat-messages').textContent = totalMessages;
    document.getElementById('wstat-contacts').textContent = contactCount;
    document.getElementById('wstat-msgs').textContent = totalMessages;
}

// ── Helpers ───────────────────────────────────────────────────────
function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/\n/g, '<br>');
}

// ── Logout ────────────────────────────────────────────────────────
function confirmLogout() {
    document.getElementById('logout-modal').classList.remove('hidden');
}
function closeLogoutModal() {
    document.getElementById('logout-modal').classList.add('hidden');
    const btn = document.getElementById('confirm-logout-btn');
    btn.classList.remove('loading');
    btn.textContent = 'Yes, Logout';
}

function doLogout() {
    const btn = document.getElementById('confirm-logout-btn');
    btn.classList.add('loading');
    btn.textContent = 'Logging out...';
    socket.emit('request_logout');
}

socket.on('logging_out', () => {
    closeLogoutModal();
    // Reset all state
    chats = {};
    activeUserId = null;
    totalMessages = 0;
    unreadCounts = {};
    // Clear sidebar
    document.getElementById('contact-list').innerHTML =
        '<div class="empty-contacts" id="empty-contacts"><div class="empty-icon">💬</div><p>No conversations yet</p><span>Messages will appear here</span></div>';
    updateStats();
    // Show QR screen to scan new login
    document.getElementById('qr-image').classList.add('hidden');
    document.getElementById('qr-loading-state').classList.remove('hidden');
    document.getElementById('qr-tag').textContent = 'Logging out...';
    showScreen('screen-qr');
    showToast('🔓 Logged out. Scan the QR code to log in again.', 5000);
});

