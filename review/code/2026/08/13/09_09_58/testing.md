# 테스트(Testing) 리뷰 — CCH-SE-02 chat-channel update dedup (최종 취합 라운드 `09_09_58`)

> 이번 diff 는 신규 `ChatChannelDedupService`(+spec) 배선·`HooksService` 호출부 배선(파일 1-6)에
> 더해, 그 구현을 검토한 두 차례 선행 리뷰 라운드(`02_38_41`, `02_50_38`)의 산출물과 그
> RESOLUTION 에 따른 조치(호출부 warn 단언 추가, CHANGELOG, sibling spec 정정)를 함께 커밋한
> 형태다. 실제 테스트 관점 검토 대상 코드는 5개로 동일하다: `chat-channel-dedup.service.ts` /
> `.spec.ts`, `chat-channel.module.ts`, `hooks/hooks.service.ts` / `.spec.ts`. 선행 두 라운드가
> 이미 이 코드를 상세히 검토했으므로, 이번 라운드에서는 (a) 1차 라운드 WARNING 이 실제로 조치됐는지
> 코드로 재확인하고 (b) 독립적으로 남은 갭을 재평가한다.

## 검증 절차 (재현)

- `chat-channel-dedup.service.spec.ts`, `hooks.service.spec.ts` 현재 소스를 직접 `Read` 로
  대조 — 프롬프트 diff 내용과 저장소 실제 파일이 일치함을 확인.
- `codebase/backend/jest.config.ts` / `package.json` 에 `clearMocks`/`resetMocks`/`restoreMocks`
  설정이 없음을 grep 으로 직접 확인 — 테스트 격리가 "매 테스트 새 `Test.createTestingModule`"
  구조에만 의존한다는 선행 라운드 주장을 독립 재확인.
- `RedisConnectionProvider.getClientOrNull()` 구현(`redis-connection.provider.ts:94-109`)을 직접
  열어, `ChatChannelDedupService` 생성자의 미검증 폴백 분기가 위임하는 로직이 이미 그 자체로
  독립 관리되는 공유 인프라(자체 warn/degrade 처리)임을 확인 — 미검증이 WARNING 급으로 격상할
  사안은 아니라고 판단.

## 발견사항

- **[INFO]** `ChatChannelDedupService` 생성자의 `RedisConnectionProvider` 폴백 분기(2번째 인자
  경유, `injectedRedis` 가 없고 `redisConn` 만 있는 경로)가 어떤 단위 테스트에서도 실행되지 않는다.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts:45`
    (`this.redis = injectedRedis ?? redisConn?.getClientOrNull() ?? null;`),
    `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.spec.ts:23-25`
    (`makeService()` 는 항상 `injectedRedis` 슬롯만 채우고 `redisConn` 은 매번 `undefined`)
  - 상세: 프로덕션 DI 경로(모듈에 `'CHAT_CHANNEL_DEDUP_REDIS'` 를 provide 하는 곳이 없으므로
    실제로는 이 폴백 분기만 탄다)가 유닛 테스트로는 한 번도 실행되지 않는다는 뜻이다. 다만 위임
    대상인 `RedisConnectionProvider.getClientOrNull()` 자체는 별도 인프라 컴포넌트로 독립
    관리되고(내부에서 자체 warn/degrade 로직 보유), 형제 클래스(`ChatChannelRateLimiterService`)도
    동일하게 미검증인 기존 관례라 이 PR 고유의 신규 결함은 아니다. 선행 두 라운드가 이미 같은
    항목을 INFO 로 지적·유예("3중 복제 구조를 손볼 때 함께")했고, 이번 코드 대조로도 그 판단이
    유효함을 확인했다.
  - 제안: `makeService` 옆에 `redisConn` mock(`{ getClientOrNull: () => redis } as unknown as
    RedisConnectionProvider`) 을 주입하는 테스트 1개를 추가하면 생성자 3-분기가 전부 닫힌다.
    급하지 않음 — sibling 서비스 일괄 정리 시점에 함께.

- **[INFO]** dedup 윈도우 상수(`CHAT_DEDUP_WINDOW_SEC = 30`)와 키 포맷
  (`cc:dedup:<triggerId>:<idempotencyKey>`) 자체가 어떤 테스트에서도 리터럴로 pin 되지 않는다.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts:9`
    (`makeChatDedupKey`), `:12`(`CHAT_DEDUP_WINDOW_SEC`) / 대응 단언
    `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.spec.ts:34-40`
  - 상세: 테스트가 구현과 **동일 심볼**(`makeChatDedupKey`, `CHAT_DEDUP_WINDOW_SEC`)을 import 해
    기대값을 계산하므로, `CHAT_DEDUP_WINDOW_SEC` 을 실수로 `60` 으로 바꾸거나 키 접두사를
    `cc:dedupe:` 로 오타 내도 이 스펙은 여전히 GREEN 이다 — spec `필수` 요구사항의 "**30초**"
    라는 숫자 자체를 고정하는 테스트가 없다. 다만 형제 파일
    (`chat-channel-rate-limiter.service.spec.ts` 의 `CHAT_RATE_LIMIT_WINDOW_SEC` 참조)과 동일한
    기존 관례이며, 운영 코드 경로에서 이 상수가 다른 목적으로 재사용될 여지가 낮아 실질 위험은
    낮다.
  - 제안: `expect(CHAT_DEDUP_WINDOW_SEC).toBe(30)` 및
    `expect(makeChatDedupKey('t', 'u')).toBe('cc:dedup:t:u')` 리터럴 단언 2줄을 추가하면 spec
    요구값과의 연결이 명시적으로 고정된다. 우선순위 낮음.

