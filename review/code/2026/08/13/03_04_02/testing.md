# 테스트(Testing) 리뷰 — CCH-SE-02 chat-channel update dedup (최종 라운드 `03_04_02`)

## 범위 확인

이번 diff 의 실질 코드는 이전 라운드(`02_38_41`, `02_50_38`)가 이미 검토한 `ChatChannelDedupService`
신설 + `HooksService` 배선(파일 1~6)과 동일하다. 파일 7(plan 체크박스)과 파일 8~44 는
이전 리뷰 라운드의 산출물(`review/code/**`, `review/consistency/**`)과 spec 문서 자체를
저장소에 커밋하는 변경으로, 실행 코드가 아니라 테스트 관점에서 별도로 다룰 대상이 없다.
따라서 이번 라운드는 파일 1~6(서비스 신설·테스트·DI 배선·호출부 배선)을 독립적으로
재검증했다.

## 검증 절차 (재현)

- `npx jest chat-channel-dedup.service.spec.ts hooks.service.spec.ts` — 2 suites / **59 tests 전부
  통과**(직접 실행 확인, 회귀 없음).
- `chat-channel-dedup.service.ts` / `chat-channel-dedup.service.spec.ts` / `hooks.service.ts` 를
  `Read` 로 직접 열어 diff 내용과 현재 소스가 정확히 일치함을 대조했다.
- `grep -rl "CCH-SE-02\|ChatChannelDedupService" codebase/backend/test/` — 0건. e2e 커버리지
  없음을 직접 확인.

## 발견사항

- **[INFO]** 생성자의 `RedisConnectionProvider` 폴백 분기가 단위 테스트에서 한 번도 실행되지
  않는다.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts:39`-`46`
    (`this.redis = injectedRedis ?? redisConn?.getClientOrNull() ?? null;`) /
    `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.spec.ts:23`-`25`
    (`makeService` 는 `injectedRedis` 슬롯에만 값을 넣고 `redisConn` 인자는 항상 `undefined`).
  - 상세: 모든 테스트가 `new ChatChannelDedupService(redis as never, undefined)` 또는
    `new ChatChannelDedupService(undefined, undefined)` 두 형태만 쓴다. 프로덕션 DI 경로에서
    실제로 타는 `redisConn?.getClientOrNull()` 분기(및 그것이 `null` 을 반환하는 경우)는
    커버되지 않는다 — `??` 순서가 뒤바뀌거나 `getClientOrNull` 오탈자가 나도 이 스펙만으로는
    못 잡는다. 다만 형제 클래스(`ChatChannelRateLimiterService`)도 동일 패턴을 동일하게
    미검증 상태로 두고 있어 이 PR 고유의 새 결함은 아니며, 이전 두 라운드에서 이미 발견되고
    "우선순위 낮음(constructor 배선 오류는 e2e/부팅 단계에서 즉시 드러남)"으로 유예된 항목과
    같다.
  - 제안: `makeService` 에 `redisConn` 목(`{ getClientOrNull: () => redis }`)을 주입하는
    테스트 1개를 추가하면 생성자 3-분기 전체가 닫힌다. 우선순위는 낮음.

- **[INFO]** 호출부 "재도착 무시" warn 로그의 동적 부분(`trigger=${trigger.id}`)은 검증되지
  않는다 — 문구 자체의 존재만 확인한다.
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:341`-`343`
    (`` `chat-channel update 재도착 무시 (CCH-SE-02, trigger=${trigger.id})` ``) /
    `codebase/backend/src/modules/hooks/hooks.service.spec.ts` 의 `CCH-SE-02` 테스트
    (`expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('재도착 무시'))`).
  - 상세: 이전 라운드(`02_38_41`)의 WARNING(호출부 warn 미검증)은 이번 diff 에서 정확히
    조치되어 있음을 확인했다 — `Logger.prototype.warn` spy + `try/finally` 복원 패턴이 실제로
    존재하고, 60~93번째 줄 사이 실행도 GREEN 이다. 다만 `stringContaining('재도착 무시')` 는
    trigger id 보간이 깨져도(예: `trigger=undefined`) 여전히 매치되므로, 로그 라인이 아예
    사라지는 회귀(이 PR 이 원래 우려하던 것)는 정확히 잡지만 보간 값 자체의 정확성 회귀는
    잡지 못한다. 심각도는 낮다 — `dedup.claim` 인자 단언(`toHaveBeenCalledWith(chatChannelTrigger.id, '3001')`)이
    별도로 존재해 `trigger.id` 자체가 옳게 전달되는지는 이미 다른 단언이 커버한다.
  - 제안: 급하지 않음. 원한다면 `stringContaining(`trigger=${chatChannelTrigger.id}`)` 로
    좁힐 수 있다.

