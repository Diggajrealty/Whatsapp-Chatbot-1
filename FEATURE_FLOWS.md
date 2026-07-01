# 🔄 Feature Flow Diagrams

Visual guide to understand how each feature works end-to-end.

---

## 1. Multi-Language Auto-Detection Flow 🌐

```
┌─────────────────────────────────────────────────────────────┐
│ FIRST MESSAGE FROM USER                                     │
└────────┬────────────────────────────────────────────────────┘
         │
         ▼
    ┌────────────────┐
    │ User sends:    │
    │ "kya haal hai?"│
    └────┬───────────┘
         │
         ▼
    ┌──────────────────────────┐
    │ detectLanguage(message)  │
    │ - Check Unicode ranges   │
    │ - Check keyword patterns │
    └────┬─────────────────────┘
         │
         ▼
    ┌────────────────┐
    │ Returns:       │
    │ "hindi"        │
    └────┬───────────┘
         │
         ▼
    ┌─────────────────────────────┐
    │ userLanguages.set(userId,   │
    │                   "hindi")  │
    └────┬────────────────────────┘
         │
         ▼
    ┌────────────────────────────┐
    │ saveLanguagePreferences()  │
    │ → user_languages.json      │
    └────┬───────────────────────┘
         │
         ▼
    ┌──────────────────────────────────┐
    │ AI Message Context:              │
    │ [User Name: John]                │
    │ [Preferred Language: Hindi]      │
    │ kya haal hai?                    │
    └────┬─────────────────────────────┘
         │
         ▼
    ┌──────────────────────────┐
    │ Gemini AI processes      │
    │ Responds in Hindi        │
    └────┬─────────────────────┘
         │
         ▼
    ┌──────────────────────────┐
    │ Bot: "Main bhadiya hun!  │
    │ Aapko kaise help kar     │
    │ sakti hun...?"           │
    └──────────────────────────┘


┌─────────────────────────────────────────────────────────────┐
│ LANGUAGE SWITCH                                             │
└────────┬────────────────────────────────────────────────────┘
         │
         ▼
    ┌────────────────┐
    │ User sends:    │
    │ "Reply in      │
    │  English"      │
    └────┬───────────┘
         │
         ▼
    ┌──────────────────────────┐
    │ Gemini detects switch    │
    │ request                  │
    └────┬─────────────────────┘
         │
         ▼
    ┌────────────────────────────┐
    │ AI Response includes:      │
    │ "Of course! ..."           │
    │ [LANG_SWITCH: english]     │
    └────┬───────────────────────┘
         │
         ▼
    ┌────────────────────────────┐
    │ Bot detects tag:           │
    │ langSwitchMatch found      │
    └────┬───────────────────────┘
         │
         ▼
    ┌─────────────────────────────┐
    │ userLanguages.set(userId,   │
    │                   "english")│
    └────┬────────────────────────┘
         │
         ▼
    ┌────────────────────────────┐
    │ saveLanguagePreferences()  │
    └────┬───────────────────────┘
         │
         ▼
    ┌──────────────────────────┐
    │ All future messages      │
    │ replied in English       │
    └──────────────────────────┘
```

---

## 2. Referral System Flow 🎁

