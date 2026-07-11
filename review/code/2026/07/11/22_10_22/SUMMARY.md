# Code Review 통합 보고서

## 전체 위험도
**LOW** — `refactor-reaper-dry`(Webchat→WebChat 식별자 정규화 + `processInBatches`/`emitCancellationEvent` DRY 추출)는 10개 reviewer 전원이 behavior-preserving 을 실측(grep 전수·tsc clean·470 tests PASS)으로 확인했다. CRITICAL 없음. WARNING 3건은 전부 기능 결함이 아니라 PR 스코프 정합성·plan frontmatter 정확성·테스트 커버리지 갭 성격이라 병합을 막을 사유는 아니나 정리를 권장한다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Scope | plan(`refactor-reaper-dry.md`)이 명시한 3개 스코프(naming·W4·W3) 밖에서 `verify()` 반환값의 명시적 타입 단언(`as {...}`)이 제거됐다. `payload` 변수가 이미 동일 타입으로 `let` 선언돼 있어 `tsc --noEmit` 상 무해하고 런타임 영향도 없지만(security/performance/requirement/side_effect/maintainability/testing 전원이 "기능 무영향"으로 확인), "behavior-preserving 순수 구조 정리"를 표방한 PR 에 미문서화 스코프 외 변경 1줄이 섞여 diff bisect·추적성을 저해한다. | `codebase/backend/src/modules/external-interaction/interaction-token.service.ts` `verifyPerExecution` 내부 (구 L203-207) | 이 캐스트 제거가 의도적이면 plan 본문에 별도 항목으로 기재, 의도치 않았으면 되돌려 diff 를 선언된 3항목으로 한정. 향후 유사 drive-by 정리는 별도 커밋으로 분리 권장. |
| 2 | Requirement/Scope | `plan/in-progress/refactor-reaper-dry.md` frontmatter `spec_impact: - none` 이 실제 diff 와 불일치한다. 이번 커밋이 `WebchatIdleReaperService`→`WebChatIdleReaperService` 등 클래스명 언급을 5개 spec 문서에서 실제로 동기화했음에도 frontmatter 는 `none` 을 유지 중이다. in-progress 단계에서는 build guard 위반이 아니나(`spec_impact` 는 Gate C 시점에만 강제), 지금 상태로 `plan/complete/` 로 이동하면 오기재로 굳어진다. 내용 자체(순수 식별자 문자열 치환, 의미 변경 없음)는 스코프 이탈로 보기 어렵지만, `spec/` 은 developer skill 의 read-only 경계와도 접촉한다. | `plan/in-progress/refactor-reaper-dry.md` frontmatter vs `spec/5-system/14-external-interaction-api.md`, `spec/7-channel-web-chat/1-widget-app.md`, `spec/7-channel-web-chat/3-auth-session.md`, `spec/data-flow/0-overview.md`, `spec/data-flow/15-external-interaction.md` (5개 파일) | Gate C(완료) 이동 직전 frontmatter 를 `spec_impact:` 리스트로 갱신(5개 spec 경로 나열). 코드 수정 아닌 문서 정합 조치이므로 plan 소유자가 완료 처리 시 반영하거나, spec 동기화가 developer 범위 밖이면 project-planner 위임 경로를 거쳤는지 확인. |
| 3 | Testing | `emitCancellationEvent` 의 핵심 계약("`error` 는 있을 때만 payload 에 포함", `...(opts.error ? { error: opts.error } : {})`)이 4개 호출부 중 `cancelParkedExecution`(error 없는 유일한 분기)에서만 약한 `expect.objectContaining({ status: 'cancelled' })` 로 검증돼 실질적으로 회귀를 잡지 못한다. 형제 3개(`markExecutionCancelled`/`markQueueWaitTimeout`/`markWebChatIdleTimeout`)는 `cancelledBy` 리터럴 동등 비교 + `error: expect.objectContaining(...)` 를 명시적으로 검증하는 반면, "error 생략" 분기를 실제로 고정하는 assertion 이 코드베이스에 하나도 없다 — 헬퍼가 실수로 항상 `error` 키를 포함하도록 바뀌어도 테스트는 통과한다. | `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:2922-2943` (대비: `emitCancellationEvent` 정의 `execution-engine.service.ts:394-419`) | `cancelParkedExecution` 테스트에 `result: { cancelledBy: 'user' }` 리터럴 비교 추가 + `error` 키 부재를 `expect(emittedPayload).not.toHaveProperty('error')` 등으로 명시적으로 고정. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Performance/Architecture/Concurrency | `processInBatches` 는 barrier(고정 청크) 방식 동시성이지 세마포어 기반 sliding-window 가 아니다 — 청크 내 한 item 이 느리면 나머지 슬롯이 다음 청크 시작 전까지 유휴. 리팩터 이전 두 호출부(`reconcileTerminalRevocations`, `webchat-idle-reaper.service.reap`)에 이미 있던 패턴을 그대로 추출한 것이라 회귀 아님. JSDoc 에도 명시됨. | `codebase/backend/src/common/utils/process-in-batches.ts:197-211` | 현재 호출부(DB/Redis 단발 왕복)엔 무해. 향후 latency 편차 큰 신규 호출부가 생기면 세마포어 기반 헬퍼로 교체 고려하라는 안내를 JSDoc 에 한 줄 추가. |
| 2 | Architecture | `ExecutionEngineService` 가 여전히 매우 큰 단일 클래스(~8,000 LOC)이며 본 diff 가 `emitCancellationEvent` 헬퍼를 추가로 얹는다. 다만 헬퍼 자체는 4개 cancel 경로 중복(~24줄×4)을 net 으로 줄이는 긍정적 방향이며 god-service 이슈는 기존 M-3 이후 분할 백로그 스코프. | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:394-419` | 조치 불요 — 기존 백로그(M-3→M-8→m-2→C-2)에서 계속 추적. |
| 3 | Architecture | 두 sweep 워커의 오케스트레이션 위치 비대칭(EIA-RL-06 은 `InteractionTokenService` 위임, EIA-RL-07 은 `WebChatIdleReaperService.reap()` 자체 오케스트레이션)이 리팩터 후도 유지 — 두 sweep 의 구조적 차이에서 기인하는 정당한 차이이며 회귀 아님. `processInBatches` 공용화로 "청크 동시성" 부분 중복은 제거됨. | `codebase/backend/src/modules/external-interaction/{interaction-token.service.ts, webchat-idle-reaper.service.ts}` | 조치 불요. |
| 4 | Maintainability | `processInBatches` 추출 후에도 호출부의 후처리(`results.forEach` 집계/warn) 블록이 두 호출처에 구조적으로 유사한 형태로 남아 있다. plan 에 "집계 형태가 달라(boolean count vs `.revoked` sum) 호출처 유지"로 트레이드오프가 이미 문서화됨. | `codebase/backend/src/modules/external-interaction/interaction-token.service.ts:1208-1221`, `webchat-idle-reaper.service.ts:1784-1799` | 현재 스코프는 수용 가능. 세 번째 호출처가 생기면 집계 헬퍼 재검토 권장. |
| 5 | Maintainability | `emitCancellationEvent` 의 `logContext: string` 파라미터는 실제 호출 메서드명과 컴파일러가 보증하지 않는 수동 동기화가 필요한 자유 문자열. 이번 PR 은 리네임과 함께 4곳 모두 정확히 갱신했으나 향후 drift 위험은 잔존. | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:962-970` (선언), 941-944/1054-1057/2694-2698/2731-2735 (호출부) | 리스크 낮음(private 헬퍼, 단일 파일, 4곳뿐). 필요 시 "메서드 리네임 시 함께 갱신" 주석 추가. |
| 6 | Requirement | `process-in-batches.spec.ts` 의 테스트 제목("concurrency 0/음수는 1로 floor")이 실제로는 `concurrency=0` 한 값만 검증하고 음수 케이스는 파라미터화되지 않아 제목과 실제 커버리지 사이 괴리가 있다(구현은 두 경로 모두 동일해 실질 결함은 아님). | `codebase/backend/src/common/utils/process-in-batches.spec.ts:87-93` | `it.each([0, -1, -100])` 로 확장. |
| 7 | Requirement | `emitCancellationEvent` 통합 후 catch 블록 로그 워딩이 미세 변경("cancel 은 DB 에 반영됨" → "cancel 은 DB 반영됨", 조사 생략). 테스트는 부분 문자열만 검증해 회귀 없음. | `execution-engine.service.ts` `emitCancellationEvent` catch 블록 | 조치 불요. |
| 8 | Side Effect | `processInBatches` 도입으로 개별 실패 warn 로그의 발화 시점이 "청크 단위 즉시" → "전체 sweep 완료 후 일괄"로 바뀐다. 최종 카운트/로그 내용/순서는 동일, 실시간 tail 추적 시 지연 체감만 발생. sweep 이 분 단위 백그라운드 잡이라 실무 영향은 낮음. | `interaction-token.service.ts` `reconcileTerminalRevocations`, `webchat-idle-reaper.service.ts` `reap()` | plan 문서 또는 함수 docstring 에 로그 타이밍 차이를 한 줄 명시해 향후 오탐 조사 예방. |
| 9 | Testing | `processInBatches` 워커가 동기적으로 throw 하는 경우(non-`async` 함수) `chunk.map()` 자체가 throw 해 `Promise.allSettled` 에 도달하지 못하고 fail-open 보장이 깨질 수 있다. 현재 실호출처 2곳은 모두 진짜 `async` 함수라 실전 위험은 낮음. | `codebase/backend/src/common/utils/process-in-batches.ts:206` | 우선순위 낮음 — "worker 는 반드시 async 함수여야 함" 문서화로 충분. |
| 10 | Testing | `processInBatches` 의 `concurrency` 양의 소수점(`Math.floor` 대상) 케이스가 테스트되지 않음. 로직이 단순해 위험도 낮음. | `codebase/backend/src/common/utils/process-in-batches.spec.ts` | 필요 시 `it.each([0, -1, 2.7])` 로 통합(선택). |
| 11 | Documentation | `CHANGELOG.md` 의 "Unreleased" 항목(EIA-RL-07 도입, 직전 PR)이 이번 rename 이전 소문자 식별자(`WebchatIdleReaperService`·`markWebchatIdleTimeout`)를 그대로 참조해 코드베이스와 어긋난다. | `CHANGELOG.md` "Unreleased — 공개 웹채팅 위젯 idle-wait execution 회수 reaper" 섹션 | 식별자 표기 정정 또는 "naming 정규화, 동작 무변경" 후속 Unreleased 항목 추가. 우선순위 낮음. |
| 12 | Documentation | `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 완료 체크박스 서술도 구식별자명(`WebchatIdleReaperService` 등, 소문자 c) 잔존. | `plan/in-progress/spec-sync-external-interaction-api-gaps.md:23` | 우선순위 매우 낮음 — 해당 plan 이 `plan/complete/` 로 이동할 때 함께 정정하거나 스킵 가능. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인증/인가·SQL·시크릿 관리 로직 변경 없음. `verify()` 캐스트 제거(INFO, 런타임 무영향), `processInBatches` concurrency floor 방어(INFO, 양호) |
| performance | NONE | 신규 N+1/O(n²)/캐싱 누락/블로킹 I/O 없음. barrier 방식 동시성(INFO, pre-existing) |
| architecture | LOW | SOLID/순환의존/레이어 침범 없음. barrier 동시성(INFO), god-service 잔존(INFO, 백로그 추적 중), rename 완전성 확인(양호) |
| requirement | LOW | plan 3개 스코프 모두 충족·"동작 무변경" 실증(grep/tsc/470 tests). WARNING: `spec_impact` frontmatter 불일치 |
| scope | LOW | 15/18 파일이 plan 3항목에 정확히 대응. WARNING: 타입 단언 제거 스코프 이탈, spec_impact 불일치 |
| side_effect | LOW | payload/로그/반환값 원본과 1:1 대조 확인. INFO: warn 로그 발화 시점 지연, rename 계약 표면 불변 확인 |
| maintainability | LOW | 두 추출 모두 엣지케이스 테스트 촘촘, 매직넘버 없음. INFO 3건(잔여 유사중복·logContext 수동동기화·스코프외 1줄) |
| testing | LOW | 핵심 신규 유닛(6케이스) 우수. WARNING: `cancelParkedExecution` error-omission 불변식 미검증 |
| documentation | LOW | JSDoc 품질 우수, spec 5개 문서 동기화 확인. INFO: CHANGELOG/plan 트래커 구식별자 잔존(diff 범위 밖) |
| concurrency | LOW | 신규 경쟁조건/데드락/await 누락/원자성 붕괴 없음. barrier 특성(INFO, by-design), rename 이 큐/env/wire 문자열 불변 확인 |

## 발견 없는 에이전트

security, performance — 리스크 NONE. 두 에이전트 모두 INFO 관찰(타입 캐스트 제거의 런타임 무영향, `processInBatches` concurrency floor 방어)을 남겼으나 이는 확인적 관찰이며 실질적 보안/성능 결함은 발견되지 않았다.

## 권장 조치사항

1. `interaction-token.service.ts` `verifyPerExecution` 의 스코프 외 타입 단언 제거를 plan 문서에 명시하거나 원복해 diff 를 선언된 3항목(naming/W4/W3)으로 한정한다 (WARNING #1).
2. `plan/in-progress/refactor-reaper-dry.md` frontmatter `spec_impact` 를 실제 수정된 5개 spec 경로 리스트로 갱신한다 — Gate C(완료) 이동 전 필수 (WARNING #2).
3. `execution-engine.service.spec.ts` 의 `cancelParkedExecution` 테스트에 `cancelledBy` 리터럴 비교 + `error` 키 부재 검증을 추가해 `emitCancellationEvent` 의 핵심 불변식 회귀를 실제로 잡도록 강화한다 (WARNING #3).
4. (낮은 우선순위) `processInBatches` JSDoc/문서에 barrier 특성, warn 로그 발화 시점 변화(청크 즉시→일괄), non-async worker 요구사항을 한 줄씩 명시해 향후 오용·오탐 조사를 예방한다.
5. (낮은 우선순위) `CHANGELOG.md` Unreleased 항목과 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 구식별자명(`Webchat`, 소문자 c) 표기를 정정한다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, concurrency (10명)
  - **제외**: dependency, database, api_contract, user_guide_sync (4명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | 순수 리팩터(rename + 내부 DRY 추출)로 `package.json`/의존성 변경 없음 — 라우터 스코프 판단(개별 사유 텍스트 미제공) |
  | database | 쿼리 구성/스키마/인덱스 변경 없음(TypeORM QueryBuilder 파라미터 바인딩 그대로 유지) — 라우터 스코프 판단 |
  | api_contract | 큐 이름·env 키·wire `error.code`·엔드포인트 시그니처 전부 불변(diff 는 클래스/메서드명 표기만) — 라우터 스코프 판단 |
  | user_guide_sync | 사용자 대면 동작/UI 변경 없음(백엔드 내부 리팩터) — 라우터 스코프 판단 |