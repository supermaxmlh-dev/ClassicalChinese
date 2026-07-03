const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "dist");

const entries = [
  "index.html",
  "pages",
  "css",
  "js",
  "data",
  "favicon.svg",
  "staticwebapp.config.json",
  "images",
];

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

for (const entry of entries) {
  const source = path.join(root, entry);
  if (!fs.existsSync(source)) continue;
  fs.cpSync(source, path.join(outDir, entry), {
    recursive: true,
    filter: (file) => path.basename(file) !== ".DS_Store",
  });
}

console.log(`Built static site artifact in ${path.relative(root, outDir)}/`);
