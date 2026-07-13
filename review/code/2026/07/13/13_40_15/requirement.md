# Requirement Review — spec/3-workflow-editor/2-edge.md §1.3 (역방향 연결 확인 + 기존 엣지 재연결/분리), 4회차 fresh 리뷰

## 컨텍스트 및 검증 방법

이 changeset 은 동일 기능(§1.3)에 대해 이미 3회의 ai-review 사이클(12_40_48 → CRITICAL 1건, 13_06_50 → SPEC-DRIFT 1건+WARNING, 13_27_36 → WARNING 2건)을 거쳤고, 매 라운드 지적사항이 후속 커밋(`b15141f12`, `c538531fc`, `77850f5f9`)으로 반영됐다고 주장한다. 이 주장을 문서·이전 리뷰 산출물 텍스트만으로 받아들이지 않고, 현재 워킹트리의 실제 소스를 직접 Read/Grep 하고 테스트·tsc·eslint 를 실행해 독립 재검증했다.

- `vitest run` (editor-store.test.ts + edge-utils.test.ts + use-edge-reconnect.test.ts): **125 passed** (RESOLUTION.md 주장과 일치)
- `tsc --noEmit -p tsconfig.json`: clean (0 errors) — 과거 지적된 `Connection` 미-import(TS2304)도 현재 `editor-store.test.ts:2`에 `import type { Connection }` 존재로 해소 확인
- `eslint` (변경 6파일 + 테스트 3파일): 0 errors, 1 warning(line 952 `aria-selected`) — `git log -L`로 이 changeset 이전부터 존재하던 무관 코드임을 확인, 이번 diff 무관
- `grep -rn "TODO\|FIXME\|HACK\|XXX"` (변경 소스 4파일): 0건
- `grep -rn "onReconnectStart\|deleteEdge\b"` (frontend src + spec/ + plan/ + CHANGELOG.md): 코드에는 잔존 없음 — 유일한 `deleteEdge` 잔존은 기존부터 있던 무관한 `workflowsApi.deleteEdge`(REST 헬퍼, `codebase/frontend/src/lib/api/workflows.ts:147`) 뿐

## 발견사항

- **[INFO]** 이전 라운드의 CRITICAL·WARNING·SPEC-DRIFT 전건 실제 해소를 소스 대조로 확인
  - 위치: `codebase/frontend/src/components/editor/canvas/use-edge-reconnect.ts`, `codebase/frontend/src/lib/stores/editor-store.ts:610-826`
  - 상세: (1) **CRITICAL(자기연결 드롭 시 오삭제)** — `useEdgeReconnect.onReconnectEnd`가 `!connectionState.toNode` 만으로 detach 를 판정하도록 재설계돼 있음을 직접 확인(success 플래그 의존 없음). `use-edge-reconnect.test.ts` 4케이스(유효 재연결/pane 드롭 삭제/무효 핸들 드롭 시 유지/재연결 성공 후 노드 위 종료 시 유지)가 정확히 이 판정을 커버한다. (2) `evaluateConnection(nodes, edges, connection): { ok: true } | { ok: false; message? }` 판별 유니온이 `onConnect`/`onReconnect` 양쪽에서 재사용되고(L618-630, L750, L775-779), 재연결 시 `edges.filter((e) => e.id !== oldEdge.id)`로 자기 자신을 제외해 "제자리 재연결" 오탐도 막는다(테스트로 확인, L281-293). (3) `reconnectEdge(oldEdge, newConnection, state.edges, { shouldReplaceId: false })`로 엣지 id 를 보존하고, `sourceHandle` 변경 시 `buildEdgeDataForConnection`으로 포트색 data 를 재계산한다(L787-797, 테스트 L234-255). (4) `removeEdge`(구 `deleteEdge`)는 로컬 상태만 변경하고 `deriveContainerAssignments`로 컨테이너 소속을 재도출한다(L808-820, 테스트 L296-321). (5) `firstInputHandleId`가 `RESERVED_INPUT_HANDLE_IDS = new Set(["emit"])`로 예약 포트를 건너뛰며, 이 값이 backend SoT `shadow-workflow.ts:220` `CONTAINER_LOOPBACK_PORTS = new Set(['emit'])`와 실제로 일치함을 grep 으로 확인했다.
  - 제안: 없음(확인 목적). 기능적 회귀나 미해소 항목은 발견되지 않았다.

