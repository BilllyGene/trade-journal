// Two-device sync test: a "laptop" and a "phone" (separate browser storage)
// syncing through a fake GitHub API. Run from the repo root:
//   NODE_PATH=$(npm root -g) node tests/sync.js
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const { FakeGitHub } = require('./fake-github');

const ROOT = path.resolve(__dirname, '..');
const FIX = path.join(__dirname, 'fixtures');
const PORT = 8766;
const URL_ = `http://127.0.0.1:${PORT}/index.html`;

let passed = 0, failed = 0; const failures = [];
function check(name, cond, extra) {
  if (cond) { passed++; console.log('  ✓ ' + name); }
  else { failed++; failures.push(name); console.log('  ✗ ' + name + (extra !== undefined ? '  →  ' + JSON.stringify(extra) : '')); }
}
const section = s => console.log('\n' + s);
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function device(browser, fake, name) {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 } });
  await fake.attach(ctx);
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', e => page.errors.push(`${name}: ${e.message}`));
  page.on('dialog', d => d.accept());
  await page.goto(URL_);
  await page.waitForSelector('#metrics .metric');
  return page;
}
async function logTrade(page, t) {
  await page.click('nav button[data-tab="form"]');
  if (t.date) await page.fill('#f-date', t.date);
  await page.fill('#f-entry', String(t.entry || 2400));
  await page.selectOption('#f-outcome', t.outcome || 'Win');
  if ((t.outcome || 'Win') !== 'Open') await page.click('#f-plan button[data-v="yes"]');
  if (t.pnl != null) await page.fill('#f-pnl', String(t.pnl));
  if (t.notes) await page.fill('#f-notes', t.notes);
  for (const [step, file] of t.shots || []) {
    await page.setInputFiles(`#f-checklist .step[data-step="${step}"] input[type=file]`, path.join(FIX, file));
    await page.waitForSelector(`#f-checklist .step[data-step="${step}"] .thumb`);
  }
  await page.click('#saveBtn');
  await page.waitForSelector('#tab-log:not(.hidden)');
}
const live = page => page.evaluate(() => trades.filter(t => !t.deleted).map(t => ({ id: t.id, notes: t.notes, pnl: t.pnl, shots: t.stepScreenshots.flat().concat(t.generalScreenshots) })));
const syncNow = page => page.evaluate(() => sync.run({ manual: true }));
async function connect(page, fake, opts = {}) {
  await page.click('nav button[data-tab="settings"]');
  await page.fill('#s-ghOwner', opts.owner || fake.owner);
  await page.fill('#s-ghRepo', opts.repo || fake.repo);
  await page.fill('#s-ghToken', opts.token || fake.token);
  await page.click('#syncConnect');
  await page.waitForFunction(() => !document.querySelector('#syncConnect').disabled);
  await page.waitForFunction(() => !document.querySelector('#syncChip').className.includes('busy'));
}
async function imagesOk(page) {
  await page.click('nav button[data-tab="log"]');
  await page.evaluate(async () => { for (const i of document.querySelectorAll('#tradeList .thumb')) { i.scrollIntoView(); await new Promise(r => setTimeout(r, 30)); } });
  await page.waitForTimeout(300);
  return page.$$eval('#tradeList .thumb img', imgs => ({ total: imgs.length, ok: imgs.filter(i => i.complete && i.naturalWidth > 0).length }));
}

(async () => {
  const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
  await sleep(800);
  const browser = await chromium.launch();
  const fake = new FakeGitHub({ owner: 'BilllyGene' });
  let laptop, phone;
  try {
    section('Merge rules (pure function)');
    laptop = await device(browser, fake, 'laptop');
    const mr = await laptop.evaluate(() => {
      const t = (id, u, extra) => Object.assign({ id, updatedAt: u, deleted: false, stepScreenshots: [], generalScreenshots: [] }, extra);
      const r = mergeForSync(
        [t('a', '2026-01-01'), t('b', '2026-01-05'), t('c', '2026-01-01'), t('e', '2026-01-09')],
        [t('a', '2026-01-02'), t('b', '2026-01-03'), t('d', '2026-01-01'), t('e', '2026-01-08', { deleted: true })], '2026-01-04');
      return { merged: r.merged.map(x => x.id + x.updatedAt).sort(), toLocal: r.toLocal.map(x => x.id).sort(), sent: r.sent, conflicts: r.conflicts.map(x => x.id + ':' + x.replacedSide) };
    });
    check('later edit wins both ways', JSON.stringify(mr.merged) === JSON.stringify(['a2026-01-02', 'b2026-01-05', 'c2026-01-01', 'd2026-01-01', 'e2026-01-09']), mr);
    check('remote-only and remote-newer go to device', JSON.stringify(mr.toLocal) === '["a","d"]', mr);
    check('local-only and local-newer are sent (b, c, e)', mr.sent === 3, mr);
    check('clash detected when both changed since last sync (e: remote deletion lost to later edit)', JSON.stringify(mr.conflicts) === '["e:remote"]', mr);

    section('Connect: safety checks');
    const pub = new FakeGitHub({ owner: 'BilllyGene', isPrivate: false });
    const pubPage = await device(browser, pub, 'pub');
    await connect(pubPage, pub);
    check('public repository is refused', (await pubPage.textContent('#syncConnErr')).includes('PUBLIC'));
    check('nothing written to a public repo', pub.head === null);
    await pubPage.context().close();
    await connect(laptop, fake, { token: 'wrong' });
    check('wrong token: clear message', (await laptop.textContent('#syncConnErr')).includes('did not accept the access token'));
    check('wrong token is not stored', await laptop.evaluate(async () => !(await store.get('meta', 'sync'))));
    await connect(laptop, fake, { repo: 'nope' });
    check('missing repo: clear message', (await laptop.textContent('#syncConnErr')).includes('Repository not found'));

    section('Laptop: first sync into an empty private repo');
    await logTrade(laptop, { notes: 'laptop trade 1', pnl: 120, shots: [[0, 'chart-small.jpg'], [1, 'chart-webp.webp']] });
    await logTrade(laptop, { notes: 'laptop trade 2', pnl: -60, outcome: 'Loss' });
    await connect(laptop, fake, { repo: 'https://github.com/BilllyGene/trade-journal-data' });
    check('connect accepts a pasted repo URL', await laptop.evaluate(() => sync.connected()));
    check('token field cleared after connect', (await laptop.inputValue('#s-ghToken')) === '');
    const j1 = fake.journal();
    check('repo now has README + journal.json', !!fake.read('README.md') && !!j1 && j1.trades.length === 2, j1 && j1.trades.length);
    const shotFiles = [...fake.files().keys()].filter(p => p.startsWith('shots/'));
    check('2 screenshots uploaded with right file types', shotFiles.length === 2 && shotFiles.some(p => p.endsWith('.webp')) && shotFiles.some(p => p.endsWith('.jpg')), shotFiles);
    check('settings stored in repo', !!j1.settings && Array.isArray(j1.settings.checklist));
    check('header chip shows synced', (await laptop.textContent('#syncChip')).includes('Synced'));
    check('token not inside journal.json', !fake.read('journal.json').toString().includes(fake.token));

    section('Phone: has its own trade, connects, both merge');
    phone = await device(browser, fake, 'phone');
    await logTrade(phone, { notes: 'phone trade', pnl: 40, shots: [[2, 'chart-big.png']] });
    await connect(phone, fake);
    const p1 = await live(phone);
    check('phone now has 3 trades', p1.length === 3, p1.length);
    const pi = await imagesOk(phone);
    check('phone shows all 3 screenshots (2 downloaded)', pi.total === 3 && pi.ok === 3, pi);
    check('repo has 3 trades, 3 screenshots', fake.journal().trades.length === 3 && [...fake.files().keys()].filter(p => p.startsWith('shots/')).length === 3);
    await syncNow(laptop);
    check('laptop receives phone trade', (await live(laptop)).length === 3);
    const li = await imagesOk(laptop);
    check('laptop shows phone screenshot', li.total === 3 && li.ok === 3, li);
    const nUp = fake.requests.length; await syncNow(laptop);
    const extra = fake.requests.slice(nUp);
    check('nothing changed → no new commit', !extra.some(r => r.startsWith('PATCH')), extra);
    check('dashboard updated on laptop (net = 120 − 60 + 40)', (await laptop.$$eval('#metrics .metric', ms => ms.find(m => m.textContent.includes('Net P&L')).querySelector('.v').textContent)) === '+$100.00');

    section('Automatic sync after a change');
    const phoneTradeId = (await live(phone)).find(t => t.notes === 'phone trade').id;
    await phone.click('nav button[data-tab="log"]');
    await phone.click(`#tradeList .card[data-id="${phoneTradeId}"] button:text-is("Edit")`);
    await phone.fill('#f-notes', 'phone trade, edited on phone');
    await phone.click('#saveBtn'); await phone.waitForSelector('#tab-log:not(.hidden)');
    let ok = false; for (let i = 0; i < 40 && !ok; i++) { await sleep(250); ok = fake.journal().trades.some(t => t.notes === 'phone trade, edited on phone'); }
    check('edit pushed automatically within a few seconds', ok);
    await syncNow(laptop);
    check('laptop gets the edit, same ID', (await live(laptop)).find(t => t.id === phoneTradeId).notes === 'phone trade, edited on phone');

    section('Delete on one device removes it everywhere');
    const del = (await live(laptop)).find(t => t.notes === 'laptop trade 1');
    await laptop.click('nav button[data-tab="log"]');
    await laptop.click(`#tradeList .card[data-id="${del.id}"] button:text-is("Delete")`);
    await laptop.waitForFunction(id => !document.querySelector(`#tradeList .card[data-id="${id}"]`), del.id);
    await syncNow(laptop);
    check('repo: trade marked deleted', fake.journal().trades.find(t => t.id === del.id).deleted === true);
    check('repo: its screenshots removed', del.shots.every(id => ![...fake.files().keys()].some(p => p.includes(id))));
    await syncNow(phone);
    check('phone: trade gone', !(await live(phone)).some(t => t.id === del.id));
    check('phone: its screenshot blobs deleted', await phone.evaluate(async ids => { const k = await store.keys('shots'); return ids.every(id => !k.includes(id)); }, del.shots));

    section('Same trade edited on both devices between syncs');
    const both = (await live(laptop)).find(t => t.notes === 'laptop trade 2').id;
    await laptop.evaluate(() => sync.setAuto(false)); await phone.evaluate(() => sync.setAuto(false));
    const editNotes = async (page, id, text) => {
      await page.click('nav button[data-tab="log"]');
      await page.click(`#tradeList .card[data-id="${id}"] button:text-is("Edit")`);
      await page.fill('#f-notes', text); await page.click('#saveBtn'); await page.waitForSelector('#tab-log:not(.hidden)');
    };
    await editNotes(laptop, both, 'laptop version (earlier)');
    await sleep(20);
    await editNotes(phone, both, 'phone version (later)');
    await syncNow(phone);   // later edit reaches GitHub first
    await syncNow(laptop);  // laptop's earlier edit loses
    check('later edit kept on laptop', (await live(laptop)).find(t => t.id === both).notes === 'phone version (later)');
    const conf = [...fake.files().keys()].filter(p => p.startsWith('conflicts/'));
    check('losing version saved in conflicts/ (nothing lost)', conf.length === 1 && fake.read(conf[0]).toString().includes('laptop version (earlier)'), conf);
    check('user told about the clash', (await laptop.textContent('#toast')).includes('edited on two devices'));
    await laptop.evaluate(() => sync.setAuto(true)); await phone.evaluate(() => sync.setAuto(true));

    section('Another device pushes at the same moment (retry)');
    await logTrade(laptop, { notes: 'race trade', pnl: 10 });
    await laptop.evaluate(() => sync.setAuto(false));
    fake.beforePatch = () => {
      const j = fake.journal(); const tt = j.trades.find(t => !t.deleted); tt.notes = 'changed by third device'; tt.updatedAt = new Date(Date.now() + 1000).toISOString();
      fake.commitFiles({ 'journal.json': JSON.stringify(j) });
    };
    const res = await syncNow(laptop);
    const notesNow = fake.journal().trades.map(t => t.notes);
    check('sync retried and succeeded', !!res && notesNow.includes('race trade'), res);
    check('the other device\'s change was not overwritten', notesNow.includes('changed by third device'));
    check('laptop also received it', (await live(laptop)).some(t => t.notes === 'changed by third device'));
    await laptop.evaluate(() => sync.setAuto(true));

    section('Settings (checklist) sync; theme stays per device');
    await phone.click('nav button[data-tab="settings"]');
    await phone.click('#themeSeg button[data-v="dark"]');
    await laptop.click('nav button[data-tab="settings"]');
    await laptop.click('#presetB');
    await laptop.waitForFunction(() => settings.checklist[0].name === 'Direction');
    await syncNow(laptop); await syncNow(phone);
    check('phone gets preset B checklist', (await phone.evaluate(() => settings.checklist[0].name)) === 'Direction');
    check('phone keeps its own dark theme', (await phone.evaluate(() => settings.theme)) === 'dark');
    check('phone new-trade form uses new checklist', (await phone.evaluate(() => draft.checklist[0].name)) === 'Direction');

    section('Offline');
    fake.offline = true;
    await logTrade(phone, { notes: 'offline trade', pnl: 5 });
    await syncNow(phone);
    check('offline: calm "Offline" status, not an error', (await phone.textContent('#syncChip')).includes('Offline') && !(await phone.getAttribute('#syncChip', 'class')).includes('err'));
    check('offline: trade still saved on phone', (await live(phone)).some(t => t.notes === 'offline trade'));
    fake.offline = false;
    await phone.evaluate(() => window.dispatchEvent(new Event('online')));
    ok = false; for (let i = 0; i < 30 && !ok; i++) { await sleep(250); ok = fake.journal().trades.some(t => t.notes === 'offline trade'); }
    check('back online: syncs by itself', ok);

    section('Token problem shows clearly');
    const savedToken = fake.token; fake.token = 'rotated';
    await syncNow(phone);
    check('expired token: red chip + message in Settings', (await phone.getAttribute('#syncChip', 'class')).includes('err') && (await phone.textContent('#syncMsg')).includes('token'));
    fake.token = savedToken; await syncNow(phone);
    check('recovers when token works again', (await phone.textContent('#syncChip')).includes('Synced'));

    section('Reload and wipe-and-restore from GitHub');
    await phone.reload(); await phone.waitForSelector('#metrics .metric'); await sleep(1500);
    check('still connected after reload', (await phone.textContent('#syncChip')).includes('Synced'));
    const before = (await live(phone)).length;
    await phone.click('nav button[data-tab="settings"]');
    await phone.click('#wipeAll');
    await phone.waitForFunction(() => trades.length === 0);
    await syncNow(phone);
    const after = await live(phone);
    check(`wiped phone gets all ${before} trades back from GitHub`, after.length === before, { before, after: after.length });
    const pi2 = await imagesOk(phone);
    check('and its screenshots', pi2.total > 0 && pi2.ok === pi2.total, pi2);
    check('backup export still excludes the token', await phone.evaluate(async () => { const b = await buildBackup(); return !(await b.blob.text()).includes('good-token'); }));

    section('Disconnect');
    await phone.click('nav button[data-tab="settings"]');
    await phone.click('#syncOff');
    check('token removed from this device', await phone.evaluate(async () => !(await store.get('meta', 'sync')).token));
    check('chip says Sync off, setup shown again with name filled', (await phone.textContent('#syncChip')).includes('Sync off') && (await phone.inputValue('#s-ghOwner')) === 'BilllyGene');
    check('trades kept after disconnect', (await live(phone)).length === before);

    check('no page errors on either device', laptop.errors.length === 0 && phone.errors.length === 0, laptop.errors.concat(phone.errors));
  } catch (e) { failed++; failures.push('exception: ' + e.message); console.error(e); }
  await browser.close(); server.kill();
  console.log(`\n${passed} passed, ${failed} failed.`);
  if (failed) { console.log('Failed:\n - ' + failures.join('\n - ')); process.exit(1); }
})();
