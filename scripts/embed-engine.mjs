import fs from "node:fs";
import path from "node:path";

const rootDirectory = process.cwd();
const indexPath = path.join(rootDirectory, "index.html");
const bundlePath = path.join(rootDirectory, "dist", "visual-novel-engine.js");
const startMarker = "  <!-- VN_ENGINE_BUNDLE_START -->";
const endMarker = "  <!-- VN_ENGINE_BUNDLE_END -->";

const html = fs.readFileSync(indexPath, "utf8");
const bundle = fs.readFileSync(bundlePath, "utf8");
const engineBlock = `${startMarker}\n  <script>\n${bundle}\n  </script>\n${endMarker}`;

let nextHtml;

if (html.includes(startMarker) && html.includes(endMarker)) {
  const startIndex = html.indexOf(startMarker);
  const endIndex = html.indexOf(endMarker) + endMarker.length;
  nextHtml = `${html.slice(0, startIndex)}${engineBlock}${html.slice(endIndex)}`;
} else {
  const firstScriptIndex = html.indexOf("  <script>");

  if (firstScriptIndex === -1) {
    throw new Error("index.html에서 삽입할 <script> 위치를 찾지 못했습니다.");
  }

  nextHtml = `${html.slice(0, firstScriptIndex)}${engineBlock}\n${html.slice(firstScriptIndex)}`;
}

fs.writeFileSync(indexPath, nextHtml);
console.log(`embedded ${path.relative(rootDirectory, bundlePath)} into ${path.relative(rootDirectory, indexPath)}`);