- **[INFO]** 실 Redis 클라이언트를 상대로 한 통합/e2e 테스트가 없다 — `SET key 1 EX 30 NX`
  호출은 모킹된 인터페이스로만 검증된다.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.spec.ts` 전체
    (모킹 전용), `codebase/backend/test/` (`grep -rl "CCH-SE-02\|ChatChannelDedupService"` 결과
    0건 — 직접 확인).
  - 상세: 인자 순서(`key, '1', 'EX', 30, 'NX'`)는 같은 모듈의 기존 락 패턴과 동일해 사용법
    자체는 신뢰할 만하지만, 실 Redis 응답 형태(`'OK'`/`null`)에 대한 가정은 e2e 로 재확인되지
    않는다. 이 프로젝트의 다른 Redis 기반 서비스(rate-limiter, quota)도 동일하게 e2e
    커버리지가 없어 이 PR 만의 결함이 아니며, 이전 라운드에서 "후속 후보"로 이미 기록된
    항목과 동일하다.
  - 제안: 후속 작업으로 "동일 raw body 2회 POST" e2e 케이스를 고려할 수 있으나 이번 PR
    범위 밖.

## 회귀·격리 확인 (문제 없음)

- `hooks.service.spec.ts` 최상위 `beforeEach`(38번째 줄)가 매 `it` 마다 `moduleRef` 를
  새로 생성해, 신규 `CCH-SE-02` 테스트의 `dedup.claim.mockResolvedValueOnce(false)` 가 다른
  테스트로 새지 않는다 — 직접 확인.
- `ChatChannelDedupService` 의 기본 mock(`claim: jest.fn().mockResolvedValue(true)`)이
  "최초 도착"을 기본값으로 둬, 기존 `CCH-NF-03` 등 다른 케이스를 오염시키지 않는다.
  `npx jest hooks.service.spec.ts` 재실행으로 회귀 없음을 확인했다(59/59 통과, 신규 테스트
  포함).
- `chat-channel-dedup.service.spec.ts` 의 6개 케이스(최초 도착/재도착/trigger 스코핑/Redis
  미주입/Redis 에러/빈 키)는 서로 독립적인 `makeService` 인스턴스를 매번 새로 만들어 상태
  공유가 없다.

## 요약

핵심 신규 코드(`ChatChannelDedupService`, 그 단위 테스트, `HooksService` 호출부 배선 및 호출부
테스트)는 서비스 경계(최초 도착·재도착·trigger 스코프·빈 키·fail-open 2종)와 호출부 경계
(반환값 소비·rate-limit 앞단 차단·쿼터 미소비·중복 dispatch 없음·warn 존재)를 모두 개별
단언으로 고정하고 있으며, 직접 재실행한 59개 테스트가 전부 통과했다. 이전 라운드가 지적한
"호출부 warn 미검증" WARNING 은 이번 diff 에서 실제로 조치되어 있음을 확인했다. 남은 갭은
전부 INFO 수준(생성자 `RedisConnectionProvider` 폴백 분기 미검증, warn 로그의 동적 보간값
미검증, 실 Redis e2e 부재)이며, 그 중 둘은 형제 서비스와 동일한 기존 관례이거나 이전 라운드에서
이미 근거와 함께 유예된 항목이라 이번 PR 고유의 새 결함이 아니다. 테스트 격리·가독성·Mock
적절성 모두 이 파일군의 기존 관례를 일관되게 따르고 있어 추가 조치를 강제할 사안은 없다.

## 위험도

LOW