```
┌─────────────────────────────────────────────────────────────┐
│ GENERATE REFERRAL CODE                                      │
└────────┬────────────────────────────────────────────────────┘
         │
         ▼
    ┌────────────────┐
    │ User A sends:  │
    │ "referral"     │
    └────┬───────────┘
         │
         ▼
    ┌──────────────────────────┐
    │ Gemini detects referral  │
    │ request                  │
    └────┬─────────────────────┘
         │
         ▼
    ┌────────────────────────────┐
    │ AI Response includes:      │
    │ "Here's your code..."      │
    │ [GENERATE_REFERRAL]        │
    └────┬───────────────────────┘
         │
         ▼
    ┌────────────────────────────┐
    │ Bot detects tag            │
    └────┬───────────────────────┘
         │
         ▼
    ┌──────────────────────────────┐
    │ Check: referralCodes has     │
    │ userId?                      │
    └────┬────────────────┬────────┘
         │ NO             │ YES
         ▼                ▼
    ┌─────────────┐  ┌──────────────┐
    │Generate new │  │Get existing  │
    │code:        │  │code + count  │
    │REF8A2F1C    │  └──────┬───────┘
    └─────┬───────┘         │
          │                 │
          ▼                 │
    ┌──────────────────┐    │
    │ Save to Maps:    │    │
    │ codes[userId]    │    │
    │ counts[userId]=0 │    │
    └─────┬────────────┘    │
          │                 │
          ▼                 ▼
    ┌────────────────────────────┐
    │ Append to response:        │
    │ "🎁 Your Referral Code:    │
    │  REF8A2F1C                 │
    │  You have X referrals!"    │
    └────┬───────────────────────┘
         │
         ▼
    ┌────────────────┐
    │ Send to User A │
    └────────────────┘


┌─────────────────────────────────────────────────────────────┐
│ USE REFERRAL CODE                                           │
└────────┬────────────────────────────────────────────────────┘
         │
         ▼
    ┌────────────────┐
    │ User B sends:  │
    │ "REF8A2F1C"    │
    └────┬───────────┘
         │
         ▼
    ┌──────────────────────────┐
    │ Gemini detects code      │
    └────┬─────────────────────┘
         │
         ▼
    ┌────────────────────────────┐
    │ AI Response includes:      │
    │ "Great! ..."               │
    │ [CHECK_REFERRAL: REF8A2F1C]│
    └────┬───────────────────────┘
         │
         ▼
    ┌────────────────────────────┐
    │ Bot extracts code          │
    └────┬───────────────────────┘
         │
         ▼
    ┌──────────────────────────────┐
    │ Loop through referralCodes:  │
    │ Find matching code           │
    └────┬────────────────┬────────┘
         │ FOUND          │ NOT FOUND
         ▼                ▼
    ┌─────────────┐  ┌──────────────┐
    │Get referrer │  │Do nothing    │
    │userId (A)   │  └──────────────┘
    └─────┬───────┘
          │
          ▼
    ┌──────────────────────────────┐
    │ Check: userReferrals has B?  │
    └────┬────────────────┬────────┘
         │ NO (first time)│ YES (already referred)
         ▼                ▼
    ┌─────────────────┐  ┌──────────────┐
    │Link B→A         │  │Skip (can only│
    │Increment A count│  │be referred   │
    │Save all data    │  │once)         │
    └─────┬───────────┘  └──────────────┘
          │
          ▼
    ┌────────────────────────────┐
    │ Send notification to A:    │
    │ "🎉 John used your code!   │
    │  You now have 3 referrals!"│
    └────┬───────────────────────┘
         │
         ▼
    ┌────────────────┐
    │ Update         │
    │ Leaderboard    │
    └────────────────┘


┌─────────────────────────────────────────────────────────────┐
│ LEADERBOARD VIEW                                            │
└────────┬────────────────────────────────────────────────────┘
         │
         ▼
    ┌────────────────┐
    │ Admin clicks   │
    │ 🎁 Referrals   │
    │ tab            │
    └────┬───────────┘
         │
         ▼
    ┌────────────────────────────┐
    │ getTopReferrers() called   │
    └────┬───────────────────────┘
         │
         ▼
    ┌──────────────────────────────┐
    │ Loop referralCounts Map:     │
    │ [{userId, count}, ...]       │
    └────┬─────────────────────────┘
         │
         ▼
    ┌──────────────────────────────┐
    │ Enrich with user data:       │
    │ [{name, phone, referrals}...]│
    └────┬─────────────────────────┘
         │
         ▼
    ┌────────────────────────────┐
    │ Sort by referral count     │
    │ (descending)               │
    └────┬───────────────────────┘
         │
         ▼
    ┌────────────────────────────┐
    │ Take top 10                │
    └────┬───────────────────────┘
         │
         ▼
    ┌────────────────────────────┐
    │ Render leaderboard:        │
    │ 🥇 Alice - 12 referrals    │
    │ 🥈 Bob - 8 referrals       │
    │ 🥉 Carol - 5 referrals     │
    └────────────────────────────┘
```

---

## 3. Analytics Dashboard Flow 📊

