// ==UserScript==
// @name         FF14 Fish Tracker - Exact Times + Alerts
// @namespace    carbuncleplushy-augment
// @version      1.8.0
// @description  Adds exact availability times and pre-window alerts for selected fish.
// @match        https://ff14fish.carbuncleplushy.com/*
// @updateURL    https://raw.githubusercontent.com/MelkyWay/carbuncle-plushy-augment/main/ff14-carbuncle-plushy-augment.js
// @downloadURL  https://raw.githubusercontent.com/MelkyWay/carbuncle-plushy-augment/main/ff14-carbuncle-plushy-augment.js
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// ==/UserScript==

(() => {
  // src/core.js
  function normalizeFishList(text) {
    return String(text || "").split(",").map((x) => x.trim()).filter(Boolean);
  }
  function computeNextStartFromValues({
    currentText,
    currentVal,
    upcomingVal,
    upcomingPrevClose
  }) {
    const curVal = Number(currentVal);
    if (!Number.isFinite(curVal)) return null;
    const curText = String(currentText || "").trim().toLowerCase();
    const upVal = Number(upcomingVal);
    const upPrev = Number(upcomingPrevClose);
    if (/^in\s+/.test(curText)) return curVal;
    if (/^closes\s+in\s+/.test(curText)) {
      if (Number.isFinite(upVal) && Number.isFinite(upPrev) && upPrev === curVal) {
        return upVal;
      }
      if (Number.isFinite(upVal) && upVal > curVal) {
        return upVal;
      }
    }
    return null;
  }
  function shouldAlert({ nowMs, startMs, beforeMinutes }) {
    const beforeMs = Math.max(1, Number(beforeMinutes) || 10) * 6e4;
    const diff = Number(startMs) - Number(nowMs);
    return diff > 0 && diff <= beforeMs;
  }
  function makeAlertKey({ fishName, startMs, beforeMinutes }) {
    return JSON.stringify([fishName, startMs, beforeMinutes]);
  }
  function pruneAlertedMap(alertedMap, nowMs, ttlHours = 6) {
    const staleCutoff = Number(nowMs) - Number(ttlHours) * 60 * 60 * 1e3;
    for (const [key, ts] of alertedMap.entries()) {
      if (ts < staleCutoff) alertedMap.delete(key);
    }
  }
  function desktopEffectiveOn({ desktopNotification, notificationSupported, permission }) {
    return Boolean(desktopNotification && notificationSupported && permission === "granted");
  }

  // src/main.js
  (() => {
    "use strict";
    const STORAGE_KEY = "ff14fish_aug_settings";
    const DEFAULTS = {
      fish: ["Mahar"],
      beforeMinutes: 10,
      sound: true,
      desktopNotification: true,
      useVisibleFish: true,
      toasts: true,
      statusBadge: true
    };
    const state = {
      alerted: /* @__PURE__ */ new Map(),
      rowCache: /* @__PURE__ */ new WeakMap(),
      audioCtx: null,
      audioUnlocked: false,
      hasToastedAudioLocked: false,
      hasToastedNotifBlocked: false,
      menuIds: [],
      canRefreshMenu: typeof GM_unregisterMenuCommand === "function"
    };
    function hasGM() {
      return typeof GM_getValue === "function" && typeof GM_setValue === "function";
    }
    function readSettings() {
      if (hasGM()) return { ...DEFAULTS, ...GM_getValue(STORAGE_KEY, {}) || {} };
      try {
        return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") };
      } catch {
        return { ...DEFAULTS };
      }
    }
    function writeSettings(next) {
      if (hasGM()) GM_setValue(STORAGE_KEY, next);
      else localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
    function formatLocalTime(ts) {
      return new Date(ts).toLocaleString([], {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      });
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
      const settings = readSettings();
      if (!settings.toasts) return;
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
      setTimeout(() => el.remove(), 9e3);
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
      const np = "Notification" in window ? Notification.permission : "unsupported";
      const ap = settings.sound ? state.audioUnlocked ? "on/unlocked" : "on/locked" : "off";
      const tracking = settings.useVisibleFish ? "auto (website)" : "manual";
      const toasts = settings.toasts ? "on" : "off";
      const desktop = desktopEffectiveOn({
        desktopNotification: settings.desktopNotification,
        notificationSupported: "Notification" in window,
        permission: np
      }) ? "on" : "off";
      el.textContent = `FFXIV Fish Ping
tracked: ${tracking}
sound: ${ap}
toasts: ${toasts}
desktop: ${desktop}
notif-perm: ${np}`;
    }
    function getAudioContext() {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      if (!state.audioCtx) state.audioCtx = new Ctx();
      return state.audioCtx;
    }
    async function unlockAudio() {
      const ctx = getAudioContext();
      if (!ctx) return false;
      try {
        if (ctx.state === "suspended") await ctx.resume();
        state.audioUnlocked = ctx.state === "running";
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
      }
    }
    function desktopNotify(settings, title, body) {
      if (!settings.desktopNotification || !("Notification" in window)) return;
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
      if (!("Notification" in window)) {
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
      const availCell = row.querySelector("td.fish-availability") || current?.closest("td") || upcoming?.closest("td") || null;
      return { fishName, fishLink, current, upcoming, availCell };
    }
    function isRowVisible(row) {
      return row.offsetParent !== null;
    }
    function getFishRows() {
      const tbodies = document.querySelectorAll("table tbody");
      const rows = [];
      tbodies.forEach((tbody) => {
        rows.push(...tbody.querySelectorAll("tr"));
      });
      return rows;
    }
    function computeNextStart(current, upcoming) {
      return computeNextStartFromValues({
        currentText: current?.textContent,
        currentVal: current?.dataset?.val,
        upcomingVal: upcoming?.dataset?.val,
        upcomingPrevClose: upcoming?.dataset?.prevclose
      });
    }
    function updateExactTimes() {
      const rows = getFishRows();
      rows.forEach((row) => {
        const { current, upcoming, availCell } = parseRow(row);
        if (!availCell) return;
        const curVal = current?.dataset?.val || "";
        const upVal = upcoming?.dataset?.val || "";
        const cacheKey = `${curVal}|${upVal}`;
        const prev = state.rowCache.get(row);
        if (prev === cacheKey) return;
        state.rowCache.set(row, cacheKey);
        let line = availCell.querySelector(".ff14fish-aug-exact");
        if (!line) {
          line = document.createElement("div");
          line.className = "ff14fish-aug-exact";
          availCell.appendChild(line);
        }
        const parts = [];
        if (curVal) {
          const currentText = (current.textContent || "").toLowerCase();
          const label = currentText.includes("closes") ? "Closes" : currentText.startsWith("in ") ? "Opens" : "Event";
          parts.push(`${label}: ${formatLocalTime(Number(curVal))}`);
        }
        if (upVal) parts.push(`Next: ${formatLocalTime(Number(upVal))}`);
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
        const { fishName, fishLink, current, upcoming } = parseRow(row);
        if (!fishName || !fishLink) return;
        if (settings.useVisibleFish && !isRowVisible(row)) return;
        if (!settings.useVisibleFish && !manualTracked.has(fishName.toLowerCase())) return;
        const start = computeNextStart(current, upcoming);
        if (!start || !Number.isFinite(start)) return;
        if (!shouldAlert({ nowMs: now, startMs: start, beforeMinutes: settings.beforeMinutes })) return;
        const key = makeAlertKey({ fishName, startMs: start, beforeMinutes: settings.beforeMinutes });
        if (state.alerted.has(key)) return;
        state.alerted.set(key, start);
        const diff = start - now;
        const mins = Math.max(1, Math.ceil(diff / 6e4));
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
          }
        }
        state.menuIds = [];
      }
      const settings = readSettings();
      const soundLabel = settings.sound ? "ON" : "OFF";
      const toastsLabel = settings.toasts ? "ON" : "OFF";
      const modeLabel = settings.useVisibleFish ? "AUTO (WEBSITE)" : "MANUAL";
      const desktopLabel = desktopEffectiveOn({
        desktopNotification: settings.desktopNotification,
        notificationSupported: "Notification" in window,
        permission: "Notification" in window ? Notification.permission : "unsupported"
      }) ? "ON" : "OFF";
      const badgeLabel = settings.statusBadge ? "ON" : "OFF";
      const register = (label, handler) => {
        const id = GM_registerMenuCommand(label, handler);
        if (id !== void 0) state.menuIds.push(id);
      };
      register("Set tracked fish (comma separated)", () => {
        const s = readSettings();
        const value = prompt("Fish names (comma separated):", (s.fish || []).join(", "));
        if (value === null) return;
        writeSettings({ ...s, fish: normalizeFishList(value) });
        toast("Tracked fish updated.");
        renderStatus();
        if (state.canRefreshMenu) refreshMenu();
      });
      register("Set alert lead time (minutes)", () => {
        const s = readSettings();
        const value = prompt("Minutes before availability:", String(s.beforeMinutes ?? 10));
        if (value === null) return;
        const n = Number(value);
        if (!Number.isFinite(n) || n <= 0) return toast("Invalid number.");
        writeSettings({ ...s, beforeMinutes: n });
        toast(`Alert lead time set to ${n} minute(s).`);
        renderStatus();
        if (state.canRefreshMenu) refreshMenu();
      });
      register(`Toggle sound (currently: ${soundLabel})`, () => {
        const s = readSettings();
        const next = !s.sound;
        writeSettings({ ...s, sound: next });
        if (next) state.hasToastedAudioLocked = false;
        toast(`Sound ${next ? "enabled" : "disabled"}.`);
        renderStatus();
        if (state.canRefreshMenu) refreshMenu();
      });
      register(`Toggle toasts (currently: ${toastsLabel})`, () => {
        const s = readSettings();
        const next = !s.toasts;
        writeSettings({ ...s, toasts: next });
        if (next) toast("Toasts enabled.");
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
      register(`Toggle desktop notifications (currently: ${desktopLabel})`, () => {
        const s = readSettings();
        const next = !s.desktopNotification;
        setDesktopNotificationsEnabled(next).then(() => {
          renderStatus();
          if (state.canRefreshMenu) refreshMenu();
        });
      });
      register(`Toggle status badge (currently: ${badgeLabel})`, () => {
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
      register("Show alert status", () => {
        renderStatus();
        const s = readSettings();
        const np = "Notification" in window ? Notification.permission : "unsupported";
        const tracking = s.useVisibleFish ? "auto (website)" : "manual";
        const desktop = desktopEffectiveOn({
          desktopNotification: s.desktopNotification,
          notificationSupported: "Notification" in window,
          permission: np
        }) ? "on" : "off";
        toast(`Tracked: ${tracking}, Sound: ${s.sound ? "on" : "off"}, Toasts: ${s.toasts ? "on" : "off"}, Desktop: ${desktop}, Notifications: ${np}`);
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
    renderStatus();
    updateExactTimes();
    runAlerts();
    setInterval(runAlerts, 5e3);
    setInterval(updateExactTimes, 3e4);
  })();
})();
