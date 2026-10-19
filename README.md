# Trade Journal (XAUUSD)

A simple trading journal that runs in your web browser. You log each trade, tick your checklist steps, add chart screenshots, and the dashboard shows your numbers. It works on your laptop and on your phone, and it works offline.

---

## 1. How to open the app

**Option A: online (best)**
Open this link on your laptop or phone:

**https://billlygene.github.io/trade-journal/**

(It only works after GitHub Pages is turned on. See section 8.)

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
- Without sync, your laptop and your phone each have their **own separate** journal.
- If you clear your browser data, uninstall the browser, or lose the phone, the journal on that device is gone, unless you use sync or have a backup.

That is why sync (section 6) and backups matter.

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

If you turn on sync (next section), you do not need to move files by hand any more.

---

## 6. Sync between laptop and phone (automatic)

Sync keeps both devices the same by themselves. It uses a free **private** GitHub repository as a shared safe for your journal. The app talks to GitHub directly: there is no other server and nothing to pay for.

**How it behaves**
- It syncs when the app opens, a few seconds after every change, every 5 minutes while the app is open, and when the internet comes back.
- The small chip at the top right shows the state: **Synced 2 min ago** (green), **Syncing…**, **Offline** (grey, it will catch up later), or **Sync problem** (red: tap it to see why).
- You can keep logging trades with no internet. They sync later.
- If you change the **same trade** on both devices before they sync, the later change wins. The other version is not thrown away: it is saved in the repository's `conflicts` folder, and the app tells you.
- Your checklist, mistakes, reminders and limits sync too. Light/dark mode stays separate per device.
- Every sync is saved in the repository's history, so it is also an automatic backup. Still export a .json backup now and then: it costs nothing and does not depend on GitHub.

### One-time setup (about 10 minutes)

**Step 1: create the private data repository** (once)
1. On GitHub, click **+** (top right) → **New repository**.
2. Name: `trade-journal-data`.
3. Choose **Private**. This matters: the app refuses to sync to a public repository.
4. Click **Create repository**. Leave it empty.

This is a different repository from the app's code (`trade-journal`). The app's code is public; your data repository is private.

**Step 2: create an access token** (a password that only opens this one repository)
1. On GitHub, click your profile picture → **Settings**.
2. At the bottom of the left menu: **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
3. Token name: e.g. `journal laptop`. Expiration: pick the longest offered.
4. **Repository access** → **Only select repositories** → choose `trade-journal-data`.
5. **Permissions** → **Repository permissions** → **Contents** → **Read and write**. Leave everything else as it is.
6. Click **Generate token** and copy it (it starts with `github_pat_`). GitHub shows it only once.

**Step 3: connect the app**
1. In the app: **Settings → Sync between devices**.
2. Fill in your GitHub username, the repository name (`trade-journal-data`) and paste the token.
3. Tap **Connect and sync**.

**Step 4: the other device**
Do step 2 again on the other device (name it e.g. `journal phone`), then step 3. Use a **separate token per device**: if you ever lose your phone, you delete only the phone's token on GitHub and the laptop keeps working. It also means you never have to send a token through WhatsApp or email.

If both devices already had trades, the first sync joins them together. Nothing is deleted.

### Good to know
- **Token expired?** The chip turns red with "did not accept the access token". Make a new token (step 2) and connect again (step 3). Your trades are safe in the meantime.
- **Lost a device?** On GitHub: Settings → Developer settings → Fine-grained tokens → delete that device's token.
- **Disconnect this device** (in Settings) only removes the token from that device. Trades stay on the device and on GitHub.
- **Delete all trades and screenshots** (Danger zone) clears only *this* device when sync is on. Everything comes back on the next sync. To remove a trade everywhere, delete it from the Trade log.
- **Space:** each screenshot is about 100 to 400 KB. GitHub is comfortable up to about 1 GB, which is thousands of screenshots.
- Make sure both devices show roughly the right time. "Later change wins" uses the device clock.

---

## 7. Quick guide to the app

- **Log trade:** fill the form, tap **Confirm** on each checklist step you saw, add screenshots per step. On a laptop you can paste a screenshot with **Ctrl+V**: it goes into the highlighted step. Then tap **Save trade**.
- **Trade log:** all trades, newest first. Filter by outcome, session, plan followed, or date. Each trade has **Edit**, **Duplicate** and **Delete**.
- **Dashboard:** win rate, net P&L, profit factor, plan-followed rate, process vs result, equity curve, wins/losses by session, recent form.
- **Settings:** edit your checklist steps (or load preset A or B), your mistake list, your reminders, trade limits, daily loss limit, starting balance, light/dark mode, and your backups.

Changing the checklist only affects **new** trades. Old trades always keep the steps they were saved with.

---

## 8. Turn on GitHub Pages (one time)

1. On GitHub, open this repository.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Branch: **main**, folder: **/ (root)** → **Save**.
5. Wait a minute or two, then open https://billlygene.github.io/trade-journal/

**About privacy:** on a free GitHub account, the app's repository (`trade-journal`) must be **public** for Pages to work. That only makes the app's **code** public. Your trades and screenshots are never put in that repository. Without sync they stay only in each device's browser. With sync they also go to your separate **private** `trade-journal-data` repository, which only you (and your tokens) can open.

**Updates:** when a new version is published, just open the app with internet and refresh once. The version number is shown at the bottom of Settings.

---

## For developers

- `index.html`: the whole app (HTML, CSS, JS, no libraries). `SPEC.md`: the full specification. Read it before making changes.
- `sw.js`: offline cache. Bump the `CACHE` name on each release.
- `manifest.json`, `icon*.png`, `icon.svg`: phone install.
- Sync: the `sync` module in `index.html` (GitHub git data API: one commit per sync, per-trade "later `updatedAt` wins", `conflicts/` keeps losing copies).
- Tests (need Playwright and Chromium, plus Python 3 for a local web server):
  - `NODE_PATH=$(npm root -g) node tests/e2e.js`: the whole app.
  - `NODE_PATH=$(npm root -g) node tests/sync.js`: two devices syncing through a fake GitHub API (`tests/fake-github.js`).
