# Code Review 통합 보고서

**대상**: CCH-NF-03 per-chat rate-limit 구현 (chat-channel-rate-limiter.service.ts, hooks.service.ts 등)
**일시**: 2026-06-12 22:49:12

---

## 전체 위험도
**MEDIUM** — spec 갱신 누락(SPEC-DRIFT 4건)과 코드 측 입력값 검증 미구현, 테스트 공백이 복합적으로 존재하나 기능 정확성 자체는 양호함

---

## Critical 발견사항

_없음_

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] spec §3.6 CCH-NF-03 본문이 "큐 적재 / 미구현(Planned)" 상태를 유지하나 코드는 skip+degraded 로 완전 구현됨 | `spec/5-system/15-chat-channel.md` line 112 | 코드 유지, `project-planner` 가 spec §3.6 CCH-NF-03 본문을 "skip+degraded / Redis fixed-window / fail-open" 으로 갱신하고 "미구현" 주석 제거 |
| 2 | SPEC-DRIFT | [SPEC-DRIFT] spec §5.5 inbound 계약 표에 rate-limit 초과(per-chat) 행 미추가 — 코드는 202 + `{ executionId: 'ignored' }` 반환 | `spec/5-system/15-chat-channel.md` §5.5 | spec §5.5 에 rate-limit 초과 행 추가 (202, `{ executionId: 'ignored' }`, fixed-window 초과 + degraded) |
| 3 | SPEC-DRIFT | [SPEC-DRIFT] 코드 주석이 `R-CC-19` 를 참조하나 spec Rationale 에 R-CC-19 미존재 (R-CC-18 까지만 있음) | `spec/5-system/15-chat-channel.md` Rationale, `hooks.service.ts` line 278·851 | `project-planner` 가 R-CC-19 신설 (skip+degraded 채택 근거, fail-open 정책, R9 독립성) |
| 4 | SPEC-DRIFT | [SPEC-DRIFT] spec-draft §결정의 "key = trigger.id + conversationKey + 분 버킷" 기술이 구현(분 버킷 없는 EXPIRE 60s 방식)과 불일치, "분 버킷" 표현이 minute-aligned 버킷으로 오해 가능 | `plan/in-progress/spec-draft-cch-nf-03-rate-limit.md` line 17 | spec-draft §결정을 "key = `cc:rl:{triggerId}:{conversationKey}`, EXPIRE 60s (first-request-anchored fixed window)" 로 수정 |
| 5 | 입력 검증 | `rateLimitPerMinute` 값 범위(1–600) 검증 미구현 — 0·음수 시 전체 차단, 600 초과 시 rate-limit 무의미화 | `codebase/backend/src/modules/chat-channel/types.ts` line 71; `hooks.service.ts` | setupChannel 또는 config 저장 시 1–600 범위 검증 추가, 또는 `consume` 내 `Math.max(1, Math.min(600, limitPerMinute))` clamp |
| 6 | 테스트 | `markChatChannelRateLimited` — 이미 `degraded` 상태 trigger 에 대해 `triggerRepo.update` 미호출 분기(중복 write 방지) 테스트 누락 | `hooks.service.ts` line 859; `hooks.service.spec.ts` | "이미 degraded → update 미호출" 케이스 추가 |
| 7 | 테스트 | `pipeline.exec()` null / 빈 배열 반환 fail-open 경로 테스트 누락 | `chat-channel-rate-limiter.service.ts` line 61; spec 파일 | null/`[]` 반환 시 fail-open(true) 검증 테스트 2개 추가 |
| 8 | 테스트 | `results[0]` 의 `incrErr` non-null 시 catch → fail-open 경로 테스트 누락 | `chat-channel-rate-limiter.service.ts` line 62–63 | `exec → [[new Error(...), null]]` 반환 시 fail-open 케이스 추가 |
| 9 | 테스트 | `pipeline.incr(key)` 가 올바른 키로 호출됐는지 검증 assertion 없음 — 키 누락 시 테스트 통과 가능 | `chat-channel-rate-limiter.service.spec.ts` | `expect(redis._incr).toHaveBeenCalledWith(makeChatRateLimitKey(...))` assertion 추가 |
| 10 | 테스트 | `triggerRepo.update` 검증이 `chatChannelLastError` 내용을 확인하지 않음 | `hooks.service.spec.ts` lines 595–600 | assertion 에 `chatChannelLastError: expect.stringContaining('60/min')` 추가 |
| 11 | 테스트 | `markChatChannelRateLimited` DB 갱신 실패 시 에러 swallow 동작 테스트 미존재 | `hooks.service.ts` lines 718–723 | `triggerRepo.update` reject 시 `handleWebhook` 이 정상 반환하는지 검증 케이스 추가 |
| 12 | 아키텍처 | `HooksService` 와 `ChatChannelDispatcher` 양쪽에 `chat_channel_health=degraded` DB 갱신 로직 분산 — health 갱신 경로 증가 시 DRY 위반 심화 | `hooks.service.ts` `markChatChannelRateLimited`, `ChatChannelDispatcher.markDegraded` | 즉각 조치 불필요. 3번째 경로 추가 시 `ChatChannelHealthManager` 등 전용 서비스 추출 고려 |
| 13 | 아키텍처 | `HooksService` 가 `CHAT_RATE_LIMIT_DEFAULT_PER_MIN` 상수를 직접 import 해 `consume` 에 전달 — 캡슐화 관점에서 기본값 처리를 서비스 내부로 이동하는 것이 더 응집도 높음 | `hooks.service.ts` import; `chat-channel-rate-limiter.service.ts` | `consume` 의 `limitPerMinute` 를 optional 로 변경하고 기본값을 서비스 내부에서 처리 (테스트 가시성과의 trade-off 있어 필수 아님) |
| 14 | 보안 | Redis 키에 외부 입력 `conversationKey` 를 새니타이징 없이 삽입 — 콜론 포함 시 키 구조 왜곡·키 콜리전 가능 | `chat-channel-rate-limiter.service.ts` `makeChatRateLimitKey` | `conversationKey` / `triggerId` 에서 콜론 제거 또는 인코딩, 키 총 길이 상한 강제(예: 256바이트) |
| 15 | 보안 | `chatChannelLastError` 필드에 외부 입력 `conversationKey` 포함 DB 저장 — 관리자 UI 렌더링 시 Stored XSS 가능성 | `hooks.service.ts` `markChatChannelRateLimited` | DB 저장 전 제어 문자·HTML 특수문자 strip, 또는 관리자 UI에서 HTML 이스케이핑 보장. 대안으로 `[external-id-redacted]` 고정 플레이스홀더 사용 |
| 16 | 동시성 | INCR 성공 후 별도 `redis.expire()` 호출 사이 프로세스 크래시 시 TTL 미설정 키 영구 잔류 — 해당 per-chat 키가 만료되지 않아 이후 모든 메시지가 잘못 차단될 수 있음 | `chat-channel-rate-limiter.service.ts` lines 267–276 | INCR 과 EXPIRE 를 같은 pipeline 에 포함하거나 Lua script(`EVAL`)로 원자적 처리. 기존 `PublicWebhookQuotaService` 패턴 정합 고려 필요 |
| 17 | 요구사항 | enforcement 위치가 spec-draft("parseUpdate 직후")와 달리 `enrichInbound` 이후에 위치 — Slack file_upload 등 외부 API 호출 후 rate-limit 확인하여 불필요한 latency 발생 | `hooks.service.ts` lines 272–283; `spec-draft-cch-nf-03-rate-limit.md` line 19 | rate-limit check 를 `enrichInbound` 이전(parseUpdate 직후)으로 이동하거나, spec-draft 를 "enrichInbound 이후(conversationKey 최종 확정 후)"로 수정 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | fail-open 정책이 Redis 비가용 시 rate-limit 완전 무력화 — 설계적 허용(R-CC-19)이나 Redis 연결 고갈 공격 시 DDoS 보호 제거됨 | `chat-channel-rate-limiter.service.ts` `consume` | 연속 Redis 에러 시 circuit-breaker 또는 운영자 알람 추가 고려. 현재 `logger.warn` 으로 기본 가시성 확보됨 |
| 2 | 보안 | fixed-window 경계 버스트(boundary burst) 최대 2배 허용 — 설계적 허용(spec Rationale 명시) | 전체 rate-limit 로직 | 현재 허용. 향후 sliding-window(Redis sorted set) 전환 고려 가능 |
| 3 | 보안 | 하드코딩된 시크릿 없음, 에러 메시지에 스택 트레이스 미노출 — 양호 | 전체 변경 파일 | 없음 |
| 4 | 성능 | `pipeline().incr()` 단독 사용 — `expire` 가 pipeline 밖 별도 round-trip (count === 1 케이스에서 Redis 왕복 2회) | `chat-channel-rate-limiter.service.ts` lines 264–273 | `expire` 를 같은 pipeline 에 포함 시 round-trip 1회로 절감 가능. 현재 패턴도 합리적이므로 INFO |
| 5 | 성능 | `markChatChannelRateLimited` 의 메모리 기반 중복 write 방지 — 멀티 인스턴스 폭주 시 중복 DB UPDATE 발생 가능하나 idempotent | `hooks.service.ts` lines 706–724 | 주석에 "멀티 인스턴스 환경 중복 write 가능하나 idempotent" 명시 |
| 6 | 성능 | `onApplicationBootstrap` 에서 대용량 trigger 전량 `.getMany()` 메모리 적재 — 이번 PR 신규 변경 아님 | `chat-channel.module.ts` lines 503–521 | trigger 수 증가 시 chunkSize 페이지네이션 고려 |
| 7 | 유지보수성 | `makeRedis` 헬퍼의 `_incr`/`_exec` 필드가 반환 타입에 미포함되어 실질 접근 불가 — 미사용 잔여물 | `chat-channel-rate-limiter.service.spec.ts` `makeRedis` | 필드 제거하거나 반환 타입에 포함해 실제 검증에 사용 |
| 8 | 유지보수성 | `as never` 타입 캐스팅이 6개 테스트 중 5곳에서 반복 | `chat-channel-rate-limiter.service.spec.ts` | `makeRedis` 반환 타입을 `Pick<Redis, 'pipeline' \| 'expire'>` 로 강화 |
| 9 | 유지보수성 | `chatChannelLastError` 에 `.slice(0, 1024)` 매직 넘버 — DB 컬럼 길이 제약 출처 주석 없음 | `hooks.service.ts` `markChatChannelRateLimited` | `CHAT_CHANNEL_LAST_ERROR_MAX_LENGTH` 등 명명 상수로 추출 |
| 10 | 유지보수성 | `hooks.service.spec.ts` 에서 `moduleRef.get(ChatChannelRateLimiterService) as { consume: jest.Mock }` 캐스팅 2회 중복 | `hooks.service.spec.ts` | `describe` 블록 공유 변수로 추출하거나 `beforeEach` 로 이동 |
| 11 | 범위 | `spec/5-system/1-auth.md` SameSite 기각 대안 문장 삭제 — rate-limit 작업과 무관 | `spec/5-system/1-auth.md` line 1826 | 별도 PR/커밋으로 분리 권장. 기능 변경 없어 차단 불필요 |
| 12 | 범위 | `spec/5-system/6-websocket-protocol.md` §3.3 채널 인가 rationale 섹션 전체 삭제 — rate-limit 작업과 무관 | `spec/5-system/6-websocket-protocol.md` lines 1922–1928 | 삭제 이유 커밋 메시지 명시 또는 별도 PR 분리 |
| 13 | 범위 | `plan/in-progress/spec-draft-cch-nf-03-rate-limit.md` frontmatter `worktree` slug 누락 (`chat-channel-rate-limit` → `chat-channel-rate-limit-baa15a` 이어야 함) | `plan/in-progress/spec-draft-cch-nf-03-rate-limit.md` 2행 | `worktree: chat-channel-rate-limit-baa15a` 로 교정 |
| 14 | 범위 | `spec/data-flow/14-chat-channel.md` 구현 갭 callout 이 "아직 없다(구현 대기)"로 남아 PR 병합 직후 stale 됨 | `spec/data-flow/14-chat-channel.md` lines 1953–1960 | "구현 완료 (2026-06-12, hooks.service.ts + ChatChannelRateLimiterService)" 로 갱신 또는 callout 제거 |
| 15 | 아키텍처 | `CHAT_CHANNEL_RATE_LIMIT_REDIS` 토큰이 어느 모듈에서도 provide 되지 않음 — `@Optional()` + `RedisConnectionProvider` fallback 으로 안전하나 silent fallback 위험 | `chat-channel-rate-limiter.service.ts` lines 35–37 | 생성자 주석에 "현재 미등록 — fallback은 RedisConnectionProvider" 명시 |
| 16 | API 계약 | rate-limit 초과 시 202 (not 429) 선택 근거가 plan 문서에만 있고 spec §5.5/R-CC-19 에 미기재 | `spec/5-system/15-chat-channel.md` §5.5 | spec §5.5 또는 R-CC-19 에 "202 선택 근거: provider webhook 자동 비활성화 방지(R-CC-12), 의도적 429 미사용" 명시 |
| 17 | API 계약 | `{ executionId: 'ignored' }` sentinel 이 기존 skip 케이스와 동일 패턴임을 spec §5.5 에서 명시적으로 통합하지 않음 | `spec/5-system/15-chat-channel.md` §5.5 | spec §5.5 신규 행에 sentinel 값과 기존 skip 케이스 통합 설명 |
| 18 | 문서 | `types.ts` `rateLimitPerMinute` 주석이 범위(1–600) 생략 | `codebase/backend/src/modules/chat-channel/types.ts` L70–71 | `/** CCH-NF-03 override. 1–600, default 60. */` 로 보강 |
| 19 | 문서 | CHANGELOG 에 CCH-NF-03 rate-limit 구현 항목 없음 | `CHANGELOG.md` `## Unreleased` | "CCH-NF-03: per-chat 분당 rate-limit 구현" 항목 추가 |
| 20 | 문서 | `markChatChannelRateLimited` JSDoc 에 `@param` 태그 누락 (trigger, limitPerMinute, conversationKey) | `hooks.service.ts` L854 | 필요 시 `@param` 태그 추가. 우선순위 낮음 |
| 21 | 요구사항 | `chatChannelLastError` 에 `conversationKey` 포함 기록 동작이 spec-draft §변경 surface §1 에 미기재 | `spec-draft-cch-nf-03-rate-limit.md`, `hooks.service.ts` | R-CC-19 또는 CCH-NF-03 갱신 문구에 `chatChannelLastError` 갱신 동작(1024자 한도) 추가 |
| 22 | 요구사항 | `config.rateLimitPerMinute` override 값(기본 60 이외)을 사용하는 케이스 통합 테스트 미검증 | `hooks.service.spec.ts` line 621 | `rateLimitPerMinute: 30` fixture 로 `consume` 에 30이 전달되는지 검증 케이스 추가 |
| 23 | 동시성 | `markChatChannelRateLimited` 멀티 인스턴스 중복 UPDATE — idempotent 하나 주석 불명확 | `hooks.service.ts` lines 709–727 | 주석에 "멀티 인스턴스 중복 write 가능하나 idempotent" 명시 |
| 24 | 의존성 | 공통 Redis fixed-window 유틸리티가 `PublicWebhookQuotaService` 와 약 30줄 중복 — 현재 규모에서 필수 아님 | `chat-channel-rate-limiter.service.ts` | 장기적으로 `common/redis/` 에 공통 유틸리티 추출 고려 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | MEDIUM | SPEC-DRIFT 4건(spec 본문 미갱신, R-CC-19 미신설, §5.5 행 누락, spec-draft 키 기술 불일치), `rateLimitPerMinute` 범위 검증 미구현, enforcement 위치 불일치 |
| security | LOW | Redis 키 콜리전(conversationKey 새니타이징 미비), Stored XSS 가능성(`chatChannelLastError`) |
| architecture | LOW | `HooksService` SRP 부담 증가, `CHAT_RATE_LIMIT_DEFAULT_PER_MIN` 캡슐화 관점 개선 여지 |
| testing | LOW | pipeline null/빈 배열/incrErr fail-open 테스트 누락, degraded 분기 테스트 누락, DB 에러 swallow 테스트 누락 |
| concurrency | LOW | INCR+EXPIRE 원자성 갭 (프로세스 크래시 시 TTL 미설정 키 영구 잔류) |
| scope | LOW | rate-limit 무관 spec 문서 2건 삭제, data-flow callout stale, plan worktree slug 오류 |
| side_effect | LOW | `HooksService` 생성자 시그니처 변경(DI 외 수동 인스턴스화 코드 없어 실질 영향 없음) |
| maintainability | LOW | 테스트 헬퍼 미사용 필드, `as never` 반복, 매직 넘버 1024 |
| performance | NONE | INCR+EXPIRE pipeline 분리(INFO 수준), O(1) 알고리즘 — 성능상 적절 |
| api_contract | LOW | 202 선택 근거·sentinel 값 spec 미기재 |
| database | LOW | INCR+EXPIRE 분리(동형 기존 패턴), best-effort DB UPDATE — 데이터 무결성 문제 없음 |
| dependency | NONE | 신규 외부 패키지 없음, 순환 의존성 없음 |
| user_guide_sync | NONE | 매칭 trigger 0건, 동반 갱신 누락 없음 |
| documentation | LOW | types.ts 범위 주석 누락, CHANGELOG 미기재, DI 토큰 용도 불명 |