- **[INFO]** CCH-SE-02 에 대한 실 Redis 대상 e2e/통합 테스트가 없다 — 재도착 억제는 모킹된
  `redis.set` 인터페이스로만 검증된다.
  - 위치: N/A(부재 확인) — `codebase/backend/src/modules/hooks/hooks.service.spec.ts:1227-1271`
    (단위/모킹 통합 테스트만 존재), e2e 디렉터리에 CCH-SE-02/dedup 관련 케이스 없음.
  - 상세: `SET key 1 EX 30 NX` 호출 인자 구성은 형제 서비스(`channel-conversation.service.ts` 의
    `acquireLock`)와 동일한 실증 패턴을 재사용하고 있어 사용법 신뢰도는 있지만, 실제 ioredis 응답
    형태(`'OK'`/`null`, 동시 두 요청이 진짜로 하나만 통과하는지)를 e2e 로 재확인하지는 않는다.
    같은 모듈의 rate-limiter/quota 서비스도 동일하게 e2e 커버리지가 없어 이 PR 만의 결함은
    아니며, plan 에도 이미 "후속 후보(동일 raw body 2회 POST)"로 등재돼 있다.
  - 제안: 조치 불요(이미 백로그 등재). 후속 e2e 작업 시 "같은 endpoint 에 동일 body 2회 POST →
    두 번째는 202 ignored, execution 1개만 생성" 형태의 케이스를 추가할 것.

## 회귀 확인 (선행 라운드 WARNING 조치 검증)

