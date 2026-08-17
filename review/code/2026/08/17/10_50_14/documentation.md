# 문서화(Documentation) 코드 리뷰

## 발견사항

- **[WARNING]** `describe` 블록 제목이 레벨 분리(83436ed45) 이후에도 옛 정책("inputData 는 비대상")을 그대로 단언한다 — 같은 블록 안의 `⑤`·`⑥-b` 테스트는 정확히 그 반대(노드 레벨 `inputData` 는 마스킹됨)를 고정한다.
  - 위치: `codebase/backend/src/modules/executions/executions.service.spec.ts:1127` — `describe('outputData 응답 마스킹 — 표면 전수 (+ inputData 비대상 고정)', () => { ... })`
  - 상세: 이 제목은 커밋 `b05756d9e`(`inputData` 마스킹 전면 철회)에서 마지막으로 갱신됐고, 그 시점엔 정확했다(Execution·Node 레벨 구분 없이 전부 비대상). 그런데 이후 커밋 `83436ed45`(재제출 카브아웃을 `Execution` 레벨로 한정 — CRITICAL 수정)가 같은 파일 안에서 `⑤`(`:1008` 부근)·`⑥-b`(`:1294`) 테스트 바디와 인접 인라인 주석을 "노드 레벨은 `inputData` 도 마스킹 대상" 으로 정확히 갱신했지만, 그보다 250여 줄 앞의 이 `describe` 제목은 손대지 않았다(`git log -L1127,1127:...` 로 확인 — 마지막 수정 커밋은 `b05756d9e`뿐). 이후 round 5 수정(`09286d542`)도 `⑧` 앞 JSDoc 블록만 "방향별 표"로 재작성했을 뿐 이 제목은 여전히 그대로다. 결과적으로 `it('⑧ …', …)` 코드 바로 위 JSDoc은 "두 방향으로 갈린다"고 정확히 경고하는데, 그 JSDoc 을 포함하는 상위 `describe` 블록의 제목 자체는 "inputData 비대상 고정"이라는 단일(옛) 방향만 단언하는 모순이 남아 있다. 이 저장소가 이번 changeset 내내 반복해서 겪고 스스로 커밋 메시지에 기록한 결함 클래스("이 주석이 두 번 틀렸다" — `00_23_57` W1, `10_26_58` W5)와 형태가 같다 — 단지 이번엔 인라인 JSDoc이 아니라 `describe` 타이틀이라는, 이전 5라운드 리뷰가 훑지 않은 자리에서 재발했다.
  - 제안: 제목을 레벨을 명시하도록 정정한다. 예: `describe('outputData·노드-레벨 inputData 응답 마스킹 — 표면 전수 (Execution.inputData 는 카브아웃)', ...)` 또는 그냥 방향 서술을 제거하고(`describe('outputData/inputData(노드 레벨) 응답 마스킹 — 표면 전수', ...)`) 세부 방향은 이미 정확한 하위 테스트 이름·JSDoc에 맡긴다.

## 확인했으나 문제 없음 (참고)

- CHANGELOG.md 최상단 항목의 "카브아웃은 `Execution` 레벨 한정" 블록·`inputData` 단락은 코드(`MASKED_INPUT_DATA_REASON` JSDoc, `executions.service.ts:57-94`)·plan(`eia-fanout-and-internal-data-masking.md` "철회의 범위 정정" 절)·트래커(`spec-sync-external-interaction-api-gaps.md` "범위 정정" 표)와 방향·근거가 모두 정합한다.
- `ExecutionDto.inputData`/`outputData`, `NodeExecutionSummaryDto.inputData`(신규 선언), `BackgroundRunNodeExecutionDto.inputData`/`outputData` 의 JSDoc·Swagger `description` 이 코드 동작(`executions.service.ts` `maskIfPresent`/`toResponseExecution`, `background-runs.service.ts`)과 대칭적으로 일치한다. `NodeExecutionSummaryDto.inputData` 는 "런타임엔 항상 있었는데 스키마에만 없었다"는 선존 갭 설명이 정확하고, 자매 `BackgroundRunNodeExecutionDto` 와 형태가 대칭이다.
- `run-results.mdx`/`.en.mdx` 의 Input·Output 두 행 모두 노드 레벨 마스킹 캐비엇을 대칭으로 담고 있다(KO/EN 문구 대응 확인) — 코드가 실제로 노드 레벨 `inputData`/`outputData` 를 마스킹하는 것과 일치한다.
- `sanitize-error-message.ts` 의 `MASKED_MARKERS`/`VALUE_MASK_MARKER` 앞 대형 JSDoc이 여전히 인접 한 줄 주석 때문에 어느 상수에도 공식 귀속되지 않는 상태(고아 주석)로 남아 있으나, 이는 `00_47_01` documentation W1 에서 WARNING 으로 지적된 뒤 같은 라운드에서 "고치면 5R 이 또 열린다"는 근거로 **의도적으로 이연**했고, `spec-sync-external-interaction-api-gaps.md:293-299` 에 사유와 함께 정확히 등재돼 있다. 재발 확인만 하고 재차 WARNING 으로 올리지 않는다 — 등재된 이연 사유가 여전히 유효하다(내용·동작 무관, 순수 배치 문제).
- `redact-stored-error.ts` 의 `redactStoredDataForResponse` JSDoc(`error` 와의 차이, ingestion-time 마스킹과 경쟁하지 않는 이유, `@returns` copy-on-change 설명)과 `background-runs.service.ts` 의 "자매 표면" 주석(`toResponseExecution` 표를 정본으로 가리킴)은 이번 diff 에서 갱신된 상태 그대로 정확하다.
- `plan/in-progress/eia-fanout-and-internal-data-masking.md`·`plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 "철회의 범위 정정"/"범위 정정" 절은 캐너리 방향(`①②⑧⑧-b` vs `⑤⑥-b`+background-runs)을 표로 정확히 갈라 서술하며, 실제 테스트 코드의 방향과 대조해도 일치한다.

## 요약

이번 changeset(5라운드에 걸친 EIA 마스킹 후속 조치 누적분)은 JSDoc·Swagger·CHANGELOG·유저 가이드·plan·트래커 문서를 이례적으로 촘촘하게 동반 갱신해 왔고, 이번 라운드에서 직접 대조한 범위에서는 코드-문서 정합성이 대체로 양호하다. 다만 `executions.service.spec.ts:1127` 의 `describe` 블록 제목이 레벨-분리 수정(`83436ed45`) 이후에도 옛(레벨 무관) 정책을 단언한 채로 남아 있어, 이 저장소가 5라운드 내내 스스로 지적·수정해 온 "주석이 코드보다 좁게/틀리게 갱신된다" 결함 클래스가 `describe` 타이틀이라는 새 위치에서 재발했다 — 실질 동작·보안 위험은 없지만 향후 편집자가 테스트 스위트 구조만 보고 정책을 오판할 수 있는 자리라 정정을 권장한다. 이미 트래커에 등재되어 의도적으로 이연된 항목(`sanitize-error-message.ts` 마커 JSDoc 고아 문제)은 사유가 여전히 유효해 재차 상향하지 않았다.

## 위험도
LOW
