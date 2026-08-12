# 아키텍처(Architecture) 리뷰 — CCH-SE-02 update dedup (재검증 라운드 02_50_38)

## 범위 확인

이번 diff 는 이전 리뷰 라운드(`02_38_41`)가 검토한 동일 기능(`ChatChannelDedupService` 신설 +
`HooksService` 배선)에 그 라운드의 **RESOLUTION 조치**(CHANGELOG 항목, sibling spec
`telegram.md` 정정, 호출부 warn 단언 테스트 추가)와 **리뷰 산출물 자체**(`review/code/2026/08/13/02_38_41/**`)가
새 파일로 추가된 형태다. 실질 아키텍처 표면(서비스 구조·모듈 배선·레이어 분리)은 이전 라운드와
동일하며, 이번에 추가된 hunk 는 문서/테스트/리뷰-메타 파일에 한정된다. 아래는 그 실질 코드를
독립적으로 재확인한 결과다.

## 발견사항

- **[INFO]** `ChatChannelDedupService` 는 `ChatChannelRateLimiterService` 의 생성자·fail-open
  래핑·로깅 스타일을 구조적으로 그대로 복제했다. `PublicWebhookQuotaService` 까지 포함하면
  "Redis 원자 연산 + fail-open + 개별 Logger" 골격의 클래스가 세 개다.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts:34`-`76`
    (클래스 전체, 특히 생성자 `:39`-`46`) vs
    `codebase/backend/src/modules/chat-channel/chat-channel-rate-limiter.service.ts:29`-`78`
    (직접 `Read` 로 대조 확인 — 두 생성자가 주입 토큰 이름만 다르고 완전히 동일).
  - 상세: 이전 라운드에서 이미 동일하게 지적됐고(INFO), "지금 통합 불요, 4번째 유사 서비스가
    생기면 공통 베이스(`RedisFailOpenGuard`) 추출 검토"로 처분되어 `plan` 백로그가 아닌 구두
    기준으로 남아 있다. 이번 라운드에서도 새 코드 변경이 없으므로 그 판단을 유지한다 — 이
    프로젝트는 axes 가 발산할 수 있는 조기 추출을 반복적으로 보류해 온 이력이 있다(cafe24/makeshop
    미러, reaper/engine DRY 등). 다만 세 번째 인스턴스가 나온 시점이므로 **다음 서비스가 추가될
    때는 이 판단을 재검토 없이 넘기지 말 것**.
  - 제안: 조치 불요. 네 번째 "Redis fail-open guard" 클래스가 생기는 순간을 추출 트리거로 고정.

- **[INFO]** `HooksService` 의 생성자 의존성이 12개로 늘었고(`chatChannelDedup` 추가),
  `handleChatChannelWebhook` 는 여전히 400줄대의 단일 메서드로 auth guard → 비활성 처리 →
  provider 핸드셰이크 → dedup → rate-limit → enrichInbound → 명령별 분기 → form/modal/interaction
  처리까지 다중 책임을 담당한다. 이번 라운드는 이 메서드에 새 코드를 추가하지 않았다(기존
  dedup 게이트 블록 그대로).
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:69`-`84`(생성자, 12 params),
    `:328`-`345`(기존 dedup 게이트 블록, 변경 없음)
  - 상세: 이전 라운드 WARNING #5 로 지적됐고 RESOLUTION.md 에서 "**다음 게이트가 추가되는
    시점**을 트리거로 유예"로 명시 처분됐다. 이번 diff 는 새 게이트를 추가하지 않았으므로(문서·
    테스트·CHANGELOG 만 추가) 그 유예 조건이 아직 성립하지 않는다 — 재상정할 근거 없음.
  - 제안: 조치 불요(트리거 미도달). 다음에 `handleChatChannelWebhook` 에 새 인바운드 게이트가
    붙는 시점에 `chatChannelInboundAuthenticator`/`chatChannelDedup`/`chatChannelRateLimiter`
    3개를 파이프라인 협력 객체로 묶는 리팩터링을 함께 검토.