```
┌─────────────────────────────────────────────────────────────┐
│ ANALYTICS TRACKING (Real-time)                              │
└────────┬────────────────────────────────────────────────────┘
         │
         ▼
    ┌────────────────┐
    │ Message        │
    │ received       │
    └────┬───────────┘
         │
         ├────────────────────────┐
         │                        │
         ▼                        ▼
    ┌─────────────┐      ┌──────────────┐
    │Track Peak   │      │Start timer:  │
    │Hour:        │      │messageStart  │
    │peakHours[h]++│      │Time          │
    └─────────────┘      └──────┬───────┘
                                │
                                ▼
                         ┌──────────────┐
                         │AI processes  │
                         │message       │
                         └──────┬───────┘
                                │
                                ▼
                         ┌──────────────┐
                         │Calculate:    │
                         │responseTime= │
                         │now-start     │
                         └──────┬───────┘
                                │
                                ▼
                         ┌──────────────────┐
                         │Push to:          │
                         │responseTimes[]   │
                         │(keep last 1000)  │
                         └──────────────────┘


┌─────────────────────────────────────────────────────────────┐
│ EVENT-BASED TRACKING                                        │
└────────┬────────────────────────────────────────────────────┘
         │
         ├──────────┬──────────┬──────────┐
         ▼          ▼          ▼          ▼
    ┌─────────┐┌─────────┐┌─────────┐┌─────────┐
    │Visit    ││Brochure ││Location ││Agent    │
    │Confirm  ││Request  ││Request  ││Handoff  │
    └────┬────┘└────┬────┘└────┬────┘└────┬────┘
         │          │          │          │
         │          │          │          │
         ▼          ▼          ▼          ▼
    ┌─────────────────────────────────────────┐
    │ Check for tags:                         │
    │ [VISIT_CONFIRMED: time | property]      │
    │ [SEND_BROCHURE: property]               │
    │ [SEND_LOCATION: property]               │
    │ [AGENT_HANDOFF]                         │
    └────┬────────────────────────────────────┘
         │
         ├──────────┬──────────┬──────────┐
         ▼          ▼          ▼          ▼
    ┌─────────┐┌─────────┐┌─────────┐┌─────────┐
    │Increment││Increment││Increment││Increment│
    │visitSch-││brochures││property-││agent-   │
    │eduled   ││Sent     ││Inquiries││Handoffs │
    └────┬────┘└────┬────┘└────┬────┘└────┬────┘
         │          │          │          │
         └──────────┴──────────┴──────────┘
                    │
                    ▼
            ┌───────────────┐
            │saveAnalytics()│
            └───────┬───────┘
                    │
                    ▼
            ┌───────────────┐
            │Emit to        │
            │Dashboard via  │
            │Socket.io      │
            └───────────────┘


┌─────────────────────────────────────────────────────────────┐
│ DASHBOARD VIEW                                              │
└────────┬────────────────────────────────────────────────────┘
         │
         ▼
    ┌────────────────┐
    │ Admin clicks   │
    │ 📊 Analytics   │
    │ tab            │
    └────┬───────────┘
         │
         ▼
    ┌────────────────────────────┐
    │ renderAnalytics() called   │
    └────┬───────────────────────┘
         │
         ├──────────────────┬────────────────┬────────────────┐
         ▼                  ▼                ▼                ▼
    ┌─────────┐     ┌────────────┐  ┌─────────────┐  ┌──────────┐
    │Render   │     │Render      │  │Render Peak  │  │Render    │
    │Metric   │     │Property    │  │Hours Chart  │  │Drop-off  │
    │Cards    │     │Chart       │  │             │  │Chart     │
    └────┬────┘     └─────┬──────┘  └──────┬──────┘  └────┬─────┘
         │                │                 │              │
         ▼                ▼                 ▼              ▼
    ┌────────────────────────────────────────────────────────┐
    │ Update DOM with:                                       │
    │ - 4 metric cards (visits, brochures, handoffs, time)  │
    │ - Bar chart (properties)                              │
    │ - 24-hour chart (peak hours)                          │
    │ - Bar chart (drop-offs)                               │
    └────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────┐
│ REAL-TIME UPDATES                                           │
└────────┬────────────────────────────────────────────────────┘
         │
         ▼
    ┌────────────────┐
    │ New event      │
    │ happens        │
    └────┬───────────┘
         │
         ▼
    ┌────────────────────────────┐
    │ analyticsData updated      │
    └────┬───────────────────────┘
         │
         ▼
    ┌────────────────────────────┐
    │ saveAnalytics() called     │
    └────┬───────────────────────┘
         │
         ▼
    ┌────────────────────────────┐
    │ Socket.io emits:           │
    │ 'analytics_update'         │
    └────┬───────────────────────┘
         │
         ▼
    ┌────────────────────────────┐
    │ Dashboard receives event   │
    └────┬───────────────────────┘
         │
         ▼
    ┌────────────────────────────┐
    │ If on Analytics tab:       │
    │ → renderAnalytics()        │
    │ → Charts update instantly  │
    └────────────────────────────┘
```

---

## 4. Quick Reply Buttons Flow ⚡

