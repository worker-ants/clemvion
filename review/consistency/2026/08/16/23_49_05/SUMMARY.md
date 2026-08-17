# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 1건 발견 (Re-run/Mock-Input 재제출 경로가 §R17 egress 마스킹과 충돌해 마스킹 리터럴 `***` 가 실제 재실행 입력으로 흘러갈 수 있음)

## 전체 위험도
**HIGH** — 5개 checker 중 4개(rationale_continuity/convention_compliance/plan_coherence/naming_collision)는 LOW 로 수렴했으나, cross_spec 이 코드 추적으로 확증한 CRITICAL 1건이 전체 위험도를 끌어올린다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | EIA §R17 의 `inputData`/`outputData` egress 마스킹 확대가 Re-run 모달·Mock Input "Load from History" 의 재제출(read-then-resubmit) 경로를 오염시킨다 — 마스킹된 필드를 사용자가 건드리지 않고 재실행하면 리터럴 `"***"` 가 새 Execution 의 실제 입력값으로 제출됨 (기능적 값 오염, 단순 가시성 저하 아님) | `spec/5-system/14-external-interaction-api.md` §R17 6-surface 열거 (구현: `executions.service.ts` `toResponseExecution`/`toExecutionDto`, `redact-stored-error.ts` `redactStoredDataForResponse`) | `spec/5-system/13-replay-rerun.md` §10.2 Re-run 모달 (기본 "원본 미리보기+편집", `useOriginalInput=false` 시 클라이언트가 보낸 `inputOverride` 를 검증만 하고 그대로 사용 — `rerun-modal.tsx`, `executions.service.ts:470-494`), `spec/3-workflow-editor/3-execution.md` §2.2 Mock Input 히스토리 로드 (`GET /executions/workflow/:id` → `toExecutionDto` 마스킹값을 textarea 에 적재 후 그대로 재실행) | (a) 프리필 전용 unmask 경로 분리, (b) 프론트가 마스킹 마커(`VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/`DEPTH_MASK_MARKER`)를 감지해 해당 필드 read-only 강제/제출 차단, (c) 최소한 `13-replay-rerun.md`§10.2·`3-execution.md`§2.2 에 "마스킹된 필드는 재입력 필요" 캐비엇 명문화 + `plan/in-progress/eia-fanout-and-internal-data-masking.md` 의 "수용된 trade-off" 서술도 이 되먹임 시나리오 반영해 갱신 |

## planner 인계 (권한 밖 Critical)

> 이 Critical 은 **developer 권한 밖**이다 — 근본 해소(a/b/c 어느 경로든) 는 `spec/13-replay-rerun.md`·`spec/3-workflow-editor/3-execution.md` 갱신(옵션 c, 최소선) 또는 마스킹 경계·권한 축 재설계(옵션 a) 를 요구하며, 이는 모두 `spec/` 쓰기 권한을 가진 `project-planner` 의 결정 사항이다. 등급은 CRITICAL 그대로이고 `BLOCK: YES` 도 유지된다 — 이 표는 차단을 푸는 장치가 아니라 다음 행동을 지정하는 장치다.

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| 1 | 해소책이 `spec/5-system/` 밖(`spec/2-navigation` 또는 `spec/3-workflow-editor`)의 UI 계약 결정 + 마스킹 경계 재설계를 요구 — developer 는 `spec/` read-only | project-planner | 최소선(c): `spec/5-system/13-replay-rerun.md` §10.2 및 `spec/3-workflow-editor/3-execution.md` §2.2 에 "마스킹된 필드는 재입력 필요" 캐비엇 추가 + `plan/in-progress/eia-fanout-and-internal-data-masking.md` "수용된 trade-off" 절에 되먹임 리스크 반영. 근본선(a/b): 마스킹 우회 프리필 경로 또는 프론트 마스킹-마커 가드 설계 후 관련 spec 반영 | `plan/in-progress/spec-sync-external-interaction-api-gaps.md` (§R17 잔여 트래커에 신규 항목으로 등재 권장) |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | naming_collision | 신규 6-surface 열거(①~⑥)가 같은 §R17 절의 기존 "잔여 ①②③" 원형숫자 표기와 글리프를 공유 — 두 개의 무관한 열거가 같은 절 안에서 같은 숫자 계열을 씀 | `spec/5-system/14-external-interaction-api.md:1514-1516` (신규 6-surface) vs `:1523,1526,1528` (잔여 ①②③, `plan/complete/eia-internal-rest-error-masking.md`·`plan/in-progress/spec-draft-eia-fanout-masking.md` 가 외부 인용 중) | 신규 6-surface 열거를 코드 정본(`toResponseExecution` JSDoc, 이미 아라비아 숫자 1~6 사용)과 동일하게 아라비아 숫자(`1.`~`6.` 또는 `(1)`~`(6)`)로 바꾸고, 원형숫자(①②③)는 기존 "잔여" 열거 전용으로 남길 것 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `execution.node.*` WS 이벤트 필드명 `nodeName`→`nodeLabel` 정정은 타 spec 영역과 이미 정합 (조치 불요) | `spec/5-system/6-websocket-protocol.md` §4.1 | 조치 불요 |
| 2 | rationale_continuity | `llmCalls` strip-only 결정과 신규 값-패턴 마스킹의 경계가 명확하나, `## Rationale` 헤더 바로 아래 구분표 요약이 있으면 향후 오인 방지에 도움 | `spec/5-system/6-websocket-protocol.md` `## Rationale` `llmCalls` 절 | 선택 사항, 강제 아님 |
| 3 | rationale_continuity | R10 "WebsocketService 단일 sink 정책"이 신규 마스킹 초크포인트를 언급하지 않음(모순은 아님) | `spec/5-system/14-external-interaction-api.md` §R10 | R10 말미에 "이 sink 직전에 §R17 값-패턴 마스킹 초크포인트가 있다" 1줄 교차 참조 추가 (선택 사항) |
| 4 | convention_compliance | 신규 DTO JSDoc(`inputData`/`outputData`/`error`)이 `swagger.md §3` 길이 가이드라인(10~40자) 초과 — 단, 같은 파일 기존 필드에도 이미 있던 패턴의 연장 | `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts` (`inputData` `:49-57` 등) | 이번 PR 에서 되돌릴 필요 없음. 추세 지속 시 `swagger.md §3` 에 보안/마스킹 caveat 예외 규정 추가 또는 JSDoc 분리 검토 |
| 5 | plan_coherence | `6-websocket-protocol.md` 편집(+11행)으로 `spec-update-node-cancellation-shutdown-classification.md` #9·`spec-draft-eia-62-waiting-payload.md` 의 이미 존재하던 stale 라인 인용이 더 벌어짐 (원인은 target 이전부터의 선재 drift, target 이 신규로 만든 결함 아님) | `spec/5-system/6-websocket-protocol.md` §4.1 / `## Rationale` | 후속 티켓으로 `grep -rn "6-websocket-protocol\.md:[0-9]" plan/ spec/` 전수 재확인 후 심볼/섹션 기준 인용으로 전환 권장 |
| 6 | naming_collision | `execution.node.*` 신규 emit 마스킹 불릿과 기존 `error` 카탈로그 불릿 제목 구분 — 충돌 아님, 의도적 사전대조 확인 | `spec/5-system/14-external-interaction-api.md:1440,1464,1535` | 조치 불요 |
| 7 | naming_collision | 신규 코드 식별자(`redactStoredDataForResponse`·`WIRE_PRESERVED_FIELDS`·`toFanoutEnvelope`·`maskWireEnvelope`·`deepRedactSecretsPreserving`) 기존 패밀리와 충돌 없음, 실측 확인 | 코드베이스 전역 (`git grep`) | 조치 불요 |
| 8 | naming_collision | `nodeName`→`nodeLabel` 정정은 신규 도입이 아니라 기존 spec 전역 용례로의 수렴 | `spec/5-system/6-websocket-protocol.md` §4.1 | 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | HIGH | Re-run/Mock-Input 재제출이 §R17 egress 마스킹과 충돌해 `***` 가 실제 재실행 입력값으로 흘러갈 수 있음 (CRITICAL 1건) |
| rationale_continuity | LOW | `llmCalls` strip-only·R10 단일 sink·ingestion/egress 공존 서술 모두 검증됨, 과거 결정 재도입/무근거 번복 없음. INFO 2건(교차 참조 보강 여지) |
| convention_compliance | LOW | 명명·출력 포맷·문서 구조·API 문서·금지 항목 5관점 전부 위반 없음. INFO 1건(DTO JSDoc 길이 가이드라인 초과, 기존 패턴 연장) |
| plan_coherence | LOW | 정본 트래커(`spec-sync-external-interaction-api-gaps.md`) 열린 항목만 정확히 닫고 미해결 결정 우회 없음. INFO 1건(선재 라인-인용 drift 확대) |
| naming_collision | LOW | 신규 코드 식별자 전부 기존 패밀리와 grep 레벨 일치. WARNING 1건(원형숫자 글리프 재사용) |

## 권장 조치사항
1. **(BLOCK 해소 우선)** `project-planner` 턴에서 §planner 인계 #1 집행: 최소선으로 `spec/5-system/13-replay-rerun.md` §10.2 와 `spec/3-workflow-editor/3-execution.md` §2.2 에 "마스킹된 필드는 재입력 필요" 캐비엇을 추가하고, `plan/in-progress/eia-fanout-and-internal-data-masking.md` 의 "수용된 trade-off" 서술에 되먹임 리스크를 반영한다. 여력이 되면 근본선(마스킹 마커 감지 후 read-only 강제, 옵션 b)까지 같은 턴에 설계해 `spec-sync-external-interaction-api-gaps.md` 에 신규 항목으로 등재한다.
2. WARNING #1: `14-external-interaction-api.md` §R17 신규 6-surface 열거를 아라비아 숫자로 변경해 기존 "잔여 ①②③" 표기와 글리프 충돌을 해소한다 (developer/planner 어느 턴에서도 가능한 저비용 spec 수정).
3. INFO 항목들은 즉시 조치 불요 — 후속 티켓 또는 다음 편집 시 반영 권장 사항으로 남긴다.