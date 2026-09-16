// Guards the customer-facing copy. Run: node test-messages.js
const assert = require('assert');
const fs = require('fs');
const { botConfigs } = require('./botConfigs');

const STALE = /Divya|Ashi|Samaira|Riya|Meera|Neha|Kavya/;
const KAIRA = (fs.readFileSync('index-multibot.js', 'utf8')
    .match(/const KAIRA = '([^']+)'/) || [])[1];
const app = fs.readFileSync('public/app.js', 'utf8');

assert.strictEqual(KAIRA, 'Kaira', 'index-multibot KAIRA must be Kaira');

for (const [id, cfg] of Object.entries(botConfigs)) {
    // One identity: the CRM greeting and the AI greeting must agree, or a lead
    // who replies later gets answered by a different name than greeted them.
    assert.strictEqual(cfg.name, KAIRA, `${id}: bot name must match the CRM greeting`);

    const prompt = cfg.systemPrompt(cfg.name, cfg.builder, cfg.projects);
    assert.ok(!STALE.test(prompt), `${id}: prompt still names an old persona`);
    // A redirect with no number strands the customer.
    assert.ok(!/helpline/i.test(prompt), `${id}: "helpline" with no number`);
}

// The dashboard labels bots for the operator; all-Kaira tabs are unusable.
assert.ok(!STALE.test(app), 'public/app.js still lists old persona names');
assert.ok(/sobha: 'SOBHA'/.test(app), 'dashboard should label bots by builder');

// Internal filesystem errors must never reach a customer.
const idx = fs.readFileSync('index-multibot.js', 'utf8');
assert.ok(!/sendMessage\([^)]*folder not found/i.test(idx), 'leaks internal error');

console.log(`ok — ${Object.keys(botConfigs).length} bots, all speak as ${KAIRA}`);
