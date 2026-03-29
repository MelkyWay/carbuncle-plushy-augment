import { describe, it, expect } from "vitest";
import {
  phaseKeyFromCurrentText,
  makeExactCacheKey,
  isNodeInTable,
  isAugmentationNodeLike,
  markRowMetaDirty,
  handleStorageEventForSettings
} from "../src/main-helpers.js";

function makeElement({ id = "", selectors = {} } = {}) {
  return {
    nodeType: 1,
    id,
    closest(selector) {
      return selectors[selector] ? { selector } : null;
    }
  };
}

describe("exact-time cache key behavior", () => {
  it("treats countdown text changes as the same phase", () => {
    const a = makeExactCacheKey({
      currentVal: "1700000000000",
      upcomingVal: "1700000300000",
      currentText: "in 5 minutes"
    });
    const b = makeExactCacheKey({
      currentVal: "1700000000000",
      upcomingVal: "1700000300000",
      currentText: "in 4 minutes"
    });
    expect(a).toBe(b);
    expect(phaseKeyFromCurrentText("in 5 minutes")).toBe("opens");
  });

  it("changes key when phase changes (opens -> closes)", () => {
    const opens = makeExactCacheKey({
      currentVal: "1700000000000",
      upcomingVal: "1700000300000",
      currentText: "in 1 minute"
    });
    const closes = makeExactCacheKey({
      currentVal: "1700000000000",
      upcomingVal: "1700000300000",
      currentText: "closes in 1 minute"
    });
    expect(closes).not.toBe(opens);
    expect(phaseKeyFromCurrentText("closes in 1 minute")).toBe("closes");
  });
});

describe("mutation filtering helpers", () => {
  it("detects table-related nodes via closest(table)", () => {
    const inTable = makeElement({ selectors: { table: true } });
    const notInTable = makeElement();
    expect(isNodeInTable(inTable)).toBe(true);
    expect(isNodeInTable(notInTable)).toBe(false);
  });

  it("detects augmentation-owned nodes and style node", () => {
    const styleNode = makeElement({ id: "ff14fish-aug-style" });
    const augChild = makeElement({
      selectors: { ".ff14fish-aug-exact, .ff14fish-aug-toast-wrap, .ff14fish-aug-status": true }
    });
    const normalNode = makeElement();
    expect(isAugmentationNodeLike(styleNode)).toBe(true);
    expect(isAugmentationNodeLike(augChild)).toBe(true);
    expect(isAugmentationNodeLike(normalNode)).toBe(false);
  });
});

describe("row metadata invalidation", () => {
  it("marks row metadata dirty when present", () => {
    const row = {};
    const rowMeta = new WeakMap([[row, { dirty: false, visibilityDirty: false }]]);
    expect(markRowMetaDirty(rowMeta, row)).toBe(true);
    expect(rowMeta.get(row)).toEqual({ dirty: true, visibilityDirty: true });
  });

  it("returns false when no metadata exists", () => {
    const rowMeta = new WeakMap();
    expect(markRowMetaDirty(rowMeta, {})).toBe(false);
    expect(markRowMetaDirty(rowMeta, null)).toBe(false);
  });
});

describe("settings cache coherence on storage events", () => {
  it("invalidates cached settings when storage key matches", () => {
    const state = { settings: { sound: true } };
    const changed = handleStorageEventForSettings({
      state,
      eventKey: "ff14fish_aug_settings",
      storageKey: "ff14fish_aug_settings"
    });
    expect(changed).toBe(true);
    expect(state.settings).toBeNull();
  });

  it("does nothing when another key changes", () => {
    const state = { settings: { sound: true } };
    const changed = handleStorageEventForSettings({
      state,
      eventKey: "something_else",
      storageKey: "ff14fish_aug_settings"
    });
    expect(changed).toBe(false);
    expect(state.settings).toEqual({ sound: true });
  });
});
