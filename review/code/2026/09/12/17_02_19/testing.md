# 테스트(Testing) 리뷰 — chat-channel-rules-cleanup (라운드 3, `17_02_19`)

## 검토 방법

`chat-channel-input-rules.{ts,spec.ts}` · `chat-channel-rejection-messages.const.ts` ·
`dto/chat-channel-config.dto.ts` · `dto/responses/chat-channel-rotate-bot-token-response.dto.ts`
(신규, 라운드 2 에서 `dto/responses/` 로 이동) · `dto/trigger-dto-validation.spec.ts` ·
`triggers.controller.ts` · `triggers.service.ts` 를 `Read` 로 전체 열어 diff 게이트와 대조했다.
회귀 확인을 위해 `triggers.controller.spec.ts` · `triggers.service.spec.ts` 도 함께 열었다.
저장소 파일은 쓰지 않았다(`git status --short` 로 확인 — 이 리뷰가 만든 미커밋 변경은 본 출력
디렉터리뿐).

**직전 라운드(`16_39_18`) testing WARNING 재검증**: orphan JSDoc 지적("두-층 등가성" 코멘트와
"대칭 필드도 막는다" 코멘트가 각자의 테스트에서 갈라져 있었다)이 이번 라운드에서 실제로
정정됐음을 확인했다 — 지금은 `chat-channel-input-rules.spec.ts:84-93`(두-층 등가성 JSDoc)
바로 뒤에 그 대상 `it.each`(`:94-125`)가, `:127-131`(대칭 필드 JSDoc) 바로 뒤에 그 대상
테스트(`:132-142`)가 온다 — 코멘트-테스트 인접성 복원 확인.

## 발견사항

- **[WARNING]** 이 PR 자신이 낸 CRITICAL(Swagger DTO 클래스명 충돌)의 재발을 막는 자동화된
  회귀 테스트가 없다 — 해소 확인이 1회성 수동 `grep` 스크립트에만 의존한다
  - 위치: `codebase/backend/src/repo-guards/__tests__/`(대상 디렉터리 — 해당 가드 부재).
    근거: `review/code/2026/09/12/16_39_18/RESOLUTION.md:25-26`("잔여 0 을 실측했다:
    `codebase/backend/**/*.dto.ts` 의 `export class` **256개**를 전수 스캔해 동명 중복 **0건**
    확인(스크립트로 셌다)")와 `review/code/2026/09/12/16_39_18/api_contract.md:9-12`(동일 grep
    을 다른 reviewer 가 재현).
  - 상세: 라운드 1(`16_17_57`)에서 신규 응답 DTO(`ChatChannelBotIdentityDto`, 지금은
    `ChatChannelRotateBotIdentityDto`)가 기존 `chat-channel-config.dto.ts` 의 동명 클래스와
    충돌해 `@nestjs/swagger` 스키마 레지스트리를 오염시키는 CRITICAL 이 나왔다. 조치는
    클래스 개명이었고, "해소됐다"는 근거는 두 라운드(`16_39_18`) 모두 **일회성 `grep -rhoE
    "export class …" | sort | uniq -c`** 실행 결과였다 — 이 검증은 커밋되지 않았고 CI/jest
    어디에도 남지 않는다. 이 저장소는 정확히 이런 정적 결함 클래스를 위한 선례
    (`repo-guards/__tests__/swagger-dto-contract.spec.ts` — nullable/optional 선언 불일치를
    `collectTsFiles` 로 전수 스캔해 jest 로 고정)를 이미 갖고 있는데, "DTO 클래스명
    유일성"에는 그 패턴이 적용돼 있지 않다. 다음 PR 이 또 다른 응답 DTO 를 추가하면서 같은
    이름을 재사용해도 잡아 줄 게이트가 없다 — 이번에 발생한 결함이 **바로 그 재발 시나리오의
    실제 사례**였다.
  - 제안: `swagger-dto-contract.spec.ts` 와 같은 자리에 `export class [A-Za-z0-9_]+` 를
    `**/*.dto.ts` 전수 스캔해 이름 중복이 0건임을 고정하는 jest 케이스를 추가할 것(라운드 2가
    이미 실행한 grep 로직을 스크립트가 아니라 테스트로 승격).

