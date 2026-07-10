# Rationale 연속성 검토 — `getStatus()` 2단계 컬럼 projection

> **기록 경위**: 본 파일은 `rationale-continuity-checker` sub-agent 가 반환한 결과를 main 이 디스크에
> 기록한 것이다. sub-agent 의 Write 가 worktree write-isolation 으로 차단돼 산출 파일이 생성되지 않았고
> (반환값에는 전문이 담겨 있었음), 나머지 4개 checker 산출물과의 정합을 위해 main 이 복원했다.

## 검토 대상

- Spec: `spec/5-system/14-external-interaction-api.md` §5.3, R17 (line 1104-1177)
- Convention: `spec/conventions/conversation-thread.md` §4, §8.4 (line 339-350)
- 구현: `codebase/backend/src/modules/external-interaction/interaction.service.ts` `getStatus()`
- Plan: `plan/in-progress/eia-getstatus-column-projection.md`

## 발견사항

### [INFO] 기각 대안 (a)/(b) 재도입 아님 — 확인됨

- 과거 결정 출처: EIA `## Rationale` R17 "기각 대안" 문단 (line 1136-1139)
- R17 이 기각한 두 안은 모두 **`conversationThread` 노출 자체를 다른 소스/경로로 대체**하는 것이었다:
  - (a) SSE 전용 유지 + buffer 만료 시 위젯이 재조회 → 순환(만료 시 되살릴 소스 부재)
  - (b) `NodeExecution.output_data` 분산 저장에서 thread 재구성 → `runningSummary` 등 메타 부재로 무손실 복원 불가
- 본 변경은 여전히 `Execution.conversation_thread` durable 컬럼을 직접 SELECT 한다. 단지 그 SELECT 를
  `status === waiting_for_input` 조건부 2단계로 나눌 뿐이다. SSE-only 회귀도, NodeExecution 재구성도 아니다.
- 조치 불필요.

### [INFO] R17/§8.4 의 "waiting-only 노출" 원칙과 이미 합치

- 과거 결정 출처: `conversation-thread.md` §8.4 line 350 ("**waiting_for_input 한정**으로 read-only 동봉"),
  EIA §5.3 line 429-442, widget `7-channel-web-chat/1-widget-app.md` §3.1 line 89 ("`GET /:id`(**waiting_for_input
  상태면** durable `conversationThread` 동봉…)")
- R17 의 복원 시나리오(buffer 만료·재시작·인스턴스 스위치)는 spec·widget 계약상 이미 **"reload 시점에 execution 이
  여전히 waiting_for_input"** 인 경우로 한정 서술돼 있다. 토큰 만료/410 이면 곧바로 `[ended]` 로 전이해
  `conversationThread` 없이 처리한다.
- 기존 코드도 `execution.status === WAITING_FOR_INPUT` 분기 안에서만 thread 를 사용했다. 즉 "waiting 일 때만
  재조회" 는 **이미 문서화된 노출 경계와 일치**하며 R17 이 채택한 복원 시나리오를 축소하지 않는다.
- 조치 불필요.

### [INFO] `redactThreadForPublic` 공유 helper 불변식 — 구현 시 명시 검증 필요

- 과거 결정 출처: R17 "표면 제약(보안)" 문단 (line 1141-1149) — "REST `getStatus` 와 SSE `waiting_for_input`
  emit 이 **공유하는 단일 helper** `redactThreadForPublic`"
- 2단계 조회로 리팩터할 때 새 쿼리 결과에도 동일하게 `redactThreadForPublic` 을 통과시켜야 "REST·SSE 동일 helper"
  불변식이 깨지지 않는다. plan 의 "wire 응답 형식 무변경" 서술은 이를 전제하나 명시적 요구사항화돼 있지 않다.
- **제안**: 구현/리뷰 체크리스트에 "재조회한 `conversationThread` 도 `redactThreadForPublic` 통과 확인" 추가.
  (→ SUMMARY W1 로 승격, 마스킹 단언 테스트로 고정됨)

### [INFO] 1·2단계 사이 TOCTOU — 새 위험 클래스 아님

- 기존 코드도 `execution` 단일 스냅샷 이후 `nodeExecutionRepository.findOne` 을 별도 쿼리로 호출하는 동일 패턴을
  이미 갖고 있어(구 line 267-274) 새로운 위험 클래스가 아니다.
- 응답은 스냅샷이며 row 삭제 시 기존 "durable thread 없음" graceful 경로(키 생략)와 동일하게 흡수된다.
- 조치 불필요. 다만 `updatedAt` 계산에 쓰이는 `startedAt`/`finishedAt` 을 projection 에서 누락하지 않도록 주의.
  (→ SUMMARY W2)

### [INFO] 코드 JSDoc 동기화 (spec 아님)

- `getStatus()` JSDoc 이 단일 `findOne` 전제로 서술돼 있다. Spec 본문(R17)은 wire 계약만 규정하고 내부 fetch
  메커니즘은 범위 밖이므로 **spec 갱신은 불필요**하나, spec 을 인용하는 코드 주석은 구현과 함께 정합화 필요.
- **제안**: 구현 커밋에 JSDoc 수정 포함.

## 선례 확인 — "컬럼 projection 최적화" 기각 이력

`interaction.service.ts` 내 다른 3개 호출부(`interact` 토큰 refresh, `refreshToken`, `loadAndAssertAlive`)가 이미
`select: ['id','status']` 얇은 projection 을 쓰고 있고, 같은 모듈의 `interaction.guard.ts`·
`notification-webhook.processor.ts`·`notification-fanout.service.ts`·`interaction-token.service.ts` 도 모두 partial
select 를 표준으로 사용한다. `getStatus()` 의 전 컬럼 fetch 가 오히려 예외였다.

`spec/`, `plan/complete/`, entity 주석 어디에도 "컬럼 projection 을 쓰지 말라"는 기각 이력이나 TypeORM
partial-select 관련 사고 기록은 없다. 본 변경은 선례에 반하지 않고, 오히려 모듈 내 기존 컨벤션과의 일관성 갭을
해소하는 방향이다.

## 요약

본 변경은 R17 이 확립한 "`conversationThread` 는 `waiting_for_input` 한정으로 durable 컬럼에서 직접 노출한다"는
경계를 그대로 유지하면서 fetch **시점**만 조건화하는 순수 내부 최적화다. R17 이 명시적으로 기각한 두 대안 중
어느 쪽도 재도입하지 않으며, `conversation-thread.md` §8.4 와 widget spec §3.1 이 이미 "waiting_for_input 한정
노출"을 계약으로 못박아 두고 있어 오히려 그 계약과 완전히 합치한다.

구현 단계 확인 사항은 (1) 재조회 결과에도 `redactThreadForPublic` 마스킹 유지, (2) JSDoc 동기화 두 가지이며,
둘 다 Rationale 자체의 번복이나 원칙 위반이 아니라 구현 디테일이다.

## 위험도

LOW

STATUS: OK
