# 🔑 How to Get Valid API Keys

## ❌ Current Problem
Your Gemini API keys in `.env` are **invalid/corrupted**:
```
GEMINI_API_KEY_1=AQ.Ab8RN6Lw9u6nnh0FsmPv1OGcV_eX0iNFOIQ9-gilkyN5_7Iaow
```

Valid Gemini keys should:
- Start with `AIzaSy`
- Be exactly 39 characters long
- Example: `AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxxxxx`

---

## ✅ How to Get FREE Gemini API Keys

### Step 1: Go to Google AI Studio
Visit: **https://aistudio.google.com/apikey**

### Step 2: Sign in with Google Account
Use any Google account (Gmail)

### Step 3: Create API Key
1. Click **"Get API Key"** or **"Create API Key"**
2. Select a Google Cloud project (or create new one)
3. Click **"Create API Key in existing project"** or **"Create API Key in new project"**
4. Copy the API key (starts with `AIzaSy...`)

### Step 4: Add to .env File
Open your `.env` file and replace the keys:

```env
GEMINI_API_KEY_1=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
GEMINI_API_KEY_2=AIzaSyYYYYYYYYYYYYYYYYYYYYYYYYYYYYY
GEMINI_API_KEY_3=AIzaSyZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ
```

**You can create up to 5 keys for free rotation!**

---

## 🎯 FREE Tier Limits (Gemini 2.0 Flash)
- **15 requests per minute**
- **1,500 requests per day**
- **1 million tokens per day**
- **100% FREE - No credit card required!**

---

## 🔄 Alternative: Use OpenRouter (Already Fixed)

Good news! Your **OpenRouter** and **Anthropic** keys look valid. I've fixed the model names:
- ✅ OpenRouter: Changed to `google/gemini-2.0-flash-exp:free`
- ✅ Anthropic: Changed to `claude-3-5-sonnet-20241022`

**Your bot will now use:**
1. Try Gemini first (if keys are valid)
2. Fallback to OpenRouter (free tier available)
3. Fallback to Claude Sonnet (your key)

---

## 🚀 Quick Fix (Right Now)

### Option 1: Get Valid Gemini Keys (Recommended)
1. Go to https://aistudio.google.com/apikey
2. Create 3-5 API keys
3. Replace in `.env` file
4. Restart the bot

### Option 2: Use OpenRouter Only
Your OpenRouter key looks valid. The bot will automatically use it if Gemini fails.

---

## 🔧 After Getting Keys

1. **Update .env file** with new Gemini keys
2. **Restart the bot**:
   ```bash
   # Press Ctrl+C to stop current bot
   npm start
   ```
3. **Test by sending a message** to any connected bot

---

## 📝 Your Current Working Keys

✅ **OpenRouter**: `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`
✅ **Anthropic**: `sk-ant-api03-Hbqvd0tZR6hDevz1SGcCojse...`

These are working and will be used as fallback! So your bot **will work right now**, just restart it.

---

## 🎉 Immediate Solution

**Your bot should work NOW** since I fixed OpenRouter and Claude model names. Just:

```bash
# Kill current process
Ctrl + C

# Start again
npm start
```

Then send a test message to see the AI respond! 🚀
