# 보안(Security) Review

대상: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx`(`onConnectEnd` 배선), `codebase/frontend/src/lib/utils/edge-utils.ts`(+test, 순수 헬퍼 5종), `codebase/frontend/src/lib/stores/editor-store.ts`(+test, `onConnect` `skipUndo` 옵션), `CHANGELOG.md`, `canvas-basics`/`connecting-nodes` mdx 문서(ko/en), `plan/in-progress/spec-sync-edge-gaps.md`, `spec/3-workflow-editor/2-edge.md §1.2`, 그리고 `review/code/2026/07/13/{11_04_21,11_28_30,11_46_01}/*` 하위 이전 리뷰 산출물(신규 커밋).

## 발견사항

- **[INFO]** `handleAddNodeFromSearch` 의 `onConnect` 직접 호출이 `isValidConnection` UI 게이트를 우회
  - 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` `handleAddNodeFromSearch` → `onConnect(connection, { skipUndo: true })`; `connection` 조립은 `edge-utils.ts` `buildAutoConnectConnection(dragSource, newId, definition)`.
  - 상세: 자동 연결 경로는 React Flow 가 드래그 중에만 호출하는 `isValidConnection` 커서 힌트를 거치지 않고 스토어의 `onConnect` 액션을 직접 호출한다. 다만 `dragSource.nodeId`/`handleId` 는 React Flow 내부 `connectionState.fromNode`/`fromHandle` 에서, `newId` 는 `crypto.randomUUID()` 에서 파생되는 내부 상태 값일 뿐 사용자가 임의로 타이핑 가능한 문자열이 아니다. 실제 연결 유효성 게이트(`isSelfConnection`/`isDuplicateConnection`/컨테이너 충돌 검사)는 `editor-store.ts` `onConnect` 내부에서 항상 재검증되므로(§2.2 하드 차단 로직 무변경) 검증 우회로 인한 실질 위험은 없다. 그래프 편집 상태는 클라이언트 로컬이며 서버측 신뢰 경계를 넘지 않는다(영속화 시점의 백엔드 검증이 최종 방어선).
  - 제안: 실질 위험 없음. 이전 3회 리뷰(`11_04_21`, `11_28_30`, `11_46_01` 의 `security.md`)와 동일한 결론이며 조치 불요.

- **[INFO]** 신규 순수 헬퍼(`isConnectionDroppedOnPane`, `firstInputHandleId`, `connectionDragSource`, `pointerClientPosition`, `buildAutoConnectConnection`)는 전부 boolean/문자열/좌표 파생 로직
  - 위치: `codebase/frontend/src/lib/utils/edge-utils.ts`
  - 상세: 외부 I/O, `dangerouslySetInnerHTML`/DOM 문자열 삽입, `eval`/동적 코드 생성, 네트워크 호출, 파일시스템 접근, SQL/커맨드/LDAP 호출 경로가 전혀 없다. 모든 입력은 React Flow 가 넘기는 내부 객체(`connectionState`, `MouseEvent | TouchEvent`)와 정적 노드 정의(`inputs` 배열)뿐이라 인젝션 표면이 없다. `pointerClientPosition` 의 `changedTouches[0]` 접근은 배열 인덱싱 후 부재 시 `null` 반환(안전), `firstInputHandleId`/`buildAutoConnectConnection` 도 정의·입력 포트 부재를 `null`/`undefined` 로 처리해 예외적 크래시나 undefined 참조를 만들지 않는다.
  - 제안: 조치 불요.

- **[INFO]** 렌더링 데이터는 전부 신뢰된 소스 — XSS 표면 없음
  - 위치: `workflow-canvas.tsx` 노드 검색 팝업 렌더(`def.label`, `def.category`, `def.color` 등), `searchQuery` state
  - 상세: 팝업에 표시되는 문자열은 정적 노드 레지스트리(`useNodeDefinitionsStore`)와 i18n 번역 함수에서만 오며 사용자 입력 문자열의 직접 HTML 삽입이 없다. `searchQuery` 는 `<input value=...>` 로만 소비된다.
  - 제안: 조치 불요.

- **[INFO]** 하드코딩된 시크릿·자격증명 없음
  - 위치: `CHANGELOG.md`, `spec/3-workflow-editor/2-edge.md`, `plan/in-progress/spec-sync-edge-gaps.md`, mdx 문서, `review/code/2026/07/13/{11_04_21,11_28_30,11_46_01}/*.md`·`meta.json`·`_retry_state.json`
  - 상세: 문서·리뷰 아티팩트 diff 전수 확인. API 키/비밀번호/토큰/인증서/커넥션 스트링 등 하드코딩 시크릿 패턴 없음(grep 0건). 신규 커밋되는 이전 라운드 리뷰 산출물도 라우팅·재시도 상태 메타데이터·markdown 보고서뿐이다.
  - 제안: 조치 불요.

- **인증/인가·입력 검증·OWASP Top 10·암호화·에러 처리·의존성 보안**: 해당 없음. 이 diff 는 신규/변경 API 엔드포인트, 서버측 입력 처리, DB 쿼리, 세션·권한 검사 로직, 암호화 알고리즘 변경, 신규 의존성을 전혀 포함하지 않는 순수 프런트엔드 캔버스 UX 기능(출력 포트 드래그 → 빈 영역 드롭 → 노드 추가 팝업 → 자동 엣지 연결)이다. `crypto.randomUUID()` 사용은 기존 로직 그대로(신규 노드 id 생성용, 보안 토큰 용도 아님)이며 반환값을 변수(`newId`)로 캡처해 재사용하도록 리팩터한 것뿐이다.

## 요약

본 변경은 워크플로 에디터 캔버스에서 "출력 포트 드래그 → 빈 영역 드롭 → 노드 추가 검색 팝업 → 자동 엣지 연결"을 완성하는 순수 프런트엔드 UX 기능(및 이에 동반된 spec/plan/CHANGELOG/mdx 문서 동기화, 직전 3회 ai-review 산출물 커밋)으로, 신규 API·인증/인가 로직·서버측 입력 처리·시크릿·암호화가 전혀 없다. 유일하게 반복 검토된 지점(`handleAddNodeFromSearch` 가 `isValidConnection` UI 게이트를 우회해 store `onConnect` 을 직접 호출)도 store 내부의 권위 있는 재검증(자기연결/중복/컨테이너 충돌)으로 실질 위험이 상쇄됨을 이번 라운드에서도 재확인했다. 신규 순수 헬퍼는 모두 내부 상태만 다루고 null/undefined 가드가 충실해 입력 검증 관점에서도 결함이 없으며, 문서·리뷰 산출물에도 민감 정보 노출은 없다. 이번 diff가 도입하는 신규 보안 리스크는 없다.

## 위험도
NONE
