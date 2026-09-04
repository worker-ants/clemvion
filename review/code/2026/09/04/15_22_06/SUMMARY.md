# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 없음. 실질 코드 변경(응답 DTO 15필드 `required: false→true` 전환)은 §5.4 문면·조립부 실측과 line-level 로 정확히 일치하고, 직전 라운드가 지적한 두 결함(범위 83→15 축소, `required` 미검증 테스트)을 정확히 고쳤다. 남은 WARNING 4건은 전부 "이번 fix 가 검증하지 못한 인접 사각지대"(검증 주장 범위 과장, 테스트 중복 하드코딩, 자매 DTO 테스트 부재, plan 요약 문장 stale)이며 런타임 동작·인가·마스킹에 영향을 주는 항목은 없다. forced whitelist 7개(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보 — 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 요구사항 | `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 `## 종결 조건` 절 요약 문장이 실제 `## 후속` 체크박스 상태와 불일치 — §2.2/§5.4 스코프 문구/`3-schedule.md` §2.1 3건은 이미 `[x]`로 닫혔는데 "열려 있다"고 적고, 이번 diff 가 새로 연 "§5.4 drift 2단계(68�곳)"·"WS wire 적용 여부" 2건은 요약에 빠져 있음 | `plan/in-progress/spec-draft-nullable-notation-followups.md` `## 종결 조건` 절 | 열린 항목 목록을 `## 후속`의 실제 미체크 4건(§5.4 drift 2단계 · WS wire 적용 여부 · `QueryExecutionDto.workflowId` · `idx_schedule_next_run`)으로 갱신 |
| 2 | 부작용 | `ExecutionDto`(10필드)의 "required 전환은 tsc 가 검증했다"는 전제가 4개 노출 경로 중 리스트 경로(`toExecutionDto`) 1개에서만 성립. `stop`/`getChain`/`findById`/`reRun` 3경로는 `ResponseExecution`/`ExecutionDetailWithTrigger`(엔티티 파생 Omit 타입)를 거쳐 `ExecutionDto` 의 `required`/`nullable` 선언과 구조적으로 무관 — 오늘 시점은 partial select 가 없어 런타임상 무해하나, 이번 PR 이 다른 68필드에 적용한 "검증 없이는 주장 못한다"는 기준을 스스로 통과하지 못함 | `codebase/backend/src/modules/executions/executions.service.ts`(`toResponseExecution` 1070행, `getChain` 595-627행, `stop` 881행, `reRun` 396-406행), `executions.controller.ts`(70/130/270/300행) | `toResponseExecution` 등의 반환 타입을 `ExecutionDto`/`ExecutionDetailDto` 로 명시적으로 좁혀 tsc 가 실제 검사하게 하거나, 최소한 후속 항목으로 기록해 향후 partial select 도입 시 회귀 안전망 확보 |
| 3 | 유지보수성 / 테스트 | `execution-status-response.dto.spec.ts` 신규 `required` 가드가 `it.each` 목록(tuple)과 `expect.arrayContaining` 배열(plain string) 두 곳에 동일 5개 필드명(`result`/`error`/`durationMs`/`currentNode`/`context`)을 각각 하드코딩 — 향후 필드 추가 시 한쪽만 갱신되는 drift 경로. 바로 이 테스트가 "손으로 고른 목록만 커버한다"는 인지를 주석에 남긴 직후에 만들어진 코드라 아이러니 | `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.spec.ts:110-115`(it.each), `:133-139`(arrayContaining) | 단일 상수(`const NULL_PRESENT_FIELDS = [...] as const`)로 추출해 양쪽에서 재사용 |
| 4 | 테스트 | `ExecutionDto`(10필드)는 `ExecutionStatusDto` 와 달리 `SwaggerModule.createDocument()` 기반 스키마-레벨 테스트가 아예 없음(`ExecutionDto` 참조 `*.spec.ts` 전수 grep, `schemasOf`/`createDocument` 0건) — decorator 와 TS 타입을 동시에 optional 로 되돌리는 회귀(AST 가드도 tsc 도 못 잡는 방향)를 어떤 자동화도 감지 못하는 상태 | `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts`(`ExecutionDto` 10필드), 부재 파일 `execution-response.dto.spec.ts` | `execution-status-response.dto.spec.ts` 와 동일 패턴으로 `ExecutionDto` 스키마 테스트 신설 + `required` 배열 단언 추가(이번에 손댄 10필드이므로 2단계 68곳보다 우선순위 높게 권장) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | 응답 바디 노출 필드 자체는 불변(wire 레벨 payload 동일) — `?` 제거는 Swagger 문서화 데코레이터만 바꾸고 런타임 직렬화·마스킹 로직(`redact-stored-error.ts`)은 diff 밖에서 그대로 유지 | `execution-response.dto.ts`, `execution-status-response.dto.ts` | 조치 불요 |
| 2 | 보안/API계약 | 요청(PATCH) DTO 21곳은 tri-state 의미(키 생략=불변, null=초기화) 보존을 위해 이번 배치에서 의도적으로 제외 — 올바른 판단 | `plan/in-progress/spec-draft-nullable-notation-followups.md` | 조치 불요 |
| 3 | 요구사항 | 15필드 전환은 §5.4 문면 및 조립부(`toExecutionDto`/`toResponseExecution`/`getStatus`) 실측과 line-level 로 정확히 일치. 뮤테이션 재현(currentNode 원복 → RED 1/19 GREEN)으로 회귀 가드 실효성도 확인됨 | `execution-response.dto.ts`, `execution-status-response.dto.ts`, `execution-status-response.dto.spec.ts` | 조치 불요 |
| 4 | 요구사항 | `NodeExecutionSummaryDto` 의 동명 자매 필드(`finishedAt`/`durationMs`/`inputData`/`outputData`/`error`)는 여전히 구 패턴 — 2단계(68곳) 배치에 이미 등재된 범위 밖, 신규 결함 아님 | `execution-response.dto.ts:159-212` | 조치 불요(추적됨) |
| 5 | 범위 | 실질 코드 변경은 데코레이터/타입 옵셔널 마커에만 국한, import·포맷·인접 필드·주석 불변 확인. 테스트 확장도 W2 지적에 정확히 대응하는 최소 추가 | `execution-response.dto.ts`, `execution-status-response.dto.ts`, `execution-status-response.dto.spec.ts` | 조치 불요 |
| 6 | 문서화 | CHANGELOG "15곳" 절은 신규가 아니라 "83곳" 절을 in-place 로 정정한 것(중복 섹션 없음). 수치(10+5=15, 83-68=15)가 plan·CHANGELOG·커밋 메시지 3곳에서 일치. 오래된 주석·README 갱신 누락 없음 | `CHANGELOG.md:3-37` | 조치 불요 |
| 7 | 문서화/유지보수성 | `review/code/.../14_54_36/*`, `review/consistency/.../15_16_28/*` 20개 신규 파일은 프로젝트 관례(`review/**` 보존)에 따른 정상 산출물 커밋 — 애플리케이션 코드 아님, 이 리뷰의 실질 대상에서 제외 | `review/code/2026/09/04/14_54_36/**`, `review/consistency/2026/09/04/15_16_28/**` | 조치 불요 |
| 8 | API 계약 | `required` flip 은 wire 불변이나 코드젠 SDK 소비자의 생성 타입은 좁아짐(non-breaking 방향). 프런트/패키지에서 해당 DTO 직접 import 없음(grep 0건) 확인 | `execution-response.dto.ts`, `execution-status-response.dto.ts` | SDK 자동 재생성 파이프라인이 있다면 트리거 여부만 확인 |
| 9 | 부작용 | `ExecutionStatusDto` 5필드는 노출 경로가 `getStatus()` 단 하나뿐이라 "tsc 가 검증했다"는 주장이 정확히 성립 — WARNING #2 와 대비되는 정상 사례 | `interaction.service.ts` `getStatus()`, `interaction.controller.ts` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 노출 표면 불변, 시크릿 없음, 요청 DTO 의도적 제외 확인 |
| requirement | LOW | 코드 변경은 spec/조립부와 정확히 일치. plan "종결 조건" 요약 문장 stale (WARNING #1) |
| scope | NONE | 순 diff 가 직전 리뷰 W1/W2 지적을 정확히 좁혀 반영, 범위 확장 없음 |
| side_effect | LOW | 런타임 부작용 없음. `ExecutionDto` tsc 검증 범위가 주장보다 좁음 (WARNING #2) |
| maintainability | LOW | 15필드 전환 자체는 기계적 치환. 테스트 필드 목록 중복 하드코딩 (WARNING #3) |
| testing | LOW | W1/W2 fix 실측 검증됨(20/20 GREEN). `ExecutionDto` 스키마 테스트 전무 (WARNING #4) |
| documentation | NONE | CHANGELOG/plan/주석/규약 문서 전부 정합, 갱신 누락 없음 |
| api_contract | LOW | wire 불변, 비파괴적 축소 방향. SDK 코드젠 소비자 고지 정도만 참고 |

## 발견 없는 에이전트

documentation, scope, security — Critical/Warning 없음(INFO 및 "조치 불요" 확인만).

## 권장 조치사항
1. `execution-status-response.dto.spec.ts` 의 `it.each`/`arrayContaining` 필드 목록을 단일 상수로 추출해 drift 가능성을 구조적으로 제거 (WARNING #3, 가장 저비용).
2. `ExecutionDto`(10필드)에도 `ExecutionStatusDto` 와 동일한 패턴의 스키마-레벨(`createDocument`) `required` 회귀 테스트를 신설 (WARNING #4) — 이번 PR 이 직접 손댄 필드이므로 2단계(68곳) 백로그보다 우선순위를 높게 권장.
3. `toResponseExecution`/`getChain`/`stop`/`reRun` 의 반환 타입을 `ExecutionDto`/`ExecutionDetailDto` 로 명시적으로 좁혀, "tsc 가 검증한다"는 주장을 4경로 전체에서 실제로 성립시킬 것 (WARNING #2) — 최소한 후속 항목으로 기록.
4. `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 `## 종결 조건` 요약 문장을 `## 후속`의 실제 미체크 4건으로 갱신 (WARNING #1) — 다음 세션의 착수 판단 오도 방지.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation, api_contract (8명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 전원 결과 확보됨, 누락 없음
  - **제외**: 6명 (표)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단: 이번 changeset(데코레이터/타입 마커 전환 + 문서)에 성능 영향 경로 없음 |
  | architecture | router 판단: 아키텍처 구조 변경 없음(DTO 필드 레벨 수정) |
  | dependency | router 판단: package.json/lockfile 변경 없음 |
  | database | router 판단: 쿼리/스키마/마이그레이션 변경 없음 |
  | concurrency | router 판단: 동시성 관련 코드 경로 없음 |
  | user_guide_sync | router 판단: 사용자 가이드 문서 영향 없음(내부 API 계약 정정) |