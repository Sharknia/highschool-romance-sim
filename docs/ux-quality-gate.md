# UX Quality Gate

VN Maker의 제작 UI는 사람이 반복해서 쓰는 로컬 데스크톱형 웹 앱이다. 기본 화면은 작업 판단과 다음 행동을 돕고, 원본 ID와 내부 상태는 진단 영역에 격리한다.

## 사용자 기본 화면

- 허용: 사용자가 이해할 수 있는 작업 상태, 연결 상태, 다음 행동, 검증 결과, 실패 원인 요약.
- 금지: raw asset id, job id, route id, scene id, DTO 필드명, provider/internal adapter 이름, 내부 API 코드.
- 금지 예시: `backgroundAssetId`, `imageGeneration 가능`, `runtime 플레이`, `availableState`, `provider 확인 필요`, `asset-...`, `job-...`.
- 버튼과 탭은 사용자가 실행할 수 있는 행동만 primary로 보여준다.

## 진단 전용 정보

- raw 저장 위치, raw ID, DTO 필드명, provider/internal adapter 이름, runtime JSON은 `DiagnosticDrawer` 또는 명시적인 개발자 상세 영역 안에서만 허용한다.
- 진단 summary는 사용자가 열기 전에도 의미를 알 수 있는 한국어로 쓴다.
- 진단 영역 밖의 본문은 raw 값을 조합하지 않고 표시 helper를 거친다.

## Workflow Domain State와 Display State

- domain state는 엔진/유스케이스의 사실을 보존한다.
- display state는 현재 화면에서 사용자가 이해해야 할 상태를 별도로 만든다.
- 미구현 기능이나 준비 중 기능은 domain state가 `done`이어도 완료 카운트에 포함하지 않는다.
- `ProjectDetailView`는 workflow 단계 렌더링 전 `displayWorkflowStep` 같은 표시 변환을 거친다.

## 반응형 검토 기준

- 390px: 탭은 가로 스캔 레일을 사용하고, 탭 항목은 최소 폭을 가진다. 상세 카드는 1열이다.
- 820px: 주요 탭은 3열 기준으로 압축되며, 카드와 버튼 텍스트가 겹치지 않는다.
- 1440px: overview, background, studio, preview, export의 주요 카드가 첫 화면에서 읽히고, 진단 영역은 접힌 상태로 유지된다.
- 버튼 텍스트는 부모 안에서 줄바꿈되거나 안정적인 최소 폭을 가져야 한다.

## 새 화면 체크리스트

- 기본 본문에 raw id, DTO 필드명, provider/internal adapter 이름이 없는가?
- raw 값이 필요하면 `DiagnosticDrawer` 안에만 있는가?
- domain state를 직접 사용자 문구로 쓰지 않고 display state/display label을 거치는가?
- 준비 중 기능이 완료 수치나 실행 가능한 primary action처럼 보이지 않는가?
- 390px, 820px, 1440px에서 탭, 카드, 버튼, 상태 문구가 겹치거나 옆으로 밀리지 않는가?
- UX 품질 게이트 테스트에 새 화면의 금지 패턴이 추가되었는가?
