import { build } from "esbuild";
import { readFile } from "node:fs/promises";

const rawPkg = await readFile(new URL("../package.json", import.meta.url), "utf8");
const pkg = JSON.parse(rawPkg.replace(/^\uFEFF/, ""));

const header = `// ==UserScript==
// @name         FF14 Carbuncle Plushy QoL
// @namespace    carbuncleplushy-qol
// @version      ${pkg.version}
// @description  Adds exact availability times and pre-window alerts for selected fish.
// @match        https://ff14fish.carbuncleplushy.com/*
// @updateURL    https://raw.githubusercontent.com/MelkyWay/carbuncle-plushy-qol/main/ff14-carbuncle-plushy-qol.user.js
// @downloadURL  https://raw.githubusercontent.com/MelkyWay/carbuncle-plushy-qol/main/ff14-carbuncle-plushy-qol.user.js
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// ==/UserScript==
`;

await build({
  entryPoints: ["src/main.js"],
  outfile: "ff14-carbuncle-plushy-qol.user.js",
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["es2020"],
  banner: { js: header }
});

console.log(`Built ff14-carbuncle-plushy-qol.user.js (v${pkg.version})`);
