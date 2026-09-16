// Pure helpers for CRM lead intake. Kept separate so they are testable
// without booting the WhatsApp server. See test-lead.js.

// Normalize any phone format the CRM might send to bare digits with country code.
// ponytail: assumes India (+91) when no country code is present — change DEFAULT_CC if you expand.
const DEFAULT_CC = '91';

function normalizePhone(raw) {
    let d = String(raw || '').replace(/\D/g, '');
    if (d.startsWith('00')) d = d.slice(2);
    if (d.length === 11 && d.startsWith('0')) d = d.slice(1);      // 0XXXXXXXXXX
    if (d.length === 10) d = DEFAULT_CC + d;                        // bare mobile
    return d;
}

// Pick which bot should handle the lead, from the builder name and/or the
// property the user enquired about. Falls back to the combined 'all' bot.
function resolveBotId(botConfigs, builder, property) {
    const hay = `${builder || ''} ${property || ''}`.toLowerCase();
    for (const [id, c] of Object.entries(botConfigs)) {
        if (id === 'all') continue;
        const brand = String(c.builder || '').split(/\s+/)[0].toLowerCase();
        if (hay.includes(id) || (brand && hay.includes(brand))) return id;
        if ((c.projects || []).some(p => hay.includes(p.split(' - ')[0].trim().toLowerCase()))) return id;
    }
    return 'all';
}

module.exports = { normalizePhone, resolveBotId };

// Parse a plain-English instruction like
//   "Kaira talk to this person 9876543210 about Abhee New Dimension"
// into a lead payload. Phone = longest digit run; property = best project match.
function parseInstruction(botConfigs, text) {
    const t = String(text || '');
    const phoneMatch = (t.match(/\+?\d[\d\s\-()]{8,}\d/g) || [])
        .map(s => s.replace(/\D/g, ''))
        .sort((a, b) => b.length - a.length)[0];

    let property = null;
    for (const [id, c] of Object.entries(botConfigs)) {
        if (id === 'all') continue;
        for (const p of c.projects || []) {
            const proj = p.split(' - ')[0].trim();
            if (t.toLowerCase().includes(proj.toLowerCase())) {
                if (!property || proj.length > property.length) property = proj;
            }
        }
    }
    if (!property) {
        const m = t.match(/\babout\s+(.+?)(?:[.,!?]|$)/i);
        if (m) property = m[1].trim();
    }

    const nameMatch = t.match(/\bnamed?\s+([A-Z][a-z]+)/);
    return { phone: phoneMatch || null, property, name: nameMatch ? nameMatch[1] : null, notes: t };
}

module.exports.parseInstruction = parseInstruction;

// Pull the site-visit slot out of a bot reply. The model appends
// "[VISIT_CONFIRMED: 2026-09-20T11:00:00+05:30]" once the lead commits to a time.
// Returns { at, raw }: `at` is the ISO timestamp Luna requires, or null when the
// model wrote something we cannot trust as a date - `raw` is always what it wrote,
// so a bad slot can be logged and chased rather than silently dropped.
// ponytail: the model resolves "Saturday 4pm" against the date in its system
// instruction; no date library here. If it starts mangling slots, that prompt is
// the place to look before reaching for a parser.
const ISO_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?([+-]\d{2}:\d{2}|Z)$/;

function parseVisitTag(text) {
    const m = String(text || '').match(/\[VISIT_CONFIRMED:\s*([^\]]*)\]/i);
    if (!m) return null;
    const raw = m[1].trim();
    if (!raw) return null;
    // Must be an absolute instant. A bare "2026-09-20T11:00" has no zone, so the
    // booking would land in whatever zone the reader assumes - reject it.
    if (!ISO_WITH_OFFSET.test(raw) || Number.isNaN(Date.parse(raw))) return { at: null, raw };
    return { at: raw, raw };
}

module.exports.parseVisitTag = parseVisitTag;

// Find the builder and canonical project name for whatever Luna sent as the
// property (or buried in the notes). Only six builders have a bot; this covers
// the ~250 projects in the CRM that do not.
// Longest match wins on purpose: "Insignia" belongs to both Brigade and Sobha,
// and "Vaishnavi North 24" to two Vaishnavi entities, so a short substring must
// never beat the full project name the CRM actually sent.
function resolveFromDirectory(directory, text, placeholders = new Set()) {
    const hay = String(text || '').toLowerCase();
    if (!hay.trim()) return null;

    let best = null;
    const consider = (needle, builder, project) => {
        const n = needle.toLowerCase();
        if (!hay.includes(n)) return;
        if (!best || n.length > best.len) best = { builder, project, len: n.length };
    };

    for (const [builder, projects] of Object.entries(directory)) {
        for (const project of projects) consider(project, builder, project);
    }
    // Only fall back to the builder's own name when no project matched, so
    // "Godrej Ananda" does not resolve to just "Godrej Properties".
    if (!best) {
        for (const builder of Object.keys(directory)) consider(builder, builder, null);
    }
    if (!best) return null;
    return {
        builder: placeholders.has(best.builder) ? null : best.builder,
        project: best.project
    };
}

module.exports.resolveFromDirectory = resolveFromDirectory;
