import { describe, it, expect } from "vitest";
import {
  normalizeFishList,
  computeNextStartFromValues,
  shouldAlert,
  makeAlertKey,
  pruneAlertedMap,
  desktopEffectiveOn
} from "../src/core.js";

describe("normalizeFishList", () => {
  it("splits, trims, and drops empties", () => {
    expect(normalizeFishList("Mahar,  Starscryer, , Opabinia ")).toEqual([
      "Mahar",
      "Starscryer",
      "Opabinia"
    ]);
  });

  it("handles nullish input", () => {
    expect(normalizeFishList(null)).toEqual([]);
    expect(normalizeFishList(undefined)).toEqual([]);
  });
});

describe("computeNextStartFromValues", () => {
  it("returns current timestamp for 'in ...' rows", () => {
    expect(
      computeNextStartFromValues({
        currentText: "in 14 minutes",
        currentVal: 1700000000000,
        upcomingVal: 1700000300000,
        upcomingPrevClose: 1699999999999
      })
    ).toBe(1700000000000);
  });

  it("returns upcoming when closes-row prevclose matches", () => {
    expect(
      computeNextStartFromValues({
        currentText: "closes in 3 minutes",
        currentVal: 1700000000000,
        upcomingVal: 1700000300000,
        upcomingPrevClose: 1700000000000
      })
    ).toBe(1700000300000);
  });

  it("falls back to upcoming if prevclose missing but upcoming is in the future", () => {
    expect(
      computeNextStartFromValues({
        currentText: "closes in 3 minutes",
        currentVal: 1700000000000,
        upcomingVal: 1700000300000,
        upcomingPrevClose: undefined
      })
    ).toBe(1700000300000);
  });

  it("returns null when closes-row fallback upcoming is not in the future", () => {
    expect(
      computeNextStartFromValues({
        currentText: "closes in 3 minutes",
        currentVal: 1700000300000,
        upcomingVal: 1700000000000,
        upcomingPrevClose: undefined
      })
    ).toBeNull();
  });

  it("returns null for unrecognized/invalid data", () => {
    expect(
      computeNextStartFromValues({
        currentText: "available now",
        currentVal: 1700000000000,
        upcomingVal: 1700000300000,
        upcomingPrevClose: 1700000000000
      })
    ).toBeNull();

    expect(
      computeNextStartFromValues({
        currentText: "in 5 minutes",
        currentVal: "not-a-number",
        upcomingVal: 1700000300000,
        upcomingPrevClose: 1700000000000
      })
    ).toBeNull();
  });
});

describe("shouldAlert", () => {
  const now = 1700000000000;

  it("alerts when start is inside lead window", () => {
    expect(shouldAlert({ nowMs: now, startMs: now + 9 * 60000, beforeMinutes: 10 })).toBe(true);
  });

  it("does not alert when already started", () => {
    expect(shouldAlert({ nowMs: now, startMs: now - 1000, beforeMinutes: 10 })).toBe(false);
  });

  it("does not alert when outside lead window", () => {
    expect(shouldAlert({ nowMs: now, startMs: now + 11 * 60000, beforeMinutes: 10 })).toBe(false);
  });

  it("alerts exactly at the boundary", () => {
    expect(shouldAlert({ nowMs: now, startMs: now + 10 * 60000, beforeMinutes: 10 })).toBe(true);
  });

  it("defaults invalid lead time to 10 minutes", () => {
    expect(shouldAlert({ nowMs: now, startMs: now + 30000, beforeMinutes: 0 })).toBe(true);
    expect(shouldAlert({ nowMs: now, startMs: now + 9 * 60000, beforeMinutes: 0 })).toBe(true);
    expect(shouldAlert({ nowMs: now, startMs: now + 11 * 60000, beforeMinutes: 0 })).toBe(false);
  });
});

describe("makeAlertKey", () => {
  it("builds stable keys", () => {
    expect(makeAlertKey({ fishName: "Mahar", startMs: 1700, beforeMinutes: 10 })).toBe("[\"Mahar\",1700,10]");
  });

  it("handles fish names containing separators safely", () => {
    expect(makeAlertKey({ fishName: "fish|name", startMs: 1700, beforeMinutes: 10 })).toBe("[\"fish|name\",1700,10]");
  });
});

describe("pruneAlertedMap", () => {
  it("removes stale entries and keeps recent ones", () => {
    const now = 1700000000000;
    const m = new Map([
      ["old", now - 7 * 60 * 60 * 1000],
      ["new", now - 60 * 1000]
    ]);
    const ret = pruneAlertedMap(m, now, 6);
    expect([...m.keys()]).toEqual(["new"]);
    expect(ret).toBeUndefined();
  });
});

describe("desktopEffectiveOn", () => {
  it("is true only when enabled + supported + granted", () => {
    expect(desktopEffectiveOn({ desktopNotification: true, notificationSupported: true, permission: "granted" })).toBe(true);
    expect(desktopEffectiveOn({ desktopNotification: true, notificationSupported: true, permission: "denied" })).toBe(false);
    expect(desktopEffectiveOn({ desktopNotification: true, notificationSupported: false, permission: "granted" })).toBe(false);
    expect(desktopEffectiveOn({ desktopNotification: false, notificationSupported: true, permission: "granted" })).toBe(false);
    expect(desktopEffectiveOn({ desktopNotification: true, notificationSupported: true, permission: "default" })).toBe(false);
  });
});
