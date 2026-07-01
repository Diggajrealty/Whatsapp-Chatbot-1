# 🧪 Testing Guide for New Features

## Pre-requisites
1. Bot must be running: `node index.js`
2. Dashboard open: `http://localhost:3000`
3. WhatsApp connected (QR code scanned)

---

## Test 1: Multi-Language Auto-Detection 🌐

### Test Case 1A: Hindi Detection
**Phone 1 Actions:**
```
You: kya haal hai?
Bot: (Should respond in Hindi/Hinglish)
```

### Test Case 1B: Language Switch
**Phone 1 Actions:**
```
You: Reply in English
Bot: (Should switch to English and acknowledge)
```

### Test Case 1C: Tamil Detection
**Phone 2 Actions:**
```
You: enna irukku?
Bot: (Should detect Tamil and respond accordingly)
```

### Expected Results:
- ✅ Language detected on first message
- ✅ Language preference saved
- ✅ Bot replies in user's language
- ✅ User can switch languages mid-conversation
- ✅ Check console: `[LANG] Auto-detected hindi for [number]`

---

## Test 2: Referral System 🎁

### Test Case 2A: Generate Referral Code
**Phone 1 Actions:**
```
You: referral
Bot: Should provide unique code like REF8A2F1C
```

### Test Case 2B: Use Referral Code
**Phone 2 Actions:**
```
You: I have a referral code REF8A2F1C
Bot: (Should acknowledge and track)
```

### Test Case 2C: Check Referrer Notification
**Check Phone 1:**
```
Bot: 🎉 Great news! [Name] used your referral code. You now have 1 referral!
```

### Test Case 2D: View Leaderboard
**Dashboard Actions:**
1. Open dashboard
2. Click **🎁 Referrals** tab
3. Should see Phone 1 user with 1 referral

### Expected Results:
- ✅ Unique referral code generated
- ✅ Code format: REF + 6 characters
- ✅ Referrer gets notification
- ✅ Count increments in leaderboard
- ✅ Check file: `whatsapp_session/referrals.json` updated

---

## Test 3: Analytics Dashboard 📊

### Test Case 3A: Visit Scheduled
**Phone 1 Actions:**
```
You: Tell me about Nambiar District 25
Bot: (Provides info)
You: I want to schedule a visit
Bot: What date works for you?
You: Saturday 10am
Bot: (Confirms - should trigger [VISIT_CONFIRMED] tag)
```

### Test Case 3B: Brochure Request
**Phone 1 Actions:**
```
You: Send me the brochure
Bot: (Sends PDF + confirmation)
```

### Test Case 3C: Agent Handoff
**Phone 2 Actions:**
```
You: I want to talk to a real person
Bot: (Should trigger [AGENT_HANDOFF])
```

### Test Case 3D: View Analytics
**Dashboard Actions:**
1. Click **📊 Analytics** tab
2. Verify metrics:
   - Visits Scheduled: 1
   - Brochures Sent: 1
   - Agent Handoffs: 1
3. Check "Top Properties" chart shows Nambiar District 25
4. Check "Peak Hours" shows activity at current hour

### Expected Results:
- ✅ Metrics update in real-time
- ✅ Charts render correctly
- ✅ Property inquiries tracked
- ✅ Peak hours graph shows current hour activity
- ✅ Check file: `whatsapp_session/analytics.json` updated
- ✅ Admin receives alert on handoff

---

## Test 4: Quick Reply Buttons ⚡

### Test Case 4A: Automatic Quick Actions
**Phone 1 Actions:**
```
You: Tell me about Godrej project
Bot: (Provides detailed info)
Bot: *Quick Actions:*
     1. 📅 Schedule Visit
     2. 📄 Get Brochure
     3. 💰 EMI Calculator
     4. 📞 Talk to Expert
     
     Reply with the number or name of your choice.
```

### Test Case 4B: User Selects Action
**Phone 1 Actions:**
```
You: 1
Bot: (Starts visit scheduling flow)
```

OR

```
You: brochure
Bot: (Sends brochure)
```

### Expected Results:
- ✅ Quick actions appear after property info
- ✅ Options formatted with emojis
- ✅ User can reply with number or name
- ✅ Bot responds appropriately to selection

---

## Test 5: Peak Hours Tracking 🕐

### Test Case 5A: Message at Different Hours
**Actions:**
1. Send messages throughout the day
2. Check Analytics → Peak Hours chart
3. Should see bars at hours when messages were sent

### Expected Results:
- ✅ Peak hours array has 24 elements (0-23)
- ✅ Chart shows activity at correct hours
- ✅ Height of bars proportional to message count

---

## Test 6: Property Inquiries Tracking 🏢

### Test Case 6A: Multiple Property Inquiries
**Phone 1 Actions:**
```
You: Tell me about Nambiar District 25
Bot: (Info)
You: What about Sobha projects?
Bot: (Info)
You: Abhee properties?
Bot: (Info)
```

### Test Case 6B: View Property Chart
**Dashboard Actions:**
1. Click Analytics tab
2. Check "Top Properties by Inquiries" chart
3. Should show all 3 properties with inquiry counts

