# 부작용(Side Effect) 리뷰 결과 — CCH-SE-02 update dedup (라운드 `09_09_58`)

## 범위 확인

이번 diff 는 이전 두 라운드(`02_38_41`, `02_50_38`)가 이미 검토한 `ChatChannelDedupService` 신설
+ `HooksService` 배선과 **동일한 실질 코드**에, 그 라운드들의 RESOLUTION 조치(CHANGELOG 항목,
sibling spec `telegram.md`/`15-chat-channel.md`/`data-flow/14-chat-channel.md` 정정, 호출부 warn
단언 테스트)와 두 라운드의 **리뷰 산출물 자체**(`review/code/**`, `review/consistency/**`)가 새 파일로
추가된 형태다. 부작용 관점에서 새로 평가할 실질 코드 표면(Redis 쓰기, 생성자 시그니처, 모듈 DI
등록, 게이트 배치)은 이전 라운드와 동일함을 `Read`/`Grep` 으로 직접 재확인했다. 아래는 그 독립
재검증 결과다.

## 발견사항

- **[INFO]** 새 Redis 쓰기 부작용 — `ChatChannelDedupService.claim()` 이 chat-channel inbound 요청마다
  무조건 `SET NX EX 30` 을 실행해 신규 Redis 키 네임스페이스 `cc:dedup:<triggerId>:<idempotencyKey>`
  를 도입한다.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts:61`-`67`
    (`claim()` 내 `this.redis.set(...)`)
  - 상세: 의도된 신규 기능(Spec CCH-SE-02)이고, `spec/5-system/15-chat-channel.md:88` /
    `spec/data-flow/14-chat-channel.md`(새 Redis 키 레지스트리 행)에 동일 메커니즘(키 포맷·TTL·
    fail-open)이 문서화돼 SoT 와 일치함을 직접 대조했다. `ChatChannelRateLimiterService` 와 동일한
    주입 패턴(`@Optional() @Inject('CHAT_CHANNEL_DEDUP_REDIS')` → `RedisConnectionProvider` 폴백 →
    `null`)을 재사용해 새로운 위험 클래스를 만들지 않는다. `'CHAT_CHANNEL_DEDUP_REDIS'` 토큰은
    `grep -rn "CHAT_CHANNEL_DEDUP_REDIS" codebase/backend/src` 결과 정의부 1건(자기 자신)뿐이라
    실제로 바인딩하는 provider 가 없음을 재확인했다 — 운영 경로는 항상 `RedisConnectionProvider`
    폴백만 타는 sibling 과 동일한 "테스트 전용 override 훅" 패턴.
  - 제안: 조치 불필요. 참고 기록.

- **[INFO]** `HooksService` 생성자 시그니처 변경 — 새 필수 파라미터가 **끝이 아니라 중간**
  (`chatChannelRateLimiter` 와 `interactionService` 사이)에 삽입됐다.
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:79`
    (`private readonly chatChannelDedup: ChatChannelDedupService,`)
  - 상세: `grep -rn "new HooksService(" codebase/backend/src codebase/backend/test` 결과 0건 —
    positional 생성자 호출자가 프로덕션·테스트 어디에도 없어 NestJS 타입 기반 DI 로만 소비된다.
    `hooks.service.spec.ts:89`-`93`(파일 5 diff)에 `ChatChannelDedupService` mock provider
    (`{ claim: jest.fn().mockResolvedValue(true) }`, 기본값 "최초 도착")가 함께 추가돼 있어
    `Test.createTestingModule` DI 해석이 깨지지 않음을 확인했다. 인터페이스가 아닌 구체 클래스를
    파라미터 삽입 위치로 바꾸는 패턴이므로, **만약** 이 서비스를 직접 `new` 하는 호출자가 나중에
    생기면(예: 스크립트·e2e 헬퍼) 위치 인자 순서가 깨질 수 있다는 점만 인지 기록.
  - 제안: 조치 불필요(현재 위험 없음). 향후 이 클래스를 직접 인스턴스화하는 코드를 추가할 경우
    named-args/factory 패턴을 권장.