- **[INFO]** spec fidelity — `spec/3-workflow-editor/2-edge.md` §1.3 은 현재 코드와 line-level 로 일치
  - 위치: `spec/3-workflow-editor/2-edge.md` §1.3 "현재 구현" 문단
  - 상세: "`onReconnect`/`onReconnectEnd` 두 콜백을 배선", `evaluateConnection`(개명 반영), `reconnectEdge(..., {shouldReplaceId:false})`, `connectionState.toNode`가 null 일 때만 삭제 — 서술이 모두 실제 코드와 정확히 대응한다. 과거 지적된 `onReconnectStart` 3중 문서 잔존(CHANGELOG/spec/plan)도 현재 세 문서 전부 "두 콜백"으로 정정돼 있음을 확인했다(코드 fix 이후 spec 반영이 완료된 상태이므로 재지적 대상 아님).
  - 제안: 없음.

- **[INFO]** 역방향 연결(입력 포트 시작 드래그) "커스텀 코드 불요" 주장은 코드로 뒷받침됨
  - 위치: `codebase/frontend/src/lib/stores/editor-store.ts:822-826`(`isValidConnection`), `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx`, `custom-edge.tsx`
  - 상세: `connectionMode`를 명시적으로 설정하는 코드가 없어(grep 0건) React Flow v12 기본값(strict)이 적용되고, 핸들에 `isConnectableStart`/`isConnectableEnd` 제약이 없다(grep 0건). `isValidConnection`은 방향 무관하게 `isSelfConnection`만 검사한다. `custom-edge.tsx`는 React Flow 내장 `<BezierEdge {...props} />`를 그대로 감싸 렌더하므로 reconnect 앵커는 React Flow 내부(EdgeWrapper)가 자동 처리하며 커스텀 엣지 컴포넌트를 손댈 필요가 없다는 주장도 타당하다.
  - 제안: 없음.

- **[INFO]** 잔여 트리아지 항목(신규 아님, 이전 라운드가 이미 저위험으로 확정)
  - 구조적 엣지(컨테이너 `body`/`emit`)에 `reconnectable: false` opt-out 이 없어 드래그로 재연결/detach 가능 — 서버측 `CONTAINER_MISSING_EMIT` 검증이 최종 방어선으로 남아 즉각 위험 아님.
  - `RESERVED_INPUT_HANDLE_IDS`(FE)와 `CONTAINER_LOOPBACK_PORTS`(BE)가 주석 SoT 참조만으로 동기화되는 독립 리터럴(원소 1개) — latent drift 위험이나 즉시 조치 불필요.
  - `onConnect` 자체 스위트에는 컨테이너 충돌 거부 케이스가 없음(비대칭) — 공용 `evaluateConnection` 경로라 실질 위험 낮음.
  - `onReconnect`의 `isSelfConnection` 분기는 실제 React Flow 제스처로는 도달 불가능한 방어 코드(자기연결 드롭은 `isValidConnection` 게이트가 `onReconnect` 콜백 자체를 막음) — 실사용 시나리오는 `use-edge-reconnect.test.ts`가 정확히 커버하므로 기능적 결함 아님.
  - 모두 코드 변경 불필요 수준으로 이미 문서(plan/RESOLUTION)에 근거와 함께 기록돼 있어 재지적하지 않는다.

## 요약

3회의 선행 ai-review 사이클(CRITICAL 1건 → SPEC-DRIFT 1건+WARNING 다수 → WARNING 2건)에서 지적된 모든 항목 — 자기연결 드롭 시 엣지 오삭제(CRITICAL), `onConnect`/`onReconnect` 검증·데이터파생 중복, 문자열 sentinel 규약, `onReconnectStart` 문서 잔존(SPEC-DRIFT), `deleteEdge` 네이밍 충돌, plan 테스트 개수 stale(3회 재발), reject 테스트의 toast 미검증 — 을 실제 소스 코드·테스트·tsc/eslint 실행으로 독립 재검증한 결과 모두 실제로 해소되어 있음을 확인했다. 역방향 연결이 React Flow 기본 동작으로 지원된다는 핵심 주장은 `connectionMode` 미설정(기본 strict)·핸들 제약 없음·`isValidConnection` direction-agnostic 확인으로 뒷받침되고, 재연결/detach 판정은 success 플래그가 아니라 실제 드롭 위치(`connectionState.toNode`) 기준으로 정확히 구현돼 있다. `spec/3-workflow-editor/2-edge.md` §1.3, CHANGELOG, plan 문서는 현재 코드와 line-level 로 정합한다. TODO/FIXME/HACK/XXX 없음, 반환값 누락 경로 없음, 신규 기능 관련 CRITICAL/WARNING 급 결함은 발견되지 않았다.

## 위험도

NONE
