const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const samplesDir = path.join(root, "content", "samples");
const rawDir = path.join(root, "content", "raw");

fs.mkdirSync(rawDir, { recursive: true });

function sectionBetween(markdown, start, end) {
  const startIndex = markdown.indexOf(start);
  if (startIndex < 0) return "";
  const contentStart = startIndex + start.length;
  const endIndex = markdown.indexOf(end, contentStart);
  return markdown.slice(contentStart, endIndex >= 0 ? endIndex : undefined).trim();
}

function parseFrontmatter(markdown) {
  const match = markdown.match(/^# .+?\n\n---\n([\s\S]*?)\n---/);
  if (!match) return {};
  return match[1].split("\n").reduce((meta, line) => {
    const index = line.indexOf(":");
    if (index < 0) return meta;
    meta[line.slice(0, index).trim()] = line.slice(index + 1).trim().replace(/^"|"$/g, "");
    return meta;
  }, {});
}

fs.readdirSync(samplesDir)
  .filter((file) => file.endsWith(".md"))
  .sort()
  .forEach((file) => {
    const markdown = fs.readFileSync(path.join(samplesDir, file), "utf8");
    const meta = parseFrontmatter(markdown);
    const id = String(meta.id).padStart(3, "0");
    const original = sectionBetween(markdown, "## 原文", "## 朗读指导");
    if (!id || !meta.title || !original) {
      throw new Error(`Cannot extract original text from ${file}.`);
    }
    const output = path.join(rawDir, `${id}-${meta.title}.txt`);
    fs.writeFileSync(output, `${original}\n`, "utf8");
    console.log(path.relative(root, output));
  });
