# 요구사항(Requirement) Review — §1.3 역방향 연결 + 엣지 재연결/분리 (3회차)

## 컨텍스트
본 diff 는 `spec/3-workflow-editor/2-edge.md` §1.3(역방향 연결 확인 + 기존 엣지 재연결/분리) 구현과, 이미 두 차례(`review/code/2026/07/13/12_40_48` CRITICAL 1건, `review/code/2026/07/13/13_06_50` SPEC-DRIFT 1건 + WARNING 4건) 진행된 ai-review 피드백 반영 이력을 포함한다. 커밋 로그(`c74e27058` 최초 구현 → `c538531fc` 2회차 반영)와 실제 코드를 직접 대조해 독립 검증했다.

## 검증한 항목 (문제 없음)

- **CRITICAL 회귀 미재현**: `use-edge-reconnect.ts` `onReconnectEnd` 는 success 플래그가 아니라 `connectionState.toNode` (드롭 위치)로 detach 를 판정한다 — `toNode` 가 존재하면(자기연결 등 무효 핸들 드롭 포함) 무조건 원상 유지, `null`(pane)일 때만 `removeEdge` 호출. 자기연결 드롭 시 `isValidConnection`(자기연결만 하드 차단)이 `onReconnect` 콜백 자체를 막아도 `onReconnectEnd`의 `toNode`는 여전히 해당 노드를 가리키므로 삭제되지 않음을 코드로 직접 확인.
- **`onReconnectStart`/`evaluateConnectionRejection` stale 서술 해소**: `grep -rn "onReconnectStart\|evaluateConnectionRejection"` 결과, 코드·spec·CHANGELOG·plan 어디에도 잔존하지 않음(과거 리뷰 산출물 `review/code/2026/07/13/{12_40_48,13_06_50}/*.md` 내 인용문에만 남아있고 이는 정상적인 이력 기록). `spec/3-workflow-editor/2-edge.md` §1.3 은 `onReconnect`/`onReconnectEnd` 두 콜백, `evaluateConnection`(판별 유니온) 으로 현재 코드와 line-level 정확히 일치.
- **테스트 통과**: `npx vitest run` 직접 실행 — `use-edge-reconnect.test.ts` + `editor-store.test.ts` + `edge-utils.test.ts` = **125 passed**(RESOLUTION.md 주장과 일치). `npx tsc --noEmit` clean.
- **`RESERVED_INPUT_HANDLE_IDS` ↔ backend SoT 값 일치**: `edge-utils.ts` `new Set(["emit"])` 가 `codebase/backend/.../shadow-workflow.ts` `CONTAINER_LOOPBACK_PORTS = new Set(['emit'])` 와 정확히 일치함을 grep 으로 확인.
- **컨테이너 충돌 거부 로직 재검증**: 신규 "컨테이너 소속 충돌이면 거부한다" 테스트(`editor-store.test.ts`)가 실제 `detectContainerConflict`의 `body` 소스 핸들 분기(L256-266)와 정확히 대응하는 시나리오(다른 컨테이너 자식으로 재배선 시도)를 실행함을 소스 대조로 확인 — 13_06_50 testing WARNING("컨테이너 충돌 거부 경로 미검증, RESOLUTION.md 서술 오류")이 실제로 해소됨.
- **`onReconnect` 제자리 재연결(self-exclude) 로직 정확성**: `isDuplicateConnection` 는 `(source, sourceHandle, target, targetHandle)` 4중 일치로 판정하고, `onReconnect` 가 `get().edges.filter((e) => e.id !== oldEdge.id)` 로 자기 자신을 제외한 목록을 넘기므로 "제자리 재연결"이 자기 자신과 중복으로 오판되지 않음을 코드로 확인.
- **역방향 연결 "커스텀 코드 불요" 주장**: `grep -rn "isConnectableStart\|isConnectableEnd\|connectionMode"` 결과 0건 — 어떤 핸들에도 방향 제약이 없고 `<ReactFlow>`에 `connectionMode` 오버라이드가 없어 기본값(strict)이 적용됨을 확인, spec/CHANGELOG 서술과 일치.
- **TODO/FIXME/HACK/XXX**: 신규·변경 코드 파일 전체(`use-edge-reconnect.ts`, `editor-store.ts`, `edge-utils.ts`, 두 테스트 파일) grep 0건.

## 발견사항

