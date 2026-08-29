STATUS=success ISSUES=0

===REPORT_MARKDOWN_BELOW===

# API 계약(API Contract) 리뷰

## 검토 범위

- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` — `intercept()` 의
  `switchMap` 콜백을 `resolveCacheHit()` private 메서드로 추출하는 **순수 구조 리팩터링**.
  호출부가 넘기던 `redisKey`·`bodyHash`·`context`·`next` 4개 값을 `CacheLookup` 인터페이스로 묶음.
- `plan/in-progress/backend-lint-gate-broken-on-main.md` — plan 문서 업데이트(체크박스 완료 표시,
  worktree 필드 갱신). 코드 아님, API 계약 무관.
- `review/consistency/2026/08/29/17_23_43/*` (SUMMARY.md·_retry_state.json·convention_compliance.md·
  cross_spec.md·meta.json·naming_collision.md·plan_coherence.md·rationale_continuity.md) — 별도
  consistency-check 서브에이전트의 산출 아티팩트. 코드 아님, API 계약 무관.

## 분석

`idempotency.interceptor.ts` 의 diff 를 old(추출 전 인라인 `switchMap` 콜백)와
new(`resolveCacheHit()` 로 추출된 메서드) 양쪽 로직을 줄 단위로 대조했다. 조건 분기 순서·조건식·
throw 되는 예외 타입과 payload·응답 상태코드 설정·성공 채널 반환값이 **전부 동일**하다:

- 캐시 미스 → `processFresh()` (동일)
- 엔트리 JSON 문법 손상 → `discardCorruptEntry('엔트리', err, processFresh)` (동일)
- 엔트리 형태 불일치(`isIdempotencyEntry`) → `discardCorruptEntry` (동일, 순서도 문법 검사 다음으로 동일)
- `bodyHash` 불일치 → `throw new ConflictException({ error: { code: 'IDEMPOTENCY_KEY_CONFLICT', ... } })`
  (동일 — 에러 코드·메시지·HTTP 상태 409 불변)
- `responseJson` 손상 → `discardCorruptEntry('payload', err, processFresh)` (동일)
- `isErrorStatusCacheable`(409·410) → `throw new HttpException(cachedPayload, cached.statusCode)` (동일)
- 그 외(2xx) → `res.status(cached.statusCode)` + `of(cachedPayload)` (동일)

즉 이 변경은 클래스 내부 구조만 바꾸고 요청/응답 외부 계약(상태코드, 에러 코드, 응답 바디 형태,
헤더 처리, 인증/인가 전제조건인 `req.interaction?.executionId`)에는 아무 영향이 없다. plan 문서에도
"순수 구조 변경 — 기존 spec 63건 전부 GREEN, 새 테스트 없음" 으로 명시돼 있고, 코드 대조 결과와
일치한다.

8개 점검 관점 중 API 표면에 해당하는 항목(응답 형식·에러 응답·요청 검증·인증/인가)은 전부
"변경 없음" 으로 확인되며, 나머지(버전 관리·URL/경로 설계·페이지네이션)는 이 파일의 범위 밖이다
(라우트·경로·페이지네이션을 다루지 않는 인터셉터).

### 발견사항

없음.

## 요약

이번 diff 는 `IdempotencyInterceptor` 의 `intercept()` 안에 있던 캐시-히트 판정 로직(7갈래 분기)을
`resolveCacheHit()` private 메서드로 추출하고 4개 호출 인자를 `CacheLookup` 타입으로 묶은 **순수
내부 리팩터링**이다. old/new 로직을 줄 단위로 대조한 결과 조건 순서·예외 타입·HTTP 상태코드·응답
바디 구성이 모두 동일해 API 클라이언트에 보이는 계약(에러 코드 `IDEMPOTENCY_KEY_CONFLICT`, 409/410
재현, 2xx 캐시 재현, fail-open 동작)에 변화가 없다. 나머지 변경 파일(plan 문서, consistency-check
산출물)은 코드가 아니라 API 계약과 무관하다.

## 위험도

NONE