### Expected Results:
- ✅ Chart shows all inquired properties
- ✅ Bars sized proportionally
- ✅ Count displayed next to each bar
- ✅ Sorted by inquiry count (descending)

---

## Test 7: Response Time Tracking ⚡

### Test Case 7A: Send Multiple Messages
**Actions:**
1. Send 5-10 messages
2. Check Analytics → Avg Response Time
3. Should show average in seconds

### Expected Results:
- ✅ Response time calculated
- ✅ Displayed in seconds with 1 decimal (e.g., "2.3s")
- ✅ Updates after each message

---

## Test 8: Dashboard Tab Switching

### Test Case 8A: Navigate Tabs
**Dashboard Actions:**
1. Click **📊 Analytics** tab
   - Verify analytics panel shows
2. Click **🎁 Referrals** tab
   - Verify leaderboard shows
3. Click **💬 Conversations** tab
   - Verify chat list shows

### Expected Results:
- ✅ Only one tab active at a time
- ✅ Active tab highlighted in green
- ✅ Content switches smoothly
- ✅ Previous tab content hidden

---

## Test 9: Data Persistence

### Test Case 9A: Restart Bot
**Actions:**
1. Stop bot (Ctrl+C)
2. Restart: `node index.js`
3. Scan QR code again
4. Check Analytics tab
5. Send a message to previous contact

### Expected Results:
- ✅ Analytics data persists
- ✅ Referral codes persist
- ✅ Language preferences remembered
- ✅ Bot responds in user's saved language

---

## Test 10: CRM Integration (Google Sheets)

### Test Case 10A: Visit Confirmation Logged
**Actions:**
1. Schedule a visit (Test 3A)
2. Open your Google Sheets
3. Check for new row with:
   - Date/Time
   - User name
   - Phone number
   - Status: "Visit Confirmed"
   - Visit timing

### Expected Results:
- ✅ New row added to Google Sheets
- ✅ All fields populated correctly
- ✅ Check console: `[CRM] Successfully logged to Google Sheets`

---

## Debugging Tips

### If language detection doesn't work:
```bash
# Check console for:
[LANG] Auto-detected [language] for [userId]

# Verify file created:
cat whatsapp_session/user_languages.json
```

### If referrals don't track:
```bash
# Check console for:
[REFERRAL] Generated code REF... for [name]
[REFERRAL] [Name] used [Name]'s code

# Verify file:
cat whatsapp_session/referrals.json
```

### If analytics don't update:
```bash
# Check console for analytics saves:
# Verify file:
cat whatsapp_session/analytics.json

# Force refresh on dashboard
```

### If quick actions don't appear:
```bash
# Check console for:
[DEBUG] Quick actions requested: VISIT, BROCHURE, EMI, EXPERT

# Verify AI response includes [QUICK_ACTIONS: ...] tag
```

---

## Success Criteria Checklist

- [ ] Language auto-detected from first message
- [ ] User can switch languages mid-conversation
- [ ] Referral codes generate and track correctly
- [ ] Referrer gets notification when code is used
- [ ] Leaderboard displays top referrers
- [ ] Analytics metrics update in real-time
- [ ] Property inquiries chart renders
- [ ] Peak hours chart shows activity
- [ ] Quick actions appear after property info
- [ ] All tabs switch correctly on dashboard
- [ ] Data persists after bot restart
- [ ] Google Sheets logging works

---

## Performance Benchmarks

### Expected Response Times:
- Text message reply: 2-5 seconds
- Voice note reply: 3-8 seconds
- Brochure send: 1-3 seconds
- Analytics update: Instant (real-time via Socket.io)

### Dashboard Load Times:
- Initial load: < 2 seconds
- Tab switch: < 0.5 seconds
- Chart render: < 1 second

---

## Known Limitations

1. **Language Detection:**
   - Only detects first message
   - Limited to 5 languages (Hindi, Tamil, Kannada, Telugu, English)
   - Hinglish patterns may be imperfect

2. **Referrals:**
   - One referral code per user (unchangeable)
   - Can only be referred once (first code wins)

3. **Analytics:**
   - Response times limited to last 1000 messages
   - No date range filtering (all-time data)

4. **Quick Actions:**
   - Manual user reply required (not true WhatsApp buttons)
   - Relies on AI to add tag correctly

---

## Troubleshooting

### Dashboard shows "No data"
```bash
# Solution 1: Refresh analytics
Click "↻ Refresh" button

# Solution 2: Hard refresh browser
Ctrl+Shift+R (Windows/Linux)
Cmd+Shift+R (Mac)

# Solution 3: Check console
F12 → Console tab → Look for errors
```

### Language not switching
```bash
# Check AI response includes [LANG_SWITCH: language] tag
# Verify language name is lowercase
# Valid: hindi, tamil, kannada, telugu, english
```

### Referral notification not sent
```bash
# Verify ADMIN_PHONE_NUMBER in .env
# Check referrer is active on WhatsApp
# Verify referral code format matches exactly
```

---

**Happy Testing! 🚀**

Report any bugs or issues in the console output.
