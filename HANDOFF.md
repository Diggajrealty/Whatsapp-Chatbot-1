# 🤖 AGENT HANDOFF — Diggaj Realty WhatsApp Bot Migration
# STATUS: MID-EXECUTION — PICK UP FROM HERE

---

## CURRENT STATE (as of handoff)

### ✅ DONE
1. New project built at `d:\whatsapp chatbot multi\` — all files created, syntax OK
2. OpenWA cloned to `d:\OpenWA` — built and RUNNING on http://localhost:2785 (background task)
3. OpenWA API key: `owa_k1_53810473d957f0191a617ff0bdc87964dc543868f96f6c7681c7fda6f5d65460`
4. 5 sessions created in OpenWA (UUIDs already injected into builders.config.js):
   - nambiar  → `afbb6807-0228-4cad-8d41-693d351686be`
   - godrej   → `69feb5a0-e6f0-45bd-880b-785eab6e8123`
   - dsr      → `837e7d2f-c996-43c1-9e9a-1375d73b3f6c`
   - abhee    → `d480837e-3edb-47db-8415-7da16e86c624`
   - brigade  → `61b325e6-33bb-4647-8d3e-1d9df6a5e2b0`
5. `d:\whatsapp chatbot multi\.env` fully populated with all API keys

### ❌ STILL NEEDED — DO THESE IN ORDER

**STEP 1: Register webhooks in OpenWA (previous attempt failed — "name" field not allowed)**

Run this PowerShell to register webhooks correctly (remove the "name" field):
```powershell
$key = "owa_k1_53810473d957f0191a617ff0bdc87964dc543868f96f6c7681c7fda6f5d65460"
$headers = @{ "X-API-Key" = $key; "Content-Type" = "application/json" }
$base = "http://localhost:2785/api"
$webhookUrl = "http://localhost:3000/webhook"

$sessions = @{
    "nambiar" = "afbb6807-0228-4cad-8d41-693d351686be"
    "godrej"  = "69feb5a0-e6f0-45bd-880b-785eab6e8123"
    "dsr"     = "837e7d2f-c996-43c1-9e9a-1375d73b3f6c"
    "abhee"   = "d480837e-3edb-47db-8415-7da16e86c624"
    "brigade" = "61b325e6-33bb-4647-8d3e-1d9df6a5e2b0"
}

foreach ($entry in $sessions.GetEnumerator()) {
    $sessionId = $entry.Value
    $name = $entry.Key
    $body = @{ url = $webhookUrl; events = @("message.received") } | ConvertTo-Json
    try {
        $res = Invoke-RestMethod -Uri "$base/sessions/$sessionId/webhooks" -Method POST -Headers $headers -Body $body
        Write-Host "OK $name -> $($res.id)"
    } catch {
        Write-Host "ERR $name -> $($_.ErrorDetails.Message)"
    }
}
```
If that still fails, check what fields OpenWA webhook DTO accepts:
GET http://localhost:2785/api → Swagger UI shows all DTOs
OR check `d:\OpenWA\src\modules\webhook\dto\` for the CreateWebhookDto

**STEP 2: Start 5 sessions (scan QR for each)**

Start all sessions via API:
```powershell
$key = "owa_k1_53810473d957f0191a617ff0bdc87964dc543868f96f6c7681c7fda6f5d65460"
$headers = @{ "X-API-Key" = $key; "Content-Type" = "application/json" }
$ids = @("afbb6807-0228-4cad-8d41-693d351686be","69feb5a0-e6f0-45bd-880b-785eab6e8123","837e7d2f-c996-43c1-9e9a-1375d73b3f6c","d480837e-3edb-47db-8415-7da16e86c624","61b325e6-33bb-4647-8d3e-1d9df6a5e2b0")
foreach ($id in $ids) {
    Invoke-RestMethod -Uri "http://localhost:2785/api/sessions/$id/start" -Method POST -Headers $headers
    Write-Host "Started $id"
}
```
Then open http://localhost:2785 in browser — OpenWA has its own dashboard where you can see QR codes for each session. User (Vansh) must scan QR for each of the 5 WhatsApp numbers.

**STEP 3: Start the AI server**
```powershell
cd "d:\whatsapp chatbot multi"
node index.js
```
Dashboard at http://localhost:3000

---

## PROJECT FILES

### New project: `d:\whatsapp chatbot multi\`
```
index.js              ← main webhook server (Express + Socket.io)
builders.config.js    ← 5 builder configs WITH real UUIDs
.env                  ← fully populated with all API keys
handlers/
  gemini.js           ← AI calls + key rotation + OpenRouter/Claude fallback
  tags.js             ← [VISIT_CONFIRMED] [SEND_BROCHURE] [AGENT_HANDOFF] etc.
  crm.js              ← Google Sheets logging
  maps.js             ← Google Maps → location pin
  brochure.js         ← PDF fuzzy finder + send
session/
  chatSessions.js     ← per-user per-builder Gemini sessions
  cache.js            ← disk-persisted AI response cache
  pausedChats.js      ← AI pause state
public/
  index.html          ← dashboard with 5 builder tabs
  style.css           ← dark glassmorphism UI
  dashboard.js        ← Socket.io client
```

### OpenWA Gateway: `d:\OpenWA\`
- Built and running as background process on port 2785
- If it stopped: `cd d:\OpenWA && node dist/main`
- API key: `owa_k1_53810473d957f0191a617ff0bdc87964dc543868f96f6c7681c7fda6f5d65460`

---

## KEY DETAILS

### Webhook payload OpenWA sends to AI server:
```json
{
  "session": "afbb6807-0228-4cad-8d41-693d351686be",
  "from": "919XXXXXXXXX@c.us",
  "body": "Hi",
  "type": "text",
  "fromMe": false,
  "isGroup": false,
  "pushName": "Rahul"
}
```
Note: The exact webhook payload field names should be verified against OpenWA docs or by sending a test message after setup. If field names differ, update the destructuring in `index.js` around line 68:
```js
const { session: sessionId, from: userId, body: userMessage, type, fromMe, isGroup, pushName, timestamp } = payload;
```

### OpenWA webhook DTO — check exact fields:
File: `d:\OpenWA\src\modules\webhook\dto\create-webhook.dto.ts`
Read this file to know EXACTLY what fields are accepted for POST /api/sessions/:id/webhooks

---

## USER INFO
- Name: Vansh
- OS: Windows
- Project workspace: `d:\whatsapp chatbot multi\`
- RULE: Never push to GitHub without asking. For Diggaj Realty: only commit, Vansh pushes manually.
- No voice/TTS (removed by design)
- Be concise and conversational

## WHAT TO TELL VANSH WHEN YOU START
"Picked up where we left off! OpenWA is running. I need to fix the webhook registration (minor field issue), start the 5 sessions, then you'll need to scan QR codes on your 5 WhatsApp numbers. Let me handle the code parts first."
