// Runnable check for crmBrochures.js: node test-brochures.js (no network, fetch is stubbed).
const assert = require('assert');
process.env.CRM_WEBHOOK_URL = 'https://crm.example/kaira/site-visit';
process.env.CRM_API_KEY = 'k';
let seen;
global.fetch = async (url, opts) => {
    seen = [url, opts.headers['x-api-key']];
    return { ok: true, json: async () => ({ documents: [
        { projectName: 'Sobha Sentosa', builder: 'Sobha', kind: 'brochure', title: 'Sentosa', expired: false, facts: 'RERA X' },
        { projectName: 'Godrej Air', builder: 'Godrej', kind: 'price_sheet', title: 'P', expired: true, facts: '1 Cr' },
    ] }) };
};
const b = require('./crmBrochures');
const v0 = b.brochureVersion();
b.startBrochureSync();
setTimeout(() => {
    assert.deepStrictEqual(seen, ['https://crm.example/kaira/project-facts', 'k']);
    assert.ok(b.brochureContext('sobha').includes('Sobha Sentosa'));
    assert.ok(!b.brochureContext('sobha').includes('Godrej'), 'a builder bot never sees a competitor');
    assert.ok(b.brochureContext('all').includes('EXPIRED'));
    assert.strictEqual(b.brochureContext('brigade'), '');
    assert.strictEqual(b.brochureVersion(), v0 + 1);
    console.log('crmBrochures OK');
    process.exit(0);
}, 50);
