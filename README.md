# FF14 Fish Tracker Augment (Userscript)

Adds two quality-of-life features to [FFX|V Fish Tracker](https://ff14fish.carbuncleplushy.com/):

- Exact availability timestamps shown inline in the table
- Pre-window alerts for fish you track (toast + optional sound + optional desktop notification)

This was designed for English UI text on the site.

## Features

- Shows exact local date/time next to availability info (`Opens`, `Closes`, `Next`)
- Alerts a configurable number of minutes before tracked fish become available
- Uses strict row matching to reduce false positives
- In-page status badge for audio/notification state
- Tampermonkey menu actions for quick configuration

## Requirements

- A userscript manager:
  - [Tampermonkey](https://www.tampermonkey.net/)
  - or [Violentmonkey](https://violentmonkey.github.io/)
- A Chromium/Firefox browser with notification support

## Installation

1. Install Tampermonkey (or Violentmonkey).
2. Create a new userscript.
3. Paste the script code.
4. Save.
5. Open or reload: <https://ff14fish.carbuncleplushy.com/>

## Script

Use the latest script from your notes/conversation (version `1.4.1` in this project).

If you want to keep everything in one place, use `ff14-carbuncle-plushy-augment.js` from this folder before copying it into Tampermonkey.

## Configuration (Userscript Menu)

Open your userscript manager menu while on the fish tracker page:

- `Set tracked fish (comma separated)`
  - Example: `Mahar, Starscryer, Opabinia`
- `Toggle tracking mode (visible/manual)`
  - `visible`: alerts follow fish currently displayed on the page (default)
  - `manual`: alerts use your saved fish list
- `Set alert lead time (minutes)`
  - Example: `10`
- `Toggle sound`
- `Toggle toasts`
- `Request desktop notification permission`
- `Unlock audio now`
- `Show alert status`
- `Test alert`

## How Alerts Work

- Alert scan runs every 5 seconds.
- Exact-time inline refresh runs every 30 seconds.
- Alerts trigger once per fish/window/lead-time combination.
- If the fish is already inside the alert window when the page loads, you can still get an immediate alert.

## Important Notes

- Language assumption: script parsing is tuned for English strings (`in ...`, `closes in ...`).
- Time display: timestamps are shown in your browser local timezone.
- Persistence: settings are saved via `GM_*` storage (or `localStorage` fallback).

## Troubleshooting

### No sound plays

- Click once anywhere on the page (browser audio policies require user interaction).
- Run menu action: `Unlock audio now`.
- Run `Test alert`.
- Check status badge at bottom-left (`audio: unlocked`).

### No desktop notifications

- Run menu action: `Request desktop notification permission`.
- Ensure browser/site notifications are allowed.
- Check status badge (`notifications: granted`).

### I am not seeing alerts for a fish

- Confirm exact fish spelling from the table.
- Check whether that fish row currently exposes a valid availability timestamp.
- Increase lead time (e.g., 20 min) and use `Test alert` to verify notification channels.

### Times look wrong

- Verify your system/browser timezone.
- The script displays your local time, not Eorzea time.

## Privacy

- Script runs only on `https://ff14fish.carbuncleplushy.com/*`.
- No external requests are made by the script.
- Data stored: your tracked fish names and preferences.

## Changelog

### 1.4.1

- Added persistent `Toggle toasts` menu option.
- Toast rendering now respects a saved `toasts` setting.

### 1.4.0

- Added visible tracking mode (enabled by default): alerts can follow fish currently displayed on the page.
- Added menu command to switch between `visible` and `manual` tracking modes.
- Status badge and status toast now show current tracking mode.

### 1.3.1

- Scoped row scans to the main fish table body (`table tbody`) for lower polling overhead.
- Renamed script file to `ff14-carbuncle-plushy-augment.js`.

### 1.3.0

- Fixed sound toggle messaging to use explicit next-state logic.
- Replaced `rowCache` `Map` with `WeakMap` to avoid retaining stale row references.
- Replaced alert de-dupe `Set` clear behavior with timestamped `Map` + stale pruning.
- Reused current settings for alert sound path (no redundant settings read in `beep`).
- Added oscillator/gain disconnect on tone end for cleaner audio node lifecycle.
- Added conservative fallback in `closes in ...` detection when `data-prevclose` is missing.
- Improved exact-time label fallback (`Closes` / `Opens` / `Event`).

### 1.2.0

- Added stricter row matching to reduce false positives.
- Improved alert-window detection logic.
- Kept performance split (fast alert loop + slower exact-time refresh).

### 1.1.0

- Added audio unlock flow and status badge.
- Reused a single `AudioContext`.
- Reduced selector brittleness and improved permission feedback.

### 1.0.0

- Initial release: exact timestamps + pre-window alerts.

## Disclaimer

This is an unofficial augment and is not affiliated with Carbuncle Plushy, Square Enix, or the FFX|V Fish Tracker maintainers.
