STATUS=success ISSUES=3

===REPORT_MARKDOWN_BELOW===
# 테스트(Testing) 코드 리뷰 — eia-inputdata-marker-guard

## 컨텍스트

이 changeset 은 `Execution.inputData` egress 마스킹 카브아웃을 닫고, 재제출 소비처 3곳(폼
프리필 · Re-run 모달 · 에디터 히스토리 로드)에 마커 감지 가드를 추가한다. `review/code/2026/08/20/`
아래 이미 4라운드(`14_08_45`→`14_44_08`→`15_10_25`→`15_32_34`)의 리뷰·fix 이력이 있고, 각
라운드가 서로 다른 우회 경로(값-empty 판정 우회, touch-only 영구해제, 무효 JSON 폴백 우회)를
캐너리로 고정해 왔다. 이번 라운드는 그 누적 diff(`git diff origin/main...HEAD`)를 기준으로
실제 소스(`executions.service.ts`/`.spec.ts`, `rerun-modal.tsx`/`.test.tsx`,
`editor-toolbar.tsx`/`editor-toolbar-run-input.test.tsx`, `masked-markers.ts`/`.test.ts`)를
직접 읽고 재검토했다.

## 발견사항

- **[INFO]** `blockedByMaskedInput` 의 세 조건 중 "값이 비었는가" 단독 우회(`14_08_45` W2, boolean
  필드 + 지연 스키마 조합)를 정확히 재현하는 회귀 테스트가 없다 — 구조적으로는 막혀 있음
  - 위치: `codebase/frontend/src/components/executions/rerun-modal.tsx:368` (`blockedByMaskedInput`
    계산), 재조정 effect(`coerceInput(f.type, v)` 호출부는 `:328`)
  - 상세: 원 버그는 *"마스킹 스칼라 값 → `splitMaskedParameters` 가 `""` 로 비움 → 스키마가
    비동기로 늦게 도착해 필드 타입이 `boolean` 으로 확정 → 재조정 effect 가
    `coerceInput("boolean", "")` 를 호출 → `raw === "true"` 가 `false` 라 값이 **boolean
    `false`** 로 바뀜 → 마스킹 판정이 값 자체만 봤다면 `false` 는 마커가 아니므로 조용히
    풀림"* 이었다. 지금 구현은 `!touchedMaskedKeys.has(k)` 조건이 **coercion 결과와 무관하게**
    유지되므로 이 경로는 구조적으로 막혀 있다(`touchedMaskedKeys` 는 `setParam` 을 통해서만
    갱신되고, 재조정 effect 는 `setParamValues` 를 직접 호출해 `setParam` 을 우회하므로 touched
    로 잘못 표시되지도 않는다 — 이 부분은 맞게 설계됐다). 다만 테스트 스위트를 확인한 결과
    (`rerun-modal.test.tsx` 의 "ReRunModal — 마스킹 마커 왕복 차단" describe, `grep boolean`
    결과 `346`·`432`·`486` 세 곳은 전부 masking 과 무관한 기존 boolean-coercion 테스트다),
    "마스킹된 boolean 필드 + 지연 스키마" 조합을 직접 행사하는 캐너리는 없다. `!touched` 가지가
    이 시나리오를 이미 덮으므로 실질 회귀 위험은 낮지만, 이 정확한 버그 재현 형태를 캐너리로
    박아 두지 않으면 다음에 `!touchedMaskedKeys.has(k)` 조건을 실수로 좁히는(예: 조건 순서를
    바꾸며 이 항을 빠뜨리는) 리팩터가 나올 때 이 특정 우회가 침묵 재발할 수 있다.
  - 제안: `rerun-modal.test.tsx` 에 "마스킹된 boolean 필드가 지연 스키마 로드 후에도 계속
    막힌다" 캐너리 하나를 추가한다(`inputData.parameters.flag: "***"` 로 시작 → 스키마가
    `{ name: "flag", type: "boolean" }` 로 늦게 resolve → 여전히 disabled 단언). 기존
    line `470` 부근의 boolean 재조정 테스트와 구조가 거의 같아 비용이 낮다.

- **[INFO]** `hasMaskedMarkerLeaf` 의 재귀 순회에 깊이 상한이 없고, 이 경로 중 하나(에디터
  "Run with Input" 자유 텍스트)는 백엔드가 사전 검증한 값이 아니라 사용자가 그 자리에서 직접
  타이핑/붙여넣기하는 임의 JSON이다 — 이전 라운드의 "재귀 깊이 상한" 판정과 전제가 다르다
  - 위치: `codebase/frontend/src/lib/utils/masked-markers.ts:64-71` (`hasMaskedMarkerLeaf`),
    호출부 `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx:108-118`
    (`JSON.parse(trimmed)` → `hasMaskedMarkerLeaf(parsed)`, "Run with Input" 다이얼로그의
    직접 입력 textarea)
  - 상세: `15_10_25` RESOLUTION 은 "재귀 깊이 상한" INFO 를 "순회 대상이 이미 backend 깊이
    제한을 통과한 구조" 라는 근거로 조치 불요 처리했다. 그 근거는 **히스토리 로드로 들어오는
    `Execution.inputData`**(DB 에 저장되기 전 어떤 형태로든 백엔드를 지난 값)에는 맞지만,
    `editor-toolbar.tsx` 의 `jsonError` (line 103-120) 는 **사용자가 그 자리에서 직접 입력한
    텍스트**를 `JSON.parse` 한 뒤 곧바로 `hasMaskedMarkerLeaf` 에 넘긴다 — 이 경로는 백엔드를
    거친 적이 없다. `JSON.parse` 자체는 반복적 파서라 매우 깊은 배열 리터럴(`"[".repeat(N)+...`)
    도 아무 문제 없이 파싱하지만, 뒤이은 `hasMaskedMarkerLeaf` 의 재귀 호출(`Array.isArray`
    분기)은 스택 프레임을 하나씩 소비하므로 파서보다 먼저 `RangeError: Maximum call stack
    size exceeded` 에 도달할 수 있다. 영향은 **자기 탭만 멈추는 client-side 자해성 DoS**라
    낮은 심각도지만, 값 검증(`jsonError`)이 `catch` 절 없이 이 예외를 그대로 던지면 React
    렌더 중 unhandled exception 으로 이어질 수 있어(현재 `hasMaskedMarkerLeaf` 호출은
    `try/catch` 밖) 사용자 경험상 "Invalid JSON" 대신 흰 화면을 보게 될 수 있다.
  - 제안: 최소한 "매우 깊게 중첩된 JSON 을 붙여넣어도 예외 없이(또는 명시적 에러 메시지로)
    처리된다"는 경계 테스트 하나를 `editor-toolbar-run-input.test.tsx` 에 추가해 현재 동작을
    캐너리로 고정한다. 실제로 문제가 재현되면 `hasMaskedMarkerLeaf` 에 깊이 상한을 추가하거나
    반복(iterative) 순회로 바꾸는 후속 작업을 트래커에 등재한다(이번 PR 범위 밖일 수 있음).

- **[INFO]** frontend `MASKED_MARKERS` "backend SoT 일치" 테스트가 실제로는 리터럴 대 리터럴
  비교라 backend 상수가 바뀌어도 감지하지 못한다 — 단, 이미 이전 라운드에서 트래커 등재된
  항목으로 보인다
  - 위치: `codebase/frontend/src/lib/utils/__tests__/masked-markers.test.ts:13-19`
    (`it("마커 집합이 backend SoT 의 리터럴과 일치한다", ...)`)
  - 상세: 이 테스트는 `[...MASKED_MARKERS]` 를 `["***", "[REDACTED]", "[REDACTED_DEPTH]"]`
    라는 **frontend 파일 안에 다시 적은 리터럴**과 비교한다. `codebase/backend/src/shared/utils/sanitize-error-message.ts`
    의 `VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/`DEPTH_MASK_MARKER` 실제 값을 읽어 대조하는 게
    아니므로, 누군가 backend 마커 문자열을 바꾸고 frontend 미러를 안 바꿔도 **이 테스트는
    계속 통과한다**(frontend 파일 두 곳의 리터럴이 서로만 일치하면 그만이라서) — 정확히
    JSDoc 자신이 경고하는 "미러가 어긋나면 가드가 조용히 뚫린다" 그 시나리오를 이 테스트가
    못 잡는다. `15_10_25`/`15_32_34` RESOLUTION 문서들이 "미러 계약 테스트" 를 트래커 항목으로
    이미 등재해 둔 것으로 보여(WARNING·CRITICAL 아님) 신규 결함으로 보진 않지만, 테스트
    이름("backend SoT 의 리터럴과 일치")이 실제로 검증하는 것보다 강한 인상을 준다는 점만
    남긴다.
  - 제안: (이미 트래커 항목이면 조치 불요) 테스트 이름을 "frontend 리터럴이 문서화된 backend
    마커 문자열과 일치한다(수동 동기화, 자동 크로스체크 아님)" 정도로 낮추거나, 백엔드
    상수를 export 해 두 값을 직접 import 해 비교하는 실제 크로스체크로 승격한다.

## 확인했으나 재지적하지 않은 것 (실측상 이미 견고함)

- **세 우회 경로 전부 캐너리로 고정돼 있다**: (1) object/array leaf 마커(`14_08_45` C1) —
  `hasMaskedMarkerLeaf` 도입 + `rerun-modal.test.tsx`/`editor-toolbar-run-input.test.tsx` 양쪽
  중첩 leaf 테스트, (2) touch 영구해제(`14_44_08` W2) — "건드린 뒤 값이 다시 마커면 계속
  막는다" 캐너리, (3) 무효 JSON 폴백(`15_32_34` W1) — 스키마를 실제로 태워 `coerceInput` 의
  raw-string 폴백까지 재현하는 캐너리(`rerun-modal.test.tsx` 마지막 근처). 세 경로 모두
  "이것만 지우면 RED" 형태로 정확히 겨눠져 있다.
- **backend 세 표면(`findById`/`getChain`/`stop`) 전부 직접 단언**된다
  (`executions.service.spec.ts` ①·⑧·⑧-b) — `toResponseExecution` 이라는 단일 관문을 공유하지만
  세 진입점 각각에서 `.not.toContain('admin:pw')` 를 확인해, "한 표면만 고치고 자매를 빠뜨리는"
  이 저장소의 반복 결함 클래스를 막는다. 목록(`toExecutionDto`, ②)과 webhook 마커 보존(⑥)도
  별도로 커버됨.
- **"실제 유입 경로" 재현**: `editor-toolbar-run-input.test.tsx` 의 "Load from History 로 들어온
  마스킹 값이 Run 을 막는다" 테스트는 textarea 에 마스킹 JSON 을 직접 넣는 대신
  `getByIdMock` → `JSON.stringify` → `setJsonInput` 실제 코드 경로를 태운다(`14_08_45` W5 가
  지적했던 종류의 "단축 재현" 문제를 피함).
- **Mock 적절성**: `executions.service.spec.ts` 는 `redactStoredDataForResponse`/
  `redactStoredErrorForResponse` 를 mock 하지 않고 실구현(`sanitize-error-message.ts` 경유)을
  그대로 태운다 — 마스킹 로직 자체는 별도 `.spec.ts`(`redact-stored-error.spec.ts`, null 처리·
  copy-on-change·마커 보존 캐너리 포함, 이번 diff 로 변경되지 않음)로 이미 두텁게 커버돼 있고,
  이번 diff 는 그 기존에 검증된 함수를 새 호출부(목록 경로 `inputData`)에 배선만 했다 —
  회귀 위험이 낮다.
- **테스트 격리**: `rerun-modal.test.tsx` 의 신규 `describe("ReRunModal — 마스킹 마커 왕복
  차단", ...)` 는 기존 `describe("ReRunModal", ...)` 와 **형제** 레벨(중첩 아님)이고 자체
  `beforeEach` 에서 mock·store·router 를 리셋해 기존 스위트와 상태를 공유하지 않는다.
- **`executions-rerun.service.spec.ts`(reRun 생성 로직)는 이번 마스킹 변경과 정확히
  분리돼 있다** — `findById` 를 통째로 `jest.spyOn(...).mockResolvedValue(...)` 로 대체하고
  `engine.execute` 호출 인자(원문 파라미터)만 단언하므로, `findById` 응답에 마스킹이 새로
  걸려도 이 스위트는 영향받지 않는다. `reRun` 의 실제 반환값은 내부적으로 `findById` 를
  재사용하므로(line 542 `const detail = await this.findById(newExecutionId)`) 별도 마스킹
  테스트가 불필요하다 — DRY 재사용이 테스트 중복도 줄인 사례.
- **e2e**(`re-run.e2e-spec.ts`)는 이번 diff 로 변경되지 않았고, 사용하는 입력값(`{ foo: "bar",
  count: 7 }`)에 자격증명 패턴이 없어 마스킹 영향을 받지 않음을 확인 — 회귀 없음.

## 요약

이번 changeset 은 4라운드에 걸친 리뷰·fix 이력을 통해 이미 세 가지 실제 우회 경로(object/array
leaf, touch 영구해제, 무효 JSON 폴백)를 정확한 캐너리로 고정했고, backend 세 읽기 표면과
frontend 세 소비처(폼 프리필·Re-run 모달·에디터 히스토리 로드) 전부에 직접 단언이 존재한다.
mock 은 실구현을 우회하지 않고 실제 마스킹 함수를 태우며, 신규 테스트 블록은 기존 스위트와
격리돼 있다. 남은 갭은 전부 INFO 수준이다 — (1) `blockedByMaskedInput` 의 "값-비었음 우회"
원 시나리오(boolean + 지연 스키마)를 정확히 재현하는 캐너리 부재(구조적으로는 이미 막혀 있음),
(2) 사용자가 직접 입력하는 "Run with Input" 자유 텍스트 경로에서 `hasMaskedMarkerLeaf` 재귀의
깊이 상한 미검증(이전 라운드가 다룬 "backend 검증 통과 데이터" 전제와는 다른 입력원), (3)
frontend-backend 마커 리터럴 "일치" 테스트가 실제로는 자기 파일 내 리터럴 비교라 진짜
크로스체크가 아님(이미 트래커 등재 추정). 셋 다 현재 동작을 깨뜨리는 살아있는 결함이 아니라
회귀 방지 두께를 한 겹 더할 수 있는 지점이다.

## 위험도

LOW
