# 보안(Security) Review

대상: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx`, `codebase/frontend/src/lib/utils/edge-utils.ts`(+test), `codebase/frontend/src/lib/stores/editor-store.ts`(+test), `CHANGELOG.md`, `canvas-basics`/`connecting-nodes` mdx 문서(ko/en), `plan/in-progress/spec-sync-edge-gaps.md`, `spec/3-workflow-editor/2-edge.md`, 그리고 `review/code/2026/07/13/{11_04_21,11_28_30}/*` 하위 이전 리뷰 산출물 신규 커밋.

## 발견사항

검토한 변경분(§1.2 "출력 포트 드래그 → 빈 영역 드롭 → 노드 추가 팝업 + 자동 엣지 연결")은 순수 프런트엔드 워크플로 에디터 UI 상호작용이다. 신규/변경 API 엔드포인트, 인증/인가 로직, 서버측 입력 처리, 암호화, 시크릿, DB 쿼리, 외부 네트워크 호출이 전혀 없다. 구체적으로 확인한 항목:

- **인젝션**: `onConnectEnd`/`connectionDragSource`/`buildAutoConnectConnection`/`firstInputHandleId`/`pointerClientPosition`(`edge-utils.ts`)은 모두 React Flow `connectionState`/DOM 이벤트에서 얻은 좌표·노드ID·핸들ID를 그대로 객체 필드에 담아 상태(Zustand store)에 반영할 뿐이다. `dangerouslySetInnerHTML`, `eval`, 동적 코드 생성, DOM 문자열 삽입, SQL/커맨드/LDAP 호출 경로는 이 diff에 없다. XSS·SQLi·커맨드 인젝션 해당 없음.
- **하드코딩된 시크릿**: CHANGELOG/스펙/문서/코드 전체에 API 키·비밀번호·토큰·인증서 패턴 없음(grep 확인, 매치 0건).
- **인증/인가**: 이 변경은 캔버스 로컬 상태(nodes/edges/undo stack)만 다루며 백엔드 호출·세션·권한 검사 로직에 손대지 않는다. `handleAddNodeFromSearch`가 store `onConnect`을 직접 호출해 React Flow의 `isValidConnection`(드래그 중 UI 힌트 전용)을 우회하지만, 실제 연결 유효성 게이트(`isSelfConnection`/`isDuplicateConnection`/컨테이너 충돌 검사)는 `editor-store.ts`의 `onConnect` 내부에서 항상 재검증되므로 레이어 분리가 유지된다(우회로 인한 실질 위험 없음) — 앞선 두 차례 리뷰(`review/code/2026/07/13/11_04_21`, `11_28_30`)의 security 판정과 일치.
- **입력 검증**: `pointerClientPosition`은 `changedTouches`가 비어 있으면 `null`을 반환해 안전하게 단락시키고, `firstInputHandleId`/`buildAutoConnectConnection`도 정의 부재·입력 포트 부재를 `null`/`undefined`로 처리해 예외적 크래시나 undefined 참조를 만들지 않는다. 사용자 입력이 서버로 전달되거나 저장소에 영속화되는 경로가 이 diff엔 없다(순수 클라이언트 캔버스 상태).
- **OWASP Top 10 / 암호화 / 에러 처리 / 의존성**: 해당 없음. `crypto.randomUUID()` 사용은 기존 로직 그대로(신규 노드 id 생성, 보안 토큰 용도 아님)이며 diff는 이를 변수(`newId`)로 캡처해 재사용하도록 리팩터한 것뿐 — 알고리즘 변경 없음. 새 의존성 추가 없음.
- **신규 커밋되는 리뷰 산출물**(`review/code/2026/07/13/11_04_21/*`, `11_28_30/*`): 이전 리뷰 라운드의 markdown 보고서·`meta.json`·`_retry_state.json`이 새 파일로 추가되나, 시크릿·자격증명·민감 정보 없음(grep 확인). 저장소 관례(리뷰 산출물도 git 추적)와 일치.

이번 diff에서 CRITICAL/WARNING에 해당하는 보안 결함은 발견되지 않았다.

## 요약
본 변경은 워크플로 에디터 캔버스의 드래그-드롭 UX(출력 포트 → 빈 영역 드롭 시 노드 생성+자동 연결) 프런트엔드 전용 기능으로, 신규 API·인증/인가 로직·서버측 입력 처리·시크릿·암호화가 전혀 없다. 유일하게 검토가 필요했던 지점(`handleAddNodeFromSearch`가 `isValidConnection` UI 게이트를 우회)도 store `onConnect` 내부의 권위 있는 재검증(자기연결/중복/컨테이너 충돌)으로 실질 위험이 상쇄됨을 확인했다. 순수 헬퍼 함수들은 null/undefined 가드가 충실해 입력 검증 관점에서도 문제가 없다. 함께 커밋되는 리뷰 산출물·문서·스펙 변경에도 민감 정보 노출은 없다.

## 위험도
NONE
