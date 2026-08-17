# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 프로덕션 코드·보안·spec 은 CRITICAL/WARNING 없이 클린하나, 브랜치 최종 커밋(`83436ed45`, "재제출 카브아웃을 Execution 레벨로 한정")이 formal spec 만 갱신하고 **CHANGELOG·plan 트래커·유저 가이드·테스트 JSDoc 네 곳을 스테일하게 남겨**, 그 문서들만 보면 방금 고친 WS↔REST flip-flop CRITICAL 을 되돌리는 방향(노드 레벨 `inputData` 를 다시 "비대상"으로)으로 오도될 수 있음. 모든 forced reviewer(7명) 결과 확보됨 — 화이트리스트 미이행 없음.

## Critical 발견사항

(없음)

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing / documentation (중복 통합) | `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 가 최종 커밋(`83436ed45`)으로 뒤집힌 캐너리(`⑥-b`, `background-runs.service.spec.ts`)의 의도를 여전히 옛 방향("비대상 고정")으로 서술한다 — 실제로는 노드 레벨 `inputData` 가 이제 **마스킹 대상**으로 전환됨 | `plan/in-progress/spec-sync-external-interaction-api-gaps.md:270-271` | `⑥-b`·`background-runs.service.spec.ts` 를 "비대상" 목록에서 제거하고 "노드 레벨은 오히려 마스킹 대상으로 전환됐다(2026-08-17, `83436ed45`)" 캐비엇 추가, 또는 `⑧`·`⑧-b` 만 남긴다 |
| 2 | documentation | `CHANGELOG.md` 의 `Unreleased` 항목이 "`inputData` 는 마스킹하지 않는다"를 블랭킷 서술로 남겨, 최종 커밋이 재도입한 `NodeExecution.inputData` 마스킹(레벨 구분)을 반영하지 못함 | `CHANGELOG.md:26-33` | "단, `NodeExecution.inputData`(노드 레벨)는 재제출 소비처가 없어 마스킹 대상이다 — 카브아웃은 `Execution` 레벨 한정" 캐비엇 추가 |
| 3 | documentation | `plan/in-progress/eia-fanout-and-internal-data-masking.md` 의 요약 표·§철회·§부작용 섹션이 같은 최종 커밋의 레벨-기반 재택일을 반영하지 못해 formal spec 과 어긋남 | `plan/in-progress/eia-fanout-and-internal-data-masking.md:32, 159-181, 188-192` | 표 B행과 §부작용 표에 `Execution` vs `NodeExecution` 레벨 구분 캐비엇 추가, 또는 §철회 말미에 최종 결정을 가리키는 각주 추가 |
| 4 | documentation | `run-results.mdx`/`.en.mdx` 의 "Input" 행이 이제 마스킹 대상인 노드 레벨 `inputData` 캐비엇을 담지 않아 "Output" 행과 비대칭 | `run-results.en.mdx:60`(Input) vs `:61`(Output) / `run-results.mdx:71` vs `:72` | Input 행 description 끝에 Output 행과 대칭되는 마스킹 캐비엇 문구 추가 |
| 5 | documentation | `executions.service.spec.ts` 신규 JSDoc 블록이 `⑥-b`(및 `BackgroundRunsService` 자매 스펙)를 "비대상 고정" 다섯 표면 중 하나로 오분류 — 실제로는 정반대(마스킹 대상)를 검증. "다섯 표면" 수치 자체가 이 오분류에서 파생됨 | `codebase/backend/src/modules/executions/executions.service.spec.ts:1362-1376` | 블록을 "Execution 레벨 비대상 4곳: ①②⑧⑧-b" / "노드 레벨 마스킹 캐너리: ⑤·⑥-b + `BackgroundRunsService`" 두 그룹으로 분리 서술 |
| 6 | side_effect | `NodeExecutionSummaryDto`(Swagger) 가 `inputData` 필드를 선언하지 않는데, 실제 응답(`GET /executions/:id` 의 `nodeExecutions[]`)에는 이번 PR 최종 커밋부터 **마스킹된 값**으로 포함됨 — 공개 API 스키마와 실응답의 괴리에 "마스킹 정책 비공개"라는 새 성격이 얹힘. 자매 DTO(`BackgroundRunNodeExecutionDto`)는 같은 필드를 문서화했음(비대칭) | `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts`(`NodeExecutionSummaryDto`) | `inputData?: Record<string, unknown> \| null` 을 `@ApiPropertyOptional` 로 추가, `BackgroundRunNodeExecutionDto.inputData` 와 대칭되는 설명(`MASKED_INPUT_DATA_REASON` 참조) 부여 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | `SECRET_LEAK_PATTERNS` 가 bare `token=` 키워드를 포착 못함 (기지의 잔여 갭, 트래커 등재됨) | `codebase/backend/src/shared/utils/sanitize-error-message.ts:33-52` | 조치 불요 — `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 등재됨, 캐너리로 경계 고정됨 |
| 2 | security | 자격증명 없는 연결 문자열·내부 호스트명은 마스킹 통과 (설계상 의도된 경계) | `redact-stored-error.ts:18-21` | 조치 불요 |
| 3 | security | `execution:<id>` WS 채널 구독 인가가 role 미검사 (선존 상태, 이번 diff 는 오히려 완화 방향) | `execution-channel-authorizer.ts:26-40` | 조치 불요 — role 세분화 필요 시 별도 plan |
| 4 | security | `Execution.inputData` 마스킹 제외 carve-out — 외부 EIA API 는 애초에 `inputData` 미노출(실측 확인) | `executions.service.ts:57-91, 1044-1045, 1108-1109` | 조치 불요 |
| 5 | security | DB-at-rest 는 마스킹되지 않은 원문 보존 (egress-only 설계, 문서화된 트레이드오프) | `redact-stored-error.ts:16, 60-61` | 조치 불요 |
| 6 | requirement | `Execution.inputData` vs `NodeExecution.inputData` 카브아웃이 코드·테스트·spec 3층에서 정확히 대칭 구현됨을 직접 확인 | `executions.service.ts` `toResponseExecution`/`findById`/`toExecutionDto` | 조치 불요 |
| 7 | requirement | WS emit 값-패턴 마스킹 초크포인트(`maskWireEnvelope`→`toFanoutEnvelope`)가 두 emit 호출부 모두에서 공유됨을 실측 | `websocket.service.ts` `emitExecutionEvent`/`emitNodeEvent` | 조치 불요 |
| 8 | requirement | `6-websocket-protocol.md:184` 의 과거 자기모순이 이번 changeset 반영본에는 더 이상 없음 (이전 라운드 지적 해소 확인) | `spec/5-system/6-websocket-protocol.md:184, 193` | 조치 불요 |
| 9 | requirement | RESOLUTION.md/CHANGELOG 주장 "잔여 갭"이 실제로 트래커에 등재돼 있음을 확인 | `plan/in-progress/spec-sync-external-interaction-api-gaps.md:172, 282` | 조치 불요 |
| 10 | requirement | `maskIfPresent` 의 `mask(value) ?? value` 방어 분기는 현재 도달 불가능한 코드 (기존 처분 유지) | `executions.service.ts:118-123` | 조치 불요(기존 결론 유지) |
| 11 | scope | plan-lifecycle 관리 작업(완료 plan 이동)이 이번 기능 diff 에 함께 묶임 — 순수 이동, 이미 저위험 수용됨 | `plan/complete/eia-internal-rest-error-masking.md` 등 | 조치 불요, PR 설명에 별개 사유 명시 재권고 |
| 12 | scope | `nodeName`→`nodeLabel` 용어 정정이 이번 마스킹 기능과 무관하게 곁들여 반영됨 (drive-by, 저위험) | `spec/5-system/3-error-handling.md:249, 258` | 조치 불요 |
| 13 | scope | `review/code/**`·`review/consistency/**` 대량 신규 파일은 정상 리뷰 워크플로 산출물 | `review/code/2026/08/16-17/**` | 조치 불요 |
| 14 | testing | `NodeExecutionSummaryDto` 에 `inputData` 계약 테스트 없음 — side_effect #6 과 동일 근거, 전제가 최신 커밋으로 재부상 | `execution-response.dto.ts:143` | DTO 필드 목록과 `ResponseNodeExecution` 키 대조하는 계약 테스트 추가 고려 |
| 15 | testing | `emitNodeEvent` wire 테스트가 `error` 필드로만 마스킹 확인, 이번 커밋이 고친 실결함의 당사자 필드(`input`)를 wire 쪽에서 직접 안 겨눔 | `websocket.service.spec.ts` `② emitNodeEvent — wire 도 마스킹` | `input: LEAKY_INPUT` 추가해 `wire.input` 마스킹도 함께 단언 |
| 16 | maintainability | `MASKED_INPUT_DATA_REASON` 상수명이 "왜 마스킹 안 하는가"(카브아웃 근거)인데 이름은 "왜 마스킹 하는가"로 읽힘 | `executions.service.ts:90` | `INPUT_DATA_MASK_CARVEOUT_REASON` 등으로 리네임 고려(비긴급) |
| 17 | maintainability | 마커 상수는 이번 PR 이 통합했으나 깊이 상한 상수(`MAX_SANITIZE_DEPTH`/`MAX_REDACT_DEPTH`)는 여전히 독립 중복(값만 우연히 동일) | `websocket.service.ts:70`, `sanitize-error-message.ts:93` | 한쪽을 export 해 다른 쪽이 재사용하도록 통합 (후속 항목으로 트래커 등재 권장) |
| 18 | maintainability | `redactStoredErrorForResponse`/`redactStoredDataForResponse` 두 함수 본문이 완전 동일 (기존 의도적 미조치, 재확인) | `redact-stored-error.ts:28-35, 66-71` | 조치 불요(기존 결정 유지) |
| 19 | maintainability | 신규 테스트가 QueryBuilder 손수-mock 패턴을 헬퍼화 없이 계속 복제 | `executions.service.spec.ts:1176-1193, 1377-1392` | `buildChainQB`/`buildStopQB` 공용 헬퍼 추출 고려(비필수) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 신규 CRITICAL/WARNING 없음. 잔여 갭(bare `token=`, DSN 자격증명 없음 통과, role 미검사)은 전부 트래커 등재 또는 완화 방향 |
| requirement | NONE | 카브아웃 대칭 구현, WS 초크포인트 공유, spec 자기모순 해소 모두 실측 확인. 신규 결함 없음 |
| scope | LOW | plan-lifecycle 이동 + 용어 정정 drive-by 는 저위험, 이미 이전 라운드 검토·수용됨 |
| side_effect | LOW | `NodeExecutionSummaryDto` 에 `inputData` 미선언인데 마스킹 정책이 새로 얹힘 (WARNING 1건) |
| maintainability | LOW | CRITICAL/WARNING 없음. 상수명 반전 가독성·깊이 상한 잔여 중복 등 INFO 다수, 구조 개선 다수 긍정 언급 |
| testing | LOW | 트래커 문서가 최신 커밋으로 뒤집힌 캐너리 방향을 옛 서술로 남김 (WARNING 1건). 뮤테이션 검증으로 캐너리 vacuous 아님 확인 |
| documentation | MEDIUM | CHANGELOG·plan·유저 가이드·테스트 JSDoc 네 곳이 최종 커밋(레벨-기반 재택일)을 반영 못해 실제보다 좁게(비마스킹으로) 서술 — 안전 방향 오차이나 혼란 유발 가능 |

