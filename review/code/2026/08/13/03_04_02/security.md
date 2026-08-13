# 보안(Security) 코드 리뷰 — CCH-SE-02 chat-channel update dedup (`03_04_02`)

## 범위 확인

이번 diff 는 이전 두 라운드(`02_38_41`, `02_50_38`)가 이미 검토한 `ChatChannelDedupService` 신설 +
`HooksService` 배선(CCH-SE-02) 자체에는 **실질 코드 변경이 없다** — 이번에 새로 추가되는 것은
CHANGELOG 항목(파일 1), `plan/in-progress/backend-lint-gate-broken-on-main.md` 체크박스+완료 노트
(파일 7), 이전 두 리뷰 라운드의 산출물(`review/code/**`, `review/consistency/**`, 파일 8~41), 그리고
spec 문서 3건(`telegram.md`/`15-chat-channel.md`/`data-flow/14-chat-channel.md`, 파일 42~44)이다.
핵심 보안 표면(`chat-channel-dedup.service.ts`, `hooks.service.ts` 의 배선 지점)은 직접 `Read` 로
소스를 열어 diff 와 대조 확인했다.

## 발견사항

- **[INFO]** provider 가 공급하는 `idempotencyKey` 에 길이 검증 없이 Redis 키를 구성한다.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts:6`-`9` (`makeChatDedupKey`), 호출부 `codebase/backend/src/modules/hooks/hooks.service.ts:339`
  - 상세: `makeChatDedupKey(triggerId, idempotencyKey)` 는 provider update id 를 검증·길이 제한 없이 그대로 Redis 키 접미사로 사용한다. 이 `SET NX EX` 호출은 rate-limiter(`chatChannelRateLimiter.consume`, `hooks.service.ts:354`) **보다 앞**에 배선돼 있어(의도된 설계 — 재도착이 쿼터를 소비하면 안 되므로) 이 지점 자체는 per-chat 요청 한도의 보호를 받지 않는다. 다만 `hooks.service.ts:291`(`chatChannelInboundAuthenticator.verify`, `timingSafeEqual` 기반 HMAC/토큰 비교, 실패 시 `UnauthorizedException`)가 이 지점보다 먼저 실행되므로 유효한 provider 서명/시크릿 없이는 도달 불가하고, 각 provider(telegram `update_id`/slack `event_id`/discord interaction id)의 update id 는 실질적으로 짧은 정수/UUID 형태다. 이번 diff 로 새로 생긴 표면이지만 실익스플로잇 난도는 높다.
  - 제안: 급하지 않음. 필요 시 이 저장소가 이미 쓰는 `MAX_KEY_LENGTH` 관례와 동일한 상한(예: 200자) clamp 를 고려할 수 있다.

- **[INFO]** Redis 장애 시 fail-open — 문서화된 의도된 트레이드오프, 인증/인가 우회 아님.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts:54`-`55`(`if (!this.redis) return true;`), `:69`-`73`(`catch` 블록)
  - 상세: Redis 미가용/에러 시 억제 없이 통과한다. 클래스 docstring(`:14`-`33`)이 이 정책을 명시하고, 같은 모듈의 `ChatChannelRateLimiterService`·`PublicWebhookQuotaService` 와 동일 정책이다. warn 로그가 남으며(`:70`-`72`), 신규 테스트(`chat-channel-dedup.service.spec.ts:71`-`84`)가 이 로그 소실 회귀까지 고정한다. 인증 우회·정보 노출은 없다 — 영향은 "최대 30초 창에서 dedup 억제만 무력화"로 국한되고, 이는 방어기능 가용성 저하이지 신뢰 경계 붕괴가 아니다.
  - 제안: 조치 불요. 참고용 기록.

