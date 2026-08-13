# 테스트(Testing) 리뷰 — CCH-SE-02 chat-channel update dedup (4차 라운드 `11_12_03`)

> 이 diff 는 `ChatChannelDedupService`(+spec)·`HooksService` 호출부 배선(파일 1-7)에, 그 구현을
> 검토한 세 차례 선행 코드 리뷰(`02_38_41`·`02_50_38`·`09_09_58`) + 두 차례 consistency 검토
> (`02_38_42`·`09_20_48`) 산출물, 그리고 spec 문서 4건(파일 64-67)을 함께 커밋한 누적 형태다.
> `git log -- chat-channel-dedup.service.ts hooks.service.ts hooks.service.spec.ts
> chat-channel-dedup.service.spec.ts` 로 확인한 결과 실제 코드 커밋은 `a562bfe99`(feat)·
> `23020bb7e`(docs) 둘뿐 — 즉 `09_09_58` 라운드가 이미 검토한 코드와 **동일**하다. 이번 라운드는
> (a) 직접 `Read` 로 저장소 실제 파일을 재대조하고 (b) 세 라운드가 남긴 결론이 여전히 유효한지
> 독립 검증한다.

## 검증 절차 (재현)

- `chat-channel-dedup.service.ts` / `.spec.ts`, `hooks.service.ts` (L295-360 부근)를 `Read` 로
  직접 열어 프롬프트 diff 및 이전 라운드 인용과 저장소 현재 상태가 정확히 일치함을 확인 — 드리프트
  없음.
- `ChannelUpdate.idempotencyKey` 타입을 `types.ts:129` 에서 확인 — `idempotencyKey: string`
  (optional 아님). `claim(triggerId, idempotencyKey: string)` 시그니처와 정합하며, 3개
  provider parser(telegram/slack/discord) 모두 항상 값을 채워 넣는다(grep 대조) — "빈 문자열"
  케이스는 슬랙 `parseSlashCommand`/`block_actions` 등에서 `idempotencyKey = triggerId`(Slack
  고유 `trigger_id`, 상호작용마다 유일)로 폴백하는 경로뿐이라 실제로는 도달하기 어려운 방어적
  가드다 — 그럼에도 방어적 가드 자체를 별도 `it` 로 고정한 것은 적절하다.
- `git log --oneline -- review/code/2026/08/13/03_04_02/` 로 동명의 다른 디렉터리(`03_04_02`)가
  이 diff 와 무관한 **선행 병합 커밋**(`4b1f899b7`, EIA readKey/hashBody 무관 PR)임을 확인해
  혼동 소지를 제거했다.

## 발견사항

- **[확인, 신규 WARNING/CRITICAL 없음]** 1차 라운드(`02_38_41`)가 지적한 유일한 WARNING —
  "호출부(`hooks.service.ts`)의 재도착 무시 `warn` 이 테스트에서 단언되지 않는다" — 은 현재
  `hooks.service.spec.ts` 에 실제로 반영돼 있음을 재확인했다.
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.spec.ts` (`warnSpy` 선언부 ~
    `expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('재도착 무시'))` 까지의
    `it('CCH-SE-02 — 동일 update 재도착은 처리 생략...')` 블록, `try { … } finally {
    warnSpy.mockRestore(); }` 로 복원).
  - 상세: 서비스 내부 warn(`chat-channel-dedup.service.spec.ts` 의 "Redis 에러 → fail-open +
    warn" 케이스)과 호출부 warn(이 블록)이 각각 별도 `it` 로 고정돼 있어, "로그 한 줄이 사라지는
    회귀는 반환값만 봐서는 안 잡힌다"는 이 PR 자신의 원칙이 두 지점 모두에 실제로 적용됐다.

- **[INFO, 재확인]** `ChatChannelDedupService` 생성자의 `RedisConnectionProvider` 폴백 분기
  (`injectedRedis` 없이 `redisConn` 만 있는 경로)가 어떤 단위 테스트에서도 실행되지 않는다.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts` 의
    `this.redis = injectedRedis ?? redisConn?.getClientOrNull() ?? null;` (생성자 본문) /
    `chat-channel-dedup.service.spec.ts` 의 `makeService()` 헬퍼(`redis as never, undefined` —
    `redisConn` 슬롯은 항상 `undefined`).
  - 상세: 세 라운드(`02_38_41` INFO·`02_50_38` INFO·`09_09_58` INFO) 모두 동일 갭을 지적했고
    "sibling 서비스도 동일 관례, 3중 복제 구조를 손볼 때 함께" 로 유예됐다. 코드 재대조 결과 그
    유예 판단은 여전히 유효하다 — 새 지적 아님, 상태만 재확인.
  - 제안: 조치 불요(이미 유예 확정). `makeService` 옆에 `redisConn` mock
    (`{ getClientOrNull: () => redis }`) 주입 테스트 1개로 닫을 수 있으나 급하지 않다.