- **[확인]** 1차 라운드(`02_38_41`) testing WARNING — "호출부(`hooks.service.ts`)의 재도착 무시
  warn 이 단언되지 않는다" — 는 이번 diff 의 `hooks.service.spec.ts` 신규 테스트에서 실제로
  조치되어 있음을 코드로 재확인했다.
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.spec.ts:1251-1259`
    (`const warnSpy = jest.spyOn(Logger.prototype, 'warn')...` 및
    `expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('재도착 무시'))`)
  - 상세: `try { ... } finally { warnSpy.mockRestore(); }` 로 spy 를 확실히 복원해 다른 테스트로의
    누수가 없다. 서비스 내부 warn(`chat-channel-dedup.service.spec.ts:71-84`)과 호출부 warn(이
    자리)이 각각 별도로 고정되어, "로그 한 줄이 사라지는 회귀는 반환값만 봐서는 안 잡힌다"는 이
    PR 스스로의 원칙이 두 지점 모두에 실제로 적용됐다.

- **[확인]** `HooksService` 생성자에 `chatChannelDedup` 파라미터가 추가됐지만(`hooks.service.ts:79`)
  저장소 전체에 `new HooksService(...)` 위치 인자 직접 생성 호출이 0건임을 grep 으로 재확인 —
  기존 테스트가 전부 NestJS DI/mock 경유라 시그니처 변경에 안전하다. `hooks.service.spec.ts` 의
  provider 배열에도 `ChatChannelDedupService` 기본 mock(`claim` → `true`, "최초 도착")이
  추가되어(`hooks.service.spec.ts:89-93`) 기존 chat-channel 테스트들을 오염시키지 않는다.

## Mock 적절성·테스트 격리·가독성 (긍정 평가)

- `chat-channel-dedup.service.spec.ts` 의 `makeRedis()` 는 실제로 쓰는 `.set` 메서드만 노출하는
  최소 mock — 형제 파일과 동일한 narrow-mock 관례. 실제 ioredis 인터페이스와의 괴리는 "응답 값
  형태(`'OK'`/`null`)만 흉내낸다" 는 점으로 한정되며, 이는 위 e2e 부재 항목과 동일 축이다.
  세 번째 테스트("trigger 가 다르면...")는 `Set`+`mockImplementation` 으로 상태 있는 mock 을
  구성해 "동일 update, 다른 trigger" / "동일 trigger 재도착" 두 시나리오를 한 mock 으로 정확히
  구분해내는 설계가 적절하다.
- `hooks.service.spec.ts` 최상위 `beforeEach` 가 매 테스트마다 `Test.createTestingModule` 을
  새로 `compile()` 하므로(jest 전역 `clearMocks`/`resetMocks` 설정 없음을 직접 확인) 격리는
  구조적으로 보장된다 — `dedup.claim.mockResolvedValueOnce(false)` 같은 1회성 오버라이드가 다른
  `it` 로 새지 않는다.
  - `rateLimiter.consume.mockClear()` 호출(`hooks.service.spec.ts:1249` 부근)은 이미 fresh 모듈
    이라 불필요한 방어 코드이지만 해가 되지 않는다.
- 두 spec 파일 모두 `it` 설명과 인라인 주석에 "왜 이 값/이 순서여야 하는가"(TTL·NX 빠지면
  영구/무억제, 빈 키로 뭉치면 무관한 update 유실, dedup 이 rate-limit 보다 앞이어야 쿼터
  미소비)를 명시해 테스트 가독성·의도 전달이 좋다.

## 뮤테이션 근거 대조

- plan(`backend-lint-gate-broken-on-main.md`)·RESOLUTION 이 주장하는 "6/6 사살"(NX 제거·TTL
  제거·triggerId 세그먼트 제거·빈 키 가드 제거·warn 제거·호출부 반환값 폐기) 각각에 대응하는
  단언이 실제 테스트에 존재함을 코드 대조로 확인했다:
  `chat-channel-dedup.service.spec.ts:34-40`(NX/TTL/키 전체 인자 통짜 단언),
  `:86-92`(빈 키 가드), `:71-84`(서비스 내부 warn),
  `hooks.service.spec.ts:1264-1270`(호출부가 반환값을 실제로 소비하는지).
  다만 "warn 제거 뮤턴트가 첫 시도에 구문 오류로 거짓 RED 였다" 는 plan 의 자기 보고가 있어
  ([`feedback_mutation_validity_and_discriminating_input.md`] 계열 함정과 동일 클래스), 재확인은
  유효 뮤턴트로 다시 돌렸다는 서술을 신뢰할 수밖에 없다 — 이번 라운드에서 뮤턴트를 직접
  재실행하지는 않았다(선행 `02_50_38` 라운드가 2건을 독립 재현해 RED 확인한 기록이 있음).

## 요약

핵심 신규 코드(`ChatChannelDedupService`)와 호출부(`HooksService.handleChatChannelWebhook`)는
서비스 단위 테스트와 호출부 통합 테스트로 이원화되어 "억제 판정이 옳다"와 "호출부가 그 값을 실제로
쓴다"를 각각 별도로 고정하며, 1차 리뷰 라운드가 지적한 유일한 WARNING(호출부 warn 미검증)은 이번
diff 에서 실제로 조치되어 있음을 코드로 재확인했다. 남은 갭(`RedisConnectionProvider` 폴백 분기
미검증, 윈도우 상수·키 포맷 리터럴 미고정, 실 Redis e2e 부재)은 모두 형제 서비스와 동일한 기존
관례이거나 이미 plan/RESOLUTION 에 사유와 함께 유예 등재된 항목이라 INFO 수준을 유지한다. 신규
CRITICAL/WARNING 급 테스트 결함은 발견되지 않았다.

## 위험도

LOW