- **[INFO]** `ChatChannelModule` 의 `providers`/`exports` 양쪽에 `ChatChannelDedupService` 추가 —
  DI 그래프 확장.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.module.ts:46`, `:61`
  - 상세: `HooksModule` 이 `ChatChannelModule` 을 `imports` 에 두고 있고(`forwardRef` 미사용),
    `exports` 목록에 `ChatChannelDedupService` 가 정확히 포함돼 있어 `HooksService` 주입이 런타임
    해석 가능함을 확인했다(누락 시 부팅 시점 DI 에러가 났을 것). sibling
    `ChatChannelRateLimiterService` 와 동일 위치에 짝을 맞춰 추가돼 module 표면 관례를 따른다.
  - 제안: 없음.

- **[INFO]** dedup `claim()` 선점(SET NX)에는 **release 경로가 없다** — 이전 라운드 side_effect
  리뷰가 이를 같은 파일의 `acquireLock`/`releaseLock`(form_submission lock) 과 "동일 클래스의 기존
  트레이드오프"로 비유했는데, 정확히 동일하지는 않다는 점을 짚는다.
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:338`-`345` (dedup 게이트, 실패해도
    release 호출 없음) vs `codebase/backend/src/modules/chat-channel/channel-conversation.service.ts:132`-`173`
    (`acquireLock`/`releaseLock` — 명시적 해제 메서드 존재, `Grep` 으로 확인)
  - 상세: `acquireLock`/`releaseLock` 은 처리가 끝나면(성공/실패 무관) 명시적으로 `releaseLock` 을
    호출해 lock 을 즉시 반납하는 뮤텍스다. 반면 dedup 키는 `SET NX EX 30` 성공 이후 어떤 release
    호출도 없이 TTL 30초 동안 그대로 유지된다(설계 의도 — "같은 update_id 는 성공/실패와 무관하게
    30초간 무시"). 결과적으로, `claim()` 성공 직후 `handleWebhook` 내부 후속 단계(예:
    `enrichInbound` 의 Slack `files.info` 호출, `executionsService`/`interactionService` 호출)가
    일시적 오류로 실패해 컨트롤러가 5xx 를 반환하더라도(`hooks.controller.ts:160` 부근에
    top-level catch 없음 확인), provider 가 그 5xx 를 보고 같은 update 를 재전송하면 그 재전송은
    **`claim()` 이 이미 선점한 dedup 키에 막혀 조용히 `{ executionId: 'ignored' }` 로 삼켜진다** —
    provider 입장에서는 2xx 를 받아 재시도를 멈추지만 실제로는 아무 execution 도 시작되지 않은 채
    최대 30초간 그 update 가 유실될 수 있다. 이는 이번 PR 이 CHANGELOG/RESOLUTION 에 명시한
    "fail-open 구간엔 중복 처리가 가능" 트레이드오프와는 다른 방향(반대로 **일시적 실패 시 억제로
    인한 처리 누락 창**)의 트레이드오프이며, `acquireLock`/`releaseLock` 비유만으로는 완전히
    커버되지 않는 차이다.
  - 제안: 즉각 조치 불요 — spec CCH-SE-02 가 "동일 update_id 30초 안 재도착은 무시" 를 조건 없이
    요구하므로 현재 동작은 spec 정합이다. 다만 이 트레이드오프(일시적 하위 실패 시 최대 30초의
    "조용한 재시도 억제 창")를 서비스/게이트 주석이나 R-CC-20 Rationale 에 한 줄 명시해 두면,
    향후 "재도착이 억제됐는데 execution 이 없다"는 운영 문의를 spec 위반이 아니라 알려진 트레이드
    오프로 즉시 판별할 수 있다.

- **[INFO]** 대량의 `review/code/**`·`review/consistency/**` 신규 파일(라운드 `02_38_41`/`02_50_38`
  산출물)이 diff 에 포함돼 있으나, 이는 프로젝트 규약(`review/**` 산출물 보관, CLAUDE.md 정보 저장
  위치 표)에 따른 정상 파일시스템 기록이며 실행 코드/설정에 영향 없는 문서성 부작용이다. 예상치
  못한 파일 생성이 아님.

- **[정보 없음]** 환경 변수 신규 읽기/쓰기, 신규 외부 네트워크 호출, 전역 변수 도입은 diff 전체에서
  발견되지 않았다 (`chat-channel-dedup.service.ts` 는 기존 `ioredis`/`RedisConnectionProvider` 만
  사용, `process.env` 직접 참조 없음을 확인).

## 요약

핵심 변경은 `ChatChannelDedupService` 신설(Redis `SET NX EX 30` 기반 in-process inbound dedup)과
`HooksService.handleChatChannelWebhook` 에서 `parseUpdate` 직후·rate-limit 이전 지점에 그 게이트를
배선한 것이며, 이 라운드가 추가한 hunk 는 실질적으로 CHANGELOG/spec 문서 정정·호출부 warn 단언
테스트·이전 라운드 리뷰 산출물 커밋에 한정된다. 새 Redis 쓰기 부작용(신규 키 네임스페이스)과
`HooksService` 생성자 시그니처 변경(중간 위치 삽입)이 있으나, 전자는 기존
`ChatChannelRateLimiterService` 패턴을 그대로 재사용하고 문서·테스트로 고정돼 있으며, 후자는
positional 호출자가 0건임을 grep 으로 직접 재확인했고 테스트 provider 배열도 함께 갱신돼 있어
파손 지점을 찾지 못했다. Module 의 providers/exports 갱신도 짝이 맞는다. 유일하게 짚을 만한
뉘앙스는 dedup 선점(`claim()`)에 release 경로가 없어, `acquireLock`/`releaseLock` 비유와 달리
"처리 도중 일시적 하위 실패 → provider 재전송이 최대 30초간 조용히 억제되는 창"이 이론상 존재한다는
점인데, 이는 spec CCH-SE-02 의 무조건적 "30초 재도착 무시" 요구사항에 정합하는 설계 의도된 동작이라
CRITICAL/WARNING 으로 격상하지 않고 INFO 로 기록한다.

## 위험도
LOW
