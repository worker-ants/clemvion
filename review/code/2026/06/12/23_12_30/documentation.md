# 문서화(Documentation) 리뷰

## 발견사항

- **[INFO]** `types.ts` `rateLimitPerMinute` 인라인 주석에 유효 범위(1–600) 누락
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-rate-limit-baa15a/codebase/backend/src/modules/chat-channel/types.ts` L70
  - 상세: 현재 주석 `/** CCH-NF-03 override. default 60. */` 에 DTO 검증(`@Min(1) @Max(600)`) 및 spec 문서(`1–600`)에 명시된 유효 범위가 빠져 있다. `consume` 내부의 clamp 로직(`Math.max(1, Math.min(600, ...))`)과도 정합이 맞지 않아, 코드를 처음 읽는 개발자가 허용 범위를 별도로 추적해야 한다.
  - 제안: `/** CCH-NF-03 override. 1–600, default 60. */` 으로 범위 보강.

- **[INFO]** `CHAT_CHANNEL_RATE_LIMIT_REDIS` DI 토큰 용도가 생성자 주석에 명시되지 않음
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-rate-limit-baa15a/codebase/backend/src/modules/chat-channel/chat-channel-rate-limiter.service.ts` L35–38
  - 상세: `@Inject('CHAT_CHANNEL_RATE_LIMIT_REDIS')` 토큰은 프로덕션 코드의 어느 모듈에서도 `provide` 되지 않으며, 실질적으로 단위 테스트 직접 주입 경로다. 생성자 주석 `// 테스트 주입 우선, 아니면 공유 command connection, 미가용 시 null (fail-open).` 에서 암시하지만, 토큰 자체가 테스트 전용 슬롯임을 명시하지 않아 향후 유지보수자가 프로덕션 provide 누락으로 혼동할 수 있다.
  - 제안: 토큰 선언부 위에 `// 테스트 전용 직접 주입 슬롯 — 프로덕션에서는 미제공, RedisConnectionProvider fallback 사용.` 한 줄 추가.

- **[INFO]** CHANGELOG에 CCH-NF-03 rate-limit 구현 항목 없음
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-rate-limit-baa15a/CHANGELOG.md` — `## Unreleased` 섹션 전체
  - 상세: `ChatChannelRateLimiterService` 신규 서비스 추가와 `HooksService` 의 parseUpdate 직후 rate-limit enforcement 적용이 CHANGELOG `Unreleased` 섹션에 기재되지 않았다. spec(`15-chat-channel.md`)에는 구현 링크까지 포함된 상세 내용이 있으나, CHANGELOG는 배포 담당자·운영자 지향 독립 문서로 별도 관리가 필요하다. Redis 미가용 시 fail-open 정책, `chat_channel_health=degraded` 부작용 등 운영자 관심 항목이 포함될 필요가 있다.
  - 제안: `## Unreleased` 섹션(또는 신규 `Unreleased` 항목)에 "CCH-NF-03: per-chat 분당 rate-limit 구현 (`ChatChannelRateLimiterService` 신규, `HooksService` parseUpdate 직후 enforcement, 기본 60/min, Redis fail-open, 초과 시 202 ignored + `chat_channel_health=degraded`)" 추가.

- **[INFO]** `markChatChannelRateLimited` private 메서드에 `@param` 태그 없음
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-rate-limit-baa15a/codebase/backend/src/modules/hooks/hooks.service.ts` — `markChatChannelRateLimited` JSDoc
  - 상세: 동작 설명(best-effort, 이미 `degraded` 면 skip, best-effort swallow)은 잘 서술되어 있으나 `trigger`, `limitPerMinute` 파라미터 `@param` 태그가 없다. private 메서드라 필수는 아니지만, `HooksService` 내 다른 private 메서드들과 일관성이 떨어진다.
  - 제안: `@param trigger` 및 `@param limitPerMinute` 태그 추가. 낮은 우선순위.

- **[INFO]** `consume` 메서드 `@param` 태그 없음 — 공개 메서드
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-rate-limit-baa15a/codebase/backend/src/modules/chat-channel/chat-channel-rate-limiter.service.ts` L44–49
  - 상세: 공개 메서드 `consume` 의 JSDoc 에 `@returns` 태그는 있으나 `triggerId`, `conversationKey`, `limitPerMinute` 세 파라미터에 대한 `@param` 태그가 없다. 클래스 JSDoc 에서 키 형식을 언급하지만, 메서드 수준에서 `conversationKey` 가 Redis 키의 두 번째 세그먼트가 된다는 점 등을 명시하면 호출자가 값을 구성할 때 참고할 수 있다.
  - 제안: `@param triggerId`, `@param conversationKey` (키 형식 `cc:rl:{triggerId}:{conversationKey}` 참조), `@param limitPerMinute` (1–600, 범위 밖 값은 내부 clamp) 태그 추가.

- **[INFO]** `CHAT_RATE_LIMIT_WINDOW_SEC` 상수 JSDoc에 Redis 7+ `EXPIRE NX` 의존성 미기재
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-rate-limit-baa15a/codebase/backend/src/modules/chat-channel/chat-channel-rate-limiter.service.ts` L11–12
  - 상세: `/** fixed-window 초 (분당 한도이므로 60s). */` 는 값의 의미를 설명하지만, `consume` 내부의 `pipeline.expire(key, CHAT_RATE_LIMIT_WINDOW_SEC, 'NX')` 가 Redis 7+ `EXPIRE NX` 옵션을 사용한다는 버전 전제 조건이 인라인 주석에는 있으나 상수 레벨에는 없다. 상수만 import해 다른 방식으로 사용하려는 경우 누락될 수 있다.
  - 제안: 현행 인라인 주석 수준으로 충분하다는 판단도 합리적. 상수 JSDoc에 `// Redis 7+ EXPIRE NX 와 쌍으로 사용` 한 줄 추가는 선택 사항.

## 요약

전반적인 문서화 수준은 양호하다. `ChatChannelRateLimiterService` 클래스 JSDoc(설계 의도·fail-open 정책·키 형식·R-CC-19 참조)과 `consume` 메서드 `@returns` 태그, `markChatChannelRateLimited` 동작 주석, 인라인 코드 주석(CCH-NF-03 참조·pipeline 원자성 설명·fixed-window 시작 조건 등) 이 모두 갖춰져 있으며, spec(`15-chat-channel.md`)에도 §3.6, §5.5, R-CC-19 가 갱신돼 있다. plan 문서(`spec-draft-cch-nf-03-rate-limit.md`)에 skip-vs-queue 결정 근거가 충분히 기록되어 있다. 미비 사항은 (1) `types.ts` `rateLimitPerMinute` 주석의 범위(1–600) 누락, (2) DI 토큰 `CHAT_CHANNEL_RATE_LIMIT_REDIS` 의 테스트 전용 용도 불명확, (3) CHANGELOG 미기재 세 항목이 가장 실질적이며, 나머지는 `@param` 태그 부재 등 낮은 우선순위 개선이다. 모두 INFO 수준으로 기능 이해나 운영에 즉각적 위험을 초래하지 않는다.

## 위험도

LOW

STATUS: SUCCESS
