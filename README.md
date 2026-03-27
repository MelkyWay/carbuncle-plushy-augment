# FF14 Fish Tracker Augment

A small userscript that makes [FFX|V Fish Tracker](https://ff14fish.carbuncleplushy.com/) more convenient for daily fishing.

## What You Get

- See exact local clock times right in the Availability column (instead of only "in X minutes").
- Get alerts before fish windows open.
- Choose how fish are tracked:
  - `Visible mode` (default): alerts follow fish currently shown on the page.
  - `Manual mode`: alerts follow your own saved fish list.
- Choose your alert style:
  - sound on/off
  - desktop notifications on/off
  - toast popups on/off

## Quick Start

1. Install a userscript manager:
   - [Tampermonkey](https://www.tampermonkey.net/)
   - or [Violentmonkey](https://violentmonkey.github.io/)
2. In your userscript manager, create a new script.
3. Paste the contents of `ff14-carbuncle-plushy-augment.js`.
4. Save, then reload <https://ff14fish.carbuncleplushy.com/>.

## First-Time Setup

Open the userscript menu on the fish tracker page and set:

- `Set alert lead time (minutes)` (example: `10`)
- `Toggle tracking mode (visible/manual)`
- `Request desktop notification permission` (if you want browser notifications)
- `Toggle sound` / `Toggle toasts` as you prefer

## Day-to-Day Use

- If you filter/search fish on the site, `visible` mode will alert only for what is currently displayed.
- If you prefer a fixed target list, switch to `manual` mode and use:
  - `Set tracked fish (comma separated)`
- Use `Test alert` anytime to verify your setup.

## Menu Options

- `Set tracked fish (comma separated)`
- `Toggle tracking mode (visible/manual)`
- `Set alert lead time (minutes)`
- `Toggle sound`
- `Toggle toasts`
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

### Too many popups

- Use `Toggle toasts` to turn toast popups off.

## Notes

- Designed for the English UI text on FF14 Fish Tracker.
- Times shown are your local system/browser time.

## Privacy

- Runs only on `https://ff14fish.carbuncleplushy.com/*`.
- Does not send your data anywhere.
- Saves your preferences locally in userscript storage.

## Disclaimer

Unofficial project. Not affiliated with Carbuncle Plushy, Square Enix, or the FFX|V Fish Tracker maintainers.