```
┌─────────────────────────────────────────────────────────────┐
│ QUICK ACTIONS TRIGGER                                       │
└────────┬────────────────────────────────────────────────────┘
         │
         ▼
    ┌────────────────┐
    │ User asks:     │
    │ "Tell me about │
    │ Nambiar"       │
    └────┬───────────┘
         │
         ▼
    ┌──────────────────────────┐
    │ Gemini searches Google   │
    │ Gathers info             │
    └────┬─────────────────────┘
         │
         ▼
    ┌────────────────────────────┐
    │ Gemini provides detailed   │
    │ property information       │
    └────┬───────────────────────┘
         │
         ▼
    ┌────────────────────────────┐
    │ Gemini decides to suggest  │
    │ quick actions              │
    └────┬───────────────────────┘
         │
         ▼
    ┌────────────────────────────┐
    │ AI Response includes:      │
    │ "...premium project..."    │
    │ [QUICK_ACTIONS:            │
    │  VISIT|BROCHURE|EMI|EXPERT]│
    └────┬───────────────────────┘
         │
         ▼
    ┌────────────────────────────┐
    │ Bot detects tag:           │
    │ quickActionsMatch found    │
    └────┬───────────────────────┘
         │
         ▼
    ┌────────────────────────────┐
    │ Extract actions:           │
    │ ['VISIT','BROCHURE',       │
    │  'EMI','EXPERT']           │
    └────┬───────────────────────┘
         │
         ▼
    ┌────────────────────────────┐
    │ Remove tag from response   │
    └────┬───────────────────────┘
         │
         ▼
    ┌────────────────────────────┐
    │ Send main response first   │
    └────┬───────────────────────┘
         │
         ▼
    ┌────────────────────────────┐
    │ Build button message:      │
    │ "*Quick Actions:*"         │
    │ "1. 📅 Schedule Visit"     │
    │ "2. 📄 Get Brochure"       │
    │ "3. 💰 EMI Calculator"     │
    │ "4. 📞 Talk to Expert"     │
    │ "Reply with number/name"   │
    └────┬───────────────────────┘
         │
         ▼
    ┌────────────────────────────┐
    │ Send as follow-up message  │
    └────┬───────────────────────┘
         │
         ▼
    ┌────────────────────────────┐
    │ User sees buttons in chat  │
    └────────────────────────────┘


┌─────────────────────────────────────────────────────────────┐
│ USER CLICKS QUICK ACTION                                    │
└────────┬────────────────────────────────────────────────────┘
         │
         ├──────────┬──────────┬──────────┬──────────┐
         ▼          ▼          ▼          ▼          ▼
    ┌─────────┐┌─────────┐┌─────────┐┌─────────┐┌─────────┐
    │User     ││User     ││User     ││User     ││User     │
    │replies: ││replies: ││replies: ││replies: ││types    │
    │"1"      ││"2"      ││"visit"  ││"brochure"││"emi"    │
    └────┬────┘└────┬────┘└────┬────┘└────┬────┘└────┬────┘
         │          │          │          │          │
         └──────────┴──────────┴──────────┴──────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │Gemini AI        │
                    │understands      │
                    │selection        │
                    └────┬────────────┘
                         │
         ┌───────────────┼───────────────┬───────────────┐
         ▼               ▼               ▼               ▼
    ┌─────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
    │"Great!  │   │Send PDF  │   │Calculate │   │"I'll     │
    │What date│   │brochure  │   │EMI plan  │   │transfer  │
    │works?"  │   │[SEND_    │   │show opts │   │you..."   │
    │         │   │BROCHURE] │   │          │   │[AGENT_   │
    │         │   │          │   │          │   │HANDOFF]  │
    └─────────┘   └──────────┘   └──────────┘   └──────────┘
```

---

## Integration Flow: All Features Combined

