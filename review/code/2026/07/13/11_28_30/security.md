# 보안(Security) Review

## 발견사항

- **[INFO]** `onConnect` 직접 호출이 `isValidConnection` UI 게이트를 우회 (기존 이월 사항, 재확인)
  - 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` `handleAddNodeFromSearch` → `onConnect(connection, { skipUndo: true })`
  - 상세: 자동 연결 경로는 ReactFlow 의 `isValidConnection` 커서 게이트를 거치지 않고 store 의 `onConnect` 액션을 직접 호출한다. `connection` 은 `buildAutoConnectConnection(dragSource, newId, definition)` 이 조립하며, `dragSource.nodeId`/`handleId` 는 `connectionDragSource` 가 React Flow 내부 `connectionState.fromNode`/`fromHandle` 에서, `newId` 는 `crypto.randomUUID()` 에서 파생된다. 세 값 모두 사용자가 임의로 타이핑 가능한 문자열이 아니라 내부 상태이며, `onConnect` store 액션 내부에서 `isSelfConnection`/`isDuplicateConnection`/컨테이너 충돌 검증이 여전히 재수행되므로(§2.2 하드 차단 로직 그대로 유지) 실질적인 검증 우회는 아니다. 그래프 편집 상태는 클라이언트 로컬이며 서버측 신뢰 경계를 넘지 않는다. 이번 라운드에서 신설된 `skipUndo` 옵션은 undo 스택 처리 방식만 바꿀 뿐 연결 유효성 검증 경로에는 영향이 없다(검증 코드는 무변경).
  - 제안: 실질 위험 없음. 이전 리뷰(`review/code/2026/07/13/11_04_21/security.md`)와 동일한 결론이며 조치 불요.

- **[INFO]** 신규 순수 헬퍼(`isConnectionDroppedOnPane`, `firstInputHandleId`, `connectionDragSource`, `pointerClientPosition`, `buildAutoConnectConnection`)는 전부 boolean/문자열/좌표 파생 로직
  - 위치: `codebase/frontend/src/lib/utils/edge-utils.ts`
  - 상세: 외부 I/O, DOM `innerHTML` 삽입, `eval`/동적 코드 실행, 네트워크 호출, 파일시스템 접근이 전혀 없다. 모든 입력은 React Flow 가 넘기는 내부 객체(`connectionState`, `MouseEvent | TouchEvent`)와 정적 노드 정의(`inputs` 배열)뿐이라 인젝션 표면이 없다. `pointerClientPosition` 의 `changedTouches[0]` 접근도 배열 인덱싱만 하고 결과 없으면 `null` 반환(안전).
  - 제안: 조치 불요.

- **[INFO]** CHANGELOG/spec/plan/review 문서 diff에 시크릿·자격증명 없음
  - 위치: `CHANGELOG.md`, `spec/3-workflow-editor/2-edge.md`, `plan/in-progress/spec-sync-edge-gaps.md`, `review/code/2026/07/13/11_04_21/*.md`, `_retry_state.json`, `meta.json`
  - 상세: 문서·리뷰 아티팩트 diff 를 전수 확인. API 키/토큰/비밀번호/인증서/커넥션 스트링 등 하드코딩 시크릿 패턴 없음. `_retry_state.json`/`meta.json` 도 라우팅·재시도 상태 메타데이터만 포함.
  - 제안: 조치 불요.

## 요약
이번 diff는 워크플로우 편집기 캔버스에서 "출력 포트 드래그 → 빈 영역 드롭 → 노드 추가 팝업 → 자동 엣지 연결"을 완성하는 순수 프런트엔드 UX 기능과 그에 수반된 spec/plan/CHANGELOG 문서 동기화, 그리고 직전 ai-review(11_04_21) 아티팩트 커밋으로 구성된다. 신규 서버 API, 인증/인가 로직, 시크릿, 암호화, 사용자 입력의 서버측 처리 경로가 전혀 포함되지 않았고, 추가된 순수 헬퍼(`edge-utils.ts`)와 `onConnect(..., {skipUndo})` 옵션은 모두 클라이언트 로컬 편집 상태(내부 `connectionState`, `crypto.randomUUID()`, 정적 노드 레지스트리)만을 다루며 인젝션·XSS·권한 우회로 이어질 공격 표면을 만들지 않는다. `isValidConnection` UI 게이트 우회는 store 내부 재검증(자기연결/중복/컨테이너 충돌)으로 상쇄되어 이전 리뷰와 동일하게 실질 위험이 없다고 판단한다. 전반적으로 보안 관점에서 이번 변경이 도입하는 신규 리스크는 없다.

## 위험도
NONE
