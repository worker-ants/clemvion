# Code Review 통합 보고서

## 전체 위험도
**LOW** — CCH-NF-03 per-chat Redis fixed-window rate-limit 구현은 기능·보안·동시성·API 계약 관점 모두에서 건전하다. Critical 발견사항 없음. Warning 은 테스트 커버리지 갭 4건(상한 clamp 미검증, pipeline 원자성 순서 미검증, override 경로 미검증, 로그 호출 미검증)과 성능 관련 1건으로 기능 회귀보다는 회귀 방어 강도 및 가독성에 영향을 주는 수준이다.

---

## Critical 발견사항

해당 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `limit` 상한 clamp(600 초과 → 600) 테스트 누락 — `Math.min(600, ...)` 경로가 제거되어도 테스트 통과 | `chat-channel-rate-limiter.service.spec.ts` — `limit clamp` 케이스 | `consume(TRIGGER_ID, CHAT, 601)` 시 내부 limit 이 600 으로 보정됨을 검증하는 케이스 추가 |
| 2 | Testing | pipeline INCR+EXPIRE 가 **동일 pipeline 인스턴스에서 exec 이전에** 순서대로 호출됐는지 원자성 설계 보장 검증 부재 — pipeline 분리 시에도 테스트 통과 | `chat-channel-rate-limiter.service.spec.ts` lines 26-35 | `expect(pipeline).toHaveBeenCalledTimes(1)` 및 호출 순서(incr → expire → exec) 검증 추가 또는 `mock.invocationCallOrder` 활용 |
| 3 | Testing | `config.rateLimitPerMinute` 커스텀 override 경로(`??` 왼쪽 피연산자) 미검증 — 기본값(60) 경로만 테스트 | `hooks.service.spec.ts` — CCH-NF-03 rate-limit 이내 케이스 lines 701-724 | `chatChannelTrigger.config.rateLimitPerMinute = 30` 픽스처로 `consume(..., 30)` 호출을 assert 하는 케이스 추가 |
| 4 | Testing | DB 실패 swallow 케이스에서 `logger.warn` 호출 여부 미검증 — 로그 미발생 버그가 있어도 테스트 통과 | `hooks.service.spec.ts` — `rate-limit 초과 + degraded 갱신 DB 실패해도 throw 없이 ignored 반환` 케이스 lines 683-699 | logger mock 을 주입해 `warn` 이 호출됐는지 assert (운영 관찰가능성 회귀 방지) |
| 5 | Performance | `makeChatRateLimitKey()` 가 매 `consume()` 호출마다 템플릿 문자열 연결 수행 — 캐싱 없음 (현재 규모에서는 ns 수준이나 hot path 식별 시 고려 필요) | `chat-channel-rate-limiter.service.ts` 라인 197, `makeChatRateLimitKey()` 함수 | 현재 규모에서는 현행 유지가 안전. 성능 프로파일에서 hot path 로 식별 시 fixed-size LRU(예: 1000항목) 캐시 도입 고려 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | fail-open 정책 — Redis 장애 시 rate-limit 우회. 의도된 설계이나 Redis 장애+폭주 동시 시나리오 알람 경로 부재 | `chat-channel-rate-limiter.service.ts` fail-open 분기 전체 | Redis 장애 시 fail-open 전환을 모니터링하는 메트릭/알람 경로 확인 권장 |
| 2 | Security | `conversationKey` 가 로그에 포함되지 않아 운영 진단 제약 — stored-XSS 방어와의 의도된 트레이드오프 | `hooks.service.ts` — `markChatChannelRateLimited` warn 로그 | 로그(내부 접근 전용)에 `conversationKey` 포함 시 진단 가시성 향상 가능. 선택 사항 |
| 3 | Maintainability | `makeRedis` 반환 객체에서 `exec` 필드가 어떤 테스트에서도 검증에 사용되지 않아 독자 혼란 가능 | `chat-channel-rate-limiter.service.spec.ts` — `makeRedis` 함수 23번 줄 | `exec` 를 반환 객체에서 제거하거나 pipeline 전체 호출 흐름 검증 테스트 추가 |
| 4 | Maintainability | `as never` 타입 캐스팅이 `makeRedis` 반환부와 `exec reject` 테스트 양쪽에서 반복 | `chat-channel-rate-limiter.service.spec.ts` 23번, 86번 줄 | `makeRedis` 반환 타입을 최소 인터페이스로 명시해 `as never` 제거; `exec reject` 시나리오도 팩토리로 통합 |
| 5 | Maintainability | 테스트 상수 `LIMIT = 60` 이 `CHAT_RATE_LIMIT_DEFAULT_PER_MIN`, `CHAT_RATE_LIMIT_WINDOW_SEC` 과 모두 동일한 60 — 숫자 의미 구분 어려움 | `chat-channel-rate-limiter.service.spec.ts` 14번 줄 | `CHAT_RATE_LIMIT_DEFAULT_PER_MIN` import 로 대체하거나 5·10 등 구별 값으로 변경 |
| 6 | Maintainability | `consume` 내 clamp 상한(600)/하한(1) 이 인라인 매직 넘버 — 상수 미추출 | `chat-channel-rate-limiter.service.ts` 57번 줄 | `CHAT_RATE_LIMIT_MAX_PER_MIN = 600` 상수 추출 권장 |
| 7 | Maintainability | `chatChannelLastError` 갱신 경로에 길이 방어(`.slice`) 없음 — 코드베이스 일관성 확인 필요 | `hooks.service.ts` 864번 줄 | 코드베이스의 다른 `chatChannelLastError` 갱신 경로와 슬라이스 한도 통일 |
| 8 | Maintainability | DI 토큰 `'CHAT_CHANNEL_RATE_LIMIT_REDIS'` 문자열 리터럴 분산 — 오탈자 위험 | `chat-channel-rate-limiter.service.ts` 36번 줄 | `export const CHAT_CHANNEL_RATE_LIMIT_REDIS_TOKEN = 'CHAT_CHANNEL_RATE_LIMIT_REDIS'` 로 추출 |
| 9 | Maintainability | `moduleRef.get(ChatChannelRateLimiterService) as { consume: jest.Mock }` 캐스팅이 3개 테스트 블록에서 반복 | `hooks.service.spec.ts` 628번, 390번, 353번 줄 근방 | `describe('CCH-NF-03 rate-limit', ...)` 블록으로 묶고 `beforeEach` 에서 한 번만 할당 |
| 10 | Documentation | `types.ts` `rateLimitPerMinute` 주석에 유효 범위(1–600) 누락 | `types.ts` L70 | `/** CCH-NF-03 override. 1–600, default 60. */` 로 범위 보강 |
| 11 | Documentation | DI 토큰 `'CHAT_CHANNEL_RATE_LIMIT_REDIS'` 가 테스트 전용 슬롯임이 주석에 불명확 | `chat-channel-rate-limiter.service.ts` L35-38 | 토큰 선언부 위에 `// 테스트 전용 직접 주입 슬롯 — 프로덕션에서는 미제공, RedisConnectionProvider fallback 사용.` 한 줄 추가 |
| 12 | Documentation | CHANGELOG `Unreleased` 섹션에 CCH-NF-03 rate-limit 구현 항목 미기재 | `CHANGELOG.md` — `## Unreleased` 섹션 | CCH-NF-03 구현(신규 서비스, enforcement 위치, fail-open 정책, degraded 부작용) 항목 추가 |
| 13 | Documentation | `consume` 공개 메서드에 `@param` 태그 없음 | `chat-channel-rate-limiter.service.ts` L44-49 | `@param triggerId`, `@param conversationKey`, `@param limitPerMinute` 태그 추가 |
| 14 | Documentation | `markChatChannelRateLimited` private 메서드에 `@param` 태그 없음 | `hooks.service.ts` — `markChatChannelRateLimited` JSDoc | `@param trigger`, `@param limitPerMinute` 태그 추가 (낮은 우선순위) |
| 15 | Concurrency | Redis 7.0 미만 환경에서 `EXPIRE NX` 플래그가 무시되어 sliding window 로 동작할 수 있음 — 버전 요구사항 미문서화 | `chat-channel-rate-limiter.service.ts` `consume()` | README 또는 배포 명세에 "Redis >= 7.0 필요 (EXPIRE NX 지원)" 요구사항 명시 |
| 16 | Concurrency | 동시 폭주 시 메모리 스냅샷 기반 `degraded` 체크로 중복 DB UPDATE 가능 — 멱등 write 이므로 데이터 손상 없음 | `hooks.service.ts` 라인 482 | best-effort 정책으로 충분. 엄밀한 중복 방지 필요 시 `UPDATE WHERE chatChannelHealth != 'degraded'` 조건 추가 |
| 17 | Performance | `markChatChannelRateLimited()` 메모리 스냅샷 기반 가드로 폭주 시 burst DB UPDATE 허용 — 멱등이고 best-effort 설계 | `hooks.service.ts` `markChatChannelRateLimited()` | 단기 현행 유지. 필요 시 per-trigger debounce 또는 DB 레벨 조건 추가 |
| 18 | API Contract | rate-limit 초과 시 `202` 반환(의도적 `429` 미사용) — spec §5.5/R-CC-19 에 근거 명시 확인 필요 | spec §5.5, R-CC-19 | spec 또는 R-CC-19 에 "rate-limit 초과 시 202 반환 — R-CC-12 근거 의도적 429 미사용" 명시 확인 |
| 19 | Scope | `review/code/2026/06/12/22_49_12/` 산출물 포함 — 규약 상 커밋 의무 대상 | 커밋 파일 목록 | 범위 일탈 아님. 조치 불필요 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 전체 INFO. XSS 방어·clamp·fail-open 설계 건전. Critical/Warning 없음 |
| requirement | LOW | 이전 라운드 모든 WARNING/SPEC-DRIFT 해소. `rateLimitPerMinute` override 테스트 미추가 INFO 1건 잔여 |
| scope | NONE | 변경 범위 단일 목적 집중. 범위 일탈 없음 |
| side_effect | LOW | Redis 키·DB 갱신 의도된 부작용만 존재. 예상치 못한 전역 상태 변경 없음 |
| maintainability | LOW | 프로덕션 코드 양호. 테스트 코드 리팩토링 포인트(미사용 exec 필드, as never 반복, 매직넘버 60) 다수 INFO |
| testing | LOW | 9케이스 커버리지 양호. 상한 clamp·pipeline 원자성·override 경로·logger.warn 미검증 4건 WARNING |
| documentation | LOW | 전반적 문서화 양호. CHANGELOG 미기재, @param 누락, 범위 주석 부재 INFO |
| concurrency | LOW | pipeline 원자성 설계 올바름. Redis 7.0 버전 요구사항 미문서화, 중복 UPDATE best-effort 정책 모두 INFO |
| api_contract | LOW | Breaking change 없음. 202 선택 근거·sentinel 패턴 문서화 수준 INFO |
| performance | NONE | pipeline RTT 최소화, fail-open 조기 반환, enrichInbound 이전 배치 최적. 키 연결 WARNING 1건(현행 유지 권장) |

