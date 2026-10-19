# Build Spec: XAUUSD Trade Journal (single-page web app)

You are building a personal trading journal for one trader. Read this whole file before writing code. Build the real, working app, not a mockup.

**Priority order:** 1) data never gets lost, 2) everything works correctly, 3) simple and fast to use after every trade, 4) visual polish.

**Work without asking questions.** The trader may not be watching. Where something is unclear, make the simplest sensible choice, carry on, and list your choices in the final summary.

**First step:** save this whole specification into the repository as `SPEC.md`, so future sessions can read it before making changes.

---

## 0. Ground rules

- Vanilla HTML, CSS and JavaScript. No frameworks, no build step, no backend server, no paid services.
- Deliverable files in the repository root:
  - `index.html`: the whole app (HTML, CSS and JS inline).
  - `manifest.json` and `sw.js`: only so the app can be installed on a phone home screen and work offline.
  - `README.md`: short user instructions (see section 11).
- No external CDN libraries. Draw the charts yourself with `<canvas>` or inline SVG so the app works fully offline.
- The app will be hosted for free on GitHub Pages and opened on both a Windows laptop and a phone. It must also work when `index.html` is opened directly from disk.
- Trader's account currency: USD. Platform: MT5. Main instrument: XAUUSD (gold). Trader is in Ghana (GMT, UTC+0).
- Dates: "today" must use the device's local date, not `toISOString()` (which can give the wrong day). Weeks start on Monday.
- Number display: prices to 2 decimals, money as `+$125.50` / `−$80.00`, percentages to 1 decimal.
- Show a version number (e.g. `v1.0`) in Settings.

---

## 1. Look and feel

- White cards on a very light grey background. Compact, centred layout, max about 900px wide on desktop, full width on phone.
- Clean system font, subtle borders, rounded corners, restrained spacing.
- Colours: green for wins and confirmed steps, red for losses, blue for neutral info and session tags, grey for open or breakeven.
- Heading: **Trade Journal**
- Subtitle: **XAUUSD · Track, review, improve**
- Navigation: four tabs — **Dashboard**, **Trade log**, **Log trade**, **Settings**.
- No heavy animations or decorative graphics. Must be comfortable to use on a 380px-wide phone screen. Buttons and inputs large enough for thumbs.
- Dark mode: follow the device setting automatically (`prefers-color-scheme`), with a Light / Dark / Auto choice in Settings. Keep the same green/red/blue meaning in both modes.

---

## 2. Editable checklist (the strategy steps)

The trader has not settled on one strategy yet, so the checklist steps must be editable in **Settings**.

- Each step has a **name** and a **short description**.
- The trader can add, rename, reorder (up/down buttons are enough) and remove steps. Allow 1 to 8 steps.
- Provide two ready-made presets they can load with one click:

**Preset A: ICC (default on first launch)**
1. Indication: New HH or LL formed on HTF (4H/1H).
2. Correction: Retraced into AOI / OB / FVG zone.
3. Continuation: BOS or CHOCH confirmed on LTF (5M/15M).
4. Entry trigger: Momentum candle or engulfing at zone.

**Preset B: Direction → AOI → Entry Model**
1. Direction: LTF, MTF and HTF structure aligned? Market condition? Relevant timeframe candle closed in my favour?
2. AOI: At previous structure? Where is the setup relative to the previous move?
3. Entry model: Type 1, 2 or 3? Has MSS or CHOCH occurred?
4. Confluences: DXY alignment? Time of day? Previous HTF candle close?

**Critical rule:** each saved trade stores its own copy of the step names and descriptions it was logged with. Changing the checklist later must never change, break or relabel old trades. Old trades always display the steps they were saved with.

Loading a preset or editing steps requires a confirmation and affects only future trades.

---

## 3. Log trade form

Fields:

| Field | Type | Notes |
|---|---|---|
| Date | date | Default today. Required. |
| Time | time | Optional. |
| Instrument | text | Default `XAUUSD`. |
| Session | select | London (07:00–11:00 GMT), New York (13:00–17:00 GMT), Asia (00:00–04:00 GMT), Other |
| Direction | select | Long (Buy), Short (Sell) |
| Entry price | number, decimals | Required. |
| Exit price | number | Optional (blank while open). |
| Stop loss | number | |
| Take profit | number | |
| Lot size | number | Optional. |
| Risk ($) | number | Optional. Money risked on the trade. If filled, show the result in R (P&L ÷ Risk, e.g. +2.0R, −1.0R). |
| P&L ($) | number | Entered manually. Do NOT calculate money P&L from prices. |
| R:R ratio | number | Manual. If blank and entry, SL and TP are valid, calculate from price distances (see below). Round to 2 decimals. |
| Outcome | select | Win, Loss, Breakeven, Open |
| Setup grade | select | A+ (all confluences), A (strong), B (okay), C (weak) |
| Followed my plan? | Yes / No toggle | Required before saving (unless Outcome is Open). |
| Mistakes | multi-select chips | Defaults: Entered early, Moved stop loss, Oversized lot, Revenge trade, No clear setup, Closed too early, Ignored session time. Editable list in Settings. |
| Emotion before trade | select | Calm, Confident, Anxious, Rushed, Bored, Frustrated |
| Notes / markup observations | multiline | Free text. |

