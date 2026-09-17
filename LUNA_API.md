# Kaira ↔ Luna Integration Guide

Everything Luna's team needs to hand a lead to Kaira (the WhatsApp assistant)
and to receive site visits back. Written against the live service.

- **Base URL:** `https://kaira-whatsapp-production.up.railway.app`
- **Auth:** every request needs the header `x-api-key: <CRM_API_KEY>`
  (the same key Kaira sends back to you). No key = `401 {"error":"invalid api key"}`.
- **Content type:** `application/json` on every POST.

---

## 1. The one thing that changed

**You only ever send to one number now.** Kaira used to run a WhatsApp bot per
builder (Sobha, Brigade, Godrej, Nambiar, Abhee…) and the lead went to whichever
one matched. You no longer have to know, or check, which builder bot is linked —
**every lead goes to the single main number**, and Kaira introduces herself as
the lead's own builder based on the `property` / `builder` you send.

So: **do not send `botId`.** Just send the lead. Routing is our problem now.

---

## 2. Sending a lead — `POST /api/lead`

This is the endpoint to use. It opens the WhatsApp chat and sends the first
message immediately.

```http
POST /api/lead
x-api-key: <CRM_API_KEY>
Content-Type: application/json

{
  "phone":    "9886000000",
  "property": "Abhee New Dimension",
  "builder":  "Abhee Developers",
  "name":     "Tanishq Sharma",
  "notes":    "Enquired via Housing.com, budget 1.4Cr, wants 3BHK"
}
```

### Fields

| Field | Required | Notes |
|---|---|---|
| `phone` | **yes** | Any format. `9886000000`, `+91 98860 00000`, `09886000000`, `0091-98860-00000` all work. Bare 10-digit numbers are assumed Indian (+91). |
| `property` | strongly recommended | The project the lead enquired about, e.g. `"Sobha Neopolis"`. Free text — we match case-insensitively against ~250 projects and correct the spelling ("new dimension" → "Abhee New Dimension"). |
| `builder` | optional | e.g. `"Godrej Properties"`. Used when `property` is missing or unmatched. |
| `name` | optional | Only the first name is used, in the greeting. |
| `notes` | optional | Free text. Given to the AI as context **and** searched for a project name when `property` is null. |
| `botId` | **don't send** | Legacy override to force one specific bot. Leave it out. |

### About `property: null`

A lot of your payloads arrive as `"property": null` with the project sitting in
`notes` ("new property launch dsr villas"). Kaira reads `notes` as a fallback, so
those still work — but the greeting is much better when `property` is filled in,
because we can name the project and skip the "which project?" question.
**Please send `property` whenever the CRM has it.**

If neither field names a project, Kaira still greets the lead and asks which
project they mean. Nothing is dropped.

### Responses

| Status | Body | What to do |
|---|---|---|
| `200` | `{"ok":true,"botId":"all","whatsappId":"919886000000@c.us","sent":"Hi Tanishq! 👋 …"}` | Done. `sent` is the exact message the lead received — worth storing on the lead record. |
| `400` | `{"error":"phone is required"}` | Fix the payload; don't retry as-is. |
| `401` | `{"error":"invalid api key"}` | Wrong or missing `x-api-key`. |
| `404` | `{"error":"number is not on WhatsApp","phone":"919886000000"}` | Genuinely not a WhatsApp user. Don't retry — flag for a phone call. |
| `503` | `{"error":"bot is reconnecting — retry shortly","botId":"all"}` | Transient. Retry with backoff (see below). |
| `500` | `{"error":"lookup failed: …"}` / `{"error":"send failed: …"}` | Unexpected. Log the body, retry once, then alert us. |

### Retries — please implement this

`503` means the WhatsApp session is mid-reconnect; it recovers by itself, usually
within a minute. Queue the lead and retry with backoff — **60s, 2m, 5m, 10m,
20m** — and only then mark it failed for a human. Every request is safe to retry:
a lead sent twice just means the person gets greeted twice, which is far better
than a dropped enquiry.

Kaira answers every request within about 20 seconds, timing out cleanly rather
than hanging, so a 30s client timeout on your side is enough.

---

## 3. Plain-English intake — `POST /api/instruct`

For when an agent types a sentence rather than a structured lead (e.g. from a
Luna chat box). Prefer `/api/lead` for anything automated.

```http
POST /api/instruct
x-api-key: <CRM_API_KEY>

{ "text": "Kaira, talk to 9886000000 about Abhee New Dimension" }
```

- The phone is taken from the longest digit run in the sentence; a `"phone"`
  field can be passed alongside `text` to override it.
- The project must be named in the sentence, or you get
  `400 {"error":"could not work out which project — mention it by name"}`.
- Same success and error codes as `/api/lead`, plus a `parsed` object showing
  what we understood. Show that back to the agent so they can spot a misread.

---

## 4. Getting the site visit back — your webhook

When a lead confirms a site visit in WhatsApp, Kaira POSTs to the URL configured
as `CRM_WEBHOOK_URL` (currently
`https://luna-crm-api.vercel.app/kaira/site-visit?key=…`), with the same
`x-api-key` header:

```json
{
  "phone":   "919886000000",
  "at":      "2026-09-20T11:00:00+05:30",
  "project": "Abhee New Dimension",
  "notes":   "Booked over WhatsApp with Kaira. Lead's words: \"sunday 11am works\""
}
```

- `phone` — digits only, with country code. Match it against your lead records
  the same way you'd match a normalized number.
- `at` — **always an absolute ISO-8601 instant with an offset** (`+05:30`), never
  a bare local time, so there is no timezone guessing on your side. If the AI
  produces an unusable date we log it and do **not** call you; those get booked
  by hand.
- `project` — best-effort canonical project name, or the builder, or omitted.
- `notes` — includes the lead's own words that confirmed the slot.

**Respond `2xx` if you booked it.** Use `422` when you understood the request but
couldn't place it (unknown lead, no matching project) — we log those distinctly
so someone chases them. Anything else is treated as an outage.

This call is fire-and-forget with a 10s timeout: if your API is down, the lead's
WhatsApp conversation carries on normally, but **the booking only exists in our
log**. A 5xx from you means a visit that needs manual entry.

---

## 5. Useful lookups

### `GET /api/projects` — canonical spellings

Returns every builder and their projects as Kaira knows them:

```json
{
  "builders": [
    { "builder": "Sobha Limited", "botId": "sobha", "projects": ["Sobha Neopolis", "…"] }
  ],
  "note": "Match property against projects[]; routing is case-insensitive substring…"
}
```

Use it to normalize `property` before sending — it removes almost all "which
project did they mean?" ambiguity. Cache it; it changes rarely.

### `GET /api/bots` — is the service live?

```json
[{ "id": "all", "builder": "All Builders", "status": "ready" }]
```

`status` is one of `stopped`, `starting`, `qr` (needs a QR scan — a human has to
act), `authenticated`, `ready`, `degraded` (wedged, recycling itself).
**You don't need to poll this before sending a lead** — just send it and handle
`503`. It's for dashboards and alerting.

---

## 6. Checklist for the Luna side

1. `POST /api/lead` with `x-api-key` — never send `botId`.
2. Fill `property` from the CRM whenever it exists; put everything else in `notes`.
3. Store the returned `sent` text and `whatsappId` on the lead.
4. Treat `503` as retryable with backoff; `400` and `404` as terminal.
5. Accept the site-visit webhook; return `2xx` on success, `422` when you can't
   place it.
6. Normalize project names against `GET /api/projects`.
