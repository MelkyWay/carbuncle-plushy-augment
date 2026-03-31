function toElement(node) {
  if (!node) return null;
  if (node.nodeType === 1) return node;
  return node.parentElement || null;
}

function hasClosest(element, selector) {
  return Boolean(element && typeof element.closest === "function" && element.closest(selector));
}

export function phaseKeyFromCurrentText(currentText) {
  const loweredText = String(currentText || "").toLowerCase();
  if (loweredText.includes("closes")) return "closes";
  if (loweredText.startsWith("in ")) return "opens";
  return "event";
}

export function makeExactCacheKey({ currentVal, upcomingVal, currentText }) {
  return `${currentVal}|${upcomingVal}|${phaseKeyFromCurrentText(currentText)}`;
}

export function isNodeInTable(node) {
  const element = toElement(node);
  return hasClosest(element, "table");
}

export function isAugmentationNodeLike(node) {
  const element = toElement(node);
  if (!element) return false;
  if (element.id === "ff14fish-aug-style") return true;
  return hasClosest(element, ".ff14fish-aug-exact, .ff14fish-aug-toast-wrap, .ff14fish-aug-status");
}

export function hasTableRowStructureNode(nodes) {
  if (!Array.isArray(nodes)) return false;
  return nodes.some((node) => {
    if (!node || node.nodeType !== 1) return false;
    const hasRowMatch = typeof node.matches === "function" && node.matches("tr, tbody, table");
    const hasRowDescendant = typeof node.querySelector === "function" && Boolean(node.querySelector("tr"));
    return hasRowMatch || hasRowDescendant;
  });
}

export function isPrerequisiteFishRow(row) {
  if (!row || row.nodeType !== 1) return false;
  return /\bfish-intuition-row\b/.test(String(row.className || ""));
}

export function markRowMetaDirty(rowMeta, row) {
  if (!row) return false;
  const meta = rowMeta.get(row);
  if (!meta) return false;
  meta.dirty = true;
  meta.visibilityDirty = true;
  return true;
}

export function handleStorageEventForSettings({ state, eventKey, storageKey }) {
  if (eventKey !== storageKey) return false;
  state.settings = null;
  return true;
}
