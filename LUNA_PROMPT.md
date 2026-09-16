# Luna → Kaira handover

Kaira is the WhatsApp assistant. Luna (CRM AI) hands her a new lead; Kaira sends
the first WhatsApp message and runs the conversation from there.

Base URL = wherever this bot is deployed, e.g. `https://kaira.example.com`
(locally: `http://localhost:3000`).

## Endpoints

| Method | Path | Use |
|---|---|---|
| POST | `/api/lead` | structured handover (preferred) |
| POST | `/api/instruct` | plain-English handover |
| GET  | `/api/bots` | which builder bots are live |

Header on every POST: `x-api-key: <CRM_API_KEY>` (only needed if that env var is set).

### POST /api/lead
```json
{
  "phone": "9876543210",
  "property": "Abhee New Dimension",
  "builder": "Abhee Ventures",
  "name": "Rahul",
  "notes": "Budget 1.5Cr, wants 3BHK, ready to visit this weekend"
}
```
`phone` is required. `property` decides which builder bot replies; `builder` is a
fallback if `property` is unclear. Optional `botId` forces a specific bot
(`sobha` `brigade` `nambiar` `godrej` `abhee` `dsr` `all`).

Success → `200 {"ok":true,"botId":"abhee","whatsappId":"...","sent":"Hi Rahul! ..."}`

Errors: `400` missing phone · `401` bad key · `404` not on WhatsApp ·
`503` that builder's bot isn't running.

### POST /api/instruct
```json
{ "text": "Kaira, talk to 9876543210 about Abhee New Dimension" }
```
Kaira pulls the number and the project out of the sentence. You may also pass
`phone` separately and leave it out of the text.

---

## Prompt to give Luna

> You have a tool called **Kaira**, the WhatsApp assistant for Diggaj Realty.
> Whenever a NEW enquiry enters the CRM, hand it to Kaira so she can start the
> WhatsApp conversation. Do this once per lead — never twice for the same number.
>
> Send an HTTP POST to `{{BASE_URL}}/api/lead` with headers
> `Content-Type: application/json` and `x-api-key: {{CRM_API_KEY}}`, and this body:
>
> ```json
> {
>   "phone": "<the lead's mobile number, digits only>",
>   "property": "<the exact project name they enquired about>",
>   "builder": "<the builder/developer name, if you know it>",
>   "name": "<the lead's first name, if you have it>",
>   "notes": "<budget, configuration, timeline, anything useful — one or two lines>"
> }
> ```
>
> Rules:
> - `phone` and `property` are the two that matter. Always send both if you can.
> - Use the project name exactly as it appears in the enquiry (e.g. "Abhee New
>   Dimension", "SOBHA Neopolis") — that is how Kaira picks the right builder bot.
> - Put anything the lead told you into `notes`; Kaira uses it as context.
> - Do NOT message the lead yourself and do not draft the WhatsApp text — Kaira
>   writes and sends the opening message.
> - On `200`, log the handover and move on. On `404` the number isn't on WhatsApp,
>   so flag it for a phone call instead. On `503` the builder's bot is offline —
>   alert the team. Retry once on a network error, then stop.
> - If you only have a free-text instruction rather than clean fields, POST
>   `{"text": "..."}` to `{{BASE_URL}}/api/instruct` instead.

---

## Kaira page (manual sends)

Open `{{BASE_URL}}/kaira.html`. Type a sentence like
*"Kaira, talk to this person about Abhee New Dimension"*, put the number in the
phone box, hit send. Same pipeline as Luna's.

## Testing
```bash
node test-lead.js                     # parser/routing self-check, no WhatsApp needed
curl -X POST http://localhost:3000/api/lead \
  -H 'Content-Type: application/json' -H 'x-api-key: YOURKEY' \
  -d '{"phone":"9876543210","property":"Abhee New Dimension","name":"Rahul"}'
```
The target bot must be started from the dashboard first (`/api/bots` shows status).
