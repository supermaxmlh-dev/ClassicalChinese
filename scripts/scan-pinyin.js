const fs = require("fs");
const path = require("path");

const dir = path.resolve(__dirname, "../data/articles");
const watch = ["食", "王", "衣", "雨", "语", "重", "数", "骑", "说", "见", "知", "女", "邪", "不", "召", "与", "夫", "恶", "创", "妻", "饮", "朝", "暮", "夕", "晓", "晨", "中", "冠"];

for (const file of fs.readdirSync(dir).filter((name) => /^\d{3}\.json$/.test(name)).sort()) {
  const article = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
  const plain = article.fullTextPlain;
  article.rubyAnnotations.forEach((ruby) => {
    if (watch.includes(ruby.char)) {
      const ctx = plain.slice(Math.max(0, ruby.pos - 3), ruby.pos + 4).replace(/\n/g, "");
      console.log(`${article.id} ${ruby.char}->${ruby.pinyin}  ...${ctx}...`);
    }
  });
}
