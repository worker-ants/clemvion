# 유지보수성(Maintainability) 리뷰 — CCH-SE-02 chat-channel update dedup

## 발견사항

- **[WARNING]** `HooksService.handleChatChannelWebhook` 가 436줄(§257–§692)짜리 다중 책임 함수인데, 이번 diff 가 "게이트 체크 → 조기 return" 블록을 하나 더 추가해(§328–§345, CCH-SE-02 dedup) 계속 길어지고 있다. 이 메서드는 provider handshake(Slack url_verification/Discord PING) → 활성 검사 → parseUpdate → **dedup(신규)** → rate-limit → enrichInbound → 명령별 분기 → form/modal/interaction 처리까지 최소 10개 이상의 서로 다른 관심사를 한 함수에서 순차 처리한다.
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:257`(함수 시작)–`:692`(함수 끝), 신규 블록 `:328`-`:345`
  - 상세: 이번 PR 이 새로 만든 결함은 아니다 — 새 블록은 바로 아래 rate-limit 블록(`:347`-`:362`)과 `if (!(await guard(...))) { warn(); return { executionId: 'ignored' }; }` 형태로 구조가 완전히 동일해 기존 패턴을 정확히 따랐다. 다만 "파싱 성공 이후 순차 게이트"가 이제 5단계(비활성→handshake→parseUpdate null→dedup→rate-limit)이고, 이런 조기-return 게이트가 하나씩 늘 때마다 순서 불변식(dedup 이 rate-limit 보다 반드시 앞이어야 하는 이유 등)을 파악하려면 함수 전체를 다시 읽어야 한다. `review/code/2026/08/13/02_38_41/RESOLUTION.md` 가 이미 이 항목을 WARNING #5 로 인지하고 "다음 게이트가 추가되는 시점에 private 헬퍼로 추출"하는 조건부 유예를 명시했으므로, 이번 라운드에서 이 판단을 재확인하되 새로 강제하지는 않는다.
  - 제안: 유예 조건(다음 게이트 추가 시점)이 트리거되면 "파싱 후 게이트 체인"을 별도 private 헬퍼(예: 순차 실행 배열을 도는 `runInboundGates(...)`)로 추출할 것.

- **[INFO]** `ChatChannelDedupService` 의 생성자 보일러플레이트(`@Optional() @Inject('CHAT_CHANNEL_DEDUP_REDIS') injectedRedis?: Redis, @Optional() redisConn?: RedisConnectionProvider` + `this.redis = injectedRedis ?? redisConn?.getClientOrNull() ?? null;`)가 `ChatChannelRateLimiterService` 생성자와 토큰 이름만 다르고 완전히 동일하며, `PublicWebhookQuotaService` 까지 포함하면 같은 뼈대의 "Redis 원자 연산 + fail-open" 클래스가 3개째다.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts:39`-`:46` vs `codebase/backend/src/modules/chat-channel/chat-channel-rate-limiter.service.ts:34`-`:42`
  - 상세: 새로 만든 중복이 아니라 이 모듈군이 이미 채택한 관용구를 한 곳 더 따른 것이다. 각 클래스가 26~78줄 규모로 작아 지금 추상화 비용이 반복 비용을 넘어설 수 있고, `review/code/2026/08/13/02_38_41/RESOLUTION.md` INFO #3 이 "4번째가 생기면 공통 베이스 추출"로 이미 유예해 두었다.
  - 제안: 지금 통합 불요. 4번째 유사 서비스 등장 시 `resolveRedisClient(injected, provider)` 류 공통 헬퍼 추출을 검토.

- **[INFO]** `ChatChannelDedupService` 생성자가 형제 클래스(`ChatChannelRateLimiterService`)와 동일한 DI 패턴을 재사용하면서, `'CHAT_CHANNEL_DEDUP_REDIS'` 토큰이 **테스트 전용이고 프로덕션에서 provide 되지 않는다**는 설명 주석은 옮기지 않았다.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts:39`-`:46` (주석 없음) vs `codebase/backend/src/modules/chat-channel/chat-channel-rate-limiter.service.ts:40` (`// 테스트 주입 우선, 아니면 공유 command connection, 미가용 시 null (fail-open).`)
  - 상세: `chat-channel.module.ts` 의 `providers`/`imports` 어디에도 `'CHAT_CHANNEL_DEDUP_REDIS'` 를 provide 하는 곳이 없어(grep 확인), 프로덕션 경로는 항상 `redisConn?.getClientOrNull()` 만 탄다. 이 사실이 클래스에 문서화돼 있지 않으면 이후 누군가 이 토큰을 오해하고 죽은 provider 등록을 추가하거나, 반대로 실제 분리가 필요한 상황에서 왜 안 먹히는지 헤맬 수 있다.
  - 제안: 형제 클래스와 동일한 한 줄 주석을 `this.redis = injectedRedis ?? redisConn?.getClientOrNull() ?? null;` 위에 추가.

