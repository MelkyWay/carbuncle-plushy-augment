# FF14 Carbuncle Plushy QoL

A small userscript that makes [FFX|V Fish Tracker](https://ff14fish.carbuncleplushy.com/) more convenient for daily fishing.

Repository: [MelkyWay/carbuncle-plushy-qol](https://github.com/MelkyWay/carbuncle-plushy-qol)

## What You Get

- See exact local clock times right in the Availability column (instead of only "in X minutes").
- Get alerts before fish windows open.
- Choose how fish are tracked:
  - `Auto (website)` (default): alerts follow fish currently shown on the page.
  - `Manual mode`: alerts follow your own saved fish list.
- Choose your alert style:
  - sound on/off
  - desktop notifications on/off
  - toast popups on/off

## Quick Start

### Option A: Install from GitHub URL (recommended)

1. Open this URL in your browser:
   - `https://raw.githubusercontent.com/MelkyWay/carbuncle-plushy-qol/main/ff14-carbuncle-plushy-qol.js`
2. Tampermonkey/Violentmonkey should prompt to install. Confirm.
3. Open/reload <https://ff14fish.carbuncleplushy.com/>.

Why this is recommended:
- easiest updates (no manual copy/paste)
- works well with userscript update checks
- keeps your installed script aligned with the repo version

### Option B: Copy/paste install

1. Install a userscript manager:
   - [Tampermonkey](https://www.tampermonkey.net/)
   - or [Violentmonkey](https://violentmonkey.github.io/)
2. In your userscript manager, create a new script.
3. Paste the contents of `ff14-carbuncle-plushy-qol.js`.
4. Save, then reload <https://ff14fish.carbuncleplushy.com/>.

When to use this option:
- you are testing local edits quickly
- you do not want your installed script to auto-update from GitHub

## First-Time Setup

Open the userscript menu on the fish tracker page and set:

- `Set alert lead time (minutes)` (example: `10`)
- `Toggle tracking mode (auto (website)/manual)`
- `Request desktop notification permission` (if you want browser notifications)
- `Toggle sound` / `Toggle toasts` / `Toggle status badge` as you prefer

Tip: toggle menu entries show current state (for example `currently: ON` / `currently: OFF`).

## Day-to-Day Use

- If you filter/search fish on the site, `auto (website)` mode will alert only for what is currently displayed.
- If you prefer a fixed target list, switch to `manual` mode and use:
  - `Set tracked fish (comma separated)`
- Use `Test alert` anytime to verify your setup.

## Menu Options

- `Set tracked fish (comma separated)`
- `Toggle tracking mode (currently: AUTO (WEBSITE)/MANUAL)`
- `Set alert lead time (minutes)`
- `Toggle sound (currently: ON/OFF)`
- `Toggle toasts (currently: ON/OFF)`
- `Toggle desktop notifications (currently: ON/OFF)`
- `Toggle status badge (currently: ON/OFF)`
- `Request desktop notification permission`
- `Unlock audio now`
- `Show alert status`
- `Test alert`

## Troubleshooting

### Script installed but not running

- In Chrome extension settings for Tampermonkey, make sure:
  - `Autoriser les scripts utilisateur` / `Allow user scripts` is ON
  - site access is allowed
- Hard refresh the page (`Ctrl+F5`).

### No sound

- Click once anywhere on the page (browser audio policy).
- Use `Unlock audio now`.
- Use `Test alert`.

### No desktop notifications

- Use `Request desktop notification permission`.
- Check your browser/site notification permissions.
- Desktop notifications are permission-gated: if permission is denied/blocked, the script keeps desktop notifications OFF.

### Too many popups

- Use `Toggle toasts` to turn toast popups off.

## Notes

- Designed for the English UI text on FF14 Fish Tracker.
- Times shown are your local system/browser time.

## Privacy

- Runs only on `https://ff14fish.carbuncleplushy.com/*`.
- Does not send your data anywhere.
- Saves your preferences locally in userscript storage.

## Development / Build Workflow

- Source of truth:
  - `src/main.js` (userscript behavior)
  - `src/core.js` (shared pure logic, unit-tested)
- Generated file:
  - `ff14-carbuncle-plushy-qol.js` (this is the file to install in userscript managers)
- Typical dev loop:
  1. Edit `src/main.js` / `src/core.js`
  2. Run `npm run build`
  3. Update/reload script in Tampermonkey/Violentmonkey
- Before pushing:
  - Run `npm run verify` (tests + build)
- Release/version note:
  - Bump `package.json` version before release; the userscript `@version` is generated from it during build.

## Testing

- Install test dependencies:
  - `npm install`
- Run unit tests:
  - `npm test`
- Watch mode:
  - `npm run test:watch`
- Build userscript from source modules:
  - `npm run build`

## Performance Benchmark

- Reusable end-to-end comparison runner:
  - `npm run bench:e2e -- <baseline-script> <candidate-script>`
  - example:
    - `npm run bench:e2e -- baseline.user.js ff14-carbuncle-plushy-qol.js`
- What the end-to-end runner measures:
  - full userscript bootstrap time
  - warm `runAlerts()` interval cost
  - warm `updateExactTimes()` interval cost
- Notes for first run:
  - install dependencies with `npm install`
  - if Chromium is missing, run `npx playwright install chromium`
  - you can create a baseline script from any commit/tag with:
    - `git show <ref>:ff14-carbuncle-plushy-qol.js > baseline.user.js`

## Disclaimer

Unofficial project. Not affiliated with Carbuncle Plushy, Square Enix, or the FFX|V Fish Tracker maintainers.

