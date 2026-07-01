# 🤖 Bot Selector Dashboard - User Guide

## ✨ What's New

Your dashboard now starts with a **Bot Selector Screen** where you can choose which builder's bot to activate!

---

## 🚀 How It Works

### Step 1: Open Dashboard
```
http://localhost:3000
```

### Step 2: Choose Your Bot

You'll see **7 beautiful bot cards**:

1. **🏢 Sobha** - Luxury residential projects
2. **🏗️ Brigade** - Premium properties
3. **🌆 Nambiar** - Modern living spaces
4. **🏘️ Godrej** - Sustainable communities
5. **🏡 Abhee** - Affordable housing
6. **🏙️ DSR** - Urban developments
7. **⭐ All Builders** (Recommended) - General real estate bot

### Step 3: Click a Bot Card

When you click a bot card:
- ✨ Smooth animation
- 🎯 Bot selection confirmed
- 📱 QR screen appears
- 🤖 Bot name updates in header

### Step 4: Scan QR Code

- Open WhatsApp on phone
- Settings → Linked Devices
- Scan the QR code
- Dashboard loads automatically

### Step 5: Change Bot (Optional)

Click **"← Change Bot"** button on QR screen to go back and select a different bot.

---

## 🎨 Visual Design

### Bot Selector Screen
```
┌─────────────────────────────────────────────┐
│              ✦ Divya Dashboard              │
│       Select a builder bot to activate      │
├─────────────────────────────────────────────┤
│                                             │
│  ┌──────┐  ┌──────┐  ┌──────┐             │
│  │ 🏢   │  │ 🏗️   │  │ 🌆   │             │
│  │Sobha │  │Brigade│ │Nambiar│            │
│  └──────┘  └──────┘  └──────┘             │
│                                             │
│  ┌──────┐  ┌──────┐  ┌──────┐             │
│  │ 🏘️   │  │ 🏡   │  │ 🏙️   │             │
│  │Godrej│  │Abhee │  │ DSR  │             │
│  └──────┘  └──────┘  └──────┘             │
│                                             │
│  ┌─────────────────────────────┐           │
│  │     ⭐ All Builders         │           │
│  │  General real estate bot    │           │
│  │      (Recommended)           │           │
│  └─────────────────────────────┘           │
│                                             │
└─────────────────────────────────────────────┘
```

### Features
- **Hover Effect**: Cards lift up when you hover
- **Gradient Icons**: Each bot has unique colorful icon
- **Status Badge**: Shows "Ready" or "Recommended"
- **Smooth Animations**: Beautiful floating orbs in background

---

## 🎯 Bot Specializations

### Sobha Bot (🏢)
- **Focus**: Luxury residential projects
- **Color**: Purple gradient
- **Best for**: High-end property inquiries

### Brigade Bot (🏗️)
- **Focus**: Premium properties
- **Color**: Green gradient
- **Best for**: Quality construction queries

### Nambiar Bot (🌆)
- **Focus**: Modern living spaces
- **Color**: Orange gradient
- **Best for**: Contemporary design preferences

### Godrej Bot (🏘️)
- **Focus**: Sustainable communities
- **Color**: Purple/violet gradient
- **Best for**: Eco-friendly living

### Abhee Bot (🏡)
- **Focus**: Affordable housing
- **Color**: Cyan gradient
- **Best for**: Budget-conscious buyers

### DSR Bot (🏙️)
- **Focus**: Urban developments
- **Color**: Pink gradient
- **Best for**: City living properties

### All Builders Bot (⭐ Recommended)
- **Focus**: General real estate
- **Color**: Blue/purple gradient
- **Best for**: Multiple builder inquiries
- **Features**: 
  - Knows all builders
  - Compares projects
  - Most versatile

---

## 🔄 Workflow

```
Start Dashboard
      ↓
Bot Selector Screen (NEW!)
      ↓
Click Bot Card
      ↓
QR Code Screen
      ↓
Scan with WhatsApp
      ↓
Dashboard Loads
      ↓
Start Chatting!
```

---

## 💡 Pro Tips

### Choosing the Right Bot

**Use Specific Builder Bot when:**
- Customer knows exact builder they want
- Focused inquiry about one builder
- Need specialized builder knowledge

**Use "All Builders" Bot when:**
- Customer exploring options
- Comparing multiple builders
- General property search
- Not sure which builder

### Switching Bots

1. Click "← Change Bot" on QR screen
2. Select different bot
3. New QR appears
4. Scan with same WhatsApp
5. Bot switches automatically

---

## 🎨 Design Details

### Colors Used

Each bot card has unique gradient:
```css
Sobha:    Purple → Violet
Brigade:  Emerald → Green
Nambiar:  Orange → Amber
Godrej:   Purple → Indigo
Abhee:    Cyan → Teal
DSR:      Pink → Rose
All:      Indigo → Purple
```

### Animations

- **Floating Gem**: Up and down motion (3s loop)
- **Card Hover**: Lift effect (-8px translateY)
- **Orbs**: Smooth floating in background
- **Top Accent**: Slides in on hover

---

## 🚨 Troubleshooting

### Selector screen not showing?

**Hard refresh browser:**
```
Windows/Linux: Ctrl + Shift + R
Mac: Cmd + Shift + R
```

### Bot card click not working?

**Check browser console (F12):**
- Look for JavaScript errors
- Verify Socket.io connected

### QR not appearing after selection?

**Wait 2-3 seconds:**
- QR takes moment to generate
- Watch for loading spinner

---

## 📊 What Happens When You Select

### Backend (Server Side)
```
1. Dashboard sends selection
2. Server notes which bot chosen
3. QR code generates
4. Socket.io sends QR to browser
5. Bot connects to WhatsApp
```

### Frontend (Browser Side)
```
1. User clicks bot card
2. selectBot() function runs
3. Bot name updates
4. Screen switches to QR
5. Toast notification shows
6. QR displays when ready
```

---

## 🎯 Testing Each Bot

### Quick Test
```
1. Select "All Builders"
2. Scan QR code
3. Send: "Tell me about Sobha"
4. Bot replies with Sobha info
5. Works for all builders!
```

### Specific Bot Test
```
1. Select "Sobha Bot"
2. Scan QR code
3. Send: "Show me projects"
4. Bot focuses on Sobha only
5. Specialized responses
```

---

## 🔮 Future Enhancements

Possible additions:
- [ ] Bot switching without logout
- [ ] Multiple bots simultaneously
- [ ] Bot performance metrics
- [ ] Most popular bot tracker
- [ ] Bot-specific analytics

---

## ✅ Current Features

- ✅ Beautiful bot selector screen
- ✅ 7 different bot options
- ✅ Smooth animations
- ✅ Easy bot switching
- ✅ "All Builders" recommended option
- ✅ Back button to change selection
- ✅ Toast notifications
- ✅ Gradient icons

---

## 🎉 Benefits

### For You
- Choose the right bot for each customer
- Easy switching between builders
- Professional presentation
- Clear organization

### For Customers
- Builder-specific responses
- Focused information
- Faster answers
- Better experience

---

**Now your dashboard starts with a beautiful bot selector! 🚀**

**Open http://localhost:3000 and try it!**
