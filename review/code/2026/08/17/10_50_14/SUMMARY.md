# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 0건. WARNING 1건(테스트 파일의 `describe` 제목이 레벨-분리 이후 옛 정책을 단언 — 실질 동작·보안 영향 없음, 정정 권장). 나머지는 전부 INFO(대다수는 5회 선행 라운드에서 이미 확인·이연·수용된 항목의 재확인). forced reviewer 7명 전원(security/requirement/scope/side_effect/maintainability/testing/documentation) 결과가 정상 확보됨 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | DOCUMENTATION | `describe` 블록 제목이 레벨 분리(`83436ed45`) 이후에도 옛(레벨 무관) 정책 "inputData 는 비대상"을 그대로 단언 — 같은 블록의 `⑤`·`⑥-b` 테스트는 정확히 반대(노드 레벨 `inputData` 는 마스킹됨)를 고정하고 있어 서술-코드 불일치. 이 저장소가 5라운드 내내 겪은 "주석이 코드보다 좁게/틀리게 갱신된다" 결함 클래스가 `describe` 타이틀이라는 새 위치에서 재발. | `codebase/backend/src/modules/executions/executions.service.spec.ts:1127` (`describe('outputData 응답 마스킹 — 표면 전수 (+ inputData 비대상 고정)', ...)`) | 제목을 레벨 명시로 정정. 예: `describe('outputData/inputData(노드 레벨) 응답 마스킹 — 표면 전수 (Execution.inputData 는 카브아웃)', ...)` 세부 방향은 이미 정확한 하위 테스트명·JSDoc에 위임 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SECURITY | `Execution.inputData` 는 값-패턴 마스킹에서 의도적으로 제외 — Re-run 재제출 경로 보호 목적. 워크스페이스 멤버 전원에게 트리거 파라미터 자유 텍스트 내 자격증명이 원문 노출될 여지는 잔존하나, 프런트 실제 소비 경로(`ReRunModal`)와 대조해 근거 유효함을 확인. 이미 트래커 등재됨. | `codebase/backend/src/modules/executions/executions.service.ts`(`MASKED_INPUT_DATA_REASON`, `toResponseExecution`, `toExecutionDto`) | 조치 불요. 후속 작업에서 이 카브아웃을 다른 레벨/필드로 확대하지 않도록 주의 |
| 2 | SECURITY | `SECRET_LEAK_PATTERNS` 가 bare `token=`(접두/접미 없는 단독 키워드)를 매칭 못함 — 선존 갭, 이번 diff 가 만든 결함 아님. 이미 트래커 등재. | `codebase/backend/src/shared/utils/sanitize-error-message.ts:33-52` | 조치 불요(범위 밖). 패턴 확장 시 회귀 캐너리 갱신 필요 |
| 3 | SECURITY | `execution:<executionId>` WS 채널 구독 인가가 워크스페이스 소유만 확인하고 역할(role) 미검사 — 선존 모델, 이번 PR 이 변경한 게 아니라 오히려 이 사실을 근거로 wire·REST parity 를 맞춰 보안 강화. 이미 트래커 등재. | `codebase/backend/src/modules/websocket/websocket.gateway.ts:395,494`, `websocket.service.ts:372` | 조치 불요(범위 밖, 등재됨). 향후 viewer RBAC 세분화 시 재검토 |
| 4 | SECURITY | `deepRedactSecrets`/`deepRedactSecretsPreserving` 마커 멱등 처리가 이론상 "우연히 마커 문자열과 일치하는 정상 값"을 재마스킹하지 않을 가능성 — 실질 영향 없음(3글자 리터럴이라 정보 가치 없음), 의도된 설계이고 캐너리로 고정됨 | `codebase/backend/src/shared/utils/sanitize-error-message.ts:124-132, 257-258` | 조치 불요 |
| 5 | SECURITY | `explore-tools.service.ts`(workflow-assistant LLM 도구)의 `inputData`/`outputData`/`error` 는 키-이름 기반 마스킹만 적용, 값-패턴 마스킹 미적용 — 이번 diff 범위 밖, spec 이 명시적으로 별도 결정 필요 항목으로 문서화 | `codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts:462` | 조치 불요(별도 결정 필요 항목으로 문서에 명시됨) |
| 6 | REQUIREMENT | CHANGELOG 최신 `## Unreleased` 항목 마지막 문단이 "유저 가이드의 **Output** 탭 설명에 캐비엇 추가"로만 서술하나 실제 diff 는 Input 탭에도 캐비엇을 추가함(코드/문서 diff 자체는 옳고 CHANGELOG 서술만 stale) | `CHANGELOG.md` | `유저 가이드의 Input/Output 탭 설명에 이 캐비엇을 추가했다`로 한 단어 정정. 기능 영향 없음 |
| 7 | REQUIREMENT | 유저 가이드 "Error" 탭 설명에 마스킹 캐비엇 없음 — `NodeExecution.error` 도 이미 마스킹 대상인데 문서화 누락. 신규 발견 아니고 이미 트래커에 의도적 미조치로 등재됨 | `codebase/frontend/.../run-results.en.mdx` "Error" 행, `plan/in-progress/spec-sync-external-interaction-api-gaps.md:301` | 조치 불요(등재됨, 이연 근거 명시) |
| 8 | SCOPE | plan lifecycle 정리(in-progress→complete 이동)가 이번 기능과 별개 사유로 같은 브랜치에 묶임 — 4회 선행 라운드에서 반복 확인, 변화 없음 | `plan/complete/eia-internal-rest-error-masking.md`, `plan/complete/spec-draft-eia-fanout-masking.md` 등 | 조치 불요(반복 수용됨). PR 설명에 별개 사유 명시 권고 |
| 9 | SCOPE | `nodeName`→`nodeLabel` 용어 정정이 이번 마스킹 기능과 무관하게 drive-by 로 반영 | `spec/5-system/3-error-handling.md:249,258-259` | 조치 불요 |
| 10 | SCOPE | 별개 plan(`ie-resume-turn-boundary-cancel.md`)에 이번 WS 마스킹 작업이 그 plan 의 기존 우려를 해소했다는 각주 추가 — 코드 변경 없음, 사실 관계 갱신 | `plan/in-progress/ie-resume-turn-boundary-cancel.md:399-405` | 조치 불요 |
| 11 | SCOPE | `review/code/**`·`review/consistency/**` 대량 신규 파일(130+)이 diff 대부분 차지 — CLAUDE.md 강제 review-fix 워크플로의 정상 산출물, scope 이탈 아님 | `review/code/2026/08/16~17/**`, `review/consistency/2026/08/16~17/**` | 조치 불요 |
| 12 | SIDE-EFFECT | `NodeExecutionSummaryDto.inputData` 신규 Swagger 필드 선언 — 런타임 항상 존재했던 선존 갭을 스키마에 처음 선언, 소비자 0건 확인 | `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts:172-184` | 조치 불요 |
| 13 | SIDE-EFFECT | `ResponseNodeExecution`/`ResponseExecution` 타입 재확장(`inputData`/`outputData` non-null → `\| null`) — 소비자 영향 실측, 변화 없음 | `codebase/backend/src/modules/executions/executions.service.ts` | 조치 불요 |
| 14 | SIDE-EFFECT | 마스킹 정책 방향이 커밋 1개 사이에서 반전(`Execution.inputData` 원문 ↔ `NodeExecution.inputData` 마스킹) — 문서·테스트·구현 3층 정합 확인, flip-flop 되돌리는 CRITICAL fix 였음 | `executions.service.ts`(`MASKED_INPUT_DATA_REASON` 관련), `background-runs.service.ts:305` | 조치 불요 |
| 15 | SIDE-EFFECT | 전역 `WeakMap` 캐시(`DEEP_REDACT_CACHE`/`SANITIZE_CACHE`) 적용 범위 확장 — 신규 변형이 명시적으로 캐시 우회, 교차 오염 없음 캐너리로 고정 확인 | `sanitize-error-message.ts`(`DEEP_REDACT_CACHE`), `websocket.service.ts:91`(`SANITIZE_CACHE`) | 조치 불요. 캐시 대상 객체를 in-place mutate 하는 새 호출부가 생기면 재검토 |
| 16 | SIDE-EFFECT | WS wire envelope 마스킹 순서 — `attachRoutingContext` 의 `chatChannel` `[REDACTED]` 마커가 값-마스킹 이후 첨부되어 재마스킹 위험 없음을 확인 | `websocket.service.ts`(`toFanoutEnvelope`/`attachRoutingContext`) | 조치 불요 |
| 17 | MAINTAINABILITY | 마커-계층 JSDoc 이 실제 심볼(`VALUE_MASK_MARKER`)에 귀속되지 않음(고아 주석) — 2회 선행 라운드가 의도적으로 이연, 상태 변화 없음 | `codebase/backend/src/shared/utils/sanitize-error-message.ts:95-122` | 추가 조치 불요(등재·이연 유지, 등급 상향 금지) |
| 18 | MAINTAINABILITY | `MASKED_INPUT_DATA_REASON` 런타임 미참조 상수를 `void` 로 앵커링하는 관용구 — 주석으로 삭제 위험 완화됨 | `codebase/backend/src/modules/executions/executions.service.ts` | 조치 불요 |
| 19 | MAINTAINABILITY | `MASKED_INPUT_DATA_REASON` 상수명이 "왜 마스킹 안 하는가"(카브아웃 근거)인데 이름은 "왜 마스킹 하는가"처럼 읽힘 — 자매 파일 4곳이 같은 이름 인용 | `codebase/backend/src/modules/executions/executions.service.ts` | 조치 불요(급하지 않음). 리네임 시 `INPUT_DATA_MASK_CARVEOUT_REASON` 류 권장 |
| 20 | MAINTAINABILITY | `redactStoredErrorForResponse`/`redactStoredDataForResponse` 두 함수 본문이 완전히 동일 — §R17 컬럼별 관문 열거 계약 근거로 의도적 미통합 | `codebase/backend/src/shared/utils/redact-stored-error.ts:28-35, 66-71` | 조치 불요(기존 결정 재확인). 세 번째 컬럼 추가 시 재검토 |
| 21 | TESTING | `websocket.service.spec.ts` `emitNodeEvent` wire 마스킹 테스트가 이번 작업이 고친 실제 결함 당사자 필드인 `input` 을 직접 겨누지 않고 `error` 로만 검증 — 메커니즘상 결과 동일하여 실질 위험 낮음 | `codebase/backend/src/modules/websocket/websocket.service.spec.ts`(`②` 케이스) | 낮은 우선순위. `input: LEAKY_INPUT` 을 payload 에 추가하면 캐너리가 결함 서사와 1:1 대응(필수 아님) |
| 22 | TESTING | `maskIfPresent` 의 `value == null` 방어 분기가 실제 `undefined` 값 fixture 로 직접 실행되지 않음 — `==` 등가성으로 `null` 케이스가 간접 커버, 기존 라운드에서 같은 논거로 처분됨 | `codebase/backend/src/modules/executions/executions.service.ts`(`maskIfPresent`) | 조치 불요(기존 처분 유지). 여유 있으면 `undefined as never` fixture 로 명시 고정 가능 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 새 취약점 없음. `Execution.inputData` 카브아웃·role 미검사·패턴 갭 등은 전부 선존/의도적 결정, 이미 트래커 등재 |
| requirement | NONE | EIA §R17 표·데이터모델·spec 캐비엇과 코드가 line-level 정합. CHANGELOG 텍스트 stale 1건만 INFO |
| scope | LOW | 신규 델타(커밋 `09286d542`)는 직전 라운드 WARNING 6건 후속 조치로 정확히 구성, scope 이탈 없음 |
| side_effect | LOW | 캐시 확장·타입 재확장·정책 방향 반전 전부 문서화된 의도적 결정, 소비자 영향 실측 완료 |
| maintainability | LOW | 로직 변경 0(문서·DTO 필드 선언만). 캐너리를 "개수·목록"→"방향별 표"로 재작성해 3번째 재발 구조적으로 방지 |
| testing | LOW | 표면 전수·컬럼별 방향·마커 멱등성·캐시 격리까지 이례적으로 촘촘한 커버리지. 직전 WARNING 해소 확인 |
| documentation | LOW | `describe` 타이틀이 레벨-분리 이후 옛 정책 단언(WARNING 1건). 나머지 문서(JSDoc/Swagger/CHANGELOG/유저가이드/plan)는 정합 |

## 발견 없는 에이전트

없음 (전 reviewer 가 최소 1건 이상의 INFO/WARNING 을 보고했으나 모두 저위험).

## 권장 조치사항
1. `codebase/backend/src/modules/executions/executions.service.spec.ts:1127` 의 `describe` 블록 제목을 레벨(Execution vs NodeExecution) 을 명시하도록 정정 — 유일한 WARNING, 실질 위험은 낮으나 향후 편집자 오판 방지.
2. (선택, 비필수) `CHANGELOG.md` 최신 Unreleased 항목 마지막 문단을 "Input/Output 탭"으로 정정.
3. (선택, 비필수) `websocket.service.spec.ts` `emitNodeEvent` wire 테스트에 `input` 필드 단언 추가해 캐너리를 결함 서사에 1:1 대응.
4. 나머지 INFO(21건)는 전부 이전 라운드에서 이미 검토·이연·등재된 항목의 재확인이며 추가 조치 불요.

## 라우터 결정

- **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (7명, `routing=all`)
- **제외**: 없음
- **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` — forced 전원 결과 확보됨 (미이행 없음)

| 제외된 reviewer | 이유 |
|------------------|------|
| (없음) | — |