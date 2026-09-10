# 보안(Security) 코드 리뷰 — `impl-chat-channel-patch-token` (3라운드, `origin/main...HEAD` 누적 diff)

## 컨텍스트

이 브랜치는 이미 두 번의 전체 fan-out 코드 리뷰(`review/code/2026/09/10/23_21_57`,
`review/code/2026/09/10/23_55_23`)를 거쳤고, 각 라운드에서 보안 담당 reviewer 가 다음을 순서대로
검증했다 — 1라운드: CRITICAL(R-CC-10 single-path 우회 — PATCH·POST 공유 DTO 때문에 `botToken`
이 항상 필수라 비교 없는 `secrets.rotate()` 로 24h grace 백업·전용 audit action·
`chatChannelRotatedAt` 갱신을 우회) 발견·수정. 그 수정이 새로 만든 CRITICAL(`inboundSigningRef`
게이팅이 대칭 없이 걸려 slack/discord PATCH 한 번으로 인입 웹훅 서명 검증이 fail-open) 을 2라운드가
발견·수정. 이번(3라운드) diff 는 그 위에 2라운드 WARNING 6건(측정 범위 오류·사용자 문서 오기·타입
결속·null 케이스 누락·동시성 레이스 등재·함수 크기 등재) 후속 조치만 얹혔다 — `git show 83d5f3f94`
로 실제 코드 diff 를 직접 대조한 결과 애플리케이션 런타임 로직 변경은 없고 (a) `assertChatChannelInputSafe`
를 오버로드 2개로 컴파일 타임 결속, (b) 컨트롤러 Swagger 문구를 값 형태별 갈래로 보강, (c) 4개
문서(ko/en × telegram/triggers)의 필드명·형식 오기 정정뿐이다. 아래는 현재 `HEAD`(`83d5f3f94`)의
소스를 직접 `Read` 해 독립적으로 재검증한 결과다.

## 확인된 것 — CRITICAL 두 건 모두 현재 소스에서 닫혀 있음을 직접 재검증

- **R-CC-10 single-path 우회 — 닫힘.** `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts`
  의 `ChatChannelUpdateConfigDto`(`OmitType(ChatChannelConfigDto, ['botToken', 'inboundSigningPlaintext'])`
  + 두 필드 재선언에 `@IsEmpty()`)가 PATCH 전용으로 분리돼 있고, `update-trigger.dto.ts` 의
  `chatChannel` 필드 타입이 이 DTO 로 교체돼 있다. 서비스 층 `triggers.service.ts` 의
  `assertPatchCarriesNoSecrets`(`typeof carried.botToken !== 'undefined'` / `inboundSigningPlaintext`
  동일)가 `@IsEmpty()` 가 통과시키는 `null`/`''` 변형까지 이중으로 막는다 — 두 레이어 모두 직접
  코드를 읽어 확인했다. `assertChatChannelInputSafe` 가 이제 `mode: 'create' | 'update'` 를 받는
  **함수 오버로드 2개**로 선언돼 있어(`chatChannel: ChatChannelConfigDto, mode: 'create'` vs
  `chatChannel: ChatChannelUpdateConfigDto, mode: 'update'`), 문자열 판별자와 DTO 타입의 짝이
  깨지면 컴파일이 실패한다 — 이 함수가 지키는 보안 결함 클래스(모드-타입 불일치로 검증 우회)가
  타입 레벨에서도 재발 방지된다.
- **`inboundSigningRef` fail-open — 닫힘, 대칭 확인.** `setupChatChannel`
  (`triggers.service.ts:1075-1260`)의 `inboundSigningRefSurvives = providerIssuedStored ||
  Boolean(preservedInboundSigningRef)` 가 `internalCfg`(성공 경로 전 조립), `mergedChannel`(성공
  경로 최종 값), catch 블록의 `fallbackConfig`(`internalCfg` 재사용) 세 자리 모두에 동일하게
  적용됨을 확인했다. `update()`(`:526-528`)가 `mergeExternalConfig` 로 `config.chatChannel` 을
  통째로 교체하기 **전에** `previousInboundSigningRef` 를 캡처해 `setupChatChannel` 에 넘기므로,
  slack/discord PATCH 가 사용자 비밀 없이 편집돼도 기존 `inboundSigningRef` 가 살아남는다 —
  이 값이 없으면 `ChatChannelInboundAuthenticator` 가 `if (!config.inboundSigningRef) return;` 로
  서명 검증 자체를 건너뛰므로(인입 웹훅 인증 우회), 이 대칭이 이 PR 의 핵심 보안 수정이다.
