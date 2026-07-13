# Requirement Review — §1.2 출력 포트 드래그 → 빈 영역 드롭 자동 노드 추가+연결

## 발견사항

- **[WARNING]** spec 본문(`spec/3-workflow-editor/2-edge.md` §1.2)이 구현 완료 상태를 반영하지 못하고 여전히 "미구현 · Planned" 로 남아 있음
  - 위치: `spec/3-workflow-editor/2-edge.md` L32-37 (`### 1.2 빈 영역 드롭 시 (미구현 · Planned)` 헤더 및 `> 현재 구현: ... 아직 없다.` 각주)
  - 상세: 이번 변경(`workflow-canvas.tsx` `onConnectEnd` + `edge-utils.ts` `isConnectionDroppedOnPane`/`firstInputHandleId`)은 `plan/in-progress/spec-sync-edge-gaps.md` 의 §1.2 체크박스를 `[ ]` → `[x]` 로 갱신하며 "구현 완료" 로 표기했지만, 정작 SoT 인 `spec/3-workflow-editor/2-edge.md` 자체의 §1.2 절은 이 커밋에 포함되지 않아 헤더가 여전히 "(미구현 · Planned)"이고 각주가 "출력 포트 드래그→빈 영역 드롭에 따른 팝업 표시·자동 엣지 연결(`onConnectEnd` 핸들러)은 아직 없다" 는 stale 서술을 유지한다. 이 문서는 두 파일(`workflow-canvas.tsx`, `edge-utils.ts`)을 frontmatter `code:` 목록으로 이미 참조하고 있어 구현 상태 갱신의 1차 대상이다. 구현 자체는 spec 본문이 요구한 행위(§1.2 두 불릿: "노드 추가 검색 팝업 표시" / "노드 선택 시 해당 노드 생성 + 자동 엣지 연결")를 정확히 충족하므로 코드 결함이 아니라 문서 동기화 누락이다.
  - 제안: 코드 되돌리기 불필요 — `project-planner`/`resolution-applier` 경로로 `spec/3-workflow-editor/2-edge.md` §1.2 헤더에서 "(미구현 · Planned)" 제거하고 `> 현재 구현:` 각주를 실제 구현(React Flow v12 `connectionState.isValid`/`fromNode`/`fromHandle` 기반 `onConnectEnd`, `NodeSearchPopupState.source`, `handleAddNodeFromSearch` 자동연결)으로 갱신 필요. 나머지 §1.3/§3.2/§4/§5 항목은 그대로 미구현이라 `status: partial` 은 유지.

- **[WARNING]** `firstInputHandleId` 가 첫 입력 포트를 항상 안전 target 으로 가정하는 주석("source→새 노드 조합은 자기연결·중복이 될 수 없어 onConnect 검증을 항상 통과한다")이 컨테이너 노드의 실제 포트 순서에 암묵적으로 의존
  - 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` L777-779 (주석), `codebase/frontend/src/lib/utils/edge-utils.ts` `firstInputHandleId`
  - 상세: `onConnect` 내부 `detectContainerConflict` (`editor-store.ts` L242-266)는 target 이 컨테이너이고 `targetHandle === 'emit'` 이면서 source 가 이미 다른 컨테이너 소속이면 연결을 거부하고 에러 토스트를 띄운다. `firstInputHandleId` 가 반환하는 값이 우연히 `'emit'` 이 되는 컨테이너 타입이 생기면(현재는 `loop`/`map`/`foreach` 스키마 모두 `inputs: [{id:'in'}, {id:'emit'}]` 순서라 `'in'` 이 항상 먼저 옴을 확인함 — `codebase/backend/src/nodes/logic/{loop,map,foreach}/*.schema.ts`), 이미 생성된 새 노드가 엣지 없이 캔버스에 orphan 상태로 남고 사용자는 이유를 알기 어려운 에러 토스트만 본다. 현재 데이터로는 실제로 발생하지 않지만, 주석의 "항상 통과한다" 는 이 포트 순서 관례에 암묵적으로 의존하는 단언이라 향후 신규 컨테이너/포트 스키마 추가 시 조용히 깨질 수 있다.
  - 제안: 주석에 "포트 정의 관례(`in` 이 항상 첫 입력)에 의존" 이라고 명시하거나, `firstInputHandleId` 대신 `'body'`/`'emit'` 같은 예약 포트 id 를 명시적으로 제외하는 선택 로직으로 강화. 최소한 이 가정이 깨졌을 때 orphan 노드가 남지 않도록(예: 연결 실패 시 노드도 롤백하거나 토스트에 "노드는 생성됨" 안내 추가) 방어적 처리 고려.

- **[INFO]** `isConnectionDroppedOnPane` 이 "pane" 이라는 이름과 달리 실제로는 드롭 위치가 아니라 `connectionState.isValid` 값만으로 판정
  - 위치: `codebase/frontend/src/lib/utils/edge-utils.ts` `isConnectionDroppedOnPane`
  - 상세: 함수명은 "빈 캔버스 pane 에 드롭됐는가" 를 시사하지만 실제로는 `!isValid` 판정이라, 출력 포트 드래그를 유효하지 않은 위치(예: 다른 기존 노드 몸통 위, 핸들이 아닌 지점)에 드롭해도 동일하게 "pane 드롭"으로 취급돼 그 좌표에 노드 검색 팝업이 뜬다. 다만 이는 React Flow 공식 문서의 "Add node on edge drop" 예제와 동일한 패턴(`!connectionState.isValid` 만 검사)이라 프레임워크 관례를 따른 것으로 보이며, spec §1.2 본문도 "빈 영역"과 "유효하지 않은 target" 을 구분해 명시하지 않는다. 회색지대이므로 차단 사유는 아님.
  - 제안: 필요시 spec §1.2 본문에 "기존 노드 위 드롭도 동일하게 취급" 여부를 명시해 함수명-동작 불일치 소지를 줄일 수 있음 (선택사항).

## 요약
`onConnectEnd` 배선과 `handleAddNodeFromSearch` 의 자동 엣지 연결 로직은 spec §1.2 가 요구하는 두 가지 행위(빈 영역 드롭 시 검색 팝업, 노드 선택 시 생성+자동연결)를 정확히 구현하며, `buildAndAddNode` 의 반환값 리팩터·`edge-utils.ts` 순수 헬퍼(`isConnectionDroppedOnPane`/`firstInputHandleId`) 분리·9개 vitest 케이스(유효/무효/null/undefined 전 조합) 모두 엣지 케이스를 잘 다룬다. TODO/FIXME 류 미완성 표식은 없고, 모든 함수가 전 경로에서 값을 반환하며 React Flow v12 실제 타입(`FinalConnectionState`, `Handle.type`)과 일치한다. 다만 이번 커밋이 `plan/in-progress/spec-sync-edge-gaps.md` 체크박스만 갱신하고 SoT 인 `spec/3-workflow-editor/2-edge.md` §1.2 본문(헤더·현재 구현 각주)은 그대로 두어 spec 문서가 실제 구현 상태를 반영하지 못하는 동기화 누락이 있고, 컨테이너 포트 순서 관례에 의존하는 자동연결 "항상 성공" 가정에 문서화되지 않은 latent 엣지 케이스가 남아 있다.

## 위험도
LOW
