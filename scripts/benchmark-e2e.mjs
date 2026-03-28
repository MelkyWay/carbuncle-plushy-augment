import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";

const DEFAULT_URL = "https://ff14fish.carbuncleplushy.com/";
const DEFAULT_WARM_ITERATIONS = 10;

function printUsage() {
  console.log(`Usage:
  node scripts/benchmark-e2e.mjs <baseline-script> <candidate-script> [url]

Examples:
  node scripts/benchmark-e2e.mjs scripts/perf/before-fixed.user.js ff14-carbuncle-plushy-qol.js
  node scripts/benchmark-e2e.mjs dist/old.user.js dist/new.user.js https://ff14fish.carbuncleplushy.com/
`);
}

function stripUserscriptHeader(source) {
  return source.replace(/^\uFEFF?\/\/ ==UserScript==[\s\S]*?^\/\/ ==\/UserScript==\s*/m, "");
}

function summarize(values) {
  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    count: values.length,
    avgMs: total / values.length,
    minMs: Math.min(...values),
    maxMs: Math.max(...values)
  };
}

function ratio(before, after) {
  if (!before || !after || !Number.isFinite(before) || !Number.isFinite(after) || after === 0) {
    return "n/a";
  }
  return `${(before / after).toFixed(1)}x`;
}

async function loadScriptContent(filePath) {
  const absolutePath = path.resolve(filePath);
  const source = await readFile(absolutePath, "utf8");
  return {
    absolutePath,
    content: stripUserscriptHeader(source)
  };
}

async function benchmarkScript(page, label, scriptContent, targetUrl, warmIterations) {
  await page.goto(targetUrl, { waitUntil: "networkidle" });
  await page.waitForSelector("table tbody tr", { state: "attached", timeout: 30000 });

  await page.evaluate(() => {
    localStorage.removeItem("ff14fish_aug_settings");
    document
      .querySelectorAll(".ff14fish-aug-exact, .ff14fish-aug-toast-wrap, .ff14fish-aug-status, #ff14fish-aug-style")
      .forEach((node) => node.remove());

    delete window.GM_getValue;
    delete window.GM_setValue;
    delete window.GM_registerMenuCommand;
    delete window.GM_unregisterMenuCommand;

    window.__benchIntervals = [];
    window.__benchOriginalSetInterval = window.setInterval.bind(window);
    window.__benchOriginalClearInterval = window.clearInterval.bind(window);
    window.setInterval = (fn, delay, ...args) => {
      const id = window.__benchIntervals.length + 1;
      window.__benchIntervals.push({ id, delay, fn, args });
      return id;
    };
    window.clearInterval = () => {};
  });

  const startedAt = Date.now();
  await page.addScriptTag({ content: scriptContent });
  const bootstrapMs = Date.now() - startedAt;

  const result = await page.evaluate(({ label, bootstrapMs, warmIterations }) => {
    function summarizeValues(values) {
      const total = values.reduce((sum, value) => sum + value, 0);
      return {
        count: values.length,
        avgMs: total / values.length,
        minMs: Math.min(...values),
        maxMs: Math.max(...values)
      };
    }

    function timeInterval(entry, iterations) {
      if (!entry) return null;
      const samples = [];
      for (let i = 0; i < iterations; i += 1) {
        const start = performance.now();
        entry.fn(...entry.args);
        samples.push(performance.now() - start);
      }
      return summarizeValues(samples);
    }

    const intervals = window.__benchIntervals || [];
    const runAlertsInterval = intervals.find((entry) => entry.delay === 5000);
    const updateExactTimesInterval = intervals.find((entry) => entry.delay === 30000);

    return {
      label,
      rows: document.querySelectorAll("table tbody tr").length,
      bootstrapMs,
      intervalDelays: intervals.map(({ delay }) => delay),
      exactNodes: document.querySelectorAll(".ff14fish-aug-exact").length,
      toastNodes: document.querySelectorAll(".ff14fish-aug-toast").length,
      hasStatus: Boolean(document.querySelector(".ff14fish-aug-status")),
      runAlertsWarm: timeInterval(runAlertsInterval, warmIterations),
      updateExactTimesWarm: timeInterval(updateExactTimesInterval, warmIterations)
    };
  }, { label, bootstrapMs, warmIterations });

  await page.evaluate(() => {
    if (window.__benchOriginalSetInterval) window.setInterval = window.__benchOriginalSetInterval;
    if (window.__benchOriginalClearInterval) window.clearInterval = window.__benchOriginalClearInterval;
  });

  return result;
}

function printResults(baseline, candidate, baselinePath, candidatePath) {
  console.log(`Compared:
  baseline:  ${baselinePath}
  candidate: ${candidatePath}
`);

  console.table([
    {
      variant: baseline.label,
      rows: baseline.rows,
      bootstrapMs: baseline.bootstrapMs,
      runAlertsWarmAvgMs: baseline.runAlertsWarm?.avgMs ?? null,
      updateExactTimesWarmAvgMs: baseline.updateExactTimesWarm?.avgMs ?? null
    },
    {
      variant: candidate.label,
      rows: candidate.rows,
      bootstrapMs: candidate.bootstrapMs,
      runAlertsWarmAvgMs: candidate.runAlertsWarm?.avgMs ?? null,
      updateExactTimesWarmAvgMs: candidate.updateExactTimesWarm?.avgMs ?? null
    }
  ]);

  console.log("Details:", {
    baseline,
    candidate
  });

  console.log("Speedups vs baseline:", {
    bootstrap: ratio(baseline.bootstrapMs, candidate.bootstrapMs),
    runAlertsWarm: ratio(baseline.runAlertsWarm?.avgMs, candidate.runAlertsWarm?.avgMs),
    updateExactTimesWarm: ratio(baseline.updateExactTimesWarm?.avgMs, candidate.updateExactTimesWarm?.avgMs)
  });
}

async function main() {
  const [baselineArg, candidateArg, urlArg] = process.argv.slice(2);

  if (!baselineArg || !candidateArg || baselineArg === "--help" || baselineArg === "-h") {
    printUsage();
    process.exitCode = baselineArg ? 0 : 1;
    return;
  }

  const targetUrl = urlArg || DEFAULT_URL;
  const [baselineScript, candidateScript] = await Promise.all([
    loadScriptContent(baselineArg),
    loadScriptContent(candidateArg)
  ]);

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (error) {
    console.error("Could not launch Chromium via Playwright.");
    console.error("If this is the first run, install the browser with: npx playwright install chromium");
    throw error;
  }

  try {
    const page = await browser.newPage();
    const baseline = await benchmarkScript(
      page,
      "baseline",
      baselineScript.content,
      targetUrl,
      DEFAULT_WARM_ITERATIONS
    );
    const candidate = await benchmarkScript(
      page,
      "candidate",
      candidateScript.content,
      targetUrl,
      DEFAULT_WARM_ITERATIONS
    );

    printResults(baseline, candidate, baselineScript.absolutePath, candidateScript.absolutePath);
  } finally {
    await browser?.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
