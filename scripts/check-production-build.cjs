const { existsSync, readFileSync, readdirSync, statSync } = require("node:fs");

// GoDaddy promotes the preview build. Check the extracted release before Next listens.
try {
  const buildId = readFileSync(".next/BUILD_ID", "utf8").trim();
  if (!buildId) throw new Error("Empty .next/BUILD_ID");
  const requiredFiles = [
    ".next/routes-manifest.json",
    ".next/server/app-paths-manifest.json",
    ".next/server/app/page.js",
  ];
  for (const file of requiredFiles) {
    if (!statSync(file).isFile()) throw new Error(`Expected a file at ${file}`);
  }
  if (!readdirSync(".next/static/chunks").some(name => name.endsWith(".js"))) {
    throw new Error("No JavaScript chunks in .next/static/chunks");
  }
  if (!existsSync("public/images/pebbles-mark-black-transparent.svg")) {
    console.warn("[startup] Storefront logo missing. Check that public was included in the release.");
  }
  console.info(`[startup] Node ${process.version}, Next build ${buildId}`);
} catch (error) {
  console.error(`[startup] Incomplete production release: ${error.message}. Run npm run build in the build phase and include .next and public in the release.`);
  process.exitCode = 1;
}