## 발견 없는 에이전트

(없음 — 7개 reviewer 모두 최소 INFO 이상 발견 보고)

## 권장 조치사항

1. **[최우선]** `plan/in-progress/spec-sync-external-interaction-api-gaps.md:270-271` 정정 — `⑥-b`·`background-runs.service.spec.ts` 를 "비대상 고정" 목록에서 제거하고 최종 커밋(`83436ed45`)이 노드 레벨 `inputData` 를 마스킹 대상으로 전환했음을 명시. 방치 시 후속 작업이 방금 고친 WS↔REST flip-flop CRITICAL 을 되돌릴 위험.
2. `executions.service.spec.ts:1362-1376` JSDoc 블록을 "Execution 레벨 비대상(①②⑧⑧-b)" / "노드 레벨 마스킹 대상(⑤⑥-b + BackgroundRunsService)" 두 그룹으로 재분류.
3. `CHANGELOG.md` Unreleased 항목에 노드 레벨 `inputData` 마스킹 재도입 캐비엇 추가.
4. `plan/in-progress/eia-fanout-and-internal-data-masking.md` 요약 표·§부작용 표에 Execution/NodeExecution 레벨 구분 캐비엇 추가.
5. `run-results.mdx`/`.en.mdx` Input 행에 Output 행과 대칭되는 마스킹 캐비엇 문구 추가.
6. `NodeExecutionSummaryDto` 에 `inputData` 필드를 `@ApiPropertyOptional` 로 추가(자매 DTO `BackgroundRunNodeExecutionDto` 와 대칭 문서화).
7. (비필수 후속) 깊이 상한 상수(`MAX_SANITIZE_DEPTH`/`MAX_REDACT_DEPTH`) 통합, `MASKED_INPUT_DATA_REASON` 리네임, wire 테스트에 `input` 필드 직접 단언 추가 — 트래커에 등재해 다음 라운드로 이연 가능.

## 라우터 결정

- `routing=all` (forced 화이트리스트 전원 실행, router skip 없음):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명)
  - **제외**: 없음 (0명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명 전원, forced 전원 결과 확보됨 — 화이트리스트 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | (없음) | — |