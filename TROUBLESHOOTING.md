# 🔧 Troubleshooting Guide

## Common Issues & Solutions

### 1. ❌ Bot Crashes with "EBUSY: resource busy or locked"

**Problem:** Session file is locked, usually when turning bots on/off too quickly.

**Solution:**
```bash
# Stop everything
taskkill /F /IM node.exe
taskkill /F /IM chrome.exe

# Wait 3 seconds
sleep 3

# Restart
npm start
```

**Prevention:** Wait 3-5 seconds between toggling different bots on/off.

---

### 2. ❌ "ERR_NETWORK_CHANGED" Error

**Problem:** Chrome process was killed while WhatsApp was connecting.

**Solution:**
```bash
# Clean restart
taskkill /F /IM node.exe
npm start
```

**Prevention:** Don't kill Chrome processes manually while bots are connecting.

---

### 3. ❌ QR Code Not Appearing / Stuck on "Generating..."

**Possible Causes:**
- Browser taking time to launch
- Session files corrupted

**Solution:**
```bash
# Method 1: Just wait 15-20 seconds (first time is slow)

# Method 2: Toggle bot off and on again

# Method 3: Restart server
Ctrl+C
npm start
```

---

### 4. ❌ Bot Replies "I'm having trouble connecting..."

**Problem:** All AI APIs failed (Gemini, OpenRouter, Claude).

**Check:**
```bash
# View .env file
cat .env | grep API_KEY
```

**Solution:** Make sure you have valid API keys:
- ✅ 4 Gemini keys starting with `AQ.Ab8RN6...`
- ✅ OpenRouter key
- ✅ Anthropic key

---

### 5. ❌ "Port 3000 already in use"

**Problem:** Another Node process is using port 3000.

**Solution:**
```bash
# Kill all node processes
taskkill /F /IM node.exe

# Restart
npm start
```

---

### 6. ❌ Multiple Bots Crash When Starting Together

**Problem:** Too many bots starting simultaneously causing resource conflicts.

**Solution:**
**Start them one at a time:**
1. Toggle ON Bot 1 → Wait for "Connected"
2. Toggle ON Bot 2 → Wait for "Connected"  
3. Toggle ON Bot 3 → Wait for "Connected"

**Don't:** Toggle all 3 ON at the same time.

---

### 7. ❌ Bot Disconnects Randomly

**Possible Causes:**
- Internet connection issue
- WhatsApp Web session expired
- API rate limits hit

**Solution:**
```bash
# Check logs
tail -50 <output-file>

# Restart bot
taskkill /F /IM node.exe
npm start

# Re-scan QR code if needed
```

---

### 8. ❌ Can't Delete Session Files

**Problem:** Files locked by Chrome/Node processes.

**Solution:**
```bash
# Kill all processes first
taskkill /F /IM node.exe
taskkill /F /IM chrome.exe

# Wait 5 seconds
sleep 5

# Now you can delete
rm -rf whatsapp_session_brigade
rm -rf whatsapp_session_sobha
rm -rf whatsapp_session_nambiar
```

---

## 🚀 Quick Clean Restart (Fixes Most Issues)

```bash
# The nuclear option - kills everything and restarts clean
taskkill /F /IM node.exe
taskkill /F /IM chrome.exe
sleep 3
npm start
```

Then refresh dashboard: **http://localhost:3000**

---

## 📊 How to Check Logs

### Real-time logs:
```bash
# Watch live logs
tail -f <path-to-output-file>
```

### Check recent errors:
```bash
# Last 50 lines
tail -50 <path-to-output-file>

# Search for errors
grep -i "error\|failed" <path-to-output-file>
```

---

## ✅ Health Check

**Bot is healthy when you see:**
```
[SERVER] Multi-Bot Dashboard running → http://localhost:3000
[DASHBOARD] Browser connected
[BRIGADE] Start requested
[BRIGADE] QR code generated
[BRIGADE] Authenticated!
[BRIGADE] Bot is ready!
```

**Bot has issues when you see:**
```
Error: EBUSY
Error: ERR_NETWORK_CHANGED
[BRIGADE] All Gemini keys failed
[BRIGADE] Claude failed
```

---

## 🆘 If Nothing Works

**Complete Reset:**
```bash
# 1. Kill everything
taskkill /F /IM node.exe
taskkill /F /IM chrome.exe

# 2. Delete ALL session folders
rm -rf whatsapp_session_*

# 3. Reinstall dependencies
npm install

# 4. Start fresh
npm start

# 5. Re-scan QR codes for all bots
```

⚠️ Warning: This will log out ALL bots. You'll need to scan QR codes again.

---

## 📞 Common Error Messages Explained

| Error | Meaning | Fix |
|-------|---------|-----|
| `EBUSY: resource busy` | File is locked | Kill processes, restart |
| `ERR_NETWORK_CHANGED` | Network interrupted | Clean restart |
| `EADDRINUSE` | Port 3000 taken | Kill node processes |
| `Model not found` | Wrong API model name | Already fixed in code |
| `No endpoints found` | Wrong OpenRouter model | Already fixed in code |
| `Authentication failure` | QR expired/invalid | Toggle bot off/on, rescan QR |

---

## 💡 Best Practices

1. ✅ **Start bots one at a time** - Don't toggle all at once
2. ✅ **Wait for "Connected"** before starting next bot
3. ✅ **Don't rapidly toggle on/off** - Give 3-5 seconds between
4. ✅ **Keep terminal open** - Don't close the Node process window
5. ✅ **Monitor logs** - Watch for errors in real-time
6. ✅ **Clean restart daily** - Prevents memory buildup

---

**Most issues? Just run:**
```bash
taskkill /F /IM node.exe && npm start
```

Then refresh your browser! 🎉
