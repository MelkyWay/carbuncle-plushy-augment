import {
  normalizeFishList,
  computeNextStartFromValues,
  shouldAlert,
  makeAlertKey,
  pruneAlertedMap,
  desktopEffectiveOn
} from "./core.js";
import {
  makeExactCacheKey,
  isNodeInTable,
  isAugmentationNodeLike,
  markRowMetaDirty,
  handleStorageEventForSettings
} from "./main-helpers.js";

(() => {
  "use strict";

  const STORAGE_KEY = "ff14fish_aug_settings";
  const DEFAULTS = {
    fish: ["Mahar"],
    beforeMinutes: 10,
    sound: true,
    desktopNotification: true,
    useVisibleFish: true,
    statusBadge: true
  };

  const state = {
    alerted: new Map(),
    rowMeta: new WeakMap(),
    rows: [],
    rowsDirty: true,
    settings: null,
    processTimer: null,
    audioCtx: null,
    audioUnlocked: false,
    hasToastedAudioLocked: false,
    hasToastedNotifBlocked: false,
    menuIds: [],
    canRefreshMenu: (typeof GM_unregisterMenuCommand === "function")
  };

  const localTimeFormatter = new Intl.DateTimeFormat([], {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });

  function hasGM() {
    return typeof GM_getValue === "function" && typeof GM_setValue === "function";
  }

  function loadSettings() {
    if (hasGM()) {
      const stored = GM_getValue(STORAGE_KEY);
      return { ...DEFAULTS, ...(stored && typeof stored === "object" ? stored : {}) };
    }
    try {
      return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}")) };
    } catch {
      return { ...DEFAULTS };
    }
  }

  function readSettings() {
    if (!state.settings) state.settings = loadSettings();
    return state.settings;
  }

  function writeSettings(next) {
    state.settings = { ...DEFAULTS, ...(next && typeof next === "object" ? next : {}) };
    if (hasGM()) GM_setValue(STORAGE_KEY, state.settings);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(state.settings));
  }

  function formatLocalTime(ts) {
    return localTimeFormatter.format(new Date(ts));
  }

  function ensureStyles() {
    if (document.getElementById("ff14fish-aug-style")) return;
    const style = document.createElement("style");
    style.id = "ff14fish-aug-style";
    style.textContent = `
      .ff14fish-aug-exact { margin-top: 2px; font-size: 11px; opacity: 0.85; line-height: 1.25; }
      .ff14fish-aug-toast-wrap { position: fixed; right: 14px; bottom: 14px; z-index: 99999; display: flex; flex-direction: column; gap: 8px; pointer-events: none; }
      .ff14fish-aug-toast { background: rgba(20,20,24,.95); color: #fff; border: 1px solid rgba(255,255,255,.2); border-radius: 8px; padding: 8px 10px; min-width: 260px; max-width: 420px; font-size: 13px; box-shadow: 0 8px 22px rgba(0,0,0,.35); }
      .ff14fish-aug-status { position: fixed; right: 12px; top: 5vh; z-index: 99999; font-size: 12px; background: rgba(15,15,18,.92); color:#eee; border:1px solid rgba(255,255,255,.2); padding:6px 8px; border-radius:6px; white-space: pre-line; line-height: 1.35; }
    `;
    document.head.appendChild(style);
  }

  function toast(msg) {
    ensureStyles();
    let wrap = document.querySelector(".ff14fish-aug-toast-wrap");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.className = "ff14fish-aug-toast-wrap";
      document.body.appendChild(wrap);
    }
    const el = document.createElement("div");
    el.className = "ff14fish-aug-toast";
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 9000);
  }

  function renderStatus() {
    ensureStyles();
    const settings = readSettings();
    let el = document.querySelector(".ff14fish-aug-status");
    if (!settings.statusBadge) {
      if (el) el.remove();
      return;
    }
    if (!el) {
      el = document.createElement("div");
      el.className = "ff14fish-aug-status";
      document.body.appendChild(el);
    }
    const notificationSupported = ("Notification" in globalThis);
    const np = notificationSupported ? Notification.permission : "unsupported";
    let ap = "off";
    if (settings.sound) {
      ap = state.audioUnlocked ? "on/unlocked" : "on/locked";
    }
    const tracking = settings.useVisibleFish ? "auto (website)" : "manual";
    const desktop = desktopEffectiveOn({
      desktopNotification: settings.desktopNotification,
      notificationSupported,
      permission: np
    }) ? "on" : "off";
    el.textContent = `FFXIV Fish Ping\ntracked: ${tracking}\nsound: ${ap}\ndesktop: ${desktop}\nnotif-perm: ${np}`;
  }

  function getAudioContext() {
    const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Ctx) return null;
    if (!state.audioCtx) state.audioCtx = new Ctx();
    return state.audioCtx;
  }

  async function unlockAudio() {
    const ctx = getAudioContext();
    if (!ctx) return false;
    try {
      if (ctx.state === "suspended") await ctx.resume();
      state.audioUnlocked = (ctx.state === "running");
      if (state.audioUnlocked) state.hasToastedAudioLocked = false;
      renderStatus();
      return state.audioUnlocked;
    } catch {
      state.audioUnlocked = false;
      renderStatus();
      return false;
    }
  }

  function setupAudioUnlockHooks() {
    const once = async () => {
      await unlockAudio();
      document.removeEventListener("pointerdown", once, true);
      document.removeEventListener("keydown", once, true);
    };
    document.addEventListener("pointerdown", once, true);
    document.addEventListener("keydown", once, true);
  }

  function beep(settings) {
    if (!settings.sound) return;

    const ctx = getAudioContext();
    if (!ctx || !state.audioUnlocked) {
      if (!state.hasToastedAudioLocked) {
        toast("Sound blocked until a click/key interaction unlocks audio.");
        state.hasToastedAudioLocked = true;
      }
      return;
    }

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.value = 0.03;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.addEventListener("ended", () => {
        osc.disconnect();
        gain.disconnect();
      }, { once: true });
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    } catch {
      // noop
    }
  }

  function desktopNotify(settings, title, body) {
    if (!settings.desktopNotification || !("Notification" in globalThis)) return;

    if (Notification.permission === "granted") {
      state.hasToastedNotifBlocked = false;
      new Notification(title, { body });
    } else if (Notification.permission === "denied") {
      writeSettings({ ...settings, desktopNotification: false });
      if (!state.hasToastedNotifBlocked) {
        toast("Notifications denied in browser settings.");
        state.hasToastedNotifBlocked = true;
      }
      if (state.canRefreshMenu) refreshMenu();
    } else if (!state.hasToastedNotifBlocked) {
      toast("Desktop notifications are not granted yet. Use the permission menu action.");
      state.hasToastedNotifBlocked = true;
    }
    renderStatus();
  }

  async function setDesktopNotificationsEnabled(next) {
    const s = readSettings();
    if (!next) {
      writeSettings({ ...s, desktopNotification: false });
      toast("Desktop notifications disabled.");
      return;
    }
    if (!("Notification" in globalThis)) {
      writeSettings({ ...s, desktopNotification: false });
      toast("Desktop notifications unsupported in this browser.");
      return;
    }
    if (Notification.permission === "granted") {
      writeSettings({ ...s, desktopNotification: true });
      state.hasToastedNotifBlocked = false;
      toast("Desktop notifications enabled.");
      return;
    }
    if (Notification.permission === "default") {
      const result = await Notification.requestPermission();
      const enabled = result === "granted";
      writeSettings({ ...s, desktopNotification: enabled });
      state.hasToastedNotifBlocked = !enabled;
      toast(enabled ? "Desktop notifications enabled." : "Desktop notifications blocked by permission.");
      return;
    }
    writeSettings({ ...s, desktopNotification: false });
    state.hasToastedNotifBlocked = true;
    toast("Desktop notifications denied in browser settings.");
  }

  async function maybeRequestNotificationPermission() {
    await setDesktopNotificationsEnabled(true);
    renderStatus();
    if (state.canRefreshMenu) refreshMenu();
  }

  function parseRow(row) {
    const fishLink = row.querySelector('a[href*="/db/en/item/"]');
    const fishName = fishLink?.textContent?.trim() || null;

    const current = row.querySelector(".fish-availability-current[data-val]");
    const upcoming = row.querySelector(".fish-availability-upcoming[data-val]");
    const availCell =
      row.querySelector("td.fish-availability") ||
      current?.closest("td") ||
      upcoming?.closest("td") ||
      null;

    return { fishName, fishLink, current, upcoming, availCell };
  }

  function getRowMeta(row) {
    let meta = state.rowMeta.get(row);
    if (!meta) {
      meta = { dirty: true, renderedExactKey: null };
      state.rowMeta.set(row, meta);
    }
    if (!meta.dirty) return meta;

    const parsed = parseRow(row);
    meta.row = row;
    meta.fishName = parsed.fishName;
    meta.fishLink = parsed.fishLink;
    meta.current = parsed.current;
    meta.upcoming = parsed.upcoming;
    meta.availCell = parsed.availCell;
    meta.currentText = parsed.current?.textContent || "";
    meta.currentVal = parsed.current?.dataset?.val || "";
    meta.upcomingVal = parsed.upcoming?.dataset?.val || "";
    meta.upcomingPrevClose = parsed.upcoming?.dataset?.prevclose || "";
    meta.renderedExactKey = null;
    meta.visibilityDirty = true;
    meta.dirty = false;
    return meta;
  }

  function markRowDirty(row) {
    markRowMetaDirty(state.rowMeta, row);
  }

  function markRowsDirty() {
    state.rowsDirty = true;
  }

  function getRowFromNode(node) {
    const element = node instanceof Element ? node : node?.parentElement;
    return element?.closest("tr") || null;
  }

  function isTableRelatedNode(node) {
    return isNodeInTable(node);
  }

  function isAugmentationNode(node) {
    return isAugmentationNodeLike(node);
  }

  function scheduleProcess(delay = 150) {
    if (state.processTimer !== null) return;
    state.processTimer = setTimeout(() => {
      state.processTimer = null;
      updateExactTimes();
      runAlerts();
    }, delay);
  }

  function setupDomObserver() {
    if (typeof MutationObserver !== "function") return;
    const root = document.body || document.documentElement;
    if (!root) return;

    const observer = new MutationObserver((mutations) => {
      let sawRelevantChange = false;

      mutations.forEach((mutation) => {
        if (!isTableRelatedNode(mutation.target)) return;

        if (mutation.type === "childList") {
          const changedNodes = [...mutation.addedNodes, ...mutation.removedNodes];
          const relevantNodes = changedNodes.filter((node) => !isAugmentationNode(node));
          if (!relevantNodes.length) return;

          if (mutation.target instanceof Element && mutation.target.closest("table")) {
            sawRelevantChange = true;
            markRowDirty(getRowFromNode(mutation.target));
          }

          if (relevantNodes.some((node) =>
            node instanceof Element &&
            (node.matches("tr, tbody, table") || node.querySelector("tr"))
          )) {
            sawRelevantChange = true;
            markRowsDirty();
          }
          return;
        }

        if (isAugmentationNode(mutation.target)) return;

        const row = getRowFromNode(mutation.target);
        if (row) {
          sawRelevantChange = true;
          markRowDirty(row);
          return;
        }

        if (mutation.target instanceof Element && mutation.target.matches("tbody, table")) {
          sawRelevantChange = true;
          markRowsDirty();
        }
      });

      if (sawRelevantChange) scheduleProcess();
    });

    observer.observe(root, {
      subtree: true,
      childList: true,
      characterData: false,
      attributes: true,
      attributeFilter: ["class", "style", "data-val", "data-prevclose"]
    });
  }

  function getFishRows() {
    if (!state.rowsDirty) return state.rows;
    state.rows = Array.from(document.querySelectorAll("table tbody tr"));
    state.rowsDirty = false;
    return state.rows;
  }

  function computeNextStart(rowMeta) {
    return computeNextStartFromValues({
      currentText: rowMeta.currentText,
      currentVal: rowMeta.currentVal,
      upcomingVal: rowMeta.upcomingVal,
      upcomingPrevClose: rowMeta.upcomingPrevClose
    });
  }

  function isRowVisible(rowMeta, row) {
    if (rowMeta.visibilityDirty) {
      rowMeta.visible = row.offsetParent !== null;
      rowMeta.visibilityDirty = false;
    }
    return rowMeta.visible;
  }

  function updateExactTimes() {
    const rows = getFishRows();
    rows.forEach((row) => {
      const meta = getRowMeta(row);
      const { availCell, currentText, currentVal, upcomingVal } = meta;
      if (!availCell) return;

      const loweredText = currentText.toLowerCase();
      const cacheKey = makeExactCacheKey({ currentVal, upcomingVal, currentText });
      if (meta.renderedExactKey === cacheKey) return;
      meta.renderedExactKey = cacheKey;

      let line = availCell.querySelector(".ff14fish-aug-exact");
      if (!line) {
        line = document.createElement("div");
        line.className = "ff14fish-aug-exact";
        availCell.appendChild(line);
      }

      const parts = [];
      if (currentVal) {
        let label = "Event";
        if (loweredText.includes("closes")) label = "Closes";
        else if (loweredText.startsWith("in ")) label = "Opens";
        parts.push(`${label}: ${formatLocalTime(Number(currentVal))}`);
      }
      if (upcomingVal) parts.push(`Next: ${formatLocalTime(Number(upcomingVal))}`);
      line.textContent = parts.join(" | ");
    });
  }

  function runAlerts() {
    const settings = readSettings();
    const manualTracked = new Set((settings.fish || []).map((x) => x.toLowerCase()));

    const now = Date.now();
    pruneAlertedMap(state.alerted, now, 6);

    const rows = getFishRows();
    rows.forEach((row) => {
      const meta = getRowMeta(row);
      const { fishName, fishLink } = meta;

      if (!fishName || !fishLink) return;
      if (settings.useVisibleFish && !isRowVisible(meta, row)) return;
      if (!settings.useVisibleFish && !manualTracked.has(fishName.toLowerCase())) return;

      const start = computeNextStart(meta);
      if (!start || !Number.isFinite(start)) return;

      if (!shouldAlert({ nowMs: now, startMs: start, beforeMinutes: settings.beforeMinutes })) return;

      const key = makeAlertKey({ fishName, startMs: start, beforeMinutes: settings.beforeMinutes });
      if (state.alerted.has(key)) return;
      state.alerted.set(key, start);

      const diff = start - now;
      const mins = Math.max(1, Math.ceil(diff / 60000));
      const msg = `${fishName} opens at ${formatLocalTime(start)} (in ~${mins} min)`;
      toast(msg);
      beep(settings);
      desktopNotify(settings, "FF14 fish alert", msg);
    });
  }

  function refreshMenu() {
    if (typeof GM_registerMenuCommand !== "function") return;
    if (state.canRefreshMenu) {
      for (const id of state.menuIds) {
        try {
          GM_unregisterMenuCommand(id);
        } catch {
          // no-op
        }
      }
      state.menuIds = [];
    }

    const settings = readSettings();
    const soundLabel = settings.sound ? "ON" : "OFF";
    const modeLabel = settings.useVisibleFish ? "AUTO (WEBSITE)" : "MANUAL";
    const desktopLabel = desktopEffectiveOn({
      desktopNotification: settings.desktopNotification,
      notificationSupported: ("Notification" in globalThis),
      permission: ("Notification" in globalThis) ? Notification.permission : "unsupported"
    }) ? "ON" : "OFF";
    const badgeLabel = settings.statusBadge ? "ON" : "OFF";

    const register = (label, handler) => {
      const id = GM_registerMenuCommand(label, handler);
      if (id !== undefined) state.menuIds.push(id);
    };

    register("Set alert advance notice (minutes)", () => {
      const s = readSettings();
      const value = prompt("Minutes before availability:", String(s.beforeMinutes ?? 10));
      if (value === null) return;
      const n = Number(value);
      if (!Number.isFinite(n) || n <= 0) return toast("Invalid number.");
      writeSettings({ ...s, beforeMinutes: n });
      toast(`Alert advance notice set to ${n} minute(s).`);
      renderStatus();
      if (state.canRefreshMenu) refreshMenu();
    });

    register(`Toggle tracking mode (currently: ${modeLabel})`, () => {
      const s = readSettings();
      const next = !s.useVisibleFish;
      writeSettings({ ...s, useVisibleFish: next });
      toast(`Tracking mode: ${next ? "auto (website)" : "manual fish list"}.`);
      renderStatus();
      if (state.canRefreshMenu) refreshMenu();
    });

    if (!settings.useVisibleFish) {
      register("Set tracked fish (comma separated)", () => {
        const s = readSettings();
        const value = prompt("Fish names (comma separated):", (s.fish || []).join(", "));
        if (value === null) return;
        writeSettings({ ...s, fish: normalizeFishList(value) });
        toast("Tracked fish updated.");
        renderStatus();
        if (state.canRefreshMenu) refreshMenu();
      });
    }

    register(`Toggle sound (currently: ${soundLabel})`, () => {
      const s = readSettings();
      const next = !s.sound;
      writeSettings({ ...s, sound: next });
      if (next) state.hasToastedAudioLocked = false;
      toast(`Sound ${next ? "enabled" : "disabled"}.`);
      renderStatus();
      if (state.canRefreshMenu) refreshMenu();
    });

    register(`Toggle desktop notifications (currently: ${desktopLabel})`, () => {
      const s = readSettings();
      const next = !s.desktopNotification;
      setDesktopNotificationsEnabled(next).then(() => {
        renderStatus();
        if (state.canRefreshMenu) refreshMenu();
      });
    });

    register(`Display status and options (currently: ${badgeLabel})`, () => {
      const s = readSettings();
      const next = !s.statusBadge;
      writeSettings({ ...s, statusBadge: next });
      if (next) toast("Status badge enabled.");
      renderStatus();
      if (state.canRefreshMenu) refreshMenu();
    });

    register("Request desktop notification permission", () => {
      maybeRequestNotificationPermission();
    });

    register("Unlock audio now", async () => {
      const ok = await unlockAudio();
      toast(ok ? "Audio unlocked." : "Could not unlock audio.");
      if (state.canRefreshMenu) refreshMenu();
    });

    register("Test alert", () => {
      const s = readSettings();
      toast("Test alert from FF14 fish userscript.");
      beep(s);
      desktopNotify(s, "FF14 fish alert", "Test notification");
    });
  }

  function setupMenu() {
    if (typeof GM_registerMenuCommand !== "function") return;
    refreshMenu();
  }

  ensureStyles();
  setupAudioUnlockHooks();
  setupMenu();
  setupDomObserver();
  window.addEventListener("storage", (event) => {
    const changed = handleStorageEventForSettings({
      state,
      eventKey: event.key,
      storageKey: STORAGE_KEY
    });
    if (!changed) return;
    renderStatus();
    if (state.canRefreshMenu) refreshMenu();
  });
  renderStatus();

  updateExactTimes();
  runAlerts();

  setInterval(runAlerts, 5000);
  setInterval(updateExactTimes, 30000);
})();