**R:R fallback calculation**
- Long: valid only if SL < entry < TP. Risk = entry − SL. Reward = TP − entry.
- Short: valid only if TP < entry < SL. Risk = SL − entry. Reward = entry − TP.
- If invalid, leave R:R empty. Never show negative or infinite values.

**Checklist section** (uses the current checklist from Settings):
- Each step shows a numbered circle, its name and description, and a **Confirm** button that toggles to **Confirmed** (green).
- Each step has its own screenshot upload area: multiple PNG/JPG/WebP files, thumbnails, a remove (×) button on each, and click-to-open full-screen lightbox with a close button (and Escape key).
- Also add one **General screenshots** area for anything not tied to a step (e.g. the MT5 result screenshot).
- Compress images on upload (resize so the longest side is at most 1600px, JPEG/WebP quality around 0.8) to save storage.

**Saving**
1. Validate: date and entry price required; "Followed my plan?" required unless Outcome is Open. Show clear messages next to the fields.
2. Create a unique ID (e.g. `crypto.randomUUID()`), never the array position.
3. Save the full record and its screenshots.
4. Only after the save truly succeeds: show a short "Trade saved" message, reset the form and checklist, set date back to today, switch to Trade log, refresh dashboard.
5. If saving fails, keep everything the user typed on screen and show the error with advice (e.g. "Storage full: export a backup and remove old screenshots").

---

## 4. Dashboard

**Reminder strip at the top** (short, calm, not shouty). Text editable in Settings. Defaults:
- Keep risk the same on every trade.
- Probability over chasing big R:R.
- Be patient. Stop at my loss limit.
- Follow the plan. Don't force trades.

Plus a live line based on Settings: e.g. "Trades this week: 1 of 2 · Loss limit: $X remaining today". Max trades per day/week and daily loss limit ($) are configurable in Settings; leave blank to hide.

**Metric cards**
1. Total trades: all trades.
2. Win rate: wins ÷ (wins + losses). Open and breakeven trades excluded.
3. Net P&L: sum of P&L of closed trades only (Win, Loss, Breakeven). Open trades excluded.
4. Profit factor: gross wins ÷ |gross losses|. Show "—" if there are no losses.
5. Plan-followed rate: % of closed trades where "Followed my plan" = Yes.
6. Full-checklist win rate: win rate among closed trades where every checklist step was confirmed (open and breakeven excluded from the denominator).

Under the cards, a small **Process vs result** grid with four counts:
- Followed plan + Win ("good trade")
- Followed plan + Loss ("good loss, accept it")
- Broke plan + Win ("lucky, dangerous")
- Broke plan + Loss ("lesson")

Also show: average win, average loss, average R:R, average result in R (trades with Risk filled), most common mistake.

**Starting balance (optional, in Settings):** if set, show current balance (starting balance + net P&L) and % return, and let the equity curve show balance instead of cumulative P&L.

**Charts** (hand-drawn, redrawn cleanly on every change, never duplicated):
- **Equity curve:** cumulative net P&L of closed trades sorted by date then time. Readable dates and $ values.
- **Wins vs losses by session:** London, New York, Asia, Other (exclude open and breakeven).

**Recent form (last 20):** small dots: green = win, red = loss, grey = breakeven, outlined = open.

**Empty state:** with no trades, show friendly zero values and a "Log your first trade" button. No errors, no NaN, no division by zero.

All numbers update immediately after any add, edit, delete or import.

---

## 5. Trade log

- Cards, newest first. Each card shows: direction, date (and time), session, outcome badge, grade, P&L, entry, exit, SL, TP, R:R, lot size, checklist completion (e.g. 3/4), plan followed (Yes/No), mistakes, emotion, notes, and screenshot thumbnails grouped by checklist step (using the step names saved with that trade), plus general screenshots.
- **Filters** (combinable, with a "Clear filters" button): Outcome (All/Win/Loss/Breakeven/Open), Session, Followed plan (All/Yes/No), Date range (This week / This month / All).
- Clear empty state when nothing matches.
- **Edit:** opens the same form pre-filled, including checklist confirmations and screenshots, which can also be changed. The trade keeps its original ID and its saved checklist step names. Editing never loses screenshots unless the user removes them.
- **Delete:** asks for confirmation first.
- **Duplicate:** copies a trade's setup details into a new entry form (new ID, today's date, no screenshots, no P&L).

Render all user text safely (`textContent`, never raw `innerHTML` with user input).

---

## 6. Storage

- Use **IndexedDB** for trades and screenshots (stored as Blobs). Do not use localStorage for images. localStorage is only for tiny UI preferences.
- Every trade record has: `id`, `createdAt`, `updatedAt`, `deleted` (for future sync), all form fields, `checklistSnapshot` (array of `{name, description}`), `checklistConfirmed` (array of booleans), `stepScreenshots` (array of arrays of screenshot IDs), `generalScreenshots`, `schemaVersion`.
- Call `navigator.storage.persist()` on first launch so the browser is less likely to clear the data. Show storage used in Settings.
- Handle old or missing fields gracefully (default values), so future versions can read older data.
- Never silently discard data. On any storage error, show a clear message.