- **최초 setup 의 조용한 실패-은폐 — 닫힘.** `assertChatChannelAlreadySetUp` 이 `chatChannel.provider`
  가 없는 트리거에 PATCH 로 처음 채널을 붙이려는 요청을 명시적 400 으로 거부한다 — 이게 없으면
  `setupChannel` 이 필연적으로 실패(비밀을 실을 방법이 없음)하고 그 실패가 CCH-SE-01 의
  best-effort catch 에 삼켜져 `chatChannelHealth=degraded` 로 조용히 200 성공 처리된다.
- **provider 전환 차단 — 닫힘.** 같은 함수가 `incoming.provider !== current.provider` 를 400 으로
  막는다 — 허용하면 재유도되는 `botTokenRef`(trigger id 로만 유도)가 가리키는 옛 provider 의
  평문을 새 provider adapter 가 그대로 사용하게 되는 별개의 credential-confusion 경로가 열린다.
- **인가/인증 데코레이터 불변.** `triggers.controller.ts` 의 `@Roles('editor')`/`@ApiBearerAuth`
  등은 이번 diff 로 변경되지 않았고, 변경 범위는 `@ApiBadRequestResponse` 설명 텍스트뿐이다.
- **응답 sanitize 불변·유지.** `sanitizeForResponse` 의 `CHAT_CHANNEL_RESPONSE_STRIP_KEYS`(botTokenRef·
  inboundSigningRef·botToken·inboundSigning·inboundSigningPlaintext 5키)는 이번 diff 로 변경되지
  않았고 여전히 응답 경계에서 비밀을 strip 한다.
- **인젝션 표면 없음.** `triggerRepository.save/update/findOne` 은 전부 TypeORM 파라미터화 API 이고,
  이번 diff 에 raw SQL·문자열 조합 쿼리·신규 커맨드 실행이 없다. `SLACK_SIGNING_SECRET_REGEX`
  (`/^[a-f0-9]{32}$/`) / `DISCORD_PUBLIC_KEY_REGEX`(`/^[a-f0-9]{64}$/`)는 고정 길이 앵커 패턴이라
  ReDoS 표면이 없다(`codebase/packages/chat-channel-validation/src/index.ts` — 이번 diff 밖).
- **하드코딩된 시크릿 없음.** 테스트 fixture 의 `'111:TestToken'`, `'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6'`
  류는 실제 자격증명 패턴이 아닌 합성 값이고, `trigger-workflow-ref.e2e-spec.ts` 의 case E 는
  오히려 이전에 실려 있던 실제 형태의 `botToken: '111:e2eWfRefBotToken'` 을 이번 diff 로 **제거**해
  R-CC-10 우회 재현 바디를 폐기했다.
- **round-2 신규 테스트가 측정 범위 오류를 스스로 정정.** `trigger-dto-validation.spec.ts` 의
  `[실측]` 테스트 두 개가 "비어있지 않은 값" 갈래(전역 파이프 거부 → 중첩 경로 `chatChannel.<field>`,
  배열 `details`)와 "null/빈 문자열" 갈래(`@IsEmpty()` 통과 → 서비스 가드 거부 → flat 이름, 단일
  object `details`)를 분리해 각각 단언한다 — 두 갈래 모두 어딘가에서 반드시 거부됨을 직접 재현해
  확인했다(코드를 다시 읽고 `it.each` 케이스의 기대값과 `assertPatchCarriesNoSecrets`/
  `CustomValidationPipe` 동작을 대조).

## 발견사항 — 신규 CRITICAL/WARNING 없음, 기존에 등재된 항목만 재확인

