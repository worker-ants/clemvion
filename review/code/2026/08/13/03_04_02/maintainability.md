# 유지보수성(Maintainability) 리뷰 — CCH-SE-02 chat-channel update dedup (3차 라운드, `03_04_02`)

## 범위 확인

이번 diff(origin/main 대비)는 44개 파일로 구성되지만, 실질 프로덕션/테스트 코드
(`chat-channel-dedup.service.ts` · 그 spec · `chat-channel.module.ts` · `hooks.service.ts` ·
`hooks.service.spec.ts`)는 직전 두 라운드(`02_38_41`, `02_50_38`)가 검토한 것과
**바이트 단위로 동일**하다(`git diff origin/main -- <해당 5개 파일>` 로 직접 재확인). 이번
라운드에서 새로 추가된 것은 `CHANGELOG.md` 항목, `plan/in-progress/backend-lint-gate-broken-on-main.md`
체크박스+완료 기록, `spec/5-system/15-chat-channel.md`/`spec/4-nodes/7-trigger/providers/telegram.md`/
`spec/data-flow/14-chat-channel.md` 문서 정정, 그리고 이전 두 라운드의 리뷰 산출물 자체
(`review/code/**`, `review/consistency/**`)를 커밋한 파일들이다. 이들은 코드가 아니라 프로세스
산출물/spec 문서이므로 가독성·네이밍·함수 길이·중첩·매직넘버·중복·복잡도·코드 스타일 일관성이라는
이번 점검 관점의 대상이 아니다(문서 정합성은 documentation reviewer 소관). 아래는 코드 파일에 대한
독립 재검증 결과다.

## 발견사항

- **[INFO]** (재확인, 상태 변화 없음) `HooksService.handleChatChannelWebhook` 이 여전히 442줄
  (`hooks.service.ts:257`–`:698`, `wc`/`grep` 으로 직접 재계산)짜리 다중 책임 함수이고, CCH-SE-02
  dedup 게이트(`:328`–`:345`)가 그 안에 있다.
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:257`(함수 시작)–`:698`(다음 private
    메서드 `reNoiseFormModal` 직전), 신규 블록 `:328`–`:345`
  - 상세: 이 항목은 1차 라운드(`02_38_41`)에서 WARNING #5 로 식별돼 "다음 게이트가 추가되는
    시점"을 트리거로 조건부 유예됐고, 2차 라운드(`02_50_38`)에서 "이번 diff 는 새 게이트를
    추가하지 않았으므로 트리거 미도달"로 재확인됐다. 이번 3차 라운드도 `hooks.service.ts` 에 대한
    diff 가 직전 라운드와 완전히 동일함을 직접 확인했다 — 새 게이트가 추가되지 않았으므로 유예
    트리거는 이번에도 성립하지 않는다. 동일 사안을 세 번째로 WARNING 재상정하면 "발견의 성격이
    바뀌지 않았는데 반복 지적"이 되어 수렴을 방해하므로, 트리거 미도달 상태를 INFO 로 다운그레이드해
    기록한다.
  - 제안: 조치 불요(트리거 미도달). 다음에 이 메서드에 새 inbound 게이트가 실제로 추가되는 시점에
    "파싱 후 게이트 체인"을 private 헬퍼(`runInboundGates(...)` 류)로 추출할 것 — 이미 두 라운드에
    걸쳐 합의된 트리거 조건이므로 재논의 불필요.

- **[INFO]** (재확인, 상태 변화 없음) `ChatChannelDedupService` 생성자가 `ChatChannelRateLimiterService`
  생성자와 주입 토큰 이름만 다르고 완전히 동일한 보일러플레이트(`@Optional() @Inject(...)
  injectedRedis?: Redis, @Optional() redisConn?: RedisConnectionProvider` +
  `this.redis = injectedRedis ?? redisConn?.getClientOrNull() ?? null;`)를 반복한다. `PublicWebhookQuotaService`
  까지 포함하면 동형 "Redis 원자 연산 + fail-open + 개별 Logger" 클래스가 세 개다.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts:39`–`:46` vs
    `codebase/backend/src/modules/chat-channel/chat-channel-rate-limiter.service.ts:34`–`:42`
  - 상세: 1·2차 라운드 모두 이 사안을 INFO 로 "4번째 유사 서비스 등장 시 공통 베이스 추출"로 유예했다.
    이번 라운드에서도 4번째 인스턴스는 생기지 않았으므로(이 diff 는 세 번째인 `ChatChannelDedupService`
    자체가 새로 추가되는 시점의 diff이고, 이후 추가 신설은 없음) 판단을 그대로 유지한다.
  - 제안: 조치 불요. 다음 유사 클래스가 생기면 `resolveRedisClient(injected, provider)` 류 헬퍼 추출을
    한 번은 검토.