- **[INFO]** 에러 메시지를 서버 로그에만 그대로 싣는다 — 클라이언트 노출 없음.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts:71`(`err instanceof Error ? err.message : String(err)`)
  - 상세: `hooks.service.ts` 의 다른 catch 블록들과 동일 패턴이며, 이 값은 `Logger.warn` 으로만 나가고 HTTP 응답(`{ executionId: 'ignored' }`)에는 포함되지 않는다. 사용자에게 노출되는 에러 메시지가 아니므로 정보 노출 위험은 없음.
  - 제안: 조치 불요.

## 점검했으나 문제 없음으로 판단한 항목

- **인젝션**: `this.redis.set(key, '1', 'EX', 30, 'NX')`(`chat-channel-dedup.service.ts:61`-`67`)는 ioredis 의 파라미터화 호출이며 raw 커맨드 문자열 조립이 아니다 — Redis 커맨드 인젝션 표면 없음. `triggerId`(내부 UUID) + `idempotencyKey`(provider 값)를 콜론 결합으로 키를 만들지만, 키가 `triggerId` 로 스코프되어 있어 콜론 충돌이 발생해도 크로스 테넌트 유출·권한 상승으로 이어지지 않는다(`chat-channel-dedup.service.spec.ts` 의 "trigger 가 다르면 서로를 막지 않는다" 테스트로 스코핑이 실제로 고정돼 있음을 확인).
- **인증/인가**: `hooks.service.ts` 를 직접 열어 순서를 재확인했다 — `chatChannelInboundAuthenticator.verify()`(`:291`, 실패 시 `UnauthorizedException` throw, `timingSafeEqual` 비교) → `isActive` 체크(`:301`) → `parseUpdate()`(`:320`) → **dedup claim**(`:338`-`345`) → rate-limit(`:354`). dedup 은 서명 검증을 통과한 요청에만 도달하므로, 미인증 요청이 이 경로로 Redis 쓰기를 유발할 수 없다.
- **하드코딩 시크릿**: 해당 diff 전체(코드·spec·plan·review 산출물 포함)에서 패스워드/API 키/토큰/인증서 패턴을 grep 했으나 발견되지 않았다. `'CHAT_CHANNEL_DEDUP_REDIS'` 는 값이 아니라 NestJS DI 토큰 문자열이다.
- **입력 검증**: `ChannelUpdate.idempotencyKey` 는 non-optional `string` 타입이고 세 파서(telegram/slack/discord) 모두 provider 값을 채운다. 빈 문자열 케이스는 `claim()` 이 명시적으로 dedup 대상에서 제외해(`:57`-`58`) 서로 다른 update 가 한 키로 뭉쳐 유실되는 것을 방지한다.
- **암호화**: 이 diff 범위에 암호화·해시 로직 변경 없음.
- **에러 처리**: 사용자 응답 경로(`{ executionId: 'ignored' }`)에 내부 예외 스택/메시지가 노출되지 않는다.
- **의존성 보안**: 새 외부 패키지 추가 없음(`ioredis` 는 기존 의존성 재사용).
- **OWASP Top 10**: A01(접근제어) — 인증 순서 확인 완료, 우회 경로 없음. A03(인젝션) — 파라미터화 Redis 호출로 없음. A04(안전하지 않은 설계) — fail-open 이 명시적으로 문서화·테스트되어 있어 "조용한" 취약점이 아님. A09(로깅/모니터링 실패) — dedup 실패·재도착 무시 모두 warn 로그로 가시화됨. 그 외 항목(SSRF·역직렬화·XXE 등)은 이 diff 표면과 무관.
- 테스트: `chat-channel-dedup.service.spec.ts`(93줄) + `hooks.service.spec.ts` 의 CCH-SE-02 신규 케이스(`:1227`-`1271`)가 억제 판정·fail-open 2종·trigger 스코프·빈 키·호출부 반환값 소비·rate-limit 미소비를 각각 별도로 고정하고 있어, "값은 계산되지만 안 쓰인다" 류의 보안 관련 회귀(host-facing dead-field 재발)를 잡을 수 있다.
- `spec/5-system/15-chat-channel.md`(파일 43, 이번 프롬프트엔 diff 생략됐으나 이전 라운드에서 line-level 대조 확인됨) / `spec/4-nodes/7-trigger/providers/telegram.md:235`(파일 42) / `spec/data-flow/14-chat-channel.md:196`(파일 44) 의 spec 문면 갱신은 실제 구현(키 형식·TTL·fail-open·배치 순서)과 일치하며 spec-구현 드리프트를 줄이는 방향이다. 새 보안 이슈 없음.
- `review/**` 산출물 커밋(파일 8~41)은 실행 코드가 아니며, grep 결과 시크릿·민감정보 노출 없음.

## 절차 관련 참고 (보안 등급과 무관, 다른 리뷰어(scope) 영역과 중복이므로 등급 미부여)

- `spec/` 파일 3건이 이번 diff 에 포함돼 있다. CLAUDE.md 는 `developer` 를 `spec/` read-only 로 규정하는데, `plan/in-progress/backend-lint-gate-broken-on-main.md`(파일 7) 와 `review/code/2026/08/13/02_38_41/RESOLUTION.md`(파일 8) 자체가 이 절차 이탈을 이미 인지·기록하고 있다(WARNING #1, "되돌리지 않되 절차를 어긴 사실은 남긴다"). 내용 자체는 구현과 정합하고 새 보안 결정이 아니라 기존 요구사항의 메커니즘 서술 정정이므로 보안 관점의 위험으로 보지 않는다 — scope 리뷰어의 소관으로 남긴다.

## 요약

이번 라운드(`03_04_02`)에서 실질 보안 표면(`ChatChannelDedupService`, `HooksService` 배선)은 이전
두 라운드와 동일하며, 직접 소스를 재확인한 결과 인증(provider 서명 검증)이 dedup 보다 항상 먼저
실행돼 미인증 요청이 이 경로로 Redis 자원을 소모할 수 없고, Redis 커맨드는 파라미터화되어 인젝션
표면이 없으며, fail-open 정책은 문서화·테스트로 가시화돼 있다. 하드코딩된 시크릿, SQL/커맨드
인젝션, 인증 우회, 안전하지 않은 암호화, 민감정보 로그 노출, 취약 의존성 어느 것도 발견되지
않았다. 유일한 잔여 사항은 유효 인증 자료를 가진 발신자가 임의 길이의 `idempotencyKey` 로 Redis
키 공간을 소모할 수 있는 이론적 여지(INFO, 상위 인증·provider 값 형태로 사실상 완화됨)로, 이전
두 라운드에서도 동일하게 INFO 로 유예됐고 이번에도 급조치가 필요한 수준은 아니다. 이번에 새로
추가된 CHANGELOG·spec 문서·plan 완료 노트·리뷰 산출물 파일들에서도 시크릿 노출이나 별도 보안
결함은 확인되지 않았다. Critical/Warning 급 취약점 없음.

## 위험도

LOW
