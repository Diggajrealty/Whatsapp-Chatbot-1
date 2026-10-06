// ── Brochure facts from the CRM ─────────────────────────────────────────────
// Admins upload brochures and price sheets in the CRM; Gemini reads each one into
// plain text there. This pulls that text every 10 minutes so Kaira can answer from
// it without anyone editing knowledge-base/*.json or redeploying her.
// Fails quietly: on any error the last good copy (or nothing) is kept, and the
// JSON knowledge base keeps working exactly as before.

const REFRESH_MS = 10 * 60 * 1000;

let documents = [];
let version = 0;

function factsUrl() {
    if (process.env.CRM_URL) return `${process.env.CRM_URL.replace(/\/$/, '')}/kaira/project-facts`;
    // CRM_WEBHOOK_URL is the CRM's /kaira/site-visit route; the facts live beside it.
    if (process.env.CRM_WEBHOOK_URL) return `${new URL(process.env.CRM_WEBHOOK_URL).origin}/kaira/project-facts`;
    return null;
}

async function refresh() {
    const url = factsUrl();
    if (!url) return;
    try {
        const res = await fetch(url, {
            headers: process.env.CRM_API_KEY ? { 'x-api-key': process.env.CRM_API_KEY } : {},
            signal: AbortSignal.timeout(15000)
        });
        if (!res.ok) throw new Error(`${res.status}`);
        const body = await res.json();
        const next = Array.isArray(body.documents) ? body.documents : [];
        if (JSON.stringify(next) !== JSON.stringify(documents)) {
            documents = next;
            version++;
            console.log(`[BROCHURES] ${documents.length} document(s) from the CRM`);
        }
    } catch (e) {
        console.error('[BROCHURES] refresh failed, keeping last copy:', e.message);
    }
}

/** Starts the refresh loop. Call once at boot. */
function startBrochureSync() {
    refresh();
    setInterval(refresh, REFRESH_MS).unref();
}

/** Bumps whenever the documents change, so a bot can rebuild its model. */
function brochureVersion() {
    return version;
}

/**
 * The system-instruction block for one bot. The 'all' bot gets every project; a builder's
 * bot only its own builder's, so it never starts quoting a competitor.
 */
function brochureContext(botId) {
    const mine = botId === 'all'
        ? documents
        : documents.filter((d) => (d.builder || '').toLowerCase().includes(botId) || (d.projectName || '').toLowerCase().includes(botId));
    if (mine.length === 0) return '';
    const blocks = mine.map((d) =>
        `--- ${d.projectName}${d.builder ? ` (${d.builder})` : ''} · ${d.kind.replace('_', ' ')}: ${d.title}` +
        (d.expired ? ' · EXPIRED — prices and offers here may no longer apply, say so' : '') +
        ` ---\n${d.facts}`);
    return '=== FROM THE LATEST BROCHURES AND PRICE SHEETS (most up to date — prefer these over the knowledge base when they differ) ===\n' +
        blocks.join('\n\n') +
        '\n=== END BROCHURES ===';
}

module.exports = { startBrochureSync, brochureVersion, brochureContext };
