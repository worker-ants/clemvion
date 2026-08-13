# 테스트(Testing) 리뷰 — CCH-SE-02 chat-channel update dedup (재검토, `02_50_38`)

> 이 diff 는 신규 `ChatChannelDedupService`(+spec) 배선과, 직전 리뷰 라운드(`02_38_41`)에서
> 지적된 WARNING(호출부 warn 미검증 등)을 조치한 결과물, 그리고 그 라운드의 산출물 파일 자체를
> 커밋한 것으로 구성된다. 실제 테스트 관점 검토 대상은 다음 5개다:
> `chat-channel-dedup.service.ts` / `.spec.ts`, `chat-channel.module.ts`,
> `hooks/hooks.service.ts` / `.spec.ts`.

## 발견사항

- **[INFO]** `CHAT_DEDUP_WINDOW_SEC`(spec 요구값 30초) 이 테스트에서 리터럴로 pin 되지 않는다 —
  상수 값 자체의 회귀는 어떤 테스트도 못 잡는다.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts:12`
    (`export const CHAT_DEDUP_WINDOW_SEC = 30;`), 대응 단언은
    `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.spec.ts:38`
  - 상세: spec 테스트가 `SET NX EX` 호출 인자를 `CHAT_DEDUP_WINDOW_SEC` (import 된 동일 상수)로
    비교한다. 구현과 테스트가 **같은 심볼**을 참조하므로, 누군가 `CHAT_DEDUP_WINDOW_SEC = 30` 을
    실수로 `60` 등으로 바꿔도 이 테스트는 여전히 GREEN 이다 — `[Spec CCH-SE-02] "동일 update_id
    30초 안 재도착은 무시"` 라는 요구사항의 **숫자 자체**는 어떤 테스트에서도 리터럴
    `30`/`toBe(30)` 로 고정돼 있지 않다. 다만 이는 이 PR 이 새로 만든 습관이 아니라 형제 파일
    `chat-channel-rate-limiter.service.spec.ts` (`CHAT_RATE_LIMIT_WINDOW_SEC` 를 동일하게
    import 참조)와 동일한 기존 관례라 회귀는 아니다.
  - 제안: `expect(CHAT_DEDUP_WINDOW_SEC).toBe(30)` 한 줄을 추가하거나, 최소한 그 상수를
    쓰는 `toHaveBeenCalledWith` 단언 옆에 리터럴 30 주석을 남겨 spec 요구값과의 연결을 명시.
    급하지 않음(형제 파일과 함께 처리할 사안).