- **[INFO]** `@Inject('CHAT_CHANNEL_DEDUP_REDIS')` 토큰은 `ChatChannelModule`(및 다른 모듈)
  어디에서도 provide 되지 않는다 — 프로덕션 경로는 항상 `redisConn?.getClientOrNull()` 분기만
  타고, 이 토큰은 단위 테스트가 생성자를 직접 호출할 때만 의미가 있는 "죽은 확장점"이다.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts:39`-`46`
  - 상세: 인터페이스 분리 관점에서 문제라기보다, 형제 클래스(`ChatChannelRateLimiterService`)와
    동일하게 의도된 테스트 훅이다. 다만 형제 클래스는 그 사실을 생성자 옆 주석으로 명시하는데
    (`chat-channel-rate-limiter.service.ts:40` "테스트 주입 우선, 아니면 공유 command connection…")
    신규 클래스는 그 설명이 없어 "이 토큰을 provide 하면 오버라이드된다"는 오해 소지가 남는다.
    문서화 축(이전 라운드 documentation INFO)과 겹치는 사안이라 아키텍처 등급으로는 낮게 본다.
  - 제안: 조치 불요(중복 추적, documentation 트랙에서 처리 대상).

## 레이어/결합도/모듈 경계 평가 (문제 없음)

- **레이어 분리**: `ChatChannelDedupService.claim()` 은 Redis I/O 만 캡슐화하고 boolean 만
  반환한다 — "재도착 시 무엇을 할지"(로그·응답 생성)는 전부 `HooksService`(오케스트레이션
  레이어)의 책임으로 남아 인프라/비즈니스 레이어 분리가 명확하다
  (`chat-channel-dedup.service.ts:54`-`74` vs `hooks.service.ts:338`-`345`).
- **개방-폐쇄**: 새 guard 는 기존 guard 체인 사이에 **삽입**만 됐고(`hooks.service.ts:328`-`345`,
  rate-limit 블록 `:347`- 바로 앞) 기존 guard(`ChatChannelInboundAuthenticator`,
  `ChatChannelRateLimiterService`)의 코드는 수정되지 않았다.
- **모듈 경계·순환 의존**: `ChatChannelDedupService` 는 `ChatChannelModule` 의 `providers`/`exports`
  양쪽에 등록됐고(`chat-channel.module.ts:46,61`), `HooksModule → ChatChannelModule` 단방향
  의존만 늘었다. `ChatChannelModule` 은 `HooksModule` 을 참조하지 않으므로 순환 없음 —
  `Grep` 로 `chat-channel.module.ts` 의 `imports` 를 확인했을 때 `HooksModule` 참조 없음을
  재확인했다.
- **DIP**: `HooksService` 는 구체 클래스(`ChatChannelDedupService`)에 직접 의존하지만, 이는
  NestJS DI 관용구(인터페이스 없이 `@Injectable` 클래스를 토큰으로 사용)를 형제 서비스들과
  일관되게 따른 것이라 이 코드베이스 컨벤션 기준으로는 위반이 아니다.
- **테스트 아키텍처**: 서비스 단위 테스트(`chat-channel-dedup.service.spec.ts`)와 호출부 테스트
  (`hooks.service.spec.ts` 의 CCH-SE-02 케이스)가 "서비스가 옳다"와 "호출부가 그 값을 실제로
  쓴다"를 분리해서 고정한다 — 이번 라운드에서 호출부 `Logger.warn` 단언까지 보강되어(RESOLUTION
  WARNING #4 조치) 두 테스트의 책임 경계가 더 명확해졌다.

## 리뷰 산출물 커밋에 대한 참고 (아키텍처 표면 아님)

`review/code/2026/08/13/02_38_41/*.md`·`meta.json`·`_retry_state.json` 이 신규 파일로 diff 에
포함돼 있다. 이는 코드 아키텍처가 아니라 프로젝트 규약(`review/code/**` 산출물 보관)에 따른
리뷰 이력 커밋이며, 프로덕션 모듈 구조나 결합도에 영향이 없다 — 별도 findings 없음.

## 요약

이번 라운드에서 실질적으로 새로 확인할 아키텍처 표면(서비스 신설·모듈 배선·guard 삽입 위치)은
이전 라운드와 동일하며, 직접 소스를 재대조한 결과 인프라/비즈니스 레이어 분리·모듈 경계·의존
방향 모두 문제가 없다. 남아 있는 두 가지 구조적 신호 — Redis fail-open 클래스 3중 복제,
`HooksService.handleChatChannelWebhook` 의 guard 누적 — 는 이전 라운드에서 이미 각각 명시적
트리거 조건(4번째 유사 클래스 / 다음 게이트 추가)으로 유예 처분됐고, 이번 diff 는 그 트리거를
충족하는 변경(새 게이트·새 유사 클래스)을 포함하지 않으므로 재상정하지 않는다. 이번에 추가된
hunk(CHANGELOG, sibling spec 정정, 호출부 warn 테스트, 리뷰 산출물 커밋)는 모두 아키텍처
표면 밖이다.

## 위험도
LOW
