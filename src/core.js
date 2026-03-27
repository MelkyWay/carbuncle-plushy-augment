export function normalizeFishList(text) {
  return String(text || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export function computeNextStartFromValues({
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

export function shouldAlert({ nowMs, startMs, beforeMinutes }) {
  const beforeMs = Math.max(1, Number(beforeMinutes) || 10) * 60000;
  const diff = Number(startMs) - Number(nowMs);
  return diff > 0 && diff <= beforeMs;
}

export function makeAlertKey({ fishName, startMs, beforeMinutes }) {
  return `${fishName}|${startMs}|${beforeMinutes}`;
}

export function pruneAlertedMap(alertedMap, nowMs, ttlHours = 6) {
  const staleCutoff = Number(nowMs) - (Number(ttlHours) * 60 * 60 * 1000);
  for (const [key, ts] of alertedMap.entries()) {
    if (ts < staleCutoff) alertedMap.delete(key);
  }
  return alertedMap;
}

export function desktopEffectiveOn({ desktopNotification, notificationSupported, permission }) {
  return Boolean(desktopNotification && notificationSupported && permission === "granted");
}