- **[WARNING]** `plan/in-progress/spec-sync-edge-gaps.md` §1.3 체크박스의 테스트 개수 서술이 동일 커밋(`c538531fc`, 2회차 ai-review 반영) 내에서 다시 stale 해졌다 — "store onReconnect 4/removeEdge 1" 이라 적혀 있으나 실제로는 **onReconnect 6개 / removeEdge 2개**다.
  - 위치: `plan/in-progress/spec-sync-edge-gaps.md` §1.3 체크박스 본문("테스트: reconnect 훅 renderHook 4 + store onReconnect 4/removeEdge 1 + firstInputHandleId emit 2")
  - 상세: `git show c538531fc -- plan/in-progress/spec-sync-edge-gaps.md` 로 확인한 결과, 이 커밋은 직전 라운드(`13_06_50`)의 두 testing WARNING을 반영하며 `onReconnect` describe 블록에 "sourceHandle 재계산" 테스트와 "컨테이너 소속 충돌 거부" 테스트를, `removeEdge` describe 블록에 "containerId 재도출" 테스트를 **동시에 추가**했다. 그런데 같은 커밋에서 plan 텍스트는 개수를 "3→4"(onReconnect)로만 갱신하고 새로 추가된 2개(컨테이너 충돌·sourceHandle 재계산)를 반영하지 않았고, `removeEdge`도 "1"에서 갱신되지 않았다. `awk`로 실제 `it(...)` 블록을 직접 카운트해 확인: `describe("onReconnect (§1.3)")` = 6건, `describe("removeEdge (§1.3 detach)")` = 2건. 이는 사용자 메모에 기록된 "테스트 개수/메서드명 stale" 패턴(직전 라운드에서 "3→4"로 이미 한 번 정정된 바로 그 문구)이 **같은 정정 작업 중에 또 재발**한 사례다 — 기능 결함은 아니지만, 완료 항목의 커버리지 audit 근거로 plan을 참조할 향후 작업자에게 실제보다 적은 테스트 커버리지가 있다고 오인시킬 수 있다.
  - 제안: plan 체크박스 텍스트를 "store onReconnect 6/removeEdge 2"로 정정(코드 변경 불필요, 완료 항목 서술 정확성 문제). `spec/3-workflow-editor/2-edge.md`·`CHANGELOG.md`에는 테스트 개수 서술이 없어 이 stale 은 plan 파일에 국한됨을 확인했다.

## 참고 (INFO, 이미 트리아지된 잔여 항목 — 재지적 아님)

- 구조적 엣지(컨테이너 `body`/`emit`)도 `reconnectable:false` opt-out 없이 드래그 재연결/detach 대상 — 서버측 이중 검증 존재로 즉각 위험 아님(직전 두 라운드에서 이미 수용).
- `onReconnect`/`removeEdge` 는 변화 없어도 무조건 `pushUndo()` — 영향 미미, 우선순위 낮음(직전 라운드 수용).
- `*.test.ts` 가 tsconfig exclude + vitest 타입 strip 이중 사각지대라는 구조적 문제 자체는 이번 PR 범위 밖(직전 라운드 수용, 이번 PR에서 실제 타입 오류는 없음을 `tsc --noEmit` 로 재확인).
- 재연결/detach e2e(Playwright) 부재 — 순수 판정 로직은 단위 테스트로 전수 커버, canvas e2e 하네스 부재는 기존 결정(직전 라운드 수용).

## spec fidelity 종합

`spec/3-workflow-editor/2-edge.md` §1.3 은 "미구현 · Planned" → 구현 서술로 갱신되었고, 현재 코드(`onReconnect`/`onReconnectEnd` 2콜백, `evaluateConnection` 판별 유니온, `reconnectEdge(..., {shouldReplaceId:false})`, `toNode` 기반 detach 판정)와 line-level 로 정확히 일치함을 확인했다. `code:` frontmatter 목록도 `use-edge-reconnect.ts`/`edge-utils.ts` 를 정확히 포함한다. 이전 두 라운드에서 지적된 CRITICAL 1건·SPEC-DRIFT 1건·WARNING 다수는 모두 코드·문서 레벨에서 실제로 해소되었음을 독립적으로(diff 대조 + 실제 파일 Read + grep + vitest/tsc 실행) 재검증했다.

## 요약

이번 diff 는 §1.3(역방향 연결 확인 + 기존 엣지 재연결/분리)을 spec 본문과 line-level 로 정확히 일치시켜 구현했고, 직전 두 차례 ai-review 라운드가 지적한 CRITICAL(자기연결 reconnect 드롭 시 엣지 오삭제)·SPEC-DRIFT(`onReconnectStart` 문서 잔존)·WARNING(검증 로직 중복, sentinel 반환값, 컨테이너 충돌/포트색 재계산 미검증, `deleteEdge` 명명 충돌)이 모두 코드·테스트 레벨에서 실제로 해소되었음을 직접 실행(vitest 125 passed, tsc clean)과 grep으로 재확인했다. 유일한 신규 발견은 plan 문서의 테스트 개수 서술이 바로 그 정정 커밋 내에서 다시 stale 해진 것(WARNING, 기능 결함 아님)이며, 그 외 잔여 INFO 항목은 모두 이미 트리아지되어 낮은 우선순위로 수용된 사항의 재확인이다.

## 위험도
LOW