---

## 발견 없는 에이전트

- `user_guide_sync` — 매트릭스 19개 row 전체 비매칭, 동반 갱신 필요 항목 없음
- `dependency` — 신규 외부 패키지 없음, 순환 의존성·라이선스·취약점 발견 없음
- `performance` — O(1) 알고리즘, 완전 비동기, INFO 수준 최적화 여지만 존재

---

## 권장 조치사항

1. **(SPEC-DRIFT — 필수, project-planner 위임)** `spec/5-system/15-chat-channel.md` §3.6 CCH-NF-03 본문을 "skip+degraded, Redis fixed-window, fail-open" 으로 갱신하고 "미구현 Planned" 제거; §5.5 rate-limit 초과 행 추가; R-CC-19 Rationale 신설; spec-draft 키 기술 수정
2. **(입력 검증 — WARNING W-5)** `rateLimitPerMinute` 1–600 범위 검증 추가 (setupChannel/config 저장 시점 또는 `consume` 내 clamp)
3. **(보안 — WARNING W-14·W-15)** `makeChatRateLimitKey` 에서 `conversationKey`/`triggerId` 콜론 인코딩; `chatChannelLastError` DB 저장 전 HTML 특수문자 strip 또는 관리자 UI 이스케이핑 보장
4. **(동시성 — WARNING W-16)** INCR+EXPIRE 원자성 갭 해소: EXPIRE 를 같은 pipeline 에 포함하거나 Lua script 사용 (기존 `PublicWebhookQuotaService` 패턴 정합 우선 논의)
5. **(테스트 보완 — WARNING W-6~W-11)** 우선순위 순: ① 이미 degraded → update 미호출, ② pipeline null/빈 배열 fail-open, ③ incrErr non-null fail-open, ④ incr 올바른 키 호출 검증, ⑤ `chatChannelLastError` 내용 검증, ⑥ DB 에러 swallow
6. **(요구사항 — WARNING W-17)** enforcement 위치를 `enrichInbound` 이전(parseUpdate 직후)으로 이동하거나 spec-draft 기술 수정
7. **(INFO 정리)** `spec/data-flow/14-chat-channel.md` callout "아직 없다" → "구현 완료" 갱신; plan frontmatter worktree slug 교정; CHANGELOG `## Unreleased` 항목 추가

---

## 라우터 결정

라우터 미사용 — `routing=fallback-all`. 전체 reviewer 14명 모두 실행됨.

- **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, concurrency, api_contract, database, dependency, user_guide_sync (14명)
- **제외**: 없음
- **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명 — fallback-all 이므로 강제/비강제 구분 없이 전원 실행)