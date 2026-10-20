// End-to-end test for the Trade Journal, run in headless Chromium with Playwright.
// Run from the repo root:  NODE_PATH=$(npm root -g) node tests/e2e.js
// It serves the repo on a local port (python3 -m http.server) and also checks file:// mode.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const FIX = path.join(__dirname, 'fixtures');
const PORT = 8765;
const BASE = `http://127.0.0.1:${PORT}/index.html`;
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'tj-test-'));

let passed = 0, failed = 0;
const failures = [];
function check(name, cond, extra) {
  if (cond) { passed++; console.log('  ✓ ' + name); }
  else { failed++; failures.push(name); console.log('  ✗ ' + name + (extra !== undefined ? '  →  ' + JSON.stringify(extra) : '')); }
}
function section(s) { console.log('\n' + s); }

function ymd(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function addDays(s, n) { const [y, m, d] = s.split('-').map(Number); return ymd(new Date(y, m - 1, d + n)); }

async function logTrade(page, t) {
  await page.click('nav button[data-tab="form"]');
  await page.fill('#f-date', t.date);
  if (t.time) await page.fill('#f-time', t.time);
  await page.selectOption('#f-session', t.session);
  await page.selectOption('#f-direction', t.direction);
  await page.selectOption('#f-outcome', t.outcome);
  for (const k of ['entry', 'exit', 'sl', 'tp', 'lot', 'risk', 'pnl', 'rr']) if (t[k] != null) await page.fill('#f-' + k, String(t[k]));
  if (t.grade) await page.selectOption('#f-grade', t.grade);
  if (t.emotion) await page.selectOption('#f-emotion', t.emotion);
  if (t.plan) await page.click(`#f-plan button[data-v="${t.plan}"]`);
  for (const m of t.mistakes || []) await page.click(`#f-mistakes .chip:text-is("${m}")`);
  if (t.notes) await page.fill('#f-notes', t.notes);
  for (const i of t.confirm || []) await page.click(`#f-checklist .step[data-step="${i}"] .confirm-btn`);
  for (const [step, files] of Object.entries(t.shots || {})) {
    const sel = step === 'g' ? '#f-general input[type=file]' : `#f-checklist .step[data-step="${step}"] input[type=file]`;
    const before = await page.locator(step === 'g' ? '#f-general .thumb' : `#f-checklist .step[data-step="${step}"] .thumb`).count();
    await page.setInputFiles(sel, files.map(f => path.join(FIX, f)));
    await page.waitForFunction(([s, n]) => document.querySelectorAll(s).length >= n,
      [step === 'g' ? '#f-general .thumb' : `#f-checklist .step[data-step="${step}"] .thumb`, before + files.length]);
  }
  await page.click('#saveBtn');
  await page.waitForSelector('#tab-log:not(.hidden)', { timeout: 5000 });
}

async function metrics(page) {
  return page.$$eval('#metrics .metric', ms => Object.fromEntries(ms.map(m => [m.querySelector('.k').textContent, m.querySelector('.v').textContent])));
}
async function kv(page, sel) {
  return page.$$eval(`${sel} > div`, ds => { const o = {}; for (let i = 0; i < ds.length; i += 2) o[ds[i].textContent] = ds[i + 1].textContent; return o; });
}
async function imagesLoaded(page, scope) {
  // Scroll everything into view so lazy thumbnails load, then count decoded images.
  await page.evaluate(async s => { for (const i of document.querySelectorAll(s + ' .thumb')) { i.scrollIntoView(); await new Promise(r => setTimeout(r, 30)); } }, scope);
  await page.waitForTimeout(300);
  return page.$$eval(scope + ' .thumb img', imgs => ({ total: imgs.length, ok: imgs.filter(i => i.complete && i.naturalWidth > 0).length }));
}

(async () => {
  const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 800));
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1100, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  let dialogs = [];
  let dialogAnswer = true;
  page.on('dialog', d => { dialogs.push(d.message()); dialogAnswer ? d.accept() : d.dismiss(); });

  try {
    // ---------------------------------------------------------------- 1
    section('1. Fresh start');
    await page.goto(BASE);
    await page.waitForSelector('#metrics .metric');
    const m0 = await metrics(page);
    check('empty dashboard shows zero trades', m0['Total trades'] === '0', m0);
    check('no NaN / Infinity anywhere', !/NaN|Infinity|undefined/.test(await page.textContent('#tab-dashboard')));
    check('"Log your first trade" button visible', await page.isVisible('#dashEmpty button'));
    check('reminders shown', (await page.textContent('#reminders')).includes('Keep risk the same'));
    check('version shown in settings', (await page.textContent('#appVersion')) === 'v1.4');
    const sw = await page.evaluate(async () => { const r = await navigator.serviceWorker.ready; return !!r.active; });
    check('service worker active over http', sw);
    check('no errors on fresh start', errors.length === 0, errors);

    // ---------------------------------------------------------------- 5 (pure)
    section('5. R:R fallback');
    const rr = await page.evaluate(() => [
      calcRR('Long', 2400, 2390, 2420), calcRR('Short', 2410, 2420, 2380),
      calcRR('Long', 2400, 2410, 2420), calcRR('Short', 2400, 2390, 2380),
      calcRR('Long', 2400, 2400, 2420), calcRR('Long', 2400, 2390, 2400), calcRR('Long', 2400, null, 2420),
      calcRR('Long', 2385.40, 2380.15, 2401.10)]);
    check('Long 2400/2390/2420 → 2.00', rr[0] === 2, rr[0]);
    check('Short 2410/2420/2380 → 3.00', rr[1] === 3, rr[1]);
    check('Long with SL above entry → empty', rr[2] === null);
    check('Short with SL below entry → empty', rr[3] === null);
    check('SL equal to entry → empty (no infinity)', rr[4] === null);
    check('TP equal to entry → empty (no zero)', rr[5] === null);
    check('missing SL → empty', rr[6] === null);
    check('decimals rounded to 2 places (2.99)', rr[7] === 2.99, rr[7]);

    // ---------------------------------------------------------------- 2
    section('2. Log four trades');
    const today = await page.evaluate(() => todayStr());
    const d2 = addDays(today, -4), d3 = addDays(today, -18);
    // Validation first: empty save
    await page.click('nav button[data-tab="form"]');
    await page.fill('#f-date', '');
    await page.click('#saveBtn');
    check('validation: date required message', (await page.textContent('.field[data-f="date"] .err')).length > 0);
    check('validation: entry required message', (await page.textContent('.field[data-f="entry"] .err')).includes('required'));
    check('validation: outcome required message', (await page.textContent('.field[data-f="outcome"] .err')).length > 0);
    await page.fill('#f-date', today); await page.fill('#f-entry', '2400'); await page.selectOption('#f-outcome', 'Win');
    await page.click('#saveBtn');
    check('validation: "Followed my plan?" required unless Open', (await page.textContent('.field[data-f="followedPlan"] .err')).length > 0);
    check('form kept after failed validation', (await page.inputValue('#f-entry')) === '2400');
    await page.selectOption('#f-outcome', 'Open'); await page.click('#saveBtn');
    // that saved an Open trade with only entry - delete it again via the log later? Simpler: delete now.
    await page.waitForSelector('#tab-log:not(.hidden)');
    check('Open trade saves without plan answer', (await page.locator('#tradeList .card[data-id]').count()) === 1);
    dialogAnswer = true;
    await page.click('#tradeList .card[data-id] button:text-is("Delete")');
    await page.waitForFunction(() => document.querySelectorAll('#tradeList .card[data-id]').length === 0);

    await logTrade(page, { date: today, time: '09:00', session: 'London', direction: 'Long', outcome: 'Win', entry: 2400, exit: 2420, sl: 2390, tp: 2420, lot: 0.1, risk: 100, pnl: 200, grade: 'A+', emotion: 'Calm', plan: 'yes', confirm: [0, 1, 2, 3], shots: { 0: ['chart-big.png', 'chart-small.jpg'], 1: ['chart-webp.webp'], g: ['chart-small.jpg'] }, notes: 'Clean ICC, "textbook", entry at FVG\nSecond line' });
    check('"Trade saved" toast', (await page.textContent('#toast')).includes('Trade saved'));
    check('form reset: date back to today, entry empty', (await page.inputValue('#f-date')) === today && (await page.inputValue('#f-entry')) === '');
    await logTrade(page, { date: d2, time: '14:00', session: 'New York', direction: 'Short', outcome: 'Loss', entry: 2410, exit: 2420, sl: 2420, tp: 2380, lot: 0.1, risk: 100, pnl: -100, grade: 'B', emotion: 'Rushed', plan: 'no', mistakes: ['Entered early', 'Moved stop loss'], confirm: [0, 1], shots: { 2: ['chart-small.jpg'] }, notes: '=SUM(A1) should not run in Excel' });
    await logTrade(page, { date: d3, time: '02:00', session: 'Asia', direction: 'Long', outcome: 'Breakeven', entry: 2350, exit: 2350, sl: 2360, tp: 2370, pnl: 0, grade: 'C', plan: 'yes', mistakes: ['Entered early'], confirm: [0] });
    await logTrade(page, { date: today, time: '15:00', session: 'New York', direction: 'Short', outcome: 'Open', entry: 2405, sl: 2415, tp: 2385, lot: 0.05 });
    check('four trade cards', (await page.locator('#tradeList .card[data-id]').count()) === 4);
    const shotsCompressed = await page.evaluate(async () => {
      const all = await store.list('shots'); const out = [];
      for (const s of all) { const bmp = await createImageBitmap(s.blob); out.push(Math.max(bmp.width, bmp.height)); }
      return out;
    });
    check('5 screenshots stored as blobs', shotsCompressed.length === 5, shotsCompressed);
    check('big image resized to ≤1600px', Math.max(...shotsCompressed) <= 1600, shotsCompressed);

    // ---------------------------------------------------------------- 3
    section('3. Reload');
    const idsBefore = await page.$$eval('#tradeList .card[data-id]', cs => cs.map(c => c.dataset.id));
    await page.reload(); await page.waitForSelector('#metrics .metric');
    await page.click('nav button[data-tab="log"]');
    const idsAfter = await page.$$eval('#tradeList .card[data-id]', cs => cs.map(c => c.dataset.id));
    check('same trades after reload', JSON.stringify(idsBefore) === JSON.stringify(idsAfter));
    const img = await imagesLoaded(page, '#tradeList');
    check('all 5 screenshots display after reload', img.total === 5 && img.ok === 5, img);
    const firstCard = await page.textContent(`#tradeList .card[data-id="${idsAfter[0]}"]`);
    check('newest first (today 15:00 open trade on top)', firstCard.includes('Open') && firstCard.includes('15:00'));
    const winCard = await page.locator('#tradeList .card[data-id]', { hasText: '09:00' }).textContent();
    check('card shows checklist 4/4, plan Yes, +2.0R, R:R auto 1:2.00', winCard.includes('4/4') && winCard.includes('Yes') && winCard.includes('+2.0R') && winCard.includes('1:2.00 (auto)'), winCard);
    check('card shows step names saved with trade', winCard.includes('1. Indication') && winCard.includes('4. Entry trigger'));
    check('notes rendered as text, quotes intact', winCard.includes('"textbook"'));

    // ---------------------------------------------------------------- 4
    section('4. Dashboard numbers vs hand calculation');
    await page.click('nav button[data-tab="dashboard"]');
    const m = await metrics(page);
    check('Total trades = 4', m['Total trades'] === '4', m);
    check('Win rate = 1/(1+1) = 50.0%', m['Win rate'] === '50.0%', m);
    check('Net P&L = 200 − 100 + 0 = +$100.00', m['Net P&L'] === '+$100.00', m);
    check('Profit factor = 200/100 = 2.00', m['Profit factor'] === '2.00', m);
    check('Plan followed = 2 of 3 closed = 66.7%', m['Plan followed'] === '66.7%', m);
    check('Full-checklist win rate = 1/1 = 100.0%', m['Full-checklist win rate'] === '100.0%', m);
    const pvr = await page.$$eval('#pvr .n', ns => ns.map(n => n.textContent));
    check('Process vs result = [1,0,0,1]', JSON.stringify(pvr) === '["1","0","0","1"]', pvr);
    const more = await kv(page, '#moreStats');
    check('Average win = +$200.00', more['Average win'] === '+$200.00', more);
    check('Average loss = −$100.00', more['Average loss'] === '−$100.00', more);
    check('Average R:R = (2+3+2)/3 = 1:2.33 over 3 trades', more['Average R:R (planned)'].startsWith('1:2.33') && more['Average R:R (planned)'].includes('(3)'), more);
    check('Average R = (2 − 1)/2 = +0.5R over 2 trades', more['Average result in R'].startsWith('+0.5R') && more['Average result in R'].includes('(2)'), more);
    check('Most common mistake = Entered early (2×)', more['Most common mistake'] === 'Entered early (2×)', more);
    const dots = await page.$$eval('#recentDots .dot', ds => ds.map(d => d.className.replace('dot ', '')));
    check('Recent form dots oldest→newest: BE, Loss, Win, Open', JSON.stringify(dots) === '["Breakeven","Loss","Win","Open"]', dots);
    const eqPts = await page.locator('#equityChart svg circle').count();
    check('Equity curve drawn with 3 closed-trade points (+1 hover marker)', eqPts === 4, eqPts);
    const sess = await page.getAttribute('#sessionChart svg', 'aria-label');
    check('Session chart: London 1W, NY 1L, Asia 0/0 (BE excluded)', sess.includes('London: 1 wins, 0 losses') && sess.includes('New York: 0 wins, 1 losses') && sess.includes('Asia: 0 wins, 0 losses'), sess);
    // Redraw cleanly: resize a few times, still exactly one svg per chart
    await page.setViewportSize({ width: 900, height: 900 }); await page.waitForTimeout(100);
    await page.setViewportSize({ width: 1100, height: 900 }); await page.waitForTimeout(100);
    check('charts never duplicated after redraws', (await page.locator('#equityChart svg').count()) === 1 && (await page.locator('#sessionChart svg').count()) === 1);
    check('backup reminder shown (never backed up)', await page.isVisible('#backupNudge'));
    check('reminder says sync is off and offers Set up sync', (await page.textContent('#backupNudge')).includes('sync is off') && await page.isVisible('#backupNudge button:text-is("Set up sync")'));
    check('header chip says Sync off', (await page.textContent('#syncChip')).includes('Sync off'));
    // Starting balance + limits
    await page.click('nav button[data-tab="settings"]');
    await page.fill('#s-startBal', '1000'); await page.fill('#s-maxWeek', '2'); await page.fill('#s-lossLimit', '150'); await page.fill('#s-maxDay', '3');
    await page.fill('#s-instrument', 'eurusd');
    await page.click('#saveLimits');
    await page.click('nav button[data-tab="dashboard"]');
    check('main instrument setting changes the subtitle', (await page.textContent('#subtitle')) === 'EURUSD · Track, review, improve');
    check('new trade form uses the main instrument', (await page.inputValue('#f-instrument')) === 'EURUSD');
    const mb = await metrics(page);
    check('Balance = 1000 + 100 = $1,100.00', mb['Balance'] === '$1,100.00', mb);
    const px = await page.evaluate(() => [price(2385.4), price(1.08523), price(2400), price(1.1)]);
    check('prices keep typed decimals (2385.40, 1.08523, 2400.00, 1.10)', JSON.stringify(px) === '["2385.40","1.08523","2400.00","1.10"]', px);
    check('Return = +10.0%', mb['Return'] === '+10.0%', mb);
    check('Equity title switches to balance', (await page.textContent('#equityTitle')).includes('balance'));
    const live = await page.textContent('.live-line');
    // this week = today's 2 trades (d2 may or may not be in this week depending on weekday)
    const wkStart = await page.evaluate(() => weekStartStr());
    const weekN = [today, today, d2, d3].filter(d => d >= wkStart).length;
    check(`live line: today 2 of 3, week ${weekN} of 2, loss limit $150.00 remaining`, live.includes('Trades today: 2 of 3') && live.includes(`Trades this week: ${weekN} of 2`) && live.includes('$150.00 remaining today'), live);

    // ---------------------------------------------------------------- 6
    section('6. Filters');
    await page.click('nav button[data-tab="log"]');
    const count = () => page.locator('#tradeList .card[data-id]').count();
    await page.selectOption('#flt-outcome', 'Win'); check('Outcome = Win → 1', (await count()) === 1);
    await page.selectOption('#flt-outcome', ''); await page.selectOption('#flt-session', 'New York'); check('Session = New York → 2', (await count()) === 2);
    await page.selectOption('#flt-outcome', 'Loss'); check('New York + Loss → 1', (await count()) === 1);
    await page.selectOption('#flt-plan', 'yes'); check('New York + Loss + plan Yes → 0 with empty message', (await count()) === 0 && (await page.textContent('#tradeList')).includes('No trades match'));
    await page.click('#clearFilters'); check('Clear filters → 4', (await count()) === 4);
    await page.selectOption('#flt-plan', 'no'); check('Followed plan = No → 1', (await count()) === 1);
    await page.click('#clearFilters');
    await page.selectOption('#flt-range', 'week'); check(`This week → ${weekN}`, (await count()) === weekN);
    const monthStart = today.slice(0, 8) + '01';
    const monthN = [today, today, d2, d3].filter(d => d >= monthStart).length;
    await page.selectOption('#flt-range', 'month'); check(`This month → ${monthN}`, (await count()) === monthN);
    await page.click('#clearFilters');

    // ---------------------------------------------------------------- 8 (before edit, to prove edit keeps old steps)
    section('8. Change checklist');
    await page.click('nav button[data-tab="settings"]');
    dialogs = [];
    await page.click('#presetB');
    check('loading preset asks for confirmation', dialogs.length === 1 && dialogs[0].includes('only affects NEW trades'));
    await page.click('nav button[data-tab="form"]');
    check('new form now uses preset B steps', (await page.textContent('#f-checklist')).includes('Direction'));
    await page.click('nav button[data-tab="log"]');
    const winCard2 = await page.locator('#tradeList .card[data-id]', { hasText: '09:00' }).textContent();
    check('old trade still shows its ICC steps', winCard2.includes('1. Indication') && !winCard2.includes('Entry model'));
    // edit a step name in the editor
    await page.click('nav button[data-tab="settings"]');
    await page.fill('#ckEditor .ck-edit:nth-child(1) input', 'Bias');
    await page.click('#ckEditor .ck-edit:nth-child(2) button[aria-label="Move up"]');
    await page.click('#ckSave');
    await page.waitForFunction(() => settings.checklist[1].name === 'Bias').catch(() => {});
    const savedCk = await page.evaluate(() => settings.checklist.map(s => s.name));
    check('rename + reorder saved', JSON.stringify(savedCk) === '["AOI","Bias","Entry model","Confluences"]', savedCk);

    // ---------------------------------------------------------------- 7
    section('7. Edit / delete / duplicate');
    await page.click('nav button[data-tab="log"]');
    const lossCard = page.locator('#tradeList .card[data-id]', { has: page.locator('.badge.Loss') }).first();
    const lossId = await lossCard.getAttribute('data-id');
    await lossCard.locator('button:text-is("Edit")').click();
    check('edit form shows saved ICC steps, not current ones', (await page.textContent('#f-checklist')).includes('Continuation') && !(await page.textContent('#f-checklist')).includes('Bias'));
    check('edit form pre-fills P&L and confirmations', (await page.inputValue('#f-pnl')) === '-100' && (await page.locator('#f-checklist .confirm-btn.on').count()) === 2);
    check('edit form shows existing screenshot', (await page.locator('#f-checklist .step[data-step="2"] .thumb').count()) === 1);
    await page.fill('#f-notes', 'Edited note, with comma');
    await page.click('#f-checklist .step[data-step="2"] .confirm-btn');
    await page.setInputFiles('#f-general input[type=file]', path.join(FIX, 'chart-webp.webp'));
    await page.waitForFunction(() => document.querySelectorAll('#f-general .thumb').length === 1);
    await page.click('#saveBtn'); await page.waitForSelector('#tab-log:not(.hidden)');
    const edited = await page.evaluate(id => trades.find(t => t.id === id), lossId);
    check('edit keeps the same ID', !!edited && edited.id === lossId);
    check('edit keeps original checklist names', edited.checklistSnapshot[0].name === 'Indication');
    check('edit saved new confirmation (3/4)', edited.checklistConfirmed.filter(Boolean).length === 3);
    check('edit kept old screenshot + added new', edited.stepScreenshots[2].length === 1 && edited.generalScreenshots.length === 1);
    check('updatedAt changed, createdAt kept', edited.updatedAt > edited.createdAt);
    check('only one copy of trade after edit', (await page.locator(`#tradeList .card[data-id="${lossId}"]`).count()) === 1 && (await count()) === 4);
    // Delete: cancel first, then confirm
    dialogAnswer = false;
    const beCard = page.locator('#tradeList .card[data-id]', { has: page.locator('.badge.Breakeven') }).first();
    const beId = await beCard.getAttribute('data-id');
    await beCard.locator('button:text-is("Delete")').click();
    check('delete cancelled keeps trade', (await count()) === 4);
    dialogAnswer = true;
    await beCard.locator('button:text-is("Delete")').click();
    await page.waitForFunction(() => document.querySelectorAll('#tradeList .card[data-id]').length === 3);
    check('delete confirmed removes trade', (await count()) === 3);
    check('deleted trade kept as sync tombstone', await page.evaluate(async id => (await store.get('trades', id)).deleted === true, beId));
    // Duplicate the win
    await page.locator('#tradeList .card[data-id]', { hasText: '09:00' }).locator('button:text-is("Duplicate")').click();
    check('duplicate: entry copied, date today, no P&L, no screenshots', (await page.inputValue('#f-entry')) === '2400' && (await page.inputValue('#f-date')) === today && (await page.inputValue('#f-pnl')) === '' && (await page.locator('#tradeForm .thumb').count()) === 0);
    check('duplicate uses current checklist', (await page.textContent('#f-checklist')).includes('Bias'));
    await page.selectOption('#f-outcome', 'Open'); await page.click('#saveBtn'); await page.waitForSelector('#tab-log:not(.hidden)');
    const ids = await page.evaluate(() => trades.filter(t => !t.deleted).map(t => t.id));
    check('duplicate saved with a new unique ID', ids.length === 4 && new Set(ids).size === 4);
    const dup = await page.evaluate(() => trades.filter(t => !t.deleted).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]);
    check('duplicate has new checklist snapshot', dup.checklistSnapshot[0].name === 'AOI');

    // ---------------------------------------------------------------- 12
    section('12. Lightbox');
    const th = page.locator('#tradeList .thumb').first();
    await th.scrollIntoViewIfNeeded(); await th.click();
    check('lightbox opens with image', await page.isVisible('#lightbox') && (await page.getAttribute('#lbImg', 'src') || '').startsWith('blob:'));
    await page.keyboard.press('Escape');
    check('Escape closes lightbox', !(await page.isVisible('#lightbox')));
    await th.click(); await page.click('#lbClose');
    check('Close button closes lightbox', !(await page.isVisible('#lightbox')));

    // ---------------------------------------------------------------- 10
    section('10. CSV export');
    await page.click('nav button[data-tab="settings"]');
    const [csvDl] = await Promise.all([page.waitForEvent('download'), page.click('#exportCsv')]);
    const csvPath = path.join(OUT, csvDl.suggestedFilename()); await csvDl.saveAs(csvPath);
    const csv = fs.readFileSync(csvPath);
    check('CSV starts with UTF-8 BOM', csv[0] === 0xEF && csv[1] === 0xBB && csv[2] === 0xBF);
    const csvText = csv.toString('utf8').slice(1);
    check('CSV uses CRLF line endings', csvText.includes('\r\n'));
    check('CSV quotes text with commas/quotes/newlines', csvText.includes('"Clean ICC, ""textbook"", entry at FVG\nSecond line"'));
    check('CSV has checklist completion and joined mistakes', csvText.includes('3/4 steps') && csvText.includes('Entered early; Moved stop loss'));
    check('CSV has step names joined', csvText.includes('Indication | Correction | Continuation | Entry trigger'));
    check('CSV excludes deleted trade (header + 4 rows)', csvText.trim().split('\r\n').length === 5 || (console.log(csvText), false));
    check('CSV filename', /^trade-journal-trades-\d{4}-\d{2}-\d{2}\.csv$/.test(csvDl.suggestedFilename()));

    // ---------------------------------------------------------------- 9
    section('9. Backup, wipe, restore');
    const before = await page.evaluate(() => ({ trades: JSON.stringify(trades.filter(t => !t.deleted).sort((a, b) => a.id.localeCompare(b.id))), settings: JSON.stringify(settings.checklist) }));
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#exportJson')]);
    const bkName = dl.suggestedFilename();
    check('backup filename trade-journal-backup-YYYY-MM-DD.json', bkName === `trade-journal-backup-${today}.json`, bkName);
    const bkPath = path.join(OUT, bkName); await dl.saveAs(bkPath);
    const bk = JSON.parse(fs.readFileSync(bkPath, 'utf8'));
    check('backup has 6 records (5 live + 1 deleted marker), settings and base64 screenshots', bk.trades.length === 6 && bk.screenshots.length === 6 && typeof bk.screenshots[0].data === 'string' && !!bk.settings.checklist, { t: bk.trades.length, s: bk.screenshots.length });
    await page.waitForFunction(() => document.querySelector('#exportInfo').textContent.includes('KB') || document.querySelector('#exportInfo').textContent.includes('MB'));
    check('export states file size', /\d+(\.\d)? (KB|MB)/.test(await page.textContent('#exportInfo')));
    check('last backup shows Today', (await kv(page, '#dataInfo'))['Last backup'] === 'Today');
    check('storage used shown', /\d/.test((await kv(page, '#dataInfo'))['Storage used']));
    // wipe
    dialogAnswer = true;
    await page.click('#wipeAll');
    await page.waitForFunction(() => trades.length === 0);
    check('wipe: no trades left', (await page.evaluate(() => store.list('shots'))).length === 0);
    // also reset checklist to default to prove settings come back
    await page.click('#presetA');
    // import
    await page.setInputFiles('#importFile', bkPath);
    await page.waitForSelector('#importPanel:not(.hidden)');
    const summary = await page.textContent('#importPanel');
    check('import summary: "4 trades, 6 screenshots, 0 already exist"', summary.includes('4 trades, 6 screenshots, 0 already exist'), summary);
    await page.check('#impSettings');
    await page.click('#importPanel button:text-is("Merge (recommended)")');
    await page.waitForFunction(() => trades.filter(t => !t.deleted).length === 4);
    const after = await page.evaluate(() => ({ trades: JSON.stringify(trades.filter(t => !t.deleted).sort((a, b) => a.id.localeCompare(b.id))), settings: JSON.stringify(settings.checklist) }));
    check('restored trades identical to before', after.trades === before.trades);
    check('restored checklist from backup', after.settings === before.settings);
    await page.click('nav button[data-tab="log"]');
    const img2 = await imagesLoaded(page, '#tradeList');
    check('all 6 screenshots display after restore', img2.total === 6 && img2.ok === 6, img2);
    // import again
    await page.click('nav button[data-tab="settings"]');
    await page.setInputFiles('#importFile', bkPath);
    await page.waitForSelector('#importPanel:not(.hidden)');
    const summary2 = await page.textContent('#importPanel');
    check('second import: "4 already exist", 0 new', summary2.includes('4 already exist') && summary2.includes('add 0 new'), summary2);
    await page.click('#importPanel button:text-is("Merge (recommended)")');
    await page.waitForTimeout(400);
    check('no duplicates after second import', (await page.evaluate(() => trades.filter(t => !t.deleted).length)) === 4 && (await page.evaluate(async () => (await store.list('shots')).length)) === 6);
    // merge keeps later updatedAt
    const modified = JSON.parse(JSON.stringify(bk));
    const tgt = modified.trades.find(t => t.outcome === 'Win');
    tgt.notes = 'Newer copy from phone'; tgt.updatedAt = new Date(Date.now() + 60000).toISOString();
    const older = modified.trades.find(t => t.outcome === 'Loss');
    older.notes = 'Older copy, should be ignored'; older.updatedAt = '2000-01-01T00:00:00.000Z';
    const modPath = path.join(OUT, 'modified.json'); fs.writeFileSync(modPath, JSON.stringify(modified));
    await page.setInputFiles('#importFile', modPath);
    await page.waitForSelector('#importPanel:not(.hidden)');
    await page.click('#importPanel button:text-is("Merge (recommended)")');
    await page.waitForTimeout(400);
    const notes = await page.evaluate(() => trades.filter(t => !t.deleted).map(t => t.notes));
    check('merge takes newer copy', notes.includes('Newer copy from phone'));
    check('merge ignores older copy', !notes.includes('Older copy, should be ignored'));
    // replace all (two confirmations)
    dialogs = [];
    await page.setInputFiles('#importFile', bkPath);
    await page.waitForSelector('#importPanel:not(.hidden)');
    await page.click('#importPanel button:text-is("Replace all")');
    await page.waitForTimeout(400);
    check('replace all asks twice', dialogs.length === 2, dialogs);
    check('replace all restores backup exactly', (await page.evaluate(() => JSON.stringify(trades.filter(t => !t.deleted).sort((a, b) => a.id.localeCompare(b.id))))) === before.trades);
    // bad file
    const badPath = path.join(OUT, 'bad.json'); fs.writeFileSync(badPath, '{"hello": 1}');
    await page.setInputFiles('#importFile', badPath);
    await page.waitForTimeout(200);
    check('invalid file rejected with message', (await page.textContent('#toast')).includes('not a Trade Journal backup'));

    // ---------------------------------------------------------------- save failure keeps form
    section('Save failure handling');
    await page.click('nav button[data-tab="form"]');
    await page.fill('#f-entry', '2333'); await page.selectOption('#f-outcome', 'Open'); await page.fill('#f-notes', 'keep me');
    await page.evaluate(() => { window.__origBatch = store.batch; store.batch = () => Promise.reject(Object.assign(new Error('quota'), { name: 'QuotaExceededError' })); });
    await page.click('#saveBtn');
    await page.waitForSelector('#saveError:not(.hidden)');
    check('failed save shows storage-full advice', (await page.textContent('#saveError')).includes('Storage full: export a backup'));
    check('failed save keeps typed data', (await page.inputValue('#f-notes')) === 'keep me' && await page.isVisible('#tab-form'));
    await page.evaluate(() => { store.batch = window.__origBatch; });
    await page.click('#saveBtn'); await page.waitForSelector('#tab-log:not(.hidden)');
    check('retry after failure saves', (await page.evaluate(() => trades.filter(t => !t.deleted).length)) === 5);

    // ---------------------------------------------------------------- dark mode
    section('Dark mode');
    await page.click('nav button[data-tab="settings"]');
    await page.click('#themeSeg button[data-v="dark"]');
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    check('dark theme applies', bg === 'rgb(15, 17, 21)', bg);
    await page.click('#themeSeg button[data-v="auto"]');

    // ---------------------------------------------------------------- 11
    section('11. Phone width 380px');
    await page.setViewportSize({ width: 380, height: 800 });
    for (const tab of ['dashboard', 'log', 'form', 'settings']) {
      await page.click(`nav button[data-tab="${tab}"]`); await page.waitForTimeout(150);
      const sw = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
      check(`no horizontal scroll on ${tab}`, sw.s <= sw.c, sw);
    }
    await page.click('nav button[data-tab="dashboard"]');
    await page.screenshot({ path: path.join(OUT, 'phone-dashboard.png'), fullPage: true });
    await page.click('nav button[data-tab="log"]');
    await page.screenshot({ path: path.join(OUT, 'phone-log.png'), fullPage: true });
    await page.click('nav button[data-tab="form"]');
    await page.screenshot({ path: path.join(OUT, 'phone-form.png'), fullPage: true });
    const small = await page.$$eval('#tab-form button, #tab-form input, #tab-form select', els => els.filter(e => e.offsetParent && e.getBoundingClientRect().height < 34).map(e => e.outerHTML.slice(0, 60)));
    check('form controls at least 34px tall (thumb-friendly)', small.length === 0, small);
    await page.setViewportSize({ width: 1100, height: 900 });
    await page.click('nav button[data-tab="dashboard"]');
    await page.screenshot({ path: path.join(OUT, 'desktop-dashboard.png'), fullPage: true });

    // ---------------------------------------------------------------- offline
    section('Offline (service worker)');
    await ctx.setOffline(true);
    await page.reload(); await page.waitForSelector('#metrics .metric');
    check('app opens offline after first visit', (await page.textContent('h1')) === 'Trade Journal');
    check('data still there offline', (await metrics(page))['Total trades'] === '5');
    await ctx.setOffline(false);

    check('no page errors during the whole run', errors.length === 0, errors);
  } catch (e) {
    failed++; failures.push('exception: ' + e.message); console.error(e);
  }

  // ---------------------------------------------------------------- file://
  section('Opened directly from disk (file://)');
  try {
    const ctx2 = await browser.newContext();
    const p2 = await ctx2.newPage();
    const errs2 = [];
    p2.on('pageerror', e => errs2.push(e.message));
    await p2.goto('file://' + path.join(ROOT, 'index.html'));
    await p2.waitForSelector('#metrics .metric');
    check('file:// loads without storage banner', !(await p2.isVisible('#banner')));
    await p2.click('nav button[data-tab="form"]');
    await p2.fill('#f-entry', '2400'); await p2.selectOption('#f-outcome', 'Win'); await p2.click('#f-plan button[data-v="yes"]'); await p2.fill('#f-pnl', '50');
    await p2.setInputFiles('#f-checklist .step[data-step="0"] input[type=file]', path.join(FIX, 'chart-small.jpg'));
    await p2.waitForSelector('#f-checklist .step[data-step="0"] .thumb');
    await p2.click('#saveBtn'); await p2.waitForSelector('#tab-log:not(.hidden)');
    await p2.reload(); await p2.waitForSelector('#metrics .metric');
    check('file:// trade persists after reload', (await metrics(p2))['Net P&L'] === '+$50.00');
    check('file:// no page errors', errs2.length === 0, errs2);
    await ctx2.close();
  } catch (e) { failed++; failures.push('file:// exception: ' + e.message); console.error(e); }

  await browser.close(); server.kill();
  console.log(`\n${passed} passed, ${failed} failed. Screenshots in ${OUT}`);
  if (failed) { console.log('Failed:\n - ' + failures.join('\n - ')); process.exit(1); }
})();
