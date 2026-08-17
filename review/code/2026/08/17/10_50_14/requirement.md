# 요구사항(Requirement) 코드 리뷰

## 리뷰 방법

이 changeset 은 이미 5 라운드의 `/ai-review`(`23_08_19`→`23_50_03`→`00_23_57`→`00_47_01`→`10_26_58`)와
다수의 `/consistency-check` 라운드를 거쳐 CRITICAL/WARNING 이 전부 그 자리에서 해소된 상태다
(각 `RESOLUTION.md` 확인). 이번 라운드는 그 누적 결과물에 대한 최종 확인이라, review/ 아래
과거 라운드 산출물(파일 22~136)은 "메타 기록"으로 취급하고 실제 코드·DTO·spec 본문을 직접
Read/Grep 으로 재대조했다 — 실제 소스(`executions.service.ts`, `websocket.service.ts`,
`redact-stored-error.ts`, `sanitize-error-message.ts`, `background-runs.service.ts`, 각 DTO)를
전문 열람하고 `spec/5-system/14-external-interaction-api.md` §R17, `13-replay-rerun.md` §10.2,
`1-data-model.md` §2.13/§2.13.1, `15-chat-channel.md` CCH-MP-06, `frontend/rerun-modal.tsx` 를
line-level 로 대조했다.

## 발견사항

- **[INFO]** CHANGELOG 최신 `## Unreleased` 항목의 마지막 문단이 자기 앞 문단과 모순된 채 남아 있다 — 기능적 결함은 아니고 릴리스 노트 정확도 문제.
  - 위치: `CHANGELOG.md` — "⚠️ wire 변화" 문단, `유저 가이드의 Output 탭 설명에 이 캐비엇을 추가했다` 문장 (게이트 `49`).
  - 상세: 같은 항목의 바로 위 문단(게이트 `26`-`33`, "카브아웃은 `Execution` 레벨 한정이다")은 `NodeExecution.inputData`(노드 레벨)가 **마스킹된다**고 정확히 서술하는데, 마지막 문단은 "유저 가이드의 **Output** 탭 설명에 캐비엇을 추가했다"고만 적는다. 실제 diff(`run-results.mdx`/`.en.mdx`)는 **Input 탭에도** 같은 캐비엇을 추가했다 — `10_26_58` 라운드 RESOLUTION 항목 #4("유저 가이드 Input 행에 마스킹 캐비엇(KO/EN) — 이제 노드 레벨이 마스킹되므로 Output 행과 대칭이 맞다")가 이미 그렇게 반영했다. 즉 코드/문서 diff 자체는 옳고 CHANGELOG 서술만 그 이후 갱신에서 누락됐다.
  - 제안: `유저 가이드의 Input/Output 탭 설명에 이 캐비엇을 추가했다`로 한 단어만 정정. 기능 영향 없음(비차단).

