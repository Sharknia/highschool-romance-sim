import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const metricsPath = join(root, "docs/qa/screenshots/phase0-studio-alignment-metrics.json");
const metrics = JSON.parse(readFileSync(metricsPath, "utf8"));

const expectedDesktop = {
  "1280x720": { route: 240, inspector: 320, problems: 180, command: 52 },
  "1366x768": { route: 260, inspector: 340, problems: 34, command: 52 },
  "1440x900": { route: 300, inspector: 380, problems: 220, command: 52 },
  "1920x1080": { route: 340, inspector: 420, problems: 220, command: 52 }
};

assert.match(metrics.url, /\/projects\/[^/]+\/studio$/, "metrics는 실제 Studio route에서 수집해야 합니다.");

for (const result of metrics.results) {
  assert.equal(result.horizontalOverflow, false, `${result.label} horizontal overflow 없어야 합니다.`);
  assert.equal(result.verticalOverflow, false, `${result.label} vertical overflow 없어야 합니다.`);
  assert.deepEqual(result.errors, [], `${result.label} browser/runtime/http 5xx error 없어야 합니다.`);
  assert.ok(existsSync(join(root, result.screenshot)), `${result.label} screenshot 파일이 있어야 합니다.`);
  assert.ok(statSync(join(root, result.screenshot)).size > 10_000, `${result.label} screenshot 파일이 비어 있으면 안 됩니다.`);

  if (result.label === "mobile-unsupported") {
    assert.equal(result.hasWorkspace, false, "mobile unsupported는 Studio workspace를 렌더링하면 안 됩니다.");
    assert.equal(result.hasUnsupported, true, "mobile unsupported 안내가 보여야 합니다.");
    assert.equal(result.includes.unsupportedDesktop, true, "mobile unsupported는 1280x720 기준 안내를 보여야 합니다.");
    continue;
  }

  const expected = expectedDesktop[result.label];
  assert.ok(expected, `${result.label}는 주요 desktop 해상도여야 합니다.`);
  assert.equal(result.hasWorkspace, true, `${result.label} workspace가 보여야 합니다.`);
  assert.equal(result.hasUnsupported, false, `${result.label} unsupported가 보이면 안 됩니다.`);
  assert.equal(result.rects.workspace.x, 56, `${result.label} 56px app rail 뒤에 Studio workspace가 시작해야 합니다.`);
  assert.equal(result.rects.workspace.y, 0, `${result.label} Studio workspace는 topbar 없이 y=0에서 시작해야 합니다.`);
  assert.equal(result.rects.route.width, expected.route, `${result.label} route panel width`);
  assert.equal(result.rects.inspector.width, expected.inspector, `${result.label} inspector width`);
  assert.equal(result.rects.problems.height, expected.problems, `${result.label} problems height`);
  assert.equal(result.rects.command.height, expected.command, `${result.label} command bar height`);
  assert.equal(result.rects.inspectorFirstTab.height, 40, `${result.label} inspector tab height`);
  assert.equal(result.includes.routeMap, true, `${result.label} 루트 맵 heading이 보여야 합니다.`);
  assert.equal(result.includes.stagePreview, true, `${result.label} 스테이지 미리보기 heading이 보여야 합니다.`);
  assert.equal(result.includes.scriptEditor, true, `${result.label} 스크립트 편집기 heading이 보여야 합니다.`);
  assert.equal(result.includes.inspector, true, `${result.label} 인스펙터 heading이 보여야 합니다.`);
  assert.equal(result.includes.problems, true, `${result.label} 문제 패널 heading이 보여야 합니다.`);
}