- **[INFO]** `TriggersService.rotateBotToken()` 반환 타입을
  `NonNullable<ChatChannelConfig['botIdentity']>` 로 넓힌 수정(Discord `publicKey` 누락 W1)이
  런타임 테스트로는 여전히 단언되지 않는다 — 다만 이는 직전 라운드가 이미 지목하고 plan 이
  defer 한 `response-contract` 미배선 이월 항목의 구체 사례라 새 결함은 아니다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:990-998`(타입 선언)·
    `:1126`(`botIdentity: mergedChannel.botIdentity ?? null` — 스프레드로 전체 객체를 그대로
    반환하므로 런타임 위험 자체는 낮다). 테스트 쪽은
    `codebase/backend/src/modules/triggers/triggers.service.spec.ts:2095-2130`(`botIdentity`
    관련 두 테스트 모두 `{ botId, username }` 만 mock — `teamId`/`publicKey` 케이스 없음).
    저장소 전체에서 `grep -rn "publicKey" codebase/backend/src/modules/triggers/**/*.spec.ts`
    가 0건임을 확인.
  - 상세: `mergedChannel = { ...mergedConfig, ...(result.configUpdates ?? {}), ... }` 형태의
    전체 스프레드라 `publicKey` 가 실려 있으면 자연히 통과한다 — 지금 당장 깨질 위험은 낮다.
    다만 이 스프레드가 나중에 명시적 필드 나열(`{ botId, username, teamId }`)로 바뀌면
    `publicKey` 가 조용히 사라져도 어떤 테스트도 RED 가 되지 않는다. 신규 응답 DTO 필드
    (`publicKey?`)가 방금 도입된 시점이라 "타입이 넓어졌으니 안전하다"는 근거를 실측으로
    보강할 시점이기도 하다.
  - 제안: 급하지 않음(직전 라운드 INFO 로 이미 이월·defer 확정). 재개 시
    `triggers.service.spec.ts` 의 두 `botIdentity` 테스트 중 하나에 `configUpdates:
    { botIdentity: { botId, username, publicKey: 'pk' } }` 케이스를 추가해 통과 여부를
    실측으로 고정하는 안을 고려.

- **[INFO, 이월 — 이 라운드 신규 아님]** `assertChatChannelAlreadySetUp` 의
  `incoming.provider &&` falsy-guard 가 `chat-channel-input-rules.spec.ts` 단독으로는 여전히
  검증되지 않는다
  - 위치: `chat-channel-input-rules.ts:222`, `chat-channel-input-rules.spec.ts:295-304`(기존
    3개 테스트 모두 `provider` truthy 인 `cfg()` 사용).
  - 상세: "도달 불가" 주장의 절반(HTTP 경로 차단)은 `dto/trigger-dto-validation.spec.ts:814-822`
    가 실제 `CustomValidationPipe` 로 고정했고 이는 라운드 1 이 요구한 증거로 타당하다. 다만
    함수 자체의 falsy 무시 동작은 이 파일 하나만 읽어서는 완결되지 않는다 — 직전 라운드
    testing.md 가 이미 지적했고 plan §설계 판단 (3)이 의도적으로 defer 한 상태 그대로다.
  - 제안: 급하지 않음. 재발 방지 차원에서
    `assertChatChannelAlreadySetUp(existing, cfg({ provider: undefined }))` 단일 케이스를
    추가하면 "도달 불가" 주장이 이 파일 안에서도 완결된다.

## 긍정적으로 확인한 부분

- **직전 라운드 WARNING(orphan JSDoc) 실제로 정정됨**: 위 "검토 방법" 참조 — 코멘트-테스트
  인접성이 복원됐다.
- **`hasField` 두-층 등가성 뮤테이션 고정**: `null`/`''` 케이스(`:94-125`)가 존재-판별을
  truthy-판별로 퇴화시키는 뮤턴트를 잡는다는 것을 직전 라운드가 이미 독립 재현으로 확인했고,
  이번 라운드 diff 로 로직이 다시 흔들리지 않았음을 대조 확인했다.
- **`update` × 내부 필드 3종 순서 검증(`:163-173`)** 과 **provider label 스왑 이중 단언
  (`:238-254`, `toContain`+`not.toContain`)**: 판별 가능한 fixture 로 구성돼 vacuous 하지
  않다.
- **`trigger-dto-validation.spec.ts` provider 필수 테스트(`:814-822`)**: 새 mock 을 추가하지
  않고 기존 `run()`/`CustomValidationPipe` harness 를 재사용 — 테스트 용이성이 좋다.
- **테스트 격리**: 모든 신규 테스트가 `cfg()`/`thrown()` 헬퍼로 매 호출 새 객체를 만들고 공유
  mutable 상태가 없다.
- **회귀**: 순수 헬퍼 추출(`throwInvalidField`/`hasField`/`rejectBlockedField`)이 기존 11개
  `throw` 지점의 에러 봉투 형태(`code`/`details.field`/`details.code`)를 바꾸지 않았음을 소스
  대조로 확인 — 기존 테스트 무편집 통과 주장과 일치한다.

## 요약

이번 라운드는 순수 조치 라운드로, 직전 라운드 testing WARNING(orphan JSDoc)이 실제로
정정됐음을 확인했다. 신규 발견은 하나뿐이다 — 이 PR 자신이 이미 한 번 만들었던 Swagger DTO
클래스명 충돌 결함의 재발 방지가 커밋되지 않는 1회성 grep 검증에만 의존하고, 저장소가 이미 갖춘
`repo-guards` 정적 스캔 패턴이 이 결함 클래스에는 적용돼 있지 않다(WARNING). 그 외 두 건은
직전 라운드부터 이어지는 저위험 이월 항목(`response-contract` 미배선의 구체 사례, falsy-guard
단일 파일 미검증)으로 plan 이 의도적으로 defer 했고 이번 라운드가 새로 만든 결함이 아니다.
핵심 리팩터(`throwInvalidField`/`hasField`/`rejectBlockedField`)와 신규 테스트들은 판별 가능한
fixture 로 구성돼 있고 격리·가독성·회귀 관점에서 양호하다.

## 위험도

LOW
