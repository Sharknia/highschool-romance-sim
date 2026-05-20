import { createReadStream, existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { basename, extname, join, normalize } from "node:path";
import { handleApiRequest } from "./handlers.js";

const clientRoot = join(process.cwd(), "dist/client");
const generatedAssetsRoot = process.env.VN_MAKER_GENERATED_DIR || join(process.cwd(), "generated-assets");
const port = Number(process.env.PORT || 5174);

const contentTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  return raw ? JSON.parse(raw) : undefined;
}

async function sendJson(response: ServerResponse, status: number, body: unknown): Promise<void> {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body, null, 2));
}

async function handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = new URL(request.url || "/", `http://${request.headers.host || "127.0.0.1"}`);

  if (url.pathname === "/favicon.ico") {
    response.writeHead(204);
    response.end();
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    const apiResponse = await handleApiRequest({
      method: request.method || "GET",
      path: url.pathname,
      body: request.method === "POST" ? await readJsonBody(request) : undefined
    });
    await sendJson(response, apiResponse.status, apiResponse.body);
    return;
  }

  if (url.pathname.startsWith("/generated-assets/")) {
    const filePath = join(generatedAssetsRoot, basename(url.pathname));
    if (!filePath.startsWith(generatedAssetsRoot) || !existsSync(filePath)) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Generated asset not found");
      return;
    }

    response.writeHead(200, { "Content-Type": contentTypes[extname(filePath)] || "image/png" });
    createReadStream(filePath).pipe(response);
    return;
  }

  const safePath = normalize(url.pathname === "/" ? "/index.html" : url.pathname).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = join(clientRoot, safePath);

  if (!filePath.startsWith(clientRoot) || !existsSync(filePath)) {
    const indexPath = join(clientRoot, "index.html");
    const method = request.method || "GET";
    if ((method === "GET" || method === "HEAD") && !extname(url.pathname) && existsSync(indexPath)) {
      response.writeHead(200, { "Content-Type": contentTypes[".html"] });
      if (method === "HEAD") {
        response.end();
      } else {
        createReadStream(indexPath).pipe(response);
      }
      return;
    }

    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  response.writeHead(200, { "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream" });
  createReadStream(filePath).pipe(response);
}

if (process.argv[1]?.endsWith("server.js")) {
  if (!existsSync(join(clientRoot, "index.html"))) {
    await readFile(join(clientRoot, "index.html")).catch(() => {
      throw new Error("client build가 없습니다. 먼저 npm run build -w @vn-maker/web 실행이 필요합니다.");
    });
  }

  createServer((request, response) => {
    handleRequest(request, response).catch((error: unknown) => {
      response.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }));
    });
  }).listen(port, "127.0.0.1", () => {
    process.stdout.write(`VN Maker web app listening on http://127.0.0.1:${port}\n`);
  });
}
