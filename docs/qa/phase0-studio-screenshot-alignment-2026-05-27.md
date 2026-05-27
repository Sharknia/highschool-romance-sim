# Phase 0 Studio screenshot alignment review

검토일: 2026-05-27

기준 문서:
- Notion `VN Maker 씬 추가 수동 생성 UI/UX 기획서`
- 기준 URL: `https://www.notion.so/36d45e8947528196a238c920455faa75`
- 이번 최종 패스에서 Notion connector 재조회는 120초 timeout으로 실패했다. 요구사항은 같은 목표 수행 중 앞서 조회한 원문 기준으로 대조했다.

## 비교 기준 요약

| 기준 | 판정 기준 |
| --- | --- |
| 진입 route | `/projects/:projectId/studio`가 상세 shell chrome 없이 Studio workspace를 직접 렌더링한다. |
| 최소 viewport | `1280x720` 이상은 제작 workspace, 그보다 좁은 화면은 workspace 없이 미지원 안내를 보여준다. |
| desktop shell | 왼쪽 56px app rail 뒤에서 Studio가 `100vh`로 시작하고 기존 topbar/page padding을 노출하지 않는다. |
| 주요 해상도 | `1280x720`, `1366x768`, `1440x900`, `1920x1080`에서 가로/세로 overflow 없이 작업 영역이 들어간다. |
| 패널 기본값 | route/inspector/problems/command bar 크기가 해상도별 기획값과 일치한다. |
| 주요 문구 | 루트 맵, 스테이지 미리보기, 스크립트 편집기, 인스펙터, 문제 패널이 한국어 heading으로 보인다. |
| 제작자 기본 정보 | 기본 화면은 씬 ID 같은 기술 식별자보다 라벨, 화자, 장면 요약, 문제 상태를 우선 노출한다. |

## 검토 범위

- `/projects/:projectId/studio` 제작 워크스페이스 스크린샷과 기획서의 주요 해상도 기준을 비교했다.
- 주요 해상도는 `1280x720`, `1366x768`, `1440x900`, `1920x1080`이다.
- 모바일/좁은 화면은 제작 UI가 아니라 미지원 화면을 보여야 한다는 기준으로 `390x844`를 확인했다.
- 화면에 보이는 주요 줄글은 command bar, 루트 맵, 스테이지 미리보기, 스크립트 편집기, 인스펙터, 문제 패널 문구를 중심으로 비교했다.

## 발견 차이와 수정

| 항목 | 발견한 차이 | 수정 |
| --- | --- | --- |
| Studio shell | 기존 앱 topbar, 넓은 left nav, page padding 안에서 Studio가 시작되어 `1280x720`에서도 세로 스크롤이 생겼다. | Studio route 전용 shell을 추가해 topbar를 숨기고 56px app rail + 100vh workspace로 렌더링했다. |
| 해상도별 패널 폭 | 기본 layout이 모든 desktop 크기에서 route 240px, inspector 320px으로 고정되어 `1366/1440/1920` 기준과 달랐다. | `studioDefaultLayoutForViewport()`를 추가해 1366: 260/340, 1440: 300/380, 1920: 340/420을 적용했다. |
| 1280 compact | `1280x720`에서 problems panel 높이가 220px 기본값이라 compact 180px 기준과 달랐다. | 1280 기본 problems 높이를 180px로 조정했다. |
| 1366 default | `1366x768`은 problems collapsed default여야 하는데 열림 상태였다. | 1366 기본값을 collapsed 34px로 조정했다. |
| layout controls | 별도 layout controls row가 command bar 아래에 항상 보여 기획서의 52px command bar + main split 기준을 깨뜨렸다. | layout controls를 Diagnostics 안으로 이동했다. |
| command bar | command bar 높이가 auto/min-height였고 1280에서 상태 문구가 두 줄로 쪼개졌다. | command bar를 52px 고정하고 상태 문구를 말줄임 처리했다. |
| visible labels | `Route flow map`, `Stage preview`, `Script editor`, `Inspector`, `Problems` 등 영어 heading과 `연결/표시` 탭이 섞여 있었다. | 화면 heading을 `루트 맵`, `스테이지 미리보기`, `스크립트 편집기`, `인스펙터`, `문제 패널`로 조정하고 탭을 `선택지`, `에셋`으로 맞췄다. |
| inspector tabs | 1920 화면에서 inspector tabs가 40px이 아니라 남는 높이를 차지해 세로로 늘어났다. | inspector grid row를 toolbar/tabs/body로 분리하고 tab button 높이를 40px로 고정했다. |
| clamp 범위 | route/inspector/problems resize 범위가 기획서의 min/max와 달랐다. | route 240-420, inspector 320-520, problems 96-40vh로 조정했다. |

## 재검증 결과

측정 파일: `docs/qa/screenshots/phase0-studio-alignment-metrics.json`

| 해상도 | route | inspector | problems | command | overflow | 스크린샷 |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| 1280x720 | 240px | 320px | 180px | 52px | x 없음, y 없음 | `docs/qa/screenshots/phase0-studio-1280x720.png` |
| 1366x768 | 260px | 340px | 34px collapsed | 52px | x 없음, y 없음 | `docs/qa/screenshots/phase0-studio-1366x768.png` |
| 1440x900 | 300px | 380px | 220px | 52px | x 없음, y 없음 | `docs/qa/screenshots/phase0-studio-1440x900.png` |
| 1920x1080 | 340px | 420px | 220px | 52px | x 없음, y 없음 | `docs/qa/screenshots/phase0-studio-1920x1080.png` |
| 390x844 | workspace 없음 | workspace 없음 | workspace 없음 | workspace 없음 | x 없음, y 없음 | `docs/qa/screenshots/phase0-studio-mobile-unsupported.png` |

## 확인한 화면 문구

- `루트 맵`, `스테이지 미리보기`, `스크립트 편집기`, `인스펙터`, `문제 패널`이 주요 desktop 해상도에서 모두 보인다.
- `390x844`에서는 제작 workspace 대신 `1280x720 이상` 미지원 안내가 보인다.
- command bar 상태 문구는 `1280x720`에서 줄바꿈 없이 52px 안에 들어간다.

## 남은 제품 범위

- 이번 수정은 스크린샷/해상도/주요 줄글 정합성 보정이다.
- Route map의 실제 graph edge, Problems panel filter tabs, undo/redo history 동작 같은 기능 확장은 별도 구현 범위로 남아 있다.