- **[INFO]** (재확인) `ChatChannelDedupService` 생성자에는 `'CHAT_CHANNEL_DEDUP_REDIS'` 토큰이
  테스트 전용이고 프로덕션에서 provide 되지 않는다는 설명 주석이 없다 — 형제 클래스
  (`chat-channel-rate-limiter.service.ts:40`)에는 그 주석이 있다.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts:39`–`:46`
  - 상세/제안: 1·2차 라운드와 동일한 근거로 낮은 우선순위 유지. `this.redis = ...` 위 한 줄 주석 추가로
    해소 가능.

- **[INFO]** (재확인) `handleChatChannelWebhook` 상단 JSDoc 파이프라인 요약이 CCH-SE-02 dedup·
  CCH-NF-03 rate-limit 두 게이트를 반영하지 않는다.
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:243`–`:256`(요약) vs 실제 게이트
    `:328`–`:345`(dedup) → `:347`–`:362`(rate-limit)
  - 상세/제안: 1·2차 라운드와 동일. 급하지 않음.

- **[INFO]** 새로 도입된 코드 자체의 가독성·네이밍·상수화·중첩 깊이는 여전히 양호하다.
  `makeChatDedupKey`/`CHAT_DEDUP_WINDOW_SEC` 가 자매 파일의 `makeChatRateLimitKey`/
  `CHAT_RATE_LIMIT_WINDOW_SEC` 와 대칭을 이루고, 30초 TTL 이 이름 있는 상수로 노출되어 매직 넘버가
  없으며, `claim()` 은 약 20줄에 최대 중첩 2단계(`if` → `try`)로 단일 책임을 유지한다. 반환값 의미
  (`true`=최초 도착/fail-open, `false`=재도착)가 JSDoc `@returns` 로 명확히 문서화되어 있다.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts` 전체
  - 상세/제안: 조치 불요, 참고용 긍정 기록.

- **[INFO]** 테스트 코드(`chat-channel-dedup.service.spec.ts`, `hooks.service.spec.ts` 신규 케이스)도
  기존 관례(`as never` 캐스팅, `moduleRef.get(...)` 오버라이드, `try/finally` spy 복원, spec ID 를
  포함한 `it` 네이밍)를 그대로 따라 새 관용구를 도입하지 않았다. `hooks.service.spec.ts` 안에 warn-spy
  복원 방식이 세 변종(직접 `mockRestore()` 2건 vs `try/finally` 1건, `service.logger` vs
  `Logger.prototype` 스파이 대상)으로 공존하는 사안은 1·2차 라운드에서 이미 INFO 로 기록·유예됐고
  이번 diff 로 변화가 없다.
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.spec.ts:961`, `:1138`, `:1251` 근방
  - 상세/제안: 조치 불요(유예 유지). 다음에 이 파일의 warn-spy 케이스를 만질 때 한 방식으로 통일 고려.

- **[INFO]** 신규 순수 문서/산출물 파일(`CHANGELOG.md` 항목, `RESOLUTION.md` 3종, `spec/**` 3개
  정정)은 코드가 아니므로 함수 길이·중첩·매직넘버 등 본 점검 관점이 직접 적용되지 않는다. 다만
  `plan/in-progress/backend-lint-gate-broken-on-main.md` 의 "완료" 블록이 절차 이탈 사실
  (developer 턴에서 `spec/` 직접 수정)을 스스로 기록해 남긴 점은 이 저장소가 이미 확립한 "결정의
  배경·근거를 그 자리에 남긴다"는 문서 관례와 일치한다 — 유지보수성 관점에서 향후 담당자가 왜
  이런 형태가 됐는지 재구성하기 쉽다.
  - 위치: `plan/in-progress/backend-lint-gate-broken-on-main.md:634`–`:659`
  - 상세/제안: 조치 불요.

## 요약

3차 라운드에서 실질 프로덕션/테스트 코드는 1·2차 라운드와 완전히 동일함을 `git diff` 로 직접
재확인했다 — 이번에 추가된 것은 CHANGELOG·plan·spec 문서 정정과 이전 라운드의 리뷰 산출물 커밋뿐이며,
이들은 코드 유지보수성 점검 대상이 아니다. 코드 자체의 품질 판단(네이밍·상수화·JSDoc·테스트 관례
준수는 높음; `handleChatChannelWebhook` 442줄 다중 책임과 `ChatChannelDedupService` 생성자
보일러플레이트 반복은 구조적 신호이나 둘 다 명시적 트리거 조건과 함께 이미 두 차례 유예됨)은
1·2차 라운드와 동일하게 유지된다. 새 게이트나 4번째 유사 클래스처럼 유예 트리거를 충족하는 변경이
이번 diff 에 없으므로, 이전 WARNING 을 세 번째로 재상정하지 않고 INFO 로 하향해 "트리거 미도달"
상태를 명확히 기록한다. 새로 CRITICAL/WARNING 급으로 지적할 유지보수성 결함은 없다.

## 위험도

LOW
