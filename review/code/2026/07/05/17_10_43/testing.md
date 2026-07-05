# 테스트(Testing) 리뷰 — V-05 execution-detail node sub-tabs (17_10_43)

FOCUS: 신규 회귀 테스트 2건 — (1) 완결 노드 Input 탭이 `inputData` 를 렌더(placeholder 아님), (2) 비-effect 노드에서 execution-level dry-run 배지 표시. 실제로 두 CRITICAL/WARNING 회귀를 막는지, 단언(assertion) 이 의미 있는지 mutation testing 으로 직접 검증했다.

## 검증 방법

- `toNodeResult()` 에서 `startedAt`/`inputData` 매핑을 제거한 패치를 적용 → 대상 스위트 재실행.
- `ResultDetail` 의 dry-run 배지 조건을 `executionDryRun || isDryRunOutput(...)` → `isDryRunOutput(...)` 만으로 되돌리는 패치를 적용 → 재실행.
- 각 패치 후 복원, 전체 스위트(10개) 재확인. 격리 확인을 위해 `-t "V-05"` 필터로 4건만 단독 실행도 확인.

## 발견사항

- **[INFO]** Input 탭 회귀 테스트는 실제로 CRITICAL 을 가드한다 (mutation-tested 확인)
  - 위치: `codebase/frontend/src/app/(main)/workflows/[id]/executions/__tests__/execution-detail-waiting.test.tsx:305-311` (test) / `.../[executionId]/page.tsx` `toNodeResult()` (fix 대상)
  - 상세: `toNodeResult` 에서 `inputData: ne.inputData` 매핑을 제거하고 재실행하면 `expect(screen.queryByText("입력 데이터 로드 중...")).toBeNull()` 이 실제로 실패하며, DOM 에 정확히 그 placeholder 텍스트가 렌더된 것을 확인했다. placeholder 문자열은 `result-detail.tsx:337` 의 `t("editor.runResults.loadingInput")` 이 ko 사전(`ko/editor.ts:257`)에서 리졸브하는 값과 하드코딩 리터럴이 정확히 일치 — 오탐 없는 견고한 단언이다. 탭 라벨 `"입력"`(`ko/editor.ts:246 tabInput`), 노드 상세 진입 버튼 `"Fetch"` 등도 실제 fixture/DOM 구조와 대응해 클릭 시퀀스가 유효함을 확인.
  - 제안: 없음(양호).

- **[INFO]** dry-run 배지 회귀 테스트도 실제로 WARNING 을 가드한다 (mutation-tested 확인)
  - 위치: 동 파일 `:313-321` (test) / `result-detail.tsx:1174` (fix 대상), `page.tsx:457`(`executionDryRun={execution.dryRun === true}` 전달)
  - 상세: `ResultDetail` 의 배지 조건을 `isDryRunOutput(result.outputData)` 단독으로 되돌리면(즉 `executionDryRun` fallback 제거), `expect(await screen.findByText(/dry-run/))` 이 timeout 으로 실패함을 확인 — non-effect(`http_request`, output 에 `_dryRun` 마커 없음) 노드에서 배지가 실제로 사라진다. 정규식 `/dry-run/` 이 execution-level 체인 배지(`chainBadgeDryRun`, `reRunOf`/`chain.length>=2` 조건부)와 충돌할 가능성도 fixture 상 `reRunOf`/체인 미설정으로 실제 렌더되지 않아 오탐 위험 없음을 확인.
  - 제안: 없음(양호).

- **[INFO]** 두 테스트 모두 격리(isolation) 양호
  - 위치: `execution-detail-waiting.test.tsx:150-158` (`beforeEach`)
  - 상세: `beforeEach` 에서 `vi.clearAllMocks()` + `emitMock.mockReset()` + `useExecutionStore.getState().reset()` 을 수행해 모듈 싱글턴 store 오염을 차단한다. `vitest run -t "V-05"` 로 4건만 단독 실행해도 전부 통과 — 순서 의존성 없음을 확인했다. `mockGetById`/`mockGetByWorkflow` 도 매 테스트 재설정.
  - 제안: 없음(양호).

- **[INFO] (경계 케이스 커버리지 갭 — 비차단)** AI 노드 + dry-run 조합, null `outputData` 노드의 Config 탭 미노출 케이스는 미검증
  - 위치: `makeCompletedExecution()` — `ai_agent`/`http_request` 두 케이스만 존재, `outputData: null`(대기·에러 노드) 조합은 별도 waiting 테스트에서만 다뤄짐
  - 상세: (a) `executionDryRun` 과 `isDryRunOutput` 이 **동시에** true 인 경우(effect 노드가 dry-run 실행 중 `_dryRun` 마커도 갖는 케이스) 배지가 중복 렌더되지 않는지는 테스트되지 않음 — 다만 JSX 가 `&&` 단일 블록이라 로직상 중복 위험은 없어 실질 리스크는 낮다. (b) `outputData` 가 `undefined`(never executed) 인 노드에서 Input 탭 placeholder 유지 여부는 회귀 테스트 스코프 밖(이번 회귀와 무관하므로 범위 확장 불요).
  - 제안: 필수는 아니나, 여유가 있다면 "dry-run + effect 노드(마커 있음)"에서 배지가 하나만 렌더되는 스냅샷/exists 카운트 테스트를 추가하면 향후 조건식 리팩터 시 안전망이 된다. 현재 스코프(placeholder/배지 유무)는 이번 회귀 목적에 충분하므로 blocking 아님.

- **[INFO] (가독성)** 테스트 이름·주석이 회귀 배경(CRITICAL/WARNING 출처)을 명시해 추적성 우수
  - 위치: `:292-294`, `:302-304` 주석("ai-review requirement CRITICAL", "ai-review side_effect WARNING")
  - 상세: RESOLUTION.md 조치 #1/#3 과 테스트 주석이 1:1 대응되어 리뷰어가 회귀 배경을 즉시 추적 가능. Mock 사용도 API 클라이언트(`executionsApi.getById`)만 stub 하고 나머지는 실제 컴포넌트 트리(`ResultDetail`, store, i18n)를 그대로 렌더 — 실제 동작과의 괴리가 낮은 적절한 mock 경계.
  - 제안: 없음(양호).

## 요약

`inputData` 미매핑(Input 탭 영구 placeholder) 과 dry-run 배지 execution-level fallback 상실, 두 회귀 모두에 대해 직접 mutation testing(fix 되돌린 뒤 재실행)으로 테스트가 실제로 실패함을 확인했다 — 단언이 실제 DOM 텍스트·i18n 리졸브 값과 정확히 일치하는 견고한 가드다. `beforeEach` store/mock 리셋으로 테스트 간 격리도 확인됐고 순서 무관 단독 실행도 통과한다. Mock 경계도 API 계층만 stub 하여 실제 컴포넌트 통합 동작을 검증하는 적절한 수준이다. 남은 갭(AI+dry-run 동시 조합, undefined outputData 등)은 이번 회귀 범위 밖의 낮은 우선순위 커버리지 확장 여지로, blocking 사유 아니다.

## 위험도

NONE
