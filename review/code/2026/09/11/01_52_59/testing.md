# 테스트(Testing) 코드 리뷰 — `impl-chat-channel-patch-token` (`01_52_59`)

## 검증 방법

이 라운드는 직전 전수 라운드(`review/code/2026/09/11/01_27_26`)가 발견한 WARNING(내부
3필드 `botTokenRef`·`inboundSigningRef`·`inboundSigning` 의 `null`/`''` 무방비)을 닫은
직후 커밋(`84a6aeaa8`)을 대상으로 한다. 재작업이 아니라 **그 fix 가 실제로 효과가 있는지
독립 재검증**에 집중했다.

- `npx jest src/modules/triggers/dto/trigger-dto-validation.spec.ts src/modules/triggers/triggers.service.spec.ts`
  → **187 passed, 1 skipped, 188 total** (직전 라운드 182 + 신규 `it.each` 6조합 = 188, 일치).
- `npx jest src/modules/triggers` (모듈 전체) → **213 passed, 1 skipped, 214 total**, 6 suites 전부 통과.
- `npx jest src/repo-guards/__tests__/swagger-dto-contract.spec.ts` → 39 passed — 신설
  `ChatChannelUpdateConfigDto`(`OmitType`)가 이 정적 가드를 깨지 않음을 확인.
- **직접 뮤테이션으로 fix 를 재검증했다.** `triggers.service.ts:658`
  (`if (typeof blocked.inboundSigningRef !== 'undefined')`)을 falsy 체크
  (`if (blocked.inboundSigningRef)`)로 완화한 뒤 위 두 spec 을 재실행 → **2건 RED**
  (`inboundSigningRef: telegram 인 경우도 서비스가 400 으로 잡는다 (null / 빈 문자열)`).
  직전 라운드가 같은 뮤테이션에서 "207개 전부 GREEN(무방비)"이라 보고했던 것과 대조적으로,
  이번 fix 이후에는 정확히 그 축이 RED 로 걸린다 — **WARNING 이 실제로 닫혔다.**
  검증 절차: 원본을 `/private/tmp/.../scratchpad/triggers.service.ts.orig` 로 `cp` 해 백업 →
  `sed` 로 658행만 in-place 수정 → 테스트 재실행 → `cp` 로 즉시 원복 → `diff` 로 바이트
  동일 확인 + `git status --short` 로 저장소에 잔여 변경 없음 확인(둘 다 통과, 이 세션의
  리뷰 출력 디렉터리 외 다른 변경 없음).

## 발견사항

- **[INFO]** 내부 3필드(`botTokenRef`·`inboundSigningRef`·`inboundSigning`)의 `null`/`''`
  회귀 방어는 **서비스 층에서만** 고정됐고, DTO 층("`CustomValidationPipe` 를 통과한다")은
  여전히 `botToken`/`inboundSigningPlaintext` 두 필드만 돈다.
  - 위치: `codebase/backend/src/modules/triggers/dto/trigger-dto-validation.spec.ts` —
    `it('[실측] 값이 null/빈 문자열이면 DTO 를 통과한다 — 거부는 서비스 층이다', ...)`
    (`describe('ChatChannelUpdateConfigDto — PATCH 는 비밀을 받지 않는다 (R-CC-21 / D-1)')` 내부).
  - 상세: 실제 방어(400 을 던지는 지점)는 서비스의 `assertChatChannelInputSafe` 이고, 그
    쪽은 이번 커밋으로 3필드×2값 6조합이 추가돼 뮤테이션으로 검증됐다(위 참조). DTO 층
    테스트는 "다섯 필드 모두 같은 `@IsEmpty()` 데코레이터를 쓴다"는 선언적 사실로부터
    `botTokenRef`/`inboundSigningRef`/`inboundSigning` 도 같은 방식으로 통과하리라 추론
    가능하지만, 그 추론을 고정하는 테스트는 없다 — 만약 이 세 필드 중 하나에만 다른
    validator(`@IsOptional()` 없이 `@IsString()` 등)가 실수로 얹히면 DTO 층에서 조용히
    막힐 뿐 실패 방향(더 엄격해짐)이라 보안 회귀는 아니지만, "다섯 필드가 대칭"이라는
    이 파일의 핵심 주장(`[실측] 차단 5필드의 details.field...`) 자체는 null/`''` 갈래에서
    미완성으로 남는다.
  - 제안: 위 `[실측]` 케이스의 배열에 `botTokenRef`/`inboundSigningRef`/`inboundSigning`
    3필드를 추가해 5필드 전부가 null/`''` 갈래에서도 대칭임을 DTO 레벨에서도 닫는 것을
    권한다. 차단 사유는 아님 — 실질 방어(서비스 층)는 이미 뮤테이션 검증됐다.

