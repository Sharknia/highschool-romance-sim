import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, extname, join, normalize } from "node:path";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { createApiApp, defaultGeneratedAssetsDirectory } from "./handlers.js";

const clientRoot = join(process.cwd(), "dist/client");
const generatedAssetsRoot = process.env.VN_MAKER_GENERATED_DIR || defaultGeneratedAssetsDirectory();
const port = Number(process.env.PORT || 5174);

const contentTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml"
};

async function fileResponse(filePath: string, fallbackContentType = "application/octet-stream"): Promise<Response> {
  const payload = await readFile(filePath);
  return new Response(payload, {
    status: 200,
    headers: { "Content-Type": contentTypes[extname(filePath)] || fallbackContentType }
  });
}

function notFound(message = "Not found"): Response {
  return new Response(message, {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8" }
  });
}

export function createWebApp(): Hono {
  const app = new Hono();
  app.route("/", createApiApp());

  app.get("/favicon.ico", () => new Response(null, { status: 204 }));

  app.get("/generated-assets/:file", async (context) => {
    const filePath = join(generatedAssetsRoot, basename(context.req.param("file")));
    if (!filePath.startsWith(generatedAssetsRoot) || !existsSync(filePath)) {
      return notFound("Generated asset not found");
    }
    return fileResponse(filePath, "image/png");
  });

  app.get("*", async (context) => {
    const url = new URL(context.req.url);
    const safePath = normalize(url.pathname === "/" ? "/index.html" : url.pathname).replace(/^(\.\.(\/|\\|$))+/, "");
    const filePath = join(clientRoot, safePath);

    if (filePath.startsWith(clientRoot) && existsSync(filePath)) {
      return fileResponse(filePath);
    }

    const indexPath = join(clientRoot, "index.html");
    if (!extname(url.pathname) && existsSync(indexPath)) {
      return fileResponse(indexPath, contentTypes[".html"]);
    }

    return notFound();
  });

  return app;
}

if (process.argv[1]?.endsWith("server.js")) {
  if (!existsSync(join(clientRoot, "index.html"))) {
    await readFile(join(clientRoot, "index.html")).catch(() => {
      throw new Error("client build가 없습니다. 먼저 npm run build -w @vn-maker/web 실행이 필요합니다.");
    });
  }

  serve({
    fetch: createWebApp().fetch,
    hostname: "127.0.0.1",
    port
  }, () => {
    process.stdout.write(`VN Maker web app listening on http://127.0.0.1:${port}\n`);
  });
}
