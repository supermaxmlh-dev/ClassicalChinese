const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dictionaryPath = path.join(root, "data", "dictionary.json");
const errors = [];
const PINYIN_PATTERN = /^[a-züāáǎàōóǒòēéěèīíǐìūúǔùǖǘǚǜńňǹḿ]+$/i;

function isHan(char) {
  return /^[\u3400-\u9fff]$/.test(char);
}

if (!fs.existsSync(dictionaryPath)) {
  errors.push("Missing data/dictionary.json.");
} else {
  const dictionary = JSON.parse(fs.readFileSync(dictionaryPath, "utf8"));
  if (!Array.isArray(dictionary.entries)) {
    errors.push("dictionary.entries must be an array.");
  } else {
    const seen = new Set();
    dictionary.entries.forEach((entry, index) => {
      if (!isHan(entry.char || "")) {
        errors.push(`dictionary.entries[${index}] has invalid char.`);
      }
      if (seen.has(entry.char)) {
        errors.push(`dictionary has duplicate char ${entry.char}.`);
      }
      seen.add(entry.char);
      if (!Array.isArray(entry.pinyin) || !entry.pinyin.length) {
        errors.push(`dictionary ${entry.char} must have pinyin.`);
      } else {
        entry.pinyin.forEach((py) => {
          if (!PINYIN_PATTERN.test(py)) errors.push(`dictionary ${entry.char} has invalid pinyin ${py}.`);
        });
      }
      if (Object.prototype.hasOwnProperty.call(entry, "radical")) {
        errors.push(`dictionary ${entry.char} should not include empty radical field.`);
      }
      if (!Array.isArray(entry.senses) || !entry.senses.length) {
        errors.push(`dictionary ${entry.char} must have senses.`);
      } else {
        entry.senses.forEach((sense, senseIndex) => {
          if (!String(sense.def || "").trim()) {
            errors.push(`dictionary ${entry.char} senses[${senseIndex}] has empty def.`);
          }
          if (!String(sense.word || "").trim()) {
            errors.push(`dictionary ${entry.char} senses[${senseIndex}] has empty word.`);
          }
          if (!String(sense.articleId || "").match(/^\d{3}$/)) {
            errors.push(`dictionary ${entry.char} senses[${senseIndex}] has invalid articleId.`);
          }
          if (String(sense.example || "").replace(/\s/g, "").length > 40) {
            errors.push(`dictionary ${entry.char} senses[${senseIndex}] example is too long.`);
          }
        });
      }
    });
    if (dictionary.entryCount !== dictionary.entries.length) {
      errors.push("dictionary.entryCount does not match entries length.");
    }
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

const dictionary = JSON.parse(fs.readFileSync(dictionaryPath, "utf8"));
console.log(`Dictionary OK: ${dictionary.entries.length} entries.`);