- **[INFO]** dedup 키 포맷(`cc:dedup:<triggerId>:<idempotencyKey>`)이 어떤 테스트에서도
  리터럴 템플릿으로 독립 검증되지 않는다 — 접두사 오타 회귀에 무방비.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts:6-9`
    (`makeChatDedupKey`), 참조 지점 `chat-channel-dedup.service.spec.ts:34-35`
  - 상세: 소스 자체의 주석("테스트가 import 해 문자열 중복 정의를 피한다")이 밝히듯, 테스트는
    `makeChatDedupKey` 를 **구현과 동일한 함수**로 import 해 기대 키를 계산한다. 이 설계는
    "trig-A vs trig-B" 케이스(파일 2, 48-64행)에서 스코핑 정확성은 충분히 검증하지만,
    `cc:dedup:` 접두사 자체가 예컨대 `cc:dedupe:` 로 오타나면 어떤 테스트도 잡지 못한다 —
    키 접두사는 아키텍처 리뷰(이전 라운드)가 이미 §9.1 레지스트리 비준수로 다뤘고, 운영
    monitoring/알람이 `cc:dedup:*` 패턴에 의존할 수 있어 완전히 무해하지는 않다.
  - 제안: 리터럴 문자열 비교 단언(`expect(makeChatDedupKey('t','u')).toBe('cc:dedup:t:u')`)을
    한 줄 추가해 포맷 자체를 독립적으로 고정. 우선순위 낮음.

- **[INFO]** 생성자의 `RedisConnectionProvider` 폴백 분기(3번째 인자)가 단위 테스트로
  실행되지 않는다.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts:39-46`
    (`this.redis = injectedRedis ?? redisConn?.getClientOrNull() ?? null;`)
  - 상세: `chat-channel-dedup.service.spec.ts` 의 `makeService()` 헬퍼(23-25행)는 항상
    `injectedRedis` 를 채워 첫 번째 `??` 분기에서 단락되므로, 프로덕션 DI 경로(`redisConn` 을
    통한 공유 커맨드 커넥션 획득, 및 `redisConn?.getClientOrNull()` 이 `null` 을 반환하는
    분기)는 어떤 테스트에서도 실행되지 않는다. 형제 클래스도 동일하게 미검증이며, 직전 리뷰
    라운드(`review/code/2026/08/13/02_38_41/RESOLUTION.md` INFO #13)에서 이미 이 정확한
    갭을 지적받고 "sibling 서비스도 동일. 3중 복제 구조를 손볼 때 함께" 로 유예 처리된
    항목이다 — 새 지적이 아니라 상태 확인.
  - 제안: 조치 불요(이미 유예 결정됨). 재지적 방지를 위해 기록만 남김.

- **[INFO]** CCH-SE-02 관련 e2e(HTTP 레벨 실제 중복 POST) 테스트가 없다.
  - 위치: N/A(부재 확인) — `codebase/backend/src/modules/hooks/hooks.service.spec.ts:1227-1271`
    (단위/통합형 unit 테스트만 존재)
  - 상세: 현재 커버리지는 (a) `ChatChannelDedupService` 단위 테스트, (b) `HooksService` 를
    통한 모킹된 호출부 통합 테스트 두 계층으로 충분히 이원화돼 있다(아키텍처 리뷰가 이미
    긍정 평가). 다만 실제 raw body 를 같은 endpoint 에 2회 POST 하는 e2e 레벨 검증(Redis
    실 연결 포함)은 없다 — 이 역시 직전 라운드에서 이미 INFO 로 유예된 항목(`RESOLUTION.md`
    "7·14 | e2e 부재 | 유예 — 후속 후보").
  - 제안: 조치 불요(이미 백로그 등재·유예). 재지적 방지를 위해 기록만 남김.

## 긍정 평가 (참고)

- **Mock 적절성**: `chat-channel-dedup.service.spec.ts` 의 `makeRedis()` 는 실제로 쓰는
  `.set` 메서드만 노출하는 최소 mock(`as never` 로 타입 우회) — 형제 파일
  `chat-channel-rate-limiter.service.spec.ts` 와 동일한 narrow-mock 관례를 따른다. 과도한
  전체 인터페이스 mock 없이 필요한 표면만 흉내내 실제 동작과의 괴리가 작다.
- **테스트 격리**: `hooks.service.spec.ts` 최상위 `beforeEach` 가 매 테스트마다
  `Test.createTestingModule` 을 새로 `compile()` 하고 `ChatChannelDedupService` mock 도 그
  안에서 매번 새 `jest.fn()` 으로 생성된다(89-93행) — `dedup.claim.mockResolvedValueOnce(false)`
  같은 1회성 오버라이드가 다른 테스트로 새는 경로가 없다. `clearMocks`/`resetMocks` 전역 설정에
  기대지 않고 구조적으로 격리를 보장한다.
  (확인: `codebase/backend/jest.config*`, `package.json` 에 `clearMocks`/`resetMocks`
  설정 없음 — 격리는 순전히 "매 테스트 새 모듈" 구조에 의존한다.)
- **회귀 테스트**: `HooksService` 생성자에 `chatChannelDedup` 파라미터가 추가됐지만
  (`hooks.service.ts:79`), 저장소 전체에 `new HooksService(...)` 위치 인자 직접 생성 호출이
  0건임을 확인(grep) — 기존 테스트가 전부 DI/mock 경유라 시그니처 변경에 안전하다. 기존
  "Chat Channel 분기" 테스트들은 `ChatChannelDedupService` 기본 mock(`claim` → `true`)에
  의존해 아무 것도 바꾸지 않고 그대로 통과한다(수동 확인: 기본값이 "최초 도착" 이라 억제
  게이트가 no-op).
- **Mock 적절성/회귀**: `hooks.service.spec.ts` 의 CCH-SE-02 신규 케이스가 `Logger.prototype.warn`
  을 spy 하면서 `try/finally` 로 `mockRestore()` 를 보장한다(1251-1262행) — assertion 실패 시에도
  spy 가 전역 프로토타입에 남아 후속 테스트를 오염시키지 않는다.
- **뮤테이션 검증**: `RESOLUTION.md` 가 서술하는 "6/6 사살"(NX 제거·TTL 제거·triggerId 세그먼트
  제거·빈 키 가드 제거·warn 제거·호출부가 반환값을 버림) 각각을 코드 상으로 대조했을 때, 대응하는
  단언이 실제로 존재한다 — `chat-channel-dedup.service.spec.ts:34-40`(NX/TTL/키 전체 인자),
  `:86-92`(빈 키 가드), `:71-84`(warn), `hooks.service.spec.ts:1264-1270`(호출부 소비 확인)이
  각각 그 뮤턴트 클래스를 구조적으로 죽인다.

## 요약

핵심 신규 코드(`ChatChannelDedupService`)와 호출부(`HooksService.handleChatChannelWebhook`)
모두 단위 테스트 + 호출부 통합 테스트로 이원화돼 있고, "서비스가 옳다"와 "호출부가 그 값을
실제로 쓴다"를 분리해 고정한 설계가 이 PR 이 스스로 지적한 "반환값만 봐서는 안 잡히는 회귀"
문제(로그 소실·값 폐기)를 정확히 겨냥한다. 직전 리뷰 라운드의 testing WARNING(호출부 warn
미검증)은 이번 라운드에서 실제로 조치돼 있음을 코드로 확인했다. 남은 갭은 전부 INFO 급으로,
그중 두 건(RedisConnectionProvider 폴백 미검증, e2e 부재)은 직전 라운드에서 이미 사유와 함께
유예된 항목의 재확인이고, 나머지 두 건(윈도우 상수·키 포맷이 리터럴로 pin 되지 않음)은 신규
관찰이지만 형제 파일(`chat-channel-rate-limiter.service.spec.ts`)과 동일한 기존 관례라 이
PR 만의 회귀는 아니다. 테스트 격리·가독성(한국어 주석이 "왜"를 설명)·mock 적절성 모두 양호하다.

## 위험도

LOW
