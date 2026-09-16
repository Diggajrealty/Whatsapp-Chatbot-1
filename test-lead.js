// Self-check for the CRM lead helpers:  node test-lead.js
const assert = require('assert');
const { botConfigs } = require('./botConfigs');
const { normalizePhone, resolveBotId, parseInstruction } = require('./crmLead');

assert.strictEqual(normalizePhone('9876543210'), '919876543210');
assert.strictEqual(normalizePhone('+91 98765-43210'), '919876543210');
assert.strictEqual(normalizePhone('09876543210'), '919876543210');
assert.strictEqual(normalizePhone('919876543210'), '919876543210');

assert.strictEqual(resolveBotId(botConfigs, 'SOBHA Limited', null), 'sobha');
assert.strictEqual(resolveBotId(botConfigs, null, 'SOBHA Neopolis'), 'sobha');
assert.strictEqual(resolveBotId(botConfigs, 'Brigade Group', null), 'brigade');
assert.strictEqual(resolveBotId(botConfigs, 'Some Unknown Builder', 'Nowhere Towers'), 'all');

const p = parseInstruction(botConfigs, 'Kaira, talk to 98765 43210 about SOBHA Neopolis');
assert.strictEqual(p.phone, '9876543210');
assert.strictEqual(p.property, 'SOBHA Neopolis');
assert.strictEqual(resolveBotId(botConfigs, null, p.property), 'sobha');

const q = parseInstruction(botConfigs, 'please message +919000000001 about Random Heights Phase 2');
assert.strictEqual(q.phone, '919000000001');
assert.strictEqual(q.property, 'Random Heights Phase 2');

console.log('all lead-intake checks passed');

const { parseVisitTag } = require('./crmLead');
const good = parseVisitTag('See you then! [VISIT_CONFIRMED: 2026-09-20T11:00:00+05:30]');
assert.strictEqual(good.at, '2026-09-20T11:00:00+05:30');
assert.strictEqual(parseVisitTag('sure [visit_confirmed: 2026-09-20T11:00+05:30]').at, '2026-09-20T11:00+05:30');
assert.strictEqual(parseVisitTag('no tag here'), null);
assert.strictEqual(parseVisitTag('[VISIT_CONFIRMED:  ]'), null);
// Rejected: relative, no offset, and not a real date - each would book wrongly.
assert.strictEqual(parseVisitTag('[VISIT_CONFIRMED: Saturday at 4pm]').at, null);
assert.strictEqual(parseVisitTag('[VISIT_CONFIRMED: 2026-09-20T11:00:00]').at, null);
assert.strictEqual(parseVisitTag('[VISIT_CONFIRMED: 2026-13-45T99:00:00+05:30]').at, null);
assert.strictEqual(parseVisitTag('[VISIT_CONFIRMED: Saturday at 4pm]').raw, 'Saturday at 4pm');
console.log('visit-callback checks passed');

const { resolveFromDirectory } = require('./crmLead');
const { projectDirectory, PLACEHOLDER_BUILDERS } = require('./projectDirectory');
const find = t => resolveFromDirectory(projectDirectory, t, PLACEHOLDER_BUILDERS);
// Longest match wins: the same project word belongs to two builders.
assert.strictEqual(find('Sobha Insignia').builder, 'Sobha');
assert.strictEqual(find('brigade insignia').builder, 'Brigade');
// Canonical spelling comes back, whatever case the CRM used.
assert.strictEqual(find('abhee new dimension').project, 'Abhee New Dimension');
// A project beats its builder's bare name.
assert.strictEqual(find('Godrej Ananda').project, 'Godrej Ananda');
// Placeholder builders never become a name Kaira introduces herself with.
assert.strictEqual(find('Diggaj Skyline').builder, null);
assert.strictEqual(find('Diggaj Skyline').project, 'Diggaj Skyline');
assert.strictEqual(find('nothing here'), null);
console.log('project-directory checks passed');