- **[INFO]** `handleChatChannelWebhook` 메서드 상단 JSDoc 의 파이프라인 요약(1~5단계)이 새 **CCH-SE-02 dedup** 단계도, 기존 **CCH-NF-03 rate-limit** 단계도 반영하지 않는다.
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:243`-`:256` (요약 5단계 — adapter 조회/헤더 검증/parseUpdate/ChannelConversation 분기/ackInteraction), 실제로는 `parseUpdate` 직후 `:328`-`:345`(dedup) → `:347`-`:362`(rate-limit) 두 단계가 개입
  - 상세: 신규 블록의 인라인 주석(`:328`-`:337`)은 "dedup 이 rate-limit 보다 반드시 앞" 이라는 순서 불변식을 정확히 설명하지만, 메서드 상단 "공식 요약"만 읽는 독자는 이 두 게이트 자체를 놓칠 수 있다.
  - 제안: docstring 목록에 "3.5 CCH-SE-02 dedup(rate-limit 보다 먼저)" · "3.6 CCH-NF-03 rate-limit" 을 추가해 실제 순서와 동기화.

- **[INFO]** `hooks.service.spec.ts` 안에 `Logger.warn` 스파이를 복원하는 방식이 이제 두 가지로 갈렸다 — 기존 두 케이스(`:961`-`:985`, `:1138`-`:1154`)는 `jest.spyOn(service.logger, 'warn')` + 테스트 끝에서 `warnSpy.mockRestore()` 를 직접 호출(단언 실패 시 복원이 스킵될 수 있음)하는 반면, 이번에 추가된 CCH-SE-02 케이스(`:1251`-`:1261`)는 `jest.spyOn(Logger.prototype, 'warn')` + `try/finally` 로 항상 복원한다.
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.spec.ts:961`, `:1138`, `:1251`
  - 상세: 새 패턴 자체는 `chat-channel-dedup.service.spec.ts` 의 fail-open 테스트와 동일해 그쪽 관례를 따른 것이고, 단언 실패 시에도 spy 를 확실히 복원한다는 점에서 오히려 더 견고하다(다른 테스트로의 오염 방지). 다만 같은 파일 안에 "warn 검증"이라는 동일 의도에 대해 스파이 대상(인스턴스 vs prototype)과 복원 방식(직접 호출 vs try/finally)이 다른 세 번째 변종이 생겨, 다음에 이 파일을 만지는 사람이 어느 쪽을 표준으로 따라야 할지 판단해야 한다.
  - 제안: 급하지 않음. 다음에 이 파일의 warn-spy 케이스를 만질 때 `try/finally` + 어느 한쪽 스파이 대상으로 통일하는 정리를 고려.

- **[INFO]** `ChatChannelModule` 상단 docstring 의 "모듈 구조" 열거가 여전히 `ChatChannelRateLimiterService`·`ChatChannelDedupService` 둘 다 빠져 있다(사전 존재 stale, 이번 diff 로 새로 생긴 문제는 아님).
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.module.ts:22`-`:32`
  - 상세: 신규 서비스를 추가하면서 이 목록을 갱신할 기회였으나 놓쳤다.
  - 제안: 우선순위 낮음. 다음에 이 파일을 만질 때 갱신하거나, 목록 자체를 "Spec §7 참조" 로 단순화.

- **[INFO]** 새 파일들(`chat-channel-dedup.service.ts`, 그 spec)의 가독성·네이밍·문서화 품질은 높다. `makeChatDedupKey`/`CHAT_DEDUP_WINDOW_SEC` 가 자매 파일의 `makeChatRateLimitKey`/`CHAT_RATE_LIMIT_WINDOW_SEC` 와 대칭을 이루고, 매직 넘버(30초 TTL)가 이름 있는 상수로 노출돼 있으며, `claim()` 의 반환값 의미(`true`=최초 도착·fail-open, `false`=재도착)가 JSDoc `@returns` 로 명확하다. 클래스(76줄)·메서드(`claim()` 약 20줄) 모두 단일 책임 범위 안에 있고, 중첩 깊이도 최대 2단계(`if`→`try`)로 낮다.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts` 전체
  - 상세/제안: 조치 불요, 참고용 긍정 기록.

## 요약

이번 diff(`ChatChannelDedupService` 신설 + `HooksService` 배선)는 네이밍·상수화·JSDoc·테스트 관례 준수 면에서 전반적으로 높은 품질을 유지한다. 유일하게 실질적인 유지보수성 신호는 `handleChatChannelWebhook` 이 이미 436줄짜리 다중 책임 함수인데 이번 PR 로 조기-return 게이트가 하나 더 늘었다는 점이며(§257–§692, 신규 §328–§345), 새 블록 자체는 기존 rate-limit 게이트와 구조가 동일해 즉각적 리팩터링을 강제할 수준은 아니다 — 이 항목은 직전 리뷰 라운드에서 이미 WARNING 으로 식별돼 "다음 게이트 추가 시점" 이라는 조건부 트리거로 유예된 상태이고, 코드 현황을 재확인한 결과 그 판단은 여전히 유효하다. `ChatChannelDedupService` 생성자가 `ChatChannelRateLimiterService` 의 보일러플레이트(및 그 설명 주석 누락)를 반복하는 것도 이 모듈군 전체의 기존 관용구를 따른 것이라 이번 PR 단독의 새 결함으로 보기 어렵고, 나머지(docstring 파이프라인 요약 미동기화, module docstring stale, 테스트 파일 내 warn-spy 패턴 3종 공존)는 모두 INFO 수준의 경미한 문서/일관성 갭이다.

## 위험도

LOW