```
┌─────────────────────────────────────────────────────────────┐
│                  USER SENDS MESSAGE                         │
└────────┬────────────────────────────────────────────────────┘
         │
         ▼
    ┌──────────────────┐
    │ 1. Detect        │──→ userLanguages.set(id, lang)
    │    Language      │    saveLanguagePreferences()
    └────┬─────────────┘
         │
         ▼
    ┌──────────────────┐
    │ 2. Track         │──→ peakHours[currentHour]++
    │    Peak Hour     │    messageStartTime = now()
    └────┬─────────────┘
         │
         ▼
    ┌──────────────────┐
    │ 3. Build AI      │──→ Include language context
    │    Context       │    [Preferred Language: Hindi]
    └────┬─────────────┘
         │
         ▼
    ┌──────────────────┐
    │ 4. Get AI        │──→ Gemini processes with Google Search
    │    Response      │    Includes language, tags, content
    └────┬─────────────┘
         │
         ▼
    ┌──────────────────┐
    │ 5. Track         │──→ responseTime = now() - start
    │    Response Time │    responseTimes.push(time)
    └────┬─────────────┘
         │
         ▼
    ┌──────────────────────────────────────────┐
    │ 6. Parse Response Tags                   │
    │    ├─ [LANG_SWITCH: X]                   │──→ Update language
    │    ├─ [GENERATE_REFERRAL]                │──→ Create code
    │    ├─ [CHECK_REFERRAL: X]                │──→ Validate code
    │    ├─ [VISIT_CONFIRMED: X]               │──→ Track visit
    │    ├─ [SEND_BROCHURE: X]                 │──→ Track brochure
    │    ├─ [SEND_LOCATION: X]                 │──→ Track location
    │    ├─ [AGENT_HANDOFF]                    │──→ Track handoff
    │    └─ [QUICK_ACTIONS: X|Y|Z]             │──→ Send buttons
    └────┬─────────────────────────────────────┘
         │
         ▼
    ┌──────────────────┐
    │ 7. Save All Data │──→ saveLanguagePreferences()
    │                  │    saveReferralData()
    │                  │    saveAnalytics()
    └────┬─────────────┘
         │
         ▼
    ┌──────────────────┐
    │ 8. Send Response │──→ Voice/Text based on input
    │                  │    In user's language
    │                  │    With any media (PDF/Location)
    └────┬─────────────┘
         │
         ▼
    ┌──────────────────┐
    │ 9. Update        │──→ Socket.io emit events
    │    Dashboard     │    Real-time updates
    │                  │    Charts refresh
    └────┬─────────────┘
         │
         ▼
    ┌──────────────────┐
    │ 10. Log to CRM   │──→ Google Sheets webhook
    │                  │    Visit confirmations
    │                  │    Summaries
    └──────────────────┘
```

---

## Data Persistence Flow

```
┌─────────────────────────────────────────────────────────────┐
│ IN-MEMORY STORAGE (Fast Access)                             │
├─────────────────────────────────────────────────────────────┤
│  userLanguages:    Map<userId, language>                    │
│  referralCodes:    Map<userId, code>                        │
│  referralCounts:   Map<userId, count>                       │
│  userReferrals:    Map<userId, referrerUserId>              │
│  analyticsData:    Object { metrics, arrays, counters }     │
└────────┬────────────────────────────────────────────────────┘
         │
         │ (On every update)
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ FILE SYSTEM (Persistent Storage)                            │
├─────────────────────────────────────────────────────────────┤
│  user_languages.json    ← saveLanguagePreferences()         │
│  referrals.json         ← saveReferralData()                │
│  analytics.json         ← saveAnalytics()                   │
└────────┬────────────────────────────────────────────────────┘
         │
         │ (On bot restart)
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ LOAD BACK TO MEMORY                                         │
├─────────────────────────────────────────────────────────────┤
│  Read JSON files → Parse → Populate Maps/Objects            │
│  All data restored → No data loss on restart                │
└─────────────────────────────────────────────────────────────┘
```

---

## Dashboard Real-Time Update Flow

```
┌─────────────────────────────────────────────────────────────┐
│ BACKEND EVENT                                               │
└────────┬────────────────────────────────────────────────────┘
         │
         ▼
    ┌──────────────────┐
    │ Visit confirmed  │
    │ or               │
    │ Brochure sent    │
    │ or               │
    │ Referral tracked │
    └────┬─────────────┘
         │
         ▼
    ┌──────────────────┐
    │ Update           │
    │ analyticsData    │
    └────┬─────────────┘
         │
         ▼
    ┌──────────────────┐
    │ saveAnalytics()  │
    └────┬─────────────┘
         │
         ▼
    ┌────────────────────────────┐
    │ Socket.io broadcasts:      │
    │ io.emit('analytics_update',│
    │  {analytics, leaderboard}) │
    └────┬───────────────────────┘
         │
         │ (Real-time WebSocket)
         │
         ▼
┌────────────────────────────────────────────────────────────┐
│ FRONTEND (Browser)                                         │
├────────────────────────────────────────────────────────────┤
│  socket.on('analytics_update', (data) => {                 │
│    analyticsData = data.analytics                          │
│    referralLeaderboard = data.leaderboard                  │
│    if (onAnalyticsTab) renderAnalytics()                   │
│    if (onReferralsTab) renderReferrals()                   │
│  })                                                        │
└────────┬───────────────────────────────────────────────────┘
         │
         ▼
    ┌──────────────────┐
    │ Charts update    │
    │ Numbers update   │
    │ Leaderboard      │
    │ updates          │
    │ (Instant!)       │
    └──────────────────┘
```

---

**All flows documented! 🎉**

These diagrams show the complete journey of each feature from user input to final output.
