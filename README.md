# Trade Journal (XAUUSD)

A simple trading journal that runs in your web browser. You log each trade, tick your checklist steps, add chart screenshots, and the dashboard shows your numbers. It works on your laptop and on your phone, and it works offline.

---

## 1. How to open the app

**Option A: online (best)**
Open this link on your laptop or phone:

**https://billlygene.github.io/trade-journal/**

(It only works after GitHub Pages is turned on. See section 7.)

**Option B: straight from the file**
Download `index.html` and double-click it. It opens in your browser and works fully.
Note: the browser treats the online version and the file version as two separate places, so each one keeps its own trades. Pick one and stick with it.

---

## 2. Install it on your phone (recommended)

Installing puts an icon on your home screen. It opens like an app and works with no internet.

- **Android (Chrome):** open the link → tap the **⋮** menu → **Add to Home screen** (or **Install app**).
- **iPhone (Safari):** open the link → tap the **Share** button → **Add to Home Screen**.

**iPhone warning:** Safari can delete website data that has not been opened for a few weeks. Adding the app to the Home Screen protects it from this. Please install it, and still make regular backups.

---

## 3. Where your data is stored

Your trades and screenshots are saved **inside the browser on each device**. Nothing is sent to GitHub or any server.

This means:
- Your laptop and your phone each have their **own separate** journal.
- If you clear your browser data, uninstall the browser, or lose the phone, the journal on that device is gone.

That is why backups matter.

---

## 4. Backups (please do this weekly)

Go to **Settings → Data**.

- **Export full backup (.json):** saves everything: trades, screenshots, checklist and settings. This is your real backup. Save it somewhere safe, like Google Drive or email it to yourself.
- **Export trades to Excel (.csv):** a table of your trades to open in Excel. It has **no screenshots** and cannot be imported back. Use it for your own analysis only.

The dashboard shows a gentle reminder when your last backup is more than 7 days old, or when you have logged more than 10 trades since.

---

## 5. Restore, or move data between laptop and phone

1. On the device that has the trades: **Settings → Export full backup (.json)**.
2. Get the file to the other device (Google Drive, email, WhatsApp to yourself, USB cable).
3. On the other device: **Settings → Import backup (.json)** → choose the file.
4. The app shows a summary first, e.g. "23 trades, 41 screenshots, 5 already exist". Then choose:
   - **Merge (recommended):** adds new trades. If a trade exists on both, it keeps the copy that was changed most recently. Nothing else is touched. Importing the same file twice does **not** create duplicates.
   - **Replace all:** deletes everything on this device and uses only the backup. It asks you twice before doing this.
5. Tick **"Also use the checklist… from this backup"** if you want the same checklist and settings on both devices. (On a brand new device this is ticked for you.)

Automatic sync between laptop and phone is planned as a later add-on. For now, use export and import.

---

## 6. Quick guide to the app

- **Log trade:** fill the form, tap **Confirm** on each checklist step you saw, add screenshots per step. On a laptop you can paste a screenshot with **Ctrl+V**: it goes into the highlighted step. Then tap **Save trade**.
- **Trade log:** all trades, newest first. Filter by outcome, session, plan followed, or date. Each trade has **Edit**, **Duplicate** and **Delete**.
- **Dashboard:** win rate, net P&L, profit factor, plan-followed rate, process vs result, equity curve, wins/losses by session, recent form.
- **Settings:** edit your checklist steps (or load preset A or B), your mistake list, your reminders, trade limits, daily loss limit, starting balance, light/dark mode, and your backups.

Changing the checklist only affects **new** trades. Old trades always keep the steps they were saved with.

---

## 7. Turn on GitHub Pages (one time)

1. On GitHub, open this repository.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Branch: **main**, folder: **/ (root)** → **Save**.
5. Wait a minute or two, then open https://billlygene.github.io/trade-journal/

**About privacy:** on a free GitHub account, the repository must be **public** for Pages to work. That only makes the app's **code** public. Your trades and screenshots are **never uploaded to GitHub**. They stay in the browser on each of your devices.

**Updates:** when a new version is published, just open the app with internet and refresh once. The version number is shown at the bottom of Settings.

---

## For developers

- `index.html`: the whole app (HTML, CSS, JS, no libraries). `SPEC.md`: the full specification. Read it before making changes.
- `sw.js`: offline cache. Bump the `CACHE` name on each release.
- `manifest.json`, `icon*.png`, `icon.svg`: phone install.
- Tests: `NODE_PATH=$(npm root -g) node tests/e2e.js` (needs Playwright and Chromium, plus Python 3 for a local web server).