---

## 7. Backup, restore and moving data between devices

In **Settings → Data**:
- **Export full backup (.json):** all trades, settings, checklist and screenshots (screenshots base64-encoded inside the JSON). Filename like `trade-journal-backup-2026-10-19.json`. State the file size.
- **Export trades to Excel (.csv):** one row per trade with all simple fields, plus checklist completion as "3/4", step names joined, mistakes joined. Explain that CSV has no screenshots and the JSON is the full backup.
- **Import backup (.json):** validate first; show a summary ("23 trades, 41 screenshots, 5 already exist"). Offer **Merge** (default: add new trades, keep whichever copy has the later `updatedAt`) or **Replace all** (needs a second confirmation). Importing the same backup twice must not create duplicates.
- Show "Last backup: X days ago" in Settings, and a gentle reminder on the dashboard if it's more than 7 days or more than 10 new trades since the last backup.

This JSON export/import is also how the trader moves data between laptop and phone.

---

## 8. Phone install and offline

- `manifest.json` (name, short name "Journal", theme colour, simple generated icon as inline SVG or PNG) and `sw.js` that caches `index.html` so the app opens offline after the first visit.
- The app must still work if service workers are unavailable (e.g. opened from disk).
- Updates must reach the user: use network-first for `index.html` (fall back to cache when offline) and version the cache name, so a new version appears after a refresh instead of an old copy being stuck on the phone.
- iPhone Safari may delete website data that hasn't been opened for a while unless the app is added to the home screen. Say this in the README and recommend installing it.

---

## 9. Phase 2: automatic sync (BUILT in v1.1)

> **Update (v1.1):** the trader asked for sync, and it is now built. Design: a private GitHub repository (`trade-journal-data`) accessed straight from the browser with a fine-grained token (Contents read/write, that repo only), stored per device in IndexedDB `meta/sync` and never put in backups. Remote layout: `journal.json` (all trades incl. deleted markers, plus settings), `shots/<id>.<ext>`, `conflicts/`. Each sync = one git commit (fast-forward only, retried if another device pushed first). Per trade the later `updatedAt` wins; if both devices changed a trade since the last sync, the losing copy goes to `conflicts/`. Settings use the same rule, except theme, which stays per device. The app refuses public repositories. Code: the `sync` module and `mergeForSync` in `index.html`. Tests: `tests/sync.js` with `tests/fake-github.js`.

Original phase-2 notes:

The trader wants laptop and phone to sync automatically if possible. Do not build it in this phase. But keep the data model sync-ready (the `id`, `updatedAt`, `deleted` fields above) and keep storage access behind one small module (`store.get/put/delete/list`) so a sync layer can be added later without rewriting the app. Mention in the README that sync is planned as a later add-on.

---

## 10. Out of scope

No broker connection, live prices, auto-trading, economic calendar, AI analysis, multi-account management, user login, cloud database, or extra pages beyond the four tabs.

---

## 11. Testing and delivery

Before finishing, test in a headless browser (e.g. Playwright) and fix anything that fails. If a browser cannot be downloaded in this environment, do not stop: test the calculation and storage logic with Node (e.g. jsdom and fake-indexeddb via npm), and clearly list which checks could not be run in a real browser. Keep any test files in a `tests/` folder and do not add a `package.json` to the root that the app depends on.
1. Fresh start: empty dashboard shows no errors.
2. Log a Long win, a Short loss, a breakeven and an open trade, with checklist confirmations and screenshots on at least two steps.
3. Reload the page: everything still there, including images.
4. Check every dashboard number by hand against the four test trades.
5. R:R fallback correct for both Long and Short; invalid prices give no R:R.
6. Filters (single and combined), clear filters.
7. Edit a trade: ID, screenshots and checklist kept. Delete with confirmation. Duplicate.
8. Change the checklist in Settings: old trades still show their original steps.
9. Export JSON, wipe data, import: everything comes back. Import the same file again: no duplicates.
10. CSV opens correctly in Excel (UTF-8 with BOM, proper quoting).
11. Phone width (380px): no horizontal scrolling, everything usable.
12. Lightbox opens and closes; Escape works.

Then:
- Commit all files. Push to the `main` branch if you are allowed to. If you must work on a separate branch, open a pull request into `main` and tell the trader in plain words how to merge it (GitHub Pages publishes from `main`).
- Replace the existing placeholder `README.md`. Write it in plain, simple English covering: how to open the app (GitHub Pages link and opening the file directly), how to install it on a phone home screen, where the data is stored (in each device's browser), why backups matter, how to export, import and move data between laptop and phone, and how to turn on GitHub Pages (Settings → Pages → Deploy from branch → main → / root → Save). Explain that on a free GitHub account the repository must be public for Pages to work, that this makes only the app's code public, and that trades and screenshots are never uploaded to GitHub; they stay in the browser on each device.
- Finish with a short summary of what was built and anything that did not pass testing.
