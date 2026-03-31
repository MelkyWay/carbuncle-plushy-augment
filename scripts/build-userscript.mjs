import { build } from "esbuild";
import { readFile } from "node:fs/promises";

const rawPkg = await readFile(new URL("../package.json", import.meta.url), "utf8");
const pkg = JSON.parse(rawPkg.replace(/^\uFEFF/, ""));

const channelArg = process.argv.find((arg) => arg.startsWith("--channel="));
const channelFromArg = channelArg ? channelArg.slice("--channel=".length) : "";
const channel = (channelFromArg || process.env.BUILD_CHANNEL) === "develop" ? "develop" : "stable";
const isDevelop = channel === "develop";

const scriptName = isDevelop
  ? "FF14 Carbuncle Plushy QoL (Develop)"
  : "FF14 Carbuncle Plushy QoL";
const namespace = isDevelop
  ? "carbuncleplushy-qol-develop"
  : "carbuncleplushy-qol";
const outputFile = isDevelop
  ? "ff14-carbuncle-plushy-qol-develop.user.js"
  : "ff14-carbuncle-plushy-qol.user.js";
const branch = isDevelop ? "develop" : "main";
const rawUrl = `https://raw.githubusercontent.com/MelkyWay/carbuncle-plushy-qol/${branch}/${outputFile}`;

const header = `// ==UserScript==
// @name         ${scriptName}
// @namespace    ${namespace}
// @version      ${pkg.version}
// @description  Adds exact availability times and pre-window alerts for selected fish.
// @match        https://ff14fish.carbuncleplushy.com/*
// @updateURL    ${rawUrl}
// @downloadURL  ${rawUrl}
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// ==/UserScript==
`;

await build({
  entryPoints: ["src/main.js"],
  outfile: outputFile,
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["es2020"],
  define: {
    __QOL_CHANNEL__: JSON.stringify(channel)
  },
  banner: { js: header }
});

console.log(`Built ${outputFile} (v${pkg.version}, channel=${channel})`);
