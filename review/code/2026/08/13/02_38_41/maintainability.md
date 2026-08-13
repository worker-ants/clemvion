# 유지보수성(Maintainability) 리뷰 — CCH-SE-02 dedup 구현

## 발견사항

- **[WARNING]** `handleChatChannelWebhook` 가 이미 436줄(§257–§692)에 달하는데 이번 diff 가 또 하나의 "게이트 체크 → 조기 return" 블록을 추가해 더 길어졌다. 이 메서드는 handshake(Slack/Discord) · 인증 이후 활성 검사 · **dedup(신규)** · rate-limit · `/help` · conversation 상태 분기 · `/cancel` · `open_form_modal` · `form_submission` · interaction forwarding · 신규 execution 시작까지 최소 10개 이상의 서로 다른 책임을 한 함수 안에서 처리한다.
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:257`(함수 시작) ~ `hooks.service.ts:692`(함수 끝), 신규 블록은 `hooks.service.ts:328`-`hooks.service.ts:345`
  - 상세: 이번 PR 이 만든 문제는 아니고(사전 존재), 새 블록 자체는 기존 rate-limit 블록(`hooks.service.ts:347`-`hooks.service.ts:362`)과 `if (!(await guard.method(...))) { warn(); return { executionId: 'ignored' }; }` 형태로 구조가 동일해 패턴 일관성은 지켰다. 다만 "파싱 성공 이후 순차 게이트(비활성 → handshake → parseUpdate null → dedup → rate-limit)"가 이미 5단계이고, 이 형태의 조기-return 게이트가 하나씩 더해질 때마다 함수 전체를 다시 읽어야 순서 의존성(dedup 이 rate-limit 보다 앞이어야 하는 이유 등)을 파악할 수 있다.
  - 제안: 지금 당장 리팩터링이 필요한 정도는 아니지만, 다음에 유사한 게이트(예: 추가 보안 검사)가 붙는다면 "파싱 후 게이트 체인"을 별도 private 헬퍼(예: `runInboundGates(...): Promise<{ executionId: 'ignored' } | null>` 순차 실행 배열)로 추출하는 것을 고려할 시점이다. 이번 diff 만으로 강제할 사안은 아니라 WARNING 으로 남긴다.

- **[INFO]** `ChatChannelDedupService` 의 생성자 보일러플레이트(`@Optional() @Inject('CHAT_CHANNEL_DEDUP_REDIS') injectedRedis?: Redis, @Optional() redisConn?: RedisConnectionProvider` + `this.redis = injectedRedis ?? redisConn?.getClientOrNull() ?? null;`)가 `ChatChannelRateLimiterService` 의 생성자와 토큰 이름만 다르고 완전히 동일하다.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts:39`-`chat-channel-dedup.service.ts:46` vs `codebase/backend/src/modules/chat-channel/chat-channel-rate-limiter.service.ts:34`-`chat-channel-rate-limiter.service.ts:42`
  - 상세: 같은 패턴이 `channel-conversation.service.ts` · `interaction-token.service.ts` · `public-webhook-quota.service.ts` 등 이 모듈군 전반에 이미 반복되어 있어(grep 확인), 이번 PR 이 새로 만든 중복이라기보다 **기존에 의도적으로 유지되어 온 관용구를 한 곳 더 따른 것**이다(같은 저장소가 과거 리뷰에서 "진짜 동일 보일러플레이트만 추출, axes 발산 시 defer" 로 결론낸 사례와 같은 클래스).
  - 제안: 지금 추출을 요구하지 않는다. 다만 이런 "fail-open Redis 서비스" 생성자가 4개를 넘어가면 공용 베이스 클래스/헬퍼(`resolveRedisClient(injected, provider)`) 추출을 한 번은 검토할 가치가 있다.

- **[INFO]** 새 파일들의 가독성·네이밍·문서화 품질은 높다. `makeChatDedupKey` / `CHAT_DEDUP_WINDOW_SEC` 네이밍이 자매 파일(`makeChatRateLimitKey` / `CHAT_RATE_LIMIT_WINDOW_SEC`)과 대칭을 이루고, 매직 넘버(30초 TTL)가 이름 있는 상수로 노출되어 있으며, `claim()` 의 반환값 의미(`true`=최초 도착, `false`=재도착, 장애 시 `true`)가 JSDoc `@returns` 로 명확히 문서화되어 있다. 클래스/함수 길이 모두 단일 책임 범위 안에 있다(서비스 76줄, `claim()` 약 20줄).
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts` 전체
  - 상세/제안: 조치 불요, 참고용 긍정 기록.

- **[INFO]** 테스트(`chat-channel-dedup.service.spec.ts`, `hooks.service.spec.ts` 신규 케이스)는 기존 관례(`as never` 캐스팅, `moduleRef.get(...)` 오버라이드 패턴, describe/it 네이밍에 spec ID 포함)를 그대로 따라 리뷰어가 새 관용구를 학습할 필요가 없다. 특히 `hooks.service.spec.ts` 신규 테스트는 "서비스 단위 테스트만으로는 호출부가 반환값을 실제로 쓰는지 증명 못 한다"는 이유를 주석으로 남겨 테스트의 존재 이유를 설명하고 있어 가독성이 좋다.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.spec.ts:1`-`chat-channel-dedup.service.spec.ts:93`, `codebase/backend/src/modules/hooks/hooks.service.spec.ts:1226`-`hooks.service.spec.ts:1259`
  - 상세/제안: 조치 불요.

- **[INFO]** `chat-channel.module.ts` 의 providers/exports 배열에 `ChatChannelDedupService` 를 `ChatChannelRateLimiterService` 바로 다음 줄에 대칭적으로 삽입해(두 곳 모두) 기존 정렬 관례(관련 서비스를 인접 배치)를 지켰다.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.module.ts:46`, `chat-channel.module.ts:61`
  - 상세/제안: 조치 불요.

- **[INFO]** `plan/in-progress/backend-lint-gate-broken-on-main.md` · `spec/5-system/15-chat-channel.md` 의 변경은 각각 체크박스 상태 갱신과 요구사항 표 한 행 재기술로, 문서 관례(현재형 서술, "완료" 블록에 근거·뮤테이션 결과 기록)를 따른다. 코드 유지보수성 관점에서 지적할 사항 없음.
  - 위치: `plan/in-progress/backend-lint-gate-broken-on-main.md:620`-`backend-lint-gate-broken-on-main.md:651`, `spec/5-system/15-chat-channel.md:88`
  - 상세/제안: 조치 불요.

## 요약

이번 diff(`ChatChannelDedupService` 신설 + `HooksService` 배선)는 네이밍·상수화·문서화·테스트 관례 준수 면에서 전반적으로 높은 품질을 보인다. 유일하게 실질적인 유지보수성 신호는 `handleChatChannelWebhook` 이 이미 400줄을 넘는 다중 책임 함수인데 이번 PR 로 조금 더 커졌다는 점이며, 새 블록 자체는 기존 게이트 패턴과 일관돼 있어 즉각적인 리팩터링을 요구할 수준은 아니다. `ChatChannelDedupService` 생성자가 `ChatChannelRateLimiterService` 와 보일러플레이트를 그대로 반복하는 것도 이 모듈군 전체의 기존 관용구를 따른 것이라 이번 PR 단독의 결함으로 보기 어렵다.

## 위험도

LOW
