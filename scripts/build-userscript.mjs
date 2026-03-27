import { build } from "esbuild";
import { readFile } from "node:fs/promises";

const rawPkg = await readFile(new URL("../package.json", import.meta.url), "utf8");
const pkg = JSON.parse(rawPkg.replace(/^\uFEFF/, ""));

const header = `// ==UserScript==
// @name         FF14 Fish Tracker - Exact Times + Alerts
// @namespace    carbuncleplushy-augment
// @version      ${pkg.version}
// @description  Adds exact availability times and pre-window alerts for selected fish.
// @match        https://ff14fish.carbuncleplushy.com/*
// @updateURL    https://raw.githubusercontent.com/MelkyWay/carbuncle-plushy-augment/main/ff14-carbuncle-plushy-augment.js
// @downloadURL  https://raw.githubusercontent.com/MelkyWay/carbuncle-plushy-augment/main/ff14-carbuncle-plushy-augment.js
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// ==/UserScript==
`;

await build({
  entryPoints: ["src/main.js"],
  outfile: "ff14-carbuncle-plushy-augment.js",
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["es2020"],
  banner: { js: header }
});

console.log(`Built ff14-carbuncle-plushy-augment.js (v${pkg.version})`);