- **[INFO]** `assertChatChannelInputSafe` 오버로드(mode·DTO 타입 컴파일 타임 결속)에 대한
  타입 레벨 회귀 테스트가 없다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — 오버로드 시그니처
    3개(`private assertChatChannelInputSafe(...): void;` 2줄 + 구현 시그니처).
  - 상세: 이 오버로드는 "`mode: 'update'` 인데 생성용 DTO 를 넘긴다" 류의 짝 깨짐을
    **컴파일 타임에** 잡으려는 설계다(주석이 그 의도를 명시). 그런데 이 저장소의 4단계
    검증(lint/unit/build/e2e) 중 이 좁힘 자체를 표적으로 하는 것은 없다 — 오버로드를
    지우고 느슨한 단일 시그니처(`mode: ChatChannelInputMode`)로 되돌려도, 현재 두 호출부가
    이미 올바른 짝으로 호출하고 있으므로 `tsc`·jest 어느 쪽도 그 회귀를 감지하지 못한다.
    타입 레벨 방어가 "다음 호출부 추가 시 실수를 막는다"는 목적이라면, 그 목적 자체를
    직접 검증하는 것은 `// @ts-expect-error` 류의 타입 전용 테스트뿐인데 이 저장소에는
    그런 패턴이 이 파일 주변에 없다.
  - 제안: 우선순위 낮음 — private 메서드이고 호출부가 2곳뿐이라 실제 위험은 작다. 다음에
    호출부가 늘어나는 시점에 타입 전용 테스트 추가를 고려.

## 확인한 것 — 이전 라운드 결론이 유지되고 새 결함 없음

- **CRITICAL 회귀 방지 3종 재확인**: `inboundSigningRef` fail-open 회귀
  (`it.each(['slack','discord'])`), telegram 서버 발급 서명 재저장, `setupChannel` 실패
  경로에서의 ref 보존 — 3개 suite 모두 GREEN, 소스 대조로 `preservedInboundSigningRef`/
  `inboundSigningRefSurvives` 배선 불변 확인.
- **회귀 e2e (`trigger-workflow-ref.e2e-spec.ts` 케이스 E)**: `botToken` 을 뺀 새 바디로
  갱신됐고, `chatTriggerId` 는 `beforeAll` 에서 `chatChannel: {provider:'telegram', botToken}`
  로 생성돼 이미 setup 이 끝난 상태다 — PATCH 시 `assertChatChannelAlreadySetUp` 의
  "최초 설정 금지" 가드에 걸리지 않고, provider 도 동일(`telegram`)이라 "provider 전환 금지"
  가드에도 걸리지 않는다. 케이스가 의도한 축(`workflow` 관계 재조회)과 새 400 가드가
  서로 간섭하지 않음을 확인했다.
- **격리**: 신설 `describe('TriggersService — chatChannel PATCH 는 사용자 비밀을 쓰지 않는다
  (R-CC-21)')`의 각 `it` 가 `setup()` 을 호출해 매번 새 `Test.createTestingModule` 을
  만들고 mock 을 재생성한다 — 순서 의존성 없음. DTO spec 의 `run()` 헬퍼도 매 호출 순수.
- **가독성**: `cardBody`/`existing`/`persistedChannel` 헬퍼가 "무엇이 다른가"에만 집중하게
  하고, 각 `it` 제목이 축(D-1/D-2/D-3/§5.4.1)과 실패 시나리오를 명시해 실패 시 바로
  원인을 짚을 수 있다.
- **carry-over INFO (재확인만, 비차단)**: (1) `inboundSigningRef` 보존은 unit 레벨까지만
  검증되고 실제 webhook 서명 검증(`ChatChannelInboundAuthenticator`)까지 잇는 e2e 는 없다
  — PATCH 후 실제 서명된 웹훅이 통과하는지의 종단 검증은 여전히 부재. (2)
  `assertChatChannelAlreadySetUp` 의 `incoming.provider` falsy 분기는 HTTP 경로에서
  `provider` 가 DTO 필수라 실질 도달 불가(방어적 코드, 테스트 없음은 합리적). (3)
  `cardBody` fixture 리터럴이 두 spec 파일에 중복.
- 회귀 위험: `chat-channel-config.dto.ts`/`update-trigger.dto.ts`/`triggers.controller.ts`
  변경은 전부 이번 spec 들이 exercise 하는 표면 안에 있고, `slack.adapter.ts` 변경은
  JSDoc 주석뿐이라 테스트 대상 없음(정확한 판단).

## 요약

직전 라운드가 지적한 WARNING(`assertChatChannelInputSafe` 내부 3필드의 `null`/`''`
무방비)은 이번 커밋으로 실제로 닫혔다 — 서비스 스펙에 3필드×2값 6조합이 추가됐고,
동일 지점을 falsy 체크로 완화하는 뮤테이션을 독립적으로 재현해 정확히 그 6조합 중 2건이
RED 로 걸리는 것을 직접 확인했다(원복은 `cp`+`diff` 로 바이트 동일 검증, 저장소에 잔여
변경 없음). 모듈 전체(213/214)와 관련 정적 가드(`swagger-dto-contract` 39건)도 그린이다.
남은 것은 이전 라운드부터 이어지는 세 INFO(웹훅 서명 검증까지 잇는 e2e 부재·
`incoming.provider` 방어적 분기 미검증·fixture 중복)와, 이번에 새로 짚은 두 INFO(DTO
층에서 내부 3필드의 null/`''` 통과를 명시적으로 고정하지 않음·오버로드 타입 결속의
타입 레벨 회귀 테스트 부재)뿐이며 전부 즉시 차단 사유가 아니다.

## 위험도

LOW
