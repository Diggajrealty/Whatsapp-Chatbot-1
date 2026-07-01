# 🤖 Multi-Bot WhatsApp Setup - Quick Guide

## 🚀 How to Start

### Step 1: Start the Server
```bash
npm start
```

This will start the multi-bot dashboard on **http://localhost:3000**

### Step 2: Open Dashboard
Open your browser and go to:
```
http://localhost:3000
```

### Step 3: Turn On Bots
You'll see 3 bots available:
- **Divya (Sobha)** - For Sobha properties 🏢
- **Ashi (Brigade)** - For Brigade properties 🏗️
- **Samaira (Nambiar)** - For Nambiar properties 🌆

**Toggle ON** any bot you want to use by clicking the switch next to it.

### Step 4: Scan QR Code
1. When you turn on a bot, a **QR code modal** will appear
2. Open **WhatsApp on your phone**
3. Go to **Settings → Linked Devices → Link a Device**
4. **Scan the QR code** shown in the modal
5. Wait for "Connected!" message

### Step 5: Use Different Phone Numbers
- **Each bot needs its own WhatsApp number**
- Bot 1 (Divya) → Scan with Phone Number 1
- Bot 2 (Ashi) → Scan with Phone Number 2
- Bot 3 (Samaira) → Scan with Phone Number 3

You can run all 3 bots at the same time, each connected to a different WhatsApp number!

## 📱 Managing Bots

### Turn On a Bot
Click the toggle switch next to the bot name → QR appears → Scan it

### Turn Off a Bot
Click the toggle switch again to turn it off and disconnect

### View Chats
Click on the bot tab at the top to see its conversations

### Send Manual Messages
In the chat view, you can manually reply to customers

## 🎯 Important Notes

1. **Each bot must use a DIFFERENT WhatsApp number**
2. **Keep the terminal/server running** - don't close it
3. **QR codes expire after 20 seconds** - scan quickly or toggle off/on to get a new one
4. **First time setup takes 10-15 seconds** per bot
5. **Session is saved** - next time you start, you may not need to scan QR again

## 🔧 Troubleshooting

### QR Code not appearing?
- Refresh the browser page
- Toggle the bot off and on again
- Check if port 3000 is free

### "Still generating" message?
- Wait 10-15 seconds, the QR will appear
- Check the terminal for "[BOTNAME] QR code generated" message

### Bot disconnected?
- Just toggle it on again and rescan the QR
- Or restart the server: Stop with Ctrl+C, then `npm start` again

## 📂 Session Files

Each bot's session is saved in:
- `whatsapp_session_sobha/`
- `whatsapp_session_brigade/`
- `whatsapp_session_nambiar/`

Don't delete these folders unless you want to re-scan QR codes.

## ⚡ Quick Commands

```bash
# Start multi-bot dashboard (default)
npm start

# Start single-bot mode (old version)
npm run single
```

---

**You're all set!** Open http://localhost:3000 and start connecting your bots! 🎉
