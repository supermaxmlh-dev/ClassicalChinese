const http = require("http");
const fs = require("fs");
const path = require("path");
const { handleFeedbackRequest } = require("../api/shared/feedback");

const root = path.resolve(__dirname, "..");
const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 8080);
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8"
};

function send(res, status, headers, body) {
  res.writeHead(status, {
    "Cache-Control": "no-store",
    ...headers
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => {
      chunks.push(chunk);
      if (Buffer.concat(chunks).length > 32 * 1024) {
        reject(new Error("Request body too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      const text = Buffer.concat(chunks).toString("utf8");
      if (!text) {
        resolve(null);
        return;
      }
      try {
        resolve(JSON.parse(text));
      } catch (error) {
        resolve(text);
      }
    });
    req.on("error", reject);
  });
}

async function handleApi(req, res) {
  if (new URL(req.url, `http://${req.headers.host}`).pathname !== "/api/feedback") {
    send(res, 404, { "Content-Type": "application/json; charset=utf-8" }, JSON.stringify({ ok: false, message: "Not found." }));
    return;
  }
  try {
    const result = await handleFeedbackRequest({
      method: req.method,
      headers: req.headers,
      body: await readBody(req)
    });
    send(res, result.status, result.headers, JSON.stringify(result.body));
  } catch (error) {
    send(res, 500, { "Content-Type": "application/json; charset=utf-8" }, JSON.stringify({ ok: false, message: "Local API error." }));
  }
}

function safeFilePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const normalized = path.normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  const relative = normalized === "/" ? "index.html" : normalized.replace(/^[/\\]+/, "");
  const filePath = path.join(root, relative);
  if (!filePath.startsWith(root)) return null;
  return filePath;
}

function handleStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let filePath = safeFilePath(url.pathname);
  if (!filePath) {
    send(res, 403, { "Content-Type": "text/plain; charset=utf-8" }, "Forbidden");
    return;
  }
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }
  if (!fs.existsSync(filePath)) {
    filePath = path.join(root, "index.html");
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      send(res, 500, { "Content-Type": "text/plain; charset=utf-8" }, "Internal Server Error");
      return;
    }
    const contentType = mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    send(res, 200, { "Content-Type": contentType }, data);
  });
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith("/api/")) {
    handleApi(req, res);
    return;
  }
  handleStatic(req, res);
});

server.listen(port, host, () => {
  console.log(`Guanzhi local full-stack server running at http://${host}:${port}/`);
  console.log("Static files and /api/feedback are served by this process.");
});