- **[INFO, 재확인]** `CHAT_DEDUP_WINDOW_SEC`(30초)와 키 포맷(`cc:dedup:<triggerId>:<key>`)이
  테스트에서 **동일 심볼 참조**로만 검증되고 리터럴로 pin 되지 않는다.
  - 위치: `chat-channel-dedup.service.ts` 의 `makeChatDedupKey`/`CHAT_DEDUP_WINDOW_SEC` 선언부 /
    `chat-channel-dedup.service.spec.ts` 의 `toHaveBeenCalledWith(makeChatDedupKey(...), '1',
    'EX', CHAT_DEDUP_WINDOW_SEC, 'NX')` 단언.
  - 상세: `02_50_38`·`09_09_58` 라운드가 이미 지적("숫자 자체·접두사 자체의 회귀는 못 잡는다")했고
    형제 파일(`chat-channel-rate-limiter.service.spec.ts`)과 동일한 기존 관례라 이 PR 고유
    결함은 아니다. 재확인 결과 여전히 유효.
  - 제안: 조치 불요(유예). `expect(CHAT_DEDUP_WINDOW_SEC).toBe(30)` +
    `expect(makeChatDedupKey('t','u')).toBe('cc:dedup:t:u')` 2줄로 닫을 수 있으나 우선순위 낮음.

- **[INFO, 재확인]** CCH-SE-02 에 대한 실 Redis/HTTP 레벨 e2e(동일 raw body 2회 POST → 두 번째만
  억제)가 없다.
  - 위치: N/A(부재) — `hooks.service.spec.ts` 의 CCH-SE-02 테스트는 mock 인터페이스 레벨.
  - 상세: 세 라운드 모두 동일하게 지적했고 `plan/in-progress/backend-lint-gate-broken-on-main.md`
    가 "e2e 부재 → 유예 — 후속 후보(동일 raw body 2회 POST)" 로 이미 백로그 등재했다. 재확인
    결과 여전히 등재 상태 유지(체크박스 미완료), 새로 드롭되지 않았음을 확인.
  - 제안: 조치 불요(이미 백로그).

## 회귀 확인

- `HooksService` 생성자에 `chatChannelDedup` 파라미터가 추가됐지만(위치 인자 직접 생성 0건,
  grep 재확인) 기존 테스트는 전부 DI/mock 경유라 시그니처 변경에 안전하다.
- `hooks.service.spec.ts` provider 배열의 `ChatChannelDedupService` 기본 mock
  (`claim: jest.fn().mockResolvedValue(true)`, "최초 도착")이 기존 chat-channel 테스트 전체를
  no-op 통과시켜 오염 없음 — 이번 세션에서 새로 검증한 것은 아니고 선행 라운드 확인을 재신뢰.
- CHANGELOG.md 의 "provider 파서 **3종**"(telegram·slack·discord) 수치는 `02_50_38` WARNING #3
  조치分으로, 현재 파일 내용과 실제 grep 결과(`idempotencyKey` 를 채우는 parser 3파일)가 일치함을
  재확인했다.

## Mock 적절성 · 테스트 격리 · 가독성 (재확인, 문제 없음)

- `makeRedis()` 는 `.set` 만 노출하는 최소 mock — 형제 파일과 동일한 narrow-mock 관례.
- `hooks.service.spec.ts` 최상위 `beforeEach` 가 매 테스트 새 `Test.createTestingModule` 을
  컴파일하고(`jest.config`/`package.json` 에 전역 `clearMocks`/`resetMocks` 없음, grep 확인),
  `dedup.claim.mockResolvedValueOnce(false)` 같은 1회성 오버라이드가 다른 `it` 로 새지 않는
  구조적 격리를 갖췄다.
- `Logger.prototype.warn` spy 는 두 spec 파일 모두 `try/finally` 로 복원해 다른 테스트로의 누수를
  막는다.
- 각 `it` 설명·인라인 주석이 "왜 이 값/순서여야 하는가"를 명시해(TTL·NX 빠지면 영구/무억제,
  빈 키로 뭉치면 무관한 update 유실, dedup 이 rate-limit 보다 앞이어야 쿼터 미소비) 가독성이 좋다.

## 요약

이번 라운드는 실제 코드(`ChatChannelDedupService`/`HooksService` 배선)가 직전 라운드(`09_09_58`)
검토 시점과 동일함을 커밋 이력·직접 `Read` 대조로 확인했고, 세 차례 선행 코드 리뷰가 남긴 결론이
모두 유효함을 독립적으로 재확인했다 — 유일했던 WARNING(호출부 warn 미검증)은 조치 완료 상태이며,
새로운 CRITICAL/WARNING 급 테스트 결함은 발견되지 않았다. 남은 갭(`RedisConnectionProvider` 폴백
분기 미검증, 윈도우 상수·키 포맷 리터럴 미고정, 실 Redis/e2e 부재)은 모두 형제 서비스와 동일한
기존 관례이거나 이미 plan 백로그에 사유와 함께 유예 등재돼 있어 이번 라운드에서도 INFO 로 유지한다.
서비스 단위 테스트(억제 판정)와 호출부 통합 테스트(반환값 실사용·rate-limit 앞단 차단·쿼터
미소비)로 이원화한 테스트 설계는 이 PR 이 스스로 지적한 "반환값만으론 못 잡는 회귀" 클래스를
정확히 겨냥하고 있다.

## 위험도

LOW
