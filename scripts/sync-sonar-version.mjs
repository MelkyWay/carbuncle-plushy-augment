import { readFile, writeFile } from "node:fs/promises";

const pkgPath = new URL("../package.json", import.meta.url);
const sonarPath = new URL("../sonar-project.properties", import.meta.url);

const pkgRaw = await readFile(pkgPath, "utf8");
const pkg = JSON.parse(pkgRaw.replace(/^\uFEFF/, ""));

let sonar = await readFile(sonarPath, "utf8");
sonar = sonar.replace(/^sonar\.projectVersion=.*$/m, `sonar.projectVersion=${pkg.version}`);

await writeFile(sonarPath, sonar, "utf8");
console.log(`Updated sonar.projectVersion to ${pkg.version}`);