---

## 발견 없는 에이전트

- **scope**: 범위 일탈 징후 없음 (NONE)
- **performance**: 주요 성능 위험 없음 (NONE, 키 연결 WARNING 은 현행 유지 권장 수준)

---

## 권장 조치사항

1. **[Testing W1] limit 상한 clamp(601 입력 → 600 내부 적용) 테스트 케이스 추가** — `consume(TRIGGER_ID, CHAT, 601)` 경계 검증으로 `Math.min(600, ...)` 경로 회귀 방어.
2. **[Testing W2] pipeline 원자성 순서 검증 추가** — `expect(pipeline).toHaveBeenCalledTimes(1)` + incr → expire → exec 호출 순서 assert 로 단일 pipeline 보장 검증.
3. **[Testing W3] `config.rateLimitPerMinute` override 경로 테스트 추가** — `rateLimitPerMinute: 30` 픽스처로 `consume(..., 30)` 전달 검증.
4. **[Testing W4] DB 실패 swallow 케이스에서 `logger.warn` 호출 검증** — logger mock 주입 후 warn assert 추가.
5. **[Documentation] CHANGELOG `Unreleased` 에 CCH-NF-03 항목 추가** — 신규 서비스, enforcement 위치, fail-open 정책, degraded 부작용 기재.
6. **[Documentation] `types.ts` `rateLimitPerMinute` 주석에 범위(1–600) 보강** — `/** CCH-NF-03 override. 1–600, default 60. */`.
7. **[Concurrency/Documentation] Redis >= 7.0 요구사항 배포 명세에 명시** — `EXPIRE NX` 지원 버전 요건 문서화.
8. **[Maintainability] `LIMIT = 60` 상수를 `CHAT_RATE_LIMIT_DEFAULT_PER_MIN` import 로 교체 또는 구별 값으로 변경** — 세 가지 의미가 모두 60 인 혼동 해소.
9. **[Maintainability] DI 토큰 문자열 상수 추출 및 테스트 전용 용도 주석 명시** — `CHAT_CHANNEL_RATE_LIMIT_REDIS_TOKEN` 상수화.
10. **[Maintainability] `moduleRef.get(ChatChannelRateLimiterService)` 캐스팅을 `beforeEach` 에서 한 번만 할당하도록 리팩토링** — 3개 테스트 블록 중복 제거.

---

## 라우터 결정

라우터 미사용 — `routing=all`. 전체 reviewer(10명) 실행.

- **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation, concurrency, api_contract, performance (10명)
- **제외**: 없음
- **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명)