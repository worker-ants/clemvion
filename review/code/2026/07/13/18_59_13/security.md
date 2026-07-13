# Security Review — edge §4.1 엣지 분할(mid-insert) + 문서/plan 동기화

## 발견사항

- **[INFO]** DOM hit-test 는 신뢰 가능한 내부 렌더 결과만 읽는다 — 인젝션 표면 아님
  - 위치: `codebase/frontend/src/lib/utils/edge-utils.ts` `findEdgeIdAtPoint` (신규), `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` `onDrop`
  - 상세: `document.elementFromPoint(clientX, clientY)` 로 커서 아래 엘리먼트를 찾고 `.closest(".react-flow__edge")?.getAttribute("data-id")` 로 엣지 id 를 얻는다. `data-id` 는 React Flow 가 자기 자신이 렌더한 엣지에 부여한 속성이며, 사용자가 임의로 주입할 수 있는 HTML/attribute 가 아니다(React 가 값을 attribute 로만 직렬화, `dangerouslySetInnerHTML`/`eval`/템플릿 문자열 삽입 없음). 얻은 문자열은 로컬 `edges` 배열에서 `Array.find(e => e.id === droppedEdgeId)` 로 단순 조회에만 쓰이고 DOM 재삽입·쿼리·네트워크 호출에 재사용되지 않는다. 결과적으로 XSS/DOM-based injection 경로가 성립하지 않는다.
  - 제안: 없음(현행 유지로 충분).

- **[INFO]** 신규 `buildEdgeSplitPlan`/`isContainerBoundaryEdge`/`firstOutputHandleId` 는 순수 함수이며 네트워크·인증·시크릿과 무관
  - 위치: `codebase/frontend/src/lib/utils/edge-utils.ts`
  - 상세: 입력은 이미 클라이언트 로컬 상태(`edges`, node definition)에서 온 값이고, 출력은 표준 `onConnect` 경로로 재사용되어 기존 `evaluateConnection`/`detectContainerConflict` 유효성 검사를 그대로 통과한다. 서버 API 콜, 인증 토큰, 권한 검사가 개입하지 않는 순수 프런트엔드 편집기 상태 변환이라 OWASP Top 10 표면(인증 우회, 인가 누락, SSRF 등)에 해당하지 않는다.
  - 제안: 없음.

- **[INFO]** `editor-store.ts` `removeEdge({skipUndo})` 확장은 로컬 undo 스택 동작만 바꾼다
  - 위치: `codebase/frontend/src/lib/stores/editor-store.ts`
  - 상세: 서버 REST 호출(`workflowsApi.deleteEdge`) 과 분리된 로컬 상태 전용 액션이며, 옵션 파라미터가 진짜(저장 전) 데이터 삭제나 권한 로직에 영향을 주지 않는다. 저장 시점 서버 반영은 기존 save 플로우 그대로다.
  - 제안: 없음.

- **[INFO]** 문서/CHANGELOG/plan/spec 변경은 코드 실행 경로가 없는 정적 텍스트
  - 위치: `CHANGELOG.md`, `codebase/frontend/src/content/docs/03-workflow-editor/*.mdx`, `plan/complete/spec-sync-edge-gaps.md`, `spec/3-workflow-editor/2-edge.md`, `review/code/2026/07/13/18_32_28/*`, `review/consistency/2026/07/13/18_06_53/*`
  - 상세: 하드코딩된 시크릿, 자격증명, 내부 인프라 세부정보(호스트명/키/토큰) 없음. mdx 문서에 삽입된 링크(`/docs/03-workflow-editor/connecting-nodes`)는 내부 상대경로로 오픈 리다이렉트/SSRF 소지가 없다.
  - 제안: 없음.

이번 diff 전체(파일 1~33)에서 SQL/커맨드/LDAP 인젝션, 경로 탐색, 하드코딩 시크릿, 인증/인가 우회, 안전하지 않은 암호화, 민감정보 노출 에러 처리, 취약 의존성 추가 등 CRITICAL/WARNING 급 보안 이슈는 발견되지 않았다. 변경은 워크플로 편집기 캔버스(순수 프런트엔드, React Flow 기반)의 "엣지 위에 노드 드롭 → 분할·삽입" UX 로직과 그에 딸린 문서/plan/이전 리뷰 산출물 커밋으로, 서버 통신·인증·데이터 저장 경로를 건드리지 않는다.

## 요약

본 변경은 워크플로 캔버스 편집기의 클라이언트 전용 상태 조작(엣지 분할·노드 삽입·undo 체크포인트 병합)과 이를 설명하는 문서·spec·plan·리뷰 산출물로 구성되어 있으며, 네트워크 요청·인증/인가 로직·암호화·시크릿 관리·서버 API 를 전혀 변경하지 않는다. 신규 DOM hit-test 헬퍼(`findEdgeIdAtPoint`)는 자사 렌더 결과의 읽기 전용 attribute 조회에 그쳐 인젝션 표면을 만들지 않고, 새 순수 함수들(`buildEdgeSplitPlan` 등)은 로컬 상태만 다루며 표준 유효성 검사 경로(`onConnect`/`evaluateConnection`)를 재사용한다. 보안 관점에서 실질적 위험은 확인되지 않았다.

## 위험도
NONE
