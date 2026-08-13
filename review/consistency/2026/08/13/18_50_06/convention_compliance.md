# 정식 규약 준수 검토 — spec/5-system/

## 조사 방법 및 범위 안내

- `git diff origin/main...HEAD -- spec/5-system/` = **빈 결과**. 즉 이번 diff(HEAD)는 `spec/5-system/` 을
  전혀 건드리지 않는다 (`merge-base origin/main HEAD` == `origin/main` tip). 실제 코드 diff는
  `codebase/backend/src/common/utils/assert-row-array.ts`(신규) + 3개 호출부
  (`execution-engine.service.ts`, `executions.service.ts`) 하드닝과 그 테스트, 그리고
  `chat-channel.dispatcher.spec.ts` 테스트 추가뿐이다.
- 프롬프트 예산 초과로 `spec/5-system/*` 19개·`spec/conventions/**` 271개 파일 본문이 생략되어 있어,
  절대경로로 관련 파일을 직접 Read/Grep 했다. 워크트리 이름(`eia-r8-cache-scope`)이 가리키는
  "EIA R8 idempotency 캐시 스코프" 작업은 이미 `origin/main` 에 병합되어 있음을 `git log`(commit
  `a80599700`, `ba3dbd676`, `72db62a7b`, `cbe7e8866` 등이 모두 `origin/main` 조상)로 확인했다.
  따라서 이번 턴은 그 기능의 conventions 준수 여부를 감사할 실질적 신규 diff가 없으나, 최근
  활성 영역(EIA idempotency 캐시 스코프·Redis 키·에러 코드) 을 대상으로 spot-check 를 수행했다.

## 점검 결과

### 1. Redis 키 명명 규약 (`spec/conventions/redis-keys.md`)

`redis-keys.md` §3 인벤토리가 선언한 `interaction:idempotency:<executionId>:<route>:<key>` 형태를
- `spec/5-system/14-external-interaction-api.md:1143` (§R8 "캐시 키 스코프")
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:25,147`
  (`REDIS_KEY_PREFIX = 'interaction:idempotency:'` + `` `${REDIS_KEY_PREFIX}${executionId}:${route}:${rawKey}` ``)

양쪽에서 동일하게 확인했다. `<route>` 는 `context.getHandler().name`(`interact`|`cancel`) 으로
스코프 두 축(`executionId`+`route`)이 spec·코드·redis-keys.md 인벤토리 3자 일치 — 위반 없음.

### 2. 에러 코드 명명 규약 (`spec/conventions/error-codes.md`)

`IDEMPOTENCY_KEY_CONFLICT` (idempotency.interceptor.ts:200) 는 §1 `UPPER_SNAKE_CASE` 준수,
prefix-less 공용 코드 범주에 해당하며 §3 예외 레지스트리 대상도 아니다(정확한 이름).
카탈로그 등재도 두 SoT 모두에서 확인:
- `spec/5-system/3-error-handling.md:166` — `IDEMPOTENCY_KEY_CONFLICT | 409 | 같은 Idempotency-Key + 다른 body`
- `spec/5-system/14-external-interaction-api.md:346` — 동일 항목

위반 없음. `409`/`410`(`isErrorStatusCacheable`) 캐시 대상 상태코드도 §R8 Rationale
(`14-external-interaction-api.md:1137`)의 닫힌 목록과 코드가 정확히 일치 — 과거 `16_29_45` CRITICAL
(dead code)로 지적됐던 항목이 이번 코드베이스에서는 이미 `catchError` 채널로 옮겨져 해소돼 있다.

### 3. API 문서 규약 (`spec/conventions/swagger.md`)

`interaction.controller.ts` 는 `@ApiBearerAuth('interaction-token')` 만 사용하고 `@Roles()`/
`@WorkspaceId()` 를 쓰지 않으므로 §5-4 의 `@ApiForbiddenResponse` 소급 의무 대상이 아니다 —
범위 밖이라 위반 아님(오탐 방지 차 명시).

### 4. 문서 구조 규약 (Overview/본문/Rationale, CLAUDE.md 명명 컨벤션)

`spec/5-system/` 17개 번호 파일(`1-auth.md` ~ `17-agent-memory.md`) 전부 `## Rationale` 섹션을
보유(grep 확인). `_product-overview.md` 만 Rationale 미보유이나 이는 영역 진입/개요 문서라 3섹션
권장 대상이 아니므로 정상. 파일명은 `_product-overview.md`(언더스코어 prefix, 개요) + 번호
prefix(`1-`~`17-`, 연속) 로 CLAUDE.md 명명 컨벤션과 일치. 루트 `0-` prefix 는 `spec/0-overview.md`
전용이며 `5-system/` 하위에는 해당 사항 없음(오분류 없음).

### 5. 금지 항목

`redis-keys.md` Rationale 이 스스로 지적한 "지켜진 적 없는 규칙"(구 `4-execution-engine.md §9.1`
워크스페이스 스코프 패턴)은 이미 §1 새 규칙("머리 2세그먼트 고정 + 꼬리 가변")으로 교체되었고
`4-execution-engine.md` 는 이번 diff 대상도 아니라 재점검 사유 없음. `swagger.md` §6 "빈 껍데기
스키마" 금지 패턴도 이번 변경분(테스트 전용) 에는 해당 코드가 없다.

## 발견사항

없음 — CRITICAL/WARNING 대상 발견 없음.

- **[INFO] 이번 diff는 target 범위(spec/5-system) 를 건드리지 않음**
  - target 위치: N/A (diff-base 대비 무변경)
  - 위반 규약: 해당 없음
  - 상세: orchestrator 가 스코프를 `spec/5-system/` 로 지정했으나 `git diff origin/main...HEAD`
    에는 그 경로의 변경이 전혀 없다. 이번 세션의 실제 변경(assertRowArray 하드닝, 테스트 추가)은
    `codebase/backend/**` 에 한정되며 spec conventions 위반 표면이 없다.
  - 제안: 별도 조치 불필요. 후속 세션에서 이 checker 를 다시 호출할 때는 diff 범위를
    `codebase/` 기준으로 재계산하거나, spec 변경이 실제로 없는 턴에는 스킵하는 편이 예산 낭비를
    줄인다(정보 제공 목적, 규약 갱신 요구 아님).

## 요약

이번 턴의 실제 diff(`origin/main...HEAD`)는 `spec/5-system/` 를 전혀 변경하지 않았고, 워크트리
이름이 가리키는 "EIA R8 idempotency 캐시 스코프" 작업은 이미 `origin/main` 에 병합된 상태다.
그 기능 및 인접 영역(Redis 키 명명, 에러 코드 명명, EIA idempotency 캐시 응답 목록, 문서 3섹션
구조, 컨트롤러 swagger 데코레이터)을 절대경로로 직접 대조한 결과 `spec/conventions/redis-keys.md`·
`error-codes.md`·`swagger.md` 와 spec 본문·코드가 전부 일치했다. CRITICAL/WARNING 급 정식 규약
위반은 발견하지 못했다.

## 위험도
NONE