- **[INFO]** 유저 가이드 "Error" 탭 설명(`run-results.mdx`/`.en.mdx`)에는 마스킹 캐비엇이 없다 — `NodeExecution.error`도 이 PR 이전(#1177/#1179)부터 이미 마스킹 대상인데 문서화가 안 됐다. **새로 발견한 항목이 아니라, 이미 `plan/in-progress/spec-sync-external-interaction-api-gaps.md:301-302`에 `00_23_57` documentation INFO-19 로 등재되어 있고 이번 라운드까지 의도적으로 미조치임을 실측으로 재확인**.
  - 위치: `codebase/frontend/src/content/docs/05-run-and-debug/run-results.en.mdx` "Error" 행 / `plan/in-progress/spec-sync-external-interaction-api-gaps.md:301`.
  - 제안: 조치 불요(이미 트래커 등재, 이연 근거 명시됨). 후속 라운드에서 처리될 항목.

## 점검 결과 상세 (CRITICAL/WARNING 없음의 근거)

- **기능 완전성 / 표면 커버리지**: EIA §R17 이 정본으로 못박은 "여섯 표면·둘 컬럼"이 코드와 정확히 일치한다 — `findById`(`toResponseExecution` 경유) · `getChain` · `stop` · `toExecutionDto`(목록) · `findById`의 `nodeExecutions[]` · `BackgroundRunsService.toNodeExecutionDto`. 모두 `redactStoredDataForResponse`/`redactStoredErrorForResponse`를 통과한다. WS 는 `emitExecutionEvent`/`emitNodeEvent` 두 emit 이 공유하는 `maskWireEnvelope`(wire) → `toFanoutEnvelope`(fanout) 단일 초크포인트를 지난다.
- **엣지 케이스**: `redactStoredDataForResponse`/`redactStoredErrorForResponse` 는 `null`/`undefined` 를 `null` 로 정규화하고, `deepRedactCore` 는 비-객체(string/number/array) 를 안전 처리한다(jsonb 레거시 원시값 대비). `maskIfPresent` 는 TypeORM 이 런타임에 `undefined` 를 줄 수 있는 방어 분기를 갖고 copy-on-change 를 지킨다.
- **비즈니스 로직 (핵심 결정)**: `Execution.inputData`(REST 최상위) 는 마스킹 **비대상**, `NodeExecution.inputData`(노드 레벨) 는 마스킹 **대상** — 이 비대칭의 근거(Re-run 모달 프리필 재제출 경로)를 프런트 소스로 직접 추적해 확증했다: `rerun-modal.tsx:181`(`useOriginalInput` 기본값 `false`) → `:284`(`inputOverride: paramValues` 제출). 서버 `reRun()` 은 `useOriginalInput=true` 시 `original.inputData` 를 **raw 쿼리로 직접 재조회**(마스킹 관문 미경유, `executions.service.ts:464-519`)하므로 "기본 Re-run 은 영향 없다"는 주석 주장도 소스로 확인된다.
- **반환값**: 모든 관문 함수(`toResponseExecution`, `toExecutionDto`, `toNodeExecutionDto`, `redactStoredDataForResponse`, `redactStoredErrorForResponse`, `maskWireEnvelope`, `toFanoutEnvelope`)가 모든 경로(값 있음/없음/이미 마스킹됨)에서 타입에 맞는 값을 반환한다. `ResponseExecution`/`ResponseNodeExecution` 명시 타입이 `error`/`outputData`(그리고 `NodeExecution`은 `inputData`도)의 `| null` 가능성을 반환 타입에 드러내 `as Execution` 무단 단언을 제거했다.
- **에러 시나리오**: 마커 재마스킹 방지(`isMaskedMarker`)가 webhook ingestion `[REDACTED]` 마커를 보존해 12-webhook §5.3 계약과 충돌하지 않음을 `.spec.ts` 캐너리로 고정. `llmCalls` 는 wire 에서만 예외(`WIRE_PRESERVED_FIELDS` = `EXTERNAL_STRIPPED_FIELDS` 재사용)이고 fanout 에서는 필드째 제거되어 외부 노출이 늘지 않는다.
- **spec fidelity**: `spec/5-system/14-external-interaction-api.md` §R17 의 "적용 범위는 총칭이 아니라 열거다"(여섯 표면·둘 컬럼), "`input`/`inputData` 의 마스킹 여부는 레벨이 가른다" 표, `spec/1-data-model.md` §2.13/§2.13.1 의 `input_data`/`output_data` 행 설명, `spec/5-system/13-replay-rerun.md` §10.2 캐비엇, `spec/5-system/15-chat-channel.md` CCH-MP-06 캐비엇이 모두 코드 구현과 line-level 로 일치한다. 이전 라운드가 지적한 spec 자기모순(§2.13 의 stale "4곳"/"WS emit 미포함")도 이미 정정되어 있다(`git blame` 상 `00_47_04` 라운드 반영 확인).
- **TODO/FIXME/HACK/XXX**: 리뷰 대상 7개 핵심 소스 파일(`background-runs.service.ts`, `background-run-response.dto.ts`, `execution-response.dto.ts`, `executions.service.ts`, `websocket.service.ts`, `redact-stored-error.ts`, `sanitize-error-message.ts`) 전수 grep 결과 0건.

## 요약

`inputData`/`outputData`/WS emit 값-패턴 마스킹 확장은 EIA §R17 정본 표·데이터 모델·Re-run/Chat-Channel spec 캐비엇과 소스 코드가 line-level 로 정합하며, 이미 5회의 ai-review 라운드가 CRITICAL(재제출 오염 — `inputData` 전면 마스킹 철회)과 WARNING 다수(자매 표면 누락, 캐너리 방향 오분류, 유저 가이드 비대칭)를 그 자리에서 해소했다. 이번 최종 확인에서 새 CRITICAL/WARNING 은 발견되지 않았고, 유일한 잔여는 CHANGELOG 마지막 문단이 자신이 설명하는 diff 범위(Input+Output 탭)를 "Output 탭"으로만 좁게 서술하는 텍스트 수준의 자기모순(INFO, 비차단)이다. `Execution.inputData` 비대상 vs `NodeExecution.inputData` 대상이라는 핵심 비즈니스 규칙은 프런트 Re-run 모달 소스까지 직접 추적해 근거가 유효함을 재확인했다.

## 위험도
NONE