- **[INFO]** (사전 존재, 이번 diff 스코프 밖 — 이미 중앙 트래커 등재) `ChatChannelConfigDto.botToken`
  이 Swagger 로 `minLength: 1` 을 명시하지만 `@MinLength` validator 가 없어 **생성(POST) 경로**에서
  빈 문자열 bot token 이 통과할 수 있다.
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:174-187`
    (`@IsString() @MaxLength(256) botToken: string;` — `@MinLength` 없음).
  - 상세: 직접 재확인 — 현재도 `@MinLength` 데코레이터가 없다. 생성 경로에서
    `chatChannelCfg.botToken ?? ''` 가 `secrets.rotate()` 에 그대로 전달되므로(`triggers.service.ts`
    setupChatChannel `[쓰기 ①]`), 빈 문자열이 "정상 저장된 토큰"처럼 secret store 에 기록될 수
    있다. 이 PR 은 PATCH 축(`ChatChannelUpdateConfigDto`)만 게이팅했고 생성 DTO(`ChatChannelConfigDto`)
    는 애초에 diff 범위(파일 상단 import 1줄 + 하단 신규 클래스 추가)에 포함되지 않았다. 권한
    우회는 아니다(같은 워크스페이스 editor 가 자신의 트리거를 스스로 무력화하는 수준) — 다만
    조용히 무효한 비밀이 저장되는 입력 검증 공백이다. `plan/in-progress/spec-draft-nullable-notation-followups.md`
    에 *"`ChatChannelConfigDto.botToken` 이 swagger 로 minLength:1 을 약속하는데 validator 가
    없다"* 로 이미 등재돼 있음을 확인했다.
  - 제안: 이번 PR 을 막을 사유 아님 — 별도 후속에서 `@MinLength(1)` 또는 provider 별 형식
    정규식(telegram `\d+:[A-Za-z0-9_-]+`)추가를 권고. 이미 트래커에 있으므로 재등재 불요.

- **[INFO]** (사전 존재 설계 위에 새 보안 불변식이 얹힘, 이번 diff 신규 결함 아님 — 이미 중앙
  트래커 등재) 동시 PATCH 가 `trigger.config` 를 잃을 수 있고(lost update), 이 경로로 이번 PR 이
  막 닫은 `inboundSigningRef` fail-open 이 **동시성 타이밍**을 통해 재발할 이론적 여지가 있다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `update()` 의 `findById` →
    `assertChatChannelAlreadySetUp` → `previousInboundSigningRef` 캡처 → `save()` →
    `setupChatChannel()`(외부 adapter HTTP 호출 포함) 구간 전체.
  - 상세: `Trigger` 엔티티에 낙관적 잠금(`@VersionColumn`)이 없고 이 read-modify-write 구간을
    감싸는 트랜잭션·행 잠금도 없다 — `concurrency`/`database` reviewer 가 이전 라운드에서 이미
    이 지점을 독립적으로(WARNING·INFO) 잡았고, 처방(advisory lock / `SELECT ... FOR UPDATE`)이
    `update()` 와 자매 함수 `rotateChatChannelBotToken()` 을 함께 바꿔야 해 이 PR 범위를 넘는다는
    이유로 중앙 트래커에 등재돼 있음을 `plan/in-progress/spec-draft-nullable-notation-followups.md`
    에서 확인했다. 이 diff 가 새로 만든 취약점이 아니라 CCH-SE-01 의 기존 best-effort 2단계
    커밋 설계 위에 새 상태(`previousInboundSigningRef`)를 얹은 것이다.
  - 제안: 이번 PR 을 막을 사유 아님(등재된 후속 항목과 동일). 다만 실제 동시 PATCH 트래픽이
    관측되거나 이 클래스의 다른 필드가 또 문제되면, 등재된 처방(트리거 단위 잠금)을 우선순위
    상향할 것을 재차 권고.

- 그 외 신규 CRITICAL/WARNING 급 보안 결함은 발견하지 못했다. 이번 라운드에 새로 추가된 애플리케이션
  코드(컨트롤러 Swagger 문구, 서비스 함수 오버로드 시그니처)는 런타임 검증 로직을 바꾸지 않는
  컴파일 타임/문서 보강이라 별도 보안 표면을 만들지 않는다.

## 요약

이 PR 은 실재했던 CRITICAL(R-CC-10 single-path 우회)과 그 수정 도중 스스로 만들었다가 같은
세션의 리뷰가 잡아낸 CRITICAL(`inboundSigningRef` fail-open — 인입 웹훅 서명 검증 우회)을 모두
닫는다. 이번(3라운드) diff 는 그 위에 이전 라운드 WARNING(측정 범위·문서 정확성·타입 결속·테스트
커버리지) 후속 조치만 얹었고, 소스를 직접 읽어 대조한 결과 새로운 런타임 로직 변경이나 신규 보안
표면은 없다. 인가·인증 데코레이터, 응답 sanitize, 인젝션 방어(파라미터화 쿼리, 앵커드 정규식) 모두
불변으로 유지된다. 남은 항목(생성 경로 `botToken` `@MinLength(1)` 부재, 동시 PATCH lost-update
경로)은 둘 다 이번 PR 신규 결함이 아니고 developer SKILL §수렴 예외 (a)(b)(c) 근거와 함께 중앙
트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md`)에 이미 등재돼 있어, 이번
PR 을 막을 사유가 아니다.

## 위험도

LOW
